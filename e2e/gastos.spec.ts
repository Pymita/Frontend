import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, createCompany, field, loginUI } from './helpers'

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

  // Pesos as a Colombian writes them: "1.250.000" is a million and a quarter, not 1.
  const concept = `Bulto de harina ${stamp}`
  const amount = field(page, 'Monto *').locator('input')
  await expect(amount).not.toHaveAttribute('type', 'number')
  await amount.pressSequentially('1.250.000')
  await dialog.getByLabel('Concepto / Descripción').fill(concept)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const row = page.locator('tbody tr', { hasText: concept })
  await expect(row).toBeVisible()
  await expect(row).toContainText(categoryName)
  await expect(row).toContainText('$1.250.000')

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

/**
 * An expense is not one of the documents that limit the methods: it offers
 * every active method of the business (one used only for financial
 * movements too), never an inactive one, and keeps the one chosen.
 */
test('el gasto ofrece todas las formas de pago activas y guarda la elegida', async ({ page, request }) => {
  const company = await createCompany(request, `gastos-formas-${Date.now()}`, {
    business_type: 'restaurant',
    modules: ['orders', 'menu', 'inventory', 'customers', 'expenses', 'reports'],
  })
  const auth = { Authorization: `Bearer ${company.token}` }
  const pettyCash = await request.post(`${API}/payment-methods`, {
    headers: auth,
    data: { name: 'Caja chica', is_cash: true, documents: ['financial_movement'], active: true },
  })
  expect(pettyCash.status(), await pettyCash.text()).toBe(201)
  const pettyCashKey = (await pettyCash.json()).data.key
  const old = await request.post(`${API}/payment-methods`, {
    headers: auth,
    data: { name: 'Cheque viejo', is_cash: false, documents: ['sale'], active: false },
  })
  expect(old.status(), await old.text()).toBe(201)
  const categoryName = `Arriendo ${Date.now()}`
  const category = await request.post(`${API}/expense-categories`, { headers: auth, data: { name: categoryName, type: 'fixed_expense' } })
  expect(category.status(), await category.text()).toBe(201)

  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/gastos')
  await page.getByRole('button', { name: 'Registrar gasto' }).click()
  const dialog = page.getByRole('dialog')
  await field(page, 'Categoría *').click()
  await page.getByRole('option', { name: new RegExp(categoryName) }).click()
  await field(page, 'Monto *').locator('input').pressSequentially('80.000')
  const concept = `Arriendo local ${Date.now()}`
  await dialog.getByLabel('Concepto / Descripción').fill(concept)
  await expect(field(page, 'Forma de pago')).toContainText('Efectivo')
  await field(page, 'Forma de pago').click()
  await expect(page.getByRole('option', { name: 'Nequi' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Cheque viejo' })).toHaveCount(0)
  await page.getByRole('option', { name: 'Caja chica' }).click()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('tbody tr', { hasText: concept })).toContainText('$80.000')

  const expenses = (await (await request.get(`${API}/expenses`, { headers: auth })).json()).data
  expect(expenses.find((expense: { concept: string }) => expense.concept === concept)?.payment_method).toBe(pettyCashKey)
})

/** La tabla sigue las fechas del resumen y busca en el servidor por concepto o proveedor. */
test('los gastos se buscan por concepto o proveedor y siguen las fechas elegidas', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const category = await request.post(`${API}/expense-categories`, {
    headers: auth,
    data: { name: `Servicios ${stamp}`, type: 'fixed_expense' },
  })
  const categoryId = (await category.json()).data.id
  const today = new Date().toLocaleDateString('en-CA')
  for (const [concept, supplier] of [[`Energía ${stamp}`, 'Enel'], [`Agua ${stamp}`, `Acueducto ${stamp}`]]) {
    const created = await request.post(`${API}/expenses`, {
      headers: auth,
      data: { expense_category_id: categoryId, concept, supplier_name: supplier, amount: 50000, expense_date: today },
    })
    expect(created.status()).toBe(201)
  }

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/gastos')
  const search = page.getByRole('textbox', { name: 'Buscar gasto' })

  await search.fill(String(stamp))
  await expect(page.locator('tbody tr', { hasText: String(stamp) })).toHaveCount(2)

  await search.fill(`Acueducto ${stamp}`)
  const row = page.locator('tbody tr', { hasText: String(stamp) })
  await expect(row).toHaveText([new RegExp(`Agua ${stamp}`)])
  // Pesos con separador de miles (no "$50000.00") y el día de calendario del gasto.
  await expect(row).toContainText('$50.000')
  await expect(row).toContainText(new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }))

  // Un rango en el pasado deja la tabla vacía: ya no se queda con los gastos del mes.
  await search.fill(String(stamp))
  await page.getByLabel('Fecha inicio').fill('2001-01-01')
  await page.getByLabel('Fecha fin').fill('2001-01-31')
  await expect(page.locator('tbody tr', { hasText: String(stamp) })).toHaveCount(0)
})
