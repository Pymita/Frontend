import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Gastos: lo que sale de caja. Un gasto es solo dinero; las unidades de una
 * compra entran por el kardex, así que registrar o borrar un gasto nunca
 * mueve el stock.
 *
 * Patrón: producto y categoría por API, el gasto por la interfaz.
 */
test('una compra de inventario registra el dinero, remite al kardex y borrarla no toca el stock', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()

  const productCategory = await request.post(`${API}/categories`, { headers: auth, data: { name: `Insumos ${stamp}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: `Harina Gasto ${stamp}`, type: 'raw_material', unit: 'kg', unit_cost: 2000,
      current_stock: 10, tracks_stock: true, category_id: (await productCategory.json()).data.id,
    },
  })
  const productId = (await product.json()).data.id
  const categoryName = `Compras E2E ${stamp}`
  await request.post(`${API}/expense-categories`, {
    headers: auth,
    data: { name: categoryName, type: 'inventory_purchase' },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Registrar gasto' }).click()

  const dialog = page.getByRole('dialog')
  await field(page, 'Categoría *').click()
  await page.getByRole('option', { name: new RegExp(categoryName) }).click()

  // Sin campos de producto: el aviso dice dónde entran las unidades.
  await expect(dialog.getByText('Este gasto registra el dinero de la compra.')).toBeVisible()
  await expect(dialog.getByRole('link', { name: 'Kardex › Registrar movimiento' })).toHaveAttribute('href', /\/kardex$/)
  await expect(dialog.getByLabel(/Producto/)).toHaveCount(0)
  await expect(dialog.getByLabel(/Cantidad comprada/)).toHaveCount(0)

  const concept = `Bulto de harina ${stamp}`
  await field(page, 'Monto *').locator('input').fill('60000')
  await dialog.getByLabel('Concepto / Descripción').fill(concept)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const row = page.locator('tbody tr', { hasText: concept })
  await expect(row).toBeVisible()
  await expect(row).toContainText(categoryName)

  // Borrar el gasto: pide confirmación en tú y el stock queda igual.
  page.once('dialog', confirmation => {
    expect(confirmation.message()).toContain('¿Seguro que quieres eliminar el gasto')
    confirmation.accept()
  })
  await row.getByRole('button', { name: `Eliminar el gasto ${concept}` }).click()
  await expect(row).toHaveCount(0)

  const stock = await (await request.get(`${API}/products/${productId}`, { headers: auth })).json()
  expect(Number(stock.data.current_stock)).toBe(10)
  const kardex = await (await request.get(`${API}/kardex?product_id=${productId}`, { headers: auth })).json()
  expect(kardex.data.movements.filter((m: any) => m.document_code === 'FC')).toHaveLength(0)
})
