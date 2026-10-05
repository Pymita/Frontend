import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * La cuenta que se imprime ANTES de cobrar debe mostrar el total sin
 * propina, la propina sugerida y el total con propina, para que el cliente
 * elija. Se captura la ventana emergente de impresión y se lee su texto.
 */
test('la cuenta impresa muestra el total con y sin propina', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Cuenta E2E' } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Bandeja E2E', type: 'final', unit: 'plato', sale_price: 30000, tracks_stock: false, category_id: categoryId },
  })
  const productId = (await product.json()).data.id
  await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Cuenta E2E', items: [{ product_id: productId, quantity: 1 }] },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$30.000' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(dialog.getByLabel('Propina (opcional)')).toHaveValue('3.000')

  const [bill] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Imprimir cuenta' }).click(),
  ])
  // La ventana abre con "Generando…" y se llena cuando llega el recibo.
  await expect(bill.locator('body')).toContainText('CUENTA DE COBRO')
  const billText = await bill.locator('body').innerText()
  expect(billText).toContain('TOTAL SIN PROPINA')
  expect(billText).toContain('$30.000')
  expect(billText).toContain('PROPINA SUGERIDA 10%')
  expect(billText).toContain('$3.000')
  expect(billText).toContain('TOTAL CON PROPINA')
  expect(billText).toContain('$33.000')
  expect(billText).not.toContain('FACTURA DE VENTA')
  await bill.close()

  // Al cobrar con propina, la factura desglosa los dos totales.
  await expect(dialog.getByLabel('Imprimir la factura al cobrar')).toBeChecked()
  const [invoice] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Cobrar con propina' }).click(),
  ])
  await expect(page.getByText('Pedido cobrado con propina')).toBeVisible()
  await expect(invoice.locator('body')).toContainText('TOTAL PAGADO')
  const invoiceText = await invoice.locator('body').innerText()
  console.log(invoiceText)
  expect(invoiceText).toContain('TOTAL SIN PROPINA')
  expect(invoiceText).toContain('$30.000')
  expect(invoiceText).toContain('PROPINA VOLUNTARIA')
  expect(invoiceText).toContain('$3.000')
  expect(invoiceText).toContain('$33.000')
  expect(invoiceText).not.toContain('CUENTA DE COBRO')
})

/**
 * Propina posterior al cobro: el mesero cierra la cuenta y luego el cliente
 * deja propina. Desde el menú del pedido pagado se agrega con el endpoint
 * /orders/{id}/tip, sin volver a tocar inventario ni el consecutivo.
 */
test('se puede agregar propina a un pedido ya cobrado', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Propina Post E2E' } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Combo Propina E2E', type: 'final', unit: 'plato', sale_price: 37777, tracks_stock: false, category_id: categoryId },
  })
  const productId = (await product.json()).data.id
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Propina Post', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id
  // Se cobra sin propina (el cliente aún no decide).
  const paid = await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
  expect(paid.ok()).toBeTruthy()

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pagados' }).click()

  const row = page.locator('tr', { hasText: '$37.777' }).first()
  await expect(row).toBeVisible()
  await row.getByRole('button').filter({ has: page.locator('.mdi-dots-vertical') }).click()
  await page.getByText('Agregar propina').click()

  // "5.000", typed key by key, is five thousand pesos, in a field with no arrows.
  const dialog = page.getByRole('dialog')
  const tip = dialog.getByLabel('Propina', { exact: true })
  await expect(tip).not.toHaveAttribute('type', 'number')
  await tip.pressSequentially('5.000')
  await dialog.getByRole('button', { name: 'Agregar propina' }).click()
  await expect(page.getByText('Propina registrada')).toBeVisible()
  // The tip joins the order total: $37.777 + $5.000.
  await expect(page.locator('tr', { hasText: '$42.777' }).first()).toBeVisible()

  // El pedido sigue pagado y ahora lleva la propina (aparte de la venta).
  const after = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const data = (await after.json()).data
  expect(Number(data.tip)).toBe(5000)
  expect(data.payment_status).toBe('paid')
})
