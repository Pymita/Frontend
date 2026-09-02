import { expect, test, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Los filtros del kardex tienen que filtrar de verdad y aplicarse solos:
 * al elegir un producto solo pueden quedar SUS movimientos, y la columna
 * Producto solo desaparece cuando la tabla ya está mostrando ese producto.
 */

/** Producto con saldo inicial (entrada SI) y una salida por ajuste (AJ). */
async function createProductWithMovements(request: any, suffix: string) {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: `Insumos Filtro ${suffix}` },
  })
  expect(category.status()).toBe(201)
  const categoryId = (await category.json()).data.id

  const names = [`Azúcar ${suffix}`, `Levadura ${suffix}`]
  const ids: number[] = []

  for (const [index, name] of names.entries()) {
    const response = await request.post(`${API}/products`, {
      headers: auth,
      data: {
        name,
        type: 'raw_material',
        unit: 'kg',
        unit_cost: 5000 + index * 1000,
        current_stock: 10 + index,
        tracks_stock: true,
        category_id: categoryId,
      },
    })
    expect(response.status()).toBe(201)
    ids.push((await response.json()).data.id)
  }

  // Bajar el stock del primero deja una salida por ajuste en su kardex.
  const adjust = await request.post(`${API}/products/${ids[0]}/stock-adjustment`, {
    headers: auth,
    data: { quantity_change: -6, notes: 'Merma E2E' },
  })
  expect(adjust.ok()).toBeTruthy()

  return { names, ids }
}

/** Elige un producto en el autocompletar y espera a que cargue su kardex. */
async function filterByProduct(page: Page, name: string) {
  await page.getByRole('combobox', { name: 'Producto' }).click()
  await page.getByRole('option', { name }).click()
  // El resumen del producto solo aparece cuando la consulta ya volvió.
  await expect(page.getByText('Existencia actual')).toBeVisible()
}

test('al elegir un producto el kardex solo muestra sus movimientos', async ({ page, request }) => {
  const { names } = await createProductWithMovements(request, 'A')
  const [azucar, levadura] = names

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')

  const rows = page.locator('tbody tr')

  // Sin filtro se ven los dos productos y la columna Producto.
  await expect(page.getByRole('columnheader', { name: 'Producto' })).toBeVisible()
  await expect(rows.filter({ hasText: azucar })).not.toHaveCount(0)
  await expect(rows.filter({ hasText: levadura })).not.toHaveCount(0)

  // Al elegir uno la tabla se actualiza sola: no hace falta el botón.
  await filterByProduct(page, azucar)

  // Y no queda ni una fila del otro producto.
  await expect(rows.filter({ hasText: levadura })).toHaveCount(0)
  await expect(rows).not.toHaveCount(0)

  // Con un solo producto la columna sobra.
  await expect(page.getByRole('columnheader', { name: 'Producto' })).toHaveCount(0)

  // Al limpiar el filtro vuelven los dos y vuelve la columna.
  await page.getByRole('button', { name: 'Clear Producto' }).click()
  await expect(page.getByRole('columnheader', { name: 'Producto' })).toBeVisible()
  await expect(rows.filter({ hasText: levadura })).not.toHaveCount(0)
})

test('los filtros de movimiento, documento y fechas se aplican solos', async ({ page, request }) => {
  const { names } = await createProductWithMovements(request, 'B')
  const [azucar] = names

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await filterByProduct(page, azucar)

  const rows = page.locator('tbody tr')
  // Saldo inicial (SI, entrada) y ajuste (AJ, salida).
  await expect(rows.filter({ hasText: 'SI' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'AJ' })).toHaveCount(1)

  // Solo salidas: queda el ajuste.
  await field(page, 'Movimiento').click()
  await page.getByRole('option', { name: 'Salidas' }).click()
  await expect(rows.filter({ hasText: 'SI' })).toHaveCount(0)
  await expect(rows.filter({ hasText: 'AJ' })).toHaveCount(1)

  // Solo entradas: queda el saldo inicial.
  await field(page, 'Movimiento').click()
  await page.getByRole('option', { name: 'Entradas' }).click()
  await expect(rows.filter({ hasText: 'SI' })).toHaveCount(1)
  await expect(rows.filter({ hasText: 'AJ' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Clear Movimiento' }).click()
  await expect(rows.filter({ hasText: 'AJ' })).toHaveCount(1)

  // Tipo de documento: solo el ajuste.
  await field(page, 'Tipo de documento').click()
  await page.getByRole('option', { name: /^AJ/ }).click()
  await expect(rows.filter({ hasText: 'SI' })).toHaveCount(0)
  await expect(rows.filter({ hasText: 'AJ' })).toHaveCount(1)

  await page.getByRole('button', { name: 'Clear Tipo de documento' }).click()
  await expect(rows.filter({ hasText: 'SI' })).toHaveCount(1)

  // Fechas: un rango que ya pasó no puede traer los movimientos de hoy.
  await field(page, 'Desde').locator('input').fill('2020-01-01')
  await field(page, 'Hasta').locator('input').fill('2020-12-31')
  await expect(page.getByText('No hay movimientos con los filtros seleccionados')).toBeVisible()

  // Y el rango de hoy sí los trae. La fecha se arma en hora local: el
  // servidor trabaja en hora de Colombia y de noche el UTC ya es mañana.
  const today = new Date().toLocaleDateString('en-CA')
  await field(page, 'Desde').locator('input').fill(today)
  await field(page, 'Hasta').locator('input').fill(today)
  await expect(rows.filter({ hasText: 'SI' })).toHaveCount(1)
})

test('el Excel se descarga con los mismos filtros de la pantalla', async ({ page, request }) => {
  const { names } = await createProductWithMovements(request, 'C')
  const [azucar] = names

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await filterByProduct(page, azucar)

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Descargar Excel/ }).click(),
  ])

  // El nombre del archivo lo arma el backend con el producto filtrado.
  expect(download.suggestedFilename()).toMatch(/^kardex_azucar-c_\d{8}_\d{6}\.xlsx$/)
})
