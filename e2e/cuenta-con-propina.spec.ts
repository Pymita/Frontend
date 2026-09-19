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
  await expect(dialog.getByLabel('Propina (opcional)')).toHaveValue('3000')

  const [bill] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Imprimir cuenta' }).click(),
  ])
  const billText = await bill.locator('body').innerText()
  expect(billText).toContain('CUENTA DE COBRO')
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
