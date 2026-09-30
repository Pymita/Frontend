import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Menú: la vista previa de lo que ve el mesero en la app. Solo categorías
 * visibles, con productos activos y disponibles, y el precio en pesos.
 */
test('el menú muestra lo publicado y disponible, y deja de mostrar una categoría oculta', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const categoryName = `Postres E2E ${stamp}`
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: categoryName } })
  const categoryId = (await category.json()).data.id

  const publish = async (name: string, price: number): Promise<number> => {
    const product = await request.post(`${API}/products`, {
      headers: auth,
      data: { name, type: 'final', unit: 'unidad', sale_price: price, tracks_stock: false, category_id: categoryId },
    })
    const menuItem = await request.post(`${API}/menu-items`, {
      headers: auth,
      data: { name, final_product_id: (await product.json()).data.id, category_id: categoryId, base_price: price },
    })
    expect(menuItem.ok()).toBeTruthy()
    return (await menuItem.json()).data.id
  }
  await publish(`Brownie ${stamp}`, 8500)
  const flan = await publish(`Flan ${stamp}`, 6000)
  // Agotado: sigue en el catálogo pero el mesero no lo puede ofrecer.
  await request.post(`${API}/menu-items/${flan}/toggle-availability`, { headers: auth })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'Menú' })).toBeVisible()

  const panel = page.locator('.v-expansion-panel', { hasText: categoryName })
  await expect(panel).toContainText('1 producto')
  await expect(panel.locator('.v-list-item', { hasText: `Brownie ${stamp}` })).toContainText('$8.500')
  await expect(panel).not.toContainText(`Flan ${stamp}`)

  // Ocultar la categoría en la app la saca del menú.
  const hidden = await request.put(`${API}/categories/${categoryId}`, {
    headers: auth,
    data: { visible_in_app: false },
  })
  expect(hidden.ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Actualizar' }).click()
  await expect(page.locator('.v-expansion-panel', { hasText: categoryName })).toHaveCount(0)
})
