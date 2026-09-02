import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Resolución de facturación DIAN: el admin registra el rango autorizado,
 * cada venta toma el siguiente consecutivo y ese número queda como
 * referencia del movimiento en el kardex.
 */
test('la resolución numera las ventas y el consecutivo aparece en el kardex', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  // --- El admin registra la resolución por interfaz ---
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/configuracion')

  await page.getByLabel('Número de resolución *').fill('DIAN-18760001')
  await page.getByLabel('Prefijo').fill('POS')
  await page.getByLabel('Rango desde *').fill('500')
  await page.getByLabel('Rango hasta *').fill('600')
  await page.getByRole('button', { name: /Guardar resolución/ }).click()
  await expect(page.getByText('Resolución guardada')).toBeVisible()
  // Otros tests en paralelo pueden consumir consecutivos: solo se verifica
  // que el contador exista y esté dentro del rango.
  await expect(page.getByText(/Quedan \d+ consecutivos/)).toBeVisible()

  // --- Una venta toma el consecutivo (preparada por API) ---
  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Resolución E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Gaseosa E2E',
      type: 'final',
      unit: 'unidad',
      unit_cost: 2000,
      sale_price: 5000,
      current_stock: 10,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)
  const productId = (await product.json()).data.id

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      customer_name: 'Mesa Resolución',
      items: [{ product_id: productId, quantity: 1 }],
    },
  })
  expect(order.status()).toBe(201)
  const orderId = (await order.json()).data.id

  const payment = await request.post(`${API}/orders/${orderId}/pay`, {
    headers: auth,
    data: { payment_method: 'cash' },
  })
  expect(payment.ok()).toBeTruthy()

  // El consecutivo exacto depende de cuántas ventas hicieron los otros
  // tests: se lee del pedido y se busca ESE número en el kardex.
  const paidOrder = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const invoiceNumber: string = (await paidOrder.json()).data.invoice_number
  expect(invoiceNumber).toMatch(/^POS-\d+$/)

  // --- El kardex muestra el consecutivo como referencia ---
  await page.goto('/kardex')
  await page.getByRole('combobox', { name: 'Producto' }).click()
  await page.getByRole('option', { name: 'Gaseosa E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  const saleRow = page.locator('tr', { hasText: 'FV' }).first()
  await expect(saleRow).toBeVisible()
  await expect(saleRow).toContainText(invoiceNumber)
})
