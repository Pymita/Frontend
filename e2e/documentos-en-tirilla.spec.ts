import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, expectNoBrowserMargin, loginUI } from './helpers'

/**
 * Un computador con impresora térmica (sin RawBT) que eligió "Facturas,
 * recibos y cierres de caja también en tirilla": la factura sale como
 * tirilla en su ventana de impresión, no como hoja carta.
 */
test('en el computador, con documentos en tirilla la factura sale en una ventana de tirilla y no en hoja', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Factura PC ${Date.now()}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: `Ron de prueba ${Date.now()}`, type: 'final', unit: 'und', sale_price: 61000,
      tracks_stock: false, category_id: (await category.json()).data.id,
    },
  })
  await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Factura PC E2E', items: [{ product_id: (await product.json()).data.id, quantity: 1 }] },
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.addInitScript(() => localStorage.setItem(
    'pos.ticketPrinter',
    JSON.stringify({ mode: 'browser', paper: 80, cut: true, documents: 'ticket' }),
  ))
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: 'Mesa Factura PC E2E' }).first().getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Generar factura' }).click(),
  ])
  const body = ticket.locator('.ticket')
  await expect(body).toContainText('$61.000')
  await expect(body).toContainText('Ron de prueba')
  await expect(body).toContainText('SON:')
  // A ticket, not the sheet with its paper toolbar.
  await expect(ticket.locator('.toolbar')).toHaveCount(0)
  // Without the browser's date and title line above the ticket.
  await expectNoBrowserMargin(ticket, 2, 'body')
  await ticket.screenshot({ path: '../screenshots/factura-en-tirilla-80mm.png', fullPage: true })
  const widest = Math.max(...(await body.innerText()).split('\n').map(line => line.length))
  expect(widest).toBeLessThanOrEqual(38)
})
