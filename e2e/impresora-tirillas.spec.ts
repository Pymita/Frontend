import { expect, test, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Pantallas POS Android con impresora térmica integrada ("3 en 1"): la
 * ventana emergente de impresión allá es una pestaña con la tirilla y una X
 * que nunca imprime. Cada equipo elige en "Impresora de este equipo" cómo
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
  await page.getByRole('button', { name: 'Impresora de este equipo' }).click()
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

/** This device's printer settings, as "Impresora de este equipo" stores them. */
async function useTicketPrinter(page: Page, settings: object) {
  await page.addInitScript(value => localStorage.setItem('pos.ticketPrinter', value), JSON.stringify(settings))
}

test('con documentos en tirilla, la factura de una venta sale por RawBT con sus líneas, totales y firmas', async ({ page, request }) => {
  await seedOrder(request, 52000, 'Mesa Factura Tirilla E2E')
  await useTicketPrinter(page, { mode: 'rawbt', paper: 58, cut: true, documents: 'ticket' })
  const device = await watchDevice(page)
  let popups = 0
  page.on('popup', () => { popups++ })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: 'Mesa Factura Tirilla E2E' }).first().getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar cobro' }).click()
  await page.getByRole('button', { name: 'Generar factura' }).click()

  const sendButton = page.getByRole('button', { name: 'Enviar a la impresora' })
  await expect.poll(async () => (await device()).intents.length > 0 || await sendButton.isVisible()).toBe(true)
  if (!(await device()).intents.length) await sendButton.click()
  await expect.poll(async () => (await device()).intents.length).toBe(1)
  expect(popups).toBe(0)

  const url = (await device()).intents[0]!
  const bytes = Buffer.from(url.slice('intent:base64,'.length, url.indexOf('#')), 'base64')
  const text = bytes.toString('latin1')
  const lines = text.slice(5).split('\n')
  // 58 mm: nothing wider than 32 columns.
  expect(Math.max(...lines.map(line => line.replace(/[\x00-\x1f]/g, '').length))).toBeLessThanOrEqual(32)
  expect(text).toMatch(/No\. /)
  expect(text).toContain('Aguardiente')
  expect(text).toContain('$52.000')
  expect(text).toContain('SON:')
  expect(text).toContain('TOTAL')
  expect(text).toContain('_'.repeat(30))
  // One document, one cut at its end.
  expect(text.split('\x1d\x56\x42').length).toBe(2)
})

test('en Android una factura en hoja, desde Ventas, se abre sobre la misma pantalla, imprime y se cierra', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Hojas ${Date.now()}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: `Empanada ${Date.now()}`, type: 'final', unit: 'und', sale_price: 61000, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  const customerName = `Cliente Hoja Android ${Date.now()}`
  const customer = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: String(Date.now() % 1_000_000_000), name: customerName },
  })
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: (await product.json()).data.id, quantity: 1 }] },
  })
  const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, {
    headers: auth,
    data: { payment_method: 'cash', customer_id: (await customer.json()).data.id },
  })
  expect(paid.ok(), await paid.text()).toBe(true)

  await useTicketPrinter(page, { mode: 'browser', paper: 80, cut: true, documents: 'sheet' })
  const device = await watchDevice(page)
  let popups = 0
  page.on('popup', () => { popups++ })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')
  // The device's printer is set up from any page, not only Pedidos.
  await expect(page.getByRole('button', { name: 'Impresora de este equipo' })).toBeVisible()

  await page.locator('tr', { hasText: customerName }).first().getByRole('button', { name: /^Imprimir / }).click()
  const frame = page.frameLocator('iframe[data-document-print]')
  await expect(frame.locator('.sheets')).toContainText('$61.000')
  await expect(frame.locator('.sheets')).toContainText(customerName)
  await page.screenshot({ path: '../screenshots/factura-hoja-android-1280.png' })
  await frame.getByRole('button', { name: 'Imprimir o guardar en PDF' }).click()
  await expect.poll(async () => (await device()).printed).toBe(1)
  expect(popups).toBe(0)

  await frame.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.locator('iframe[data-document-print]')).toHaveCount(0)
})
