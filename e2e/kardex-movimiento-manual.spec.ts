import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Movimiento manual del kardex: una devolución de ventas (DV) entra al
 * inventario desde la propia pantalla del kardex, con motivo obligatorio.
 */
test('una devolución de ventas se registra desde el kardex y aparece como DV', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Devoluciones E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Vino E2E',
      type: 'raw_material',
      unit: 'botella',
      unit_cost: 25000,
      current_stock: 5,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')

  await page.getByRole('button', { name: /Registrar Movimiento/ }).click()
  await field(page, 'Producto *').locator('input').fill('Vino E2E')
  await page.getByRole('option', { name: 'Vino E2E' }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /DV — Devolución de ventas/ }).click()
  await page.getByLabel('Cantidad *').fill('2')
  await page.getByLabel('Referencia').fill('POS-999')
  await page.getByLabel('Motivo *').fill('Cliente devolvió botellas E2E')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()

  await expect(page.getByText('Movimiento registrado en el kardex')).toBeVisible()

  // El movimiento queda visible filtrando por el producto.
  await field(page, 'Producto').locator('input').fill('Vino E2E')
  await page.getByRole('option', { name: 'Vino E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  const dvRow = page.locator('tr', { hasText: 'DV' }).first()
  await expect(dvRow).toBeVisible()
  await expect(dvRow).toContainText('POS-999')
})
