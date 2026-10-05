import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Movimiento manual del kardex: una devolución de ventas (DV) entra al
 * inventario desde la propia pantalla del kardex. Las observaciones son
 * opcionales; el tercero se elige o se escribe libremente.
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

  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Producto *').locator('input').fill('Vino E2E')
  await page.getByRole('option', { name: 'Vino E2E' }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /DV — Devolución de ventas/ }).click()
  await page.getByLabel('Cantidad *').fill('2')
  await page.getByLabel('Cliente *').fill('Cliente Devolución E2E')
  await page.getByLabel('Referencia').fill('POS-999')
  // Observaciones ya no es obligatorio, pero se sigue pudiendo escribir.
  await page.getByLabel('Observaciones').fill('Cliente devolvió botellas E2E')
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

/**
 * A purchase (FC) enters at the unit cost typed as pesos: "26.000" is
 * twenty-six thousand, and the weighted average follows it.
 */
test('una compra entra al kardex con el costo unitario escrito en pesos', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const name = `Café Compra ${Date.now()}`
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name, type: 'raw_material', unit: 'kg', unit_cost: 20000, current_stock: 5, tracks_stock: true,
      category_id: (await category.json()).data.id,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Producto *').locator('input').fill(name)
  await page.getByRole('option', { name }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  await page.getByLabel('Cantidad *').fill('10')
  await page.getByLabel('Proveedor *').fill('Tostadora E2E')

  // The product's last cost is suggested with its dots, in a field with no arrows.
  const cost = page.getByLabel('Costo unitario')
  await expect(cost).toHaveValue('20.000')
  await expect(cost).not.toHaveAttribute('type', 'number')
  await cost.fill('26.000')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('Movimiento registrado en el kardex')).toBeVisible()

  await field(page, 'Producto').locator('input').fill(name)
  await page.getByRole('option', { name }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()
  await expect(page.locator('tr', { hasText: 'FC' }).first()).toContainText('$26.000')
  // (5 × $20.000 + 10 × $26.000) / 15.
  await expect(page.locator('.v-card', { hasText: 'Costo promedio' })).toContainText('$24.000')
})
