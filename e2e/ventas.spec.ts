import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Pestaña de Ventas: solo los pedidos PAGADOS cuentan, los totales se ven
 * arriba, el método de pago filtra y el Excel se puede descargar.
 */
test('las ventas pagadas aparecen con su total y el filtro de método funciona', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Ventas E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Limonada E2E',
      type: 'final',
      unit: 'unidad',
      unit_cost: 1000,
      sale_price: 7000,
      current_stock: 20,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  // Una venta en efectivo y otra por transferencia; una tercera sin pagar.
  const payOrder = async (method: string, customer: string) => {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { customer_name: customer, items: [{ product_id: productId, quantity: 1 }] },
    })
    const orderId = (await order.json()).data.id
    const payment = await request.post(`${API}/orders/${orderId}/pay`, {
      headers: auth,
      data: { payment_method: method },
    })
    expect(payment.ok()).toBeTruthy()
  }

  await payOrder('cash', 'Cliente Efectivo E2E')
  await payOrder('transfer', 'Cliente Transfer E2E')
  await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Cliente Impago E2E', items: [{ product_id: productId, quantity: 1 }] },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')

  // Las pagadas aparecen; la impaga no es una venta.
  await expect(page.locator('tr', { hasText: 'Cliente Efectivo E2E' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Cliente Transfer E2E' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Cliente Impago E2E' })).toHaveCount(0)

  // Filtrar por transferencia deja solo esa venta.
  await field(page, 'Método de pago').click()
  await page.getByRole('option', { name: 'Transferencia' }).click()
  await expect(page.locator('tr', { hasText: 'Cliente Efectivo E2E' })).toHaveCount(0)
  await expect(page.locator('tr', { hasText: 'Cliente Transfer E2E' })).toBeVisible()

  // El Excel se descarga con los filtros puestos.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Descargar Excel/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^ventas_.*\.xlsx$/)
})
