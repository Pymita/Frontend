import { expect, test, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Pantallas POS Android con impresora térmica integrada ("3 en 1"): la
 * ventana emergente de impresión allá es una pestaña con la tirilla y una X
 * que nunca imprime. Cada equipo elige en "Impresora de tirillas" cómo
 * imprime: con el diálogo (en Android, desde la misma pantalla) o directo a la
 * impresora con RawBT (ESC/POS en un intent de Android).
 */

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 11; POS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

test.use({ userAgent: ANDROID_UA, viewport: { width: 1280, height: 800 } })

async function seedOrder(request: any, total: number, customer: string) {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Tirillas ${Date.now()}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: `Aguardiente ${Date.now()}`, type: 'final', unit: 'und', sale_price: total,
      tracks_stock: false, category_id: (await category.json()).data.id,
    },
  })
  await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: customer, items: [{ product_id: (await product.json()).data.id, quantity: 1 }] },
  })
}

/** Records print() calls and the intents handed to other apps, on the page and its frames. */
async function watchDevice(page: Page) {
  await page.addInitScript(() => {
    const seen = { printed: 0, intents: [] as string[] }
    Object.assign(window, { __device: seen })
    const top = window
    window.print = () => { seen.printed++ }
    const appendChild = Node.prototype.appendChild
    // Frames get their own print(): count it in the top window.
    HTMLElement.prototype.append = function (...nodes: (Node | string)[]) {
      nodes.forEach(node => {
        appendChild.call(this, typeof node === 'string' ? document.createTextNode(node) : node)
        if (node instanceof HTMLIFrameElement && node.contentWindow) {
          node.contentWindow.print = () => { (top as any).__device.printed++ }
        }
      })
    }
    HTMLAnchorElement.prototype.click = function () {
      if (this.href.startsWith('intent:')) seen.intents.push(this.href)
    }
  })
  return () => page.evaluate(() => (window as any).__device as { printed: number; intents: string[] })
}

test('en Android la cuenta se imprime en la misma pantalla, sin ventana emergente', async ({ page, request }) => {
  await seedOrder(request, 38000, 'Mesa Android E2E')
  const device = await watchDevice(page)
  let popups = 0
  page.on('popup', () => { popups++ })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  const row = page.locator('tr', { hasText: 'Mesa Android E2E' }).first()
  await row.getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Imprimir cuenta' }).click()

  const frame = page.frameLocator('iframe[data-ticket-print]')
  await expect(frame.locator('body')).toContainText('CUENTA DE COBRO')
  await expect(frame.locator('body')).toContainText('$38.000')
  await expect.poll(async () => (await device()).printed).toBe(1)
  expect(popups).toBe(0)
})

test('con RawBT la tirilla sale en ESC/POS, con tildes, 42 columnas y corte', async ({ page, request }) => {
  await seedOrder(request, 44000, 'Mesa RawBT E2E')
  const device = await watchDevice(page)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Impresora de tirillas' }).click()
  const settings = page.getByRole('dialog')
  await settings.getByText('Directo a la impresora térmica (Android)').click()
  await expect(settings.getByText('Instala RawBT')).toBeVisible()
  await page.screenshot({ path: '../screenshots/impresora-tirillas-rawbt-1280.png' })

  await settings.getByRole('button', { name: 'Imprimir tirilla de prueba' }).click()
  await expect(settings.getByRole('status')).toContainText(/RawBT|lista/)
  const sent = async () => (await device()).intents
  // The test click is a fresh tap: the intent goes at once.
  await expect.poll(async () => (await sent()).length).toBe(1)
  await settings.getByRole('button', { name: 'Cerrar' }).click()

  const row = page.locator('tr', { hasText: 'Mesa RawBT E2E' }).first()
  await row.getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Imprimir cuenta' }).click()
  // If the server outlived the tap, the snackbar offers the button that sends it.
  const sendButton = page.getByRole('button', { name: 'Enviar a la impresora' })
  await expect.poll(async () => (await sent()).length > 1 || await sendButton.isVisible()).toBe(true)
  if ((await sent()).length === 1) await sendButton.click()
  await expect.poll(async () => (await sent()).length).toBe(2)

  const url = (await sent())[1]!
  expect(url).toMatch(/^intent:base64,[A-Za-z0-9+/=]+#Intent;scheme=rawbt;package=ru\.a402d\.rawbtprinter;end;$/)
  const bytes = Buffer.from(url.slice('intent:base64,'.length, url.indexOf('#')), 'base64')
  // ESC @ (reset) and ESC t 2 (code page 850) first; GS V 66 (feed and cut) last.
  expect([...bytes.subarray(0, 5)]).toEqual([0x1b, 0x40, 0x1b, 0x74, 2])
  expect([...bytes.subarray(-4, -1)]).toEqual([0x1d, 0x56, 66])
  const text = bytes.toString('latin1')
  expect(text).toContain('CUENTA DE COBRO')
  expect(text).toContain('$44.000')
  // "ATENDIÓ" or "Impreso el ..." carry Spanish letters: no UTF-8 sequence reaches the printer.
  expect(text).not.toMatch(/\xc3[\x80-\xbf]/)
  const lines = text.slice(5).split('\n').filter(line => line.startsWith('---'))
  expect(lines[0]).toHaveLength(42)
})
