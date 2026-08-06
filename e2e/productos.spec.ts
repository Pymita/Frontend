import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Crear varios productos (por API, rápido) y verificar que la tabla de
 * Productos muestra su información correctamente.
 */
test('los productos creados aparecen con su información en la tabla', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  // Categoría propia del test para no depender del seed.
  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Categoría E2E' },
  })
  expect(category.status()).toBe(201)
  const categoryId = (await category.json()).data.id

  const products = [
    { name: 'Harina E2E', type: 'raw_material', unit: 'kg', unit_cost: 3500, current_stock: 40, tracks_stock: true },
    { name: 'Pan Campesino E2E', type: 'final', unit: 'unidad', sale_price: 8000, tracks_stock: false },
  ]

  for (const product of products) {
    const response = await request.post(`${API}/products`, {
      headers: auth,
      data: { ...product, category_id: categoryId },
    })
    expect(response.status()).toBe(201)
  }

  // --- Verificación por interfaz ---
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')

  // La materia prima muestra nombre, categoría y su stock inicial (que
  // entró por el kardex como saldo inicial SI).
  const flourRow = page.locator('tr', { hasText: 'Harina E2E' })
  await expect(flourRow).toBeVisible()
  await expect(flourRow).toContainText('Categoría E2E')
  await expect(flourRow).toContainText('40')

  // El producto final muestra su precio de venta.
  const breadRow = page.locator('tr', { hasText: 'Pan Campesino E2E' })
  await expect(breadRow).toBeVisible()
  await expect(breadRow).toContainText('8.000')
})

test('el stock inicial del producto queda registrado en el kardex', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Insumos Kardex E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Mantequilla E2E',
      type: 'raw_material',
      unit: 'kg',
      unit_cost: 12000,
      current_stock: 15,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')

  // Filtrar por el producto y consultar.
  await page.getByRole('combobox', { name: 'Producto' }).click()
  await page.getByRole('option', { name: 'Mantequilla E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  // El movimiento SI aparece con el saldo correcto.
  await expect(page.locator('tr', { hasText: 'SI' }).first()).toBeVisible()
  await expect(page.getByText('15 kg')).toBeVisible()
  await expect(page.getByRole('button', { name: /Descargar Excel/ })).toBeEnabled()
})
