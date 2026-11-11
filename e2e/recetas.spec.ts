import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Recetas: el costo de un producto sale de sus ingredientes. Media libra de
 * harina a $2.000 la libra cuesta $1.000 por pan.
 */
test('una receta calcula su costo con los ingredientes y se puede borrar', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Panadería ${stamp}` } })
  const categoryId = (await category.json()).data.id
  const flour = `Harina receta ${stamp}`
  const bread = `Pan receta ${stamp}`
  await request.post(`${API}/products`, {
    headers: auth,
    data: { name: flour, type: 'raw_material', unit: 'libra', unit_cost: 2000, tracks_stock: false, category_id: categoryId },
  })
  await request.post(`${API}/products`, {
    headers: auth,
    data: { name: bread, type: 'final', unit: 'unidad', sale_price: 3000, tracks_stock: false, category_id: categoryId },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/recetas')
  await page.getByRole('button', { name: 'Nueva receta' }).click()

  const dialog = page.getByRole('dialog')
  await field(page, 'Producto').locator('input').fill(bread)
  await page.getByRole('option', { name: bread }).click()
  await dialog.getByLabel('Nombre de la receta').fill(`Pan de la casa ${stamp}`)
  await dialog.getByLabel('Unidad producida').fill('unidad')

  await dialog.getByRole('button', { name: 'Agregar ingrediente' }).click()
  await field(page, 'Ingrediente').locator('input').fill(flour)
  await page.getByRole('option', { name: flour }).click()
  // La unidad viene del inventario.
  await expect(dialog.getByLabel('Unidad ingrediente')).toHaveValue('libra')
  await dialog.getByLabel('Cantidad para este lote').fill('0.5')

  await expect(dialog.getByText('Costo lote').locator('..')).toContainText('$1.000')
  await expect(dialog.getByText('Costo por unidad').locator('..')).toContainText('$1.000/unidad')
  await dialog.getByRole('button', { name: 'Guardar receta' }).click()
  await expect(page.getByText('Receta creada')).toBeVisible()

  const row = page.locator('tbody tr', { hasText: bread })
  await expect(row).toContainText(`Pan de la casa ${stamp}`)
  await expect(row).toContainText('1 ingredientes')
  await expect(row).toContainText('$1.000')

  page.once('dialog', confirmation => confirmation.accept())
  await row.getByRole('button', { name: `Eliminar la receta Pan de la casa ${stamp}` }).click()
  await expect(page.getByText('Receta eliminada')).toBeVisible()
  await expect(row).toHaveCount(0)
})

/**
 * A combo keeps its components in a recipe, but they are edited in
 * Productos: Recetas neither lists it nor offers it for a new recipe.
 */
test('un combo no aparece en Recetas: sus productos se editan en Productos', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Combos receta ${stamp}` } })
  const categoryId = (await category.json()).data.id
  const product = async (data: Record<string, unknown>) =>
    (await (await request.post(`${API}/products`, { headers: auth, data: { unit: 'unidad', category_id: categoryId, ...data } })).json()).data.id
  const soda = await product({ name: `Gaseosa receta ${stamp}`, type: 'final', sale_price: 4000, current_stock: 5, unit_cost: 2000 })
  const combo = `Combo receta ${stamp}`
  const created = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: combo, type: 'final', unit: 'unidad', sale_price: 9000, category_id: categoryId, is_combo: true, components: [{ product_id: soda, quantity: 2 }] },
  })
  expect(created.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/recetas')
  await expect(page.getByRole('button', { name: 'Nueva receta' })).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: combo })).toHaveCount(0)

  await page.getByRole('button', { name: 'Nueva receta' }).click()
  await field(page, 'Producto').locator('input').fill(combo)
  await expect(page.getByRole('option', { name: combo })).toHaveCount(0)
  await field(page, 'Producto').locator('input').fill(`Gaseosa receta ${stamp}`)
  await expect(page.getByRole('option', { name: `Gaseosa receta ${stamp}` })).toBeVisible()
})
