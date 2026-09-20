import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Ventas: además del listado, un resumen por producto (unidades, neto,
 * ganancia) y por mesa, cada uno descargable en Excel con los mismos filtros.
 */
test('resumen por producto y por mesa con descarga a Excel', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Resumen E2E' } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Empanada Resumen',
      type: 'final',
      unit: 'und',
      unit_cost: 1000,
      sale_price: 2500,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  // Una mesa libre de las que ya tiene el negocio (crear otra puede chocar
  // con el límite del plan).
  const tables = await request.get(`${API}/tables/available`, { headers: auth })
  const freeTable = (await tables.json()).data.find((t: any) => t.status === 'available')
  const tableId = freeTable.id
  const tableName: string = freeTable.display_name

  for (const quantity of [3, 1]) {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { dining_table_id: tableId, items: [{ product_id: productId, quantity }] },
    })
    const orderId = (await order.json()).data.id
    await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
  }

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')

  // Por producto: 4 unidades en 2 ventas, neto 10.000, ganancia 6.000.
  await page.getByRole('button', { name: 'Por producto' }).click()
  const productRow = page.locator('tr', { hasText: 'Empanada Resumen' })
  await expect(productRow).toContainText('Resumen E2E')
  await expect(productRow).toContainText('4')
  await expect(productRow).toContainText('$10.000')
  await expect(productRow).toContainText('$6.000')

  // Por mesa: la mesa 77 con sus 2 ventas.
  await page.getByRole('button', { name: 'Por mesa' }).click()
  const tableRow = page.locator('tr', { hasText: tableName }).first()
  await expect(tableRow).toContainText('2')
  await expect(tableRow).toContainText('$10.000')

  // El Excel descarga la vista activa.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toContain('ventas_por_mesa')
})
