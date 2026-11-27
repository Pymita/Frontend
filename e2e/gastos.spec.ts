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

/**
 * Gastos recurrentes (DEVELOPMENT.md 7.4.1): the schedule is a projection.
 * The tab spreads each one over its months (the domain every 3 years is
 * $X/36 a month), says what is overdue and what comes in 30 and 90 days, and
 * "Registrar pago" writes the real expense and moves the due date.
 */
test('un gasto recurrente proyecta el costo mensual y registrar el pago crea el gasto y mueve la fecha', async ({ page, request }) => {
  const company = await createCompany(request, `gastos-recurrentes-${Date.now()}`, {
    business_type: 'restaurant',
    modules: ['orders', 'menu', 'inventory', 'customers', 'expenses', 'reports'],
  })
  const auth = { Authorization: `Bearer ${company.token}` }
  const stamp = Date.now()
  const iso = (date: Date) => date.toLocaleDateString('en-CA')
  const shift = (months: number, days = 0) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setMonth(date.getMonth() + months)
    return date
  }
  const dmy = (date: Date) => date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const category = await (await request.post(`${API}/expense-categories`, {
    headers: auth,
    data: { name: `Servicios ${stamp}`, type: 'fixed_expense' },
  })).json()
  const schedule = (data: Record<string, unknown>) => request.post(`${API}/recurring-expenses`, {
    headers: auth,
    data: { expense_category_id: category.data.id, interval_unit: 'month', interval_count: 1, ...data },
  })
  // The rent was due 10 days ago; the domain, in two years.
  const rentStart = shift(0, -10)
  expect((await schedule({ concept: `Arriendo ${stamp}`, estimated_amount: 1500000, starts_on: iso(rentStart) })).status()).toBe(201)
  expect((await schedule({
    concept: `Dominio ${stamp}`, estimated_amount: 180000, interval_unit: 'year', interval_count: 3,
    starts_on: iso(shift(-12)), next_due_on: iso(shift(24)),
  })).status()).toBe(201)

  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/gastos')
  await page.getByRole('tab', { name: /Gastos recurrentes/ }).click()

  const tile = (title: string) => page.getByRole('region', { name: 'Costo de los gastos recurrentes' }).getByText(title, { exact: true }).locator('..')
  const rent = page.locator('tbody tr', { hasText: `Arriendo ${stamp}` })
  const domain = page.locator('tbody tr', { hasText: `Dominio ${stamp}` })
  await expect(rent).toContainText('Vencido')
  await expect(rent).toContainText('Hace 10 días')
  await expect(domain).toContainText('Cada 3 años')
  // $180.000 / 36 months.
  await expect(domain).toContainText('$5.000')
  await expect(tile('Costo mensual real')).toContainText('$1.505.000')
  await expect(tile('Vencidos')).toContainText('$1.500.000')

  // A new one from the form, monthly from today: the hint spreads it.
  await page.getByRole('button', { name: 'Nuevo gasto recurrente' }).click()
  const form = page.getByRole('dialog')
  await field(page, 'Categoría *').click()
  await page.getByRole('option', { name: `Servicios ${stamp}` }).click()
  await form.getByLabel('Concepto').fill(`Hosting ${stamp}`)
  await field(page, 'Valor de cada pago *').locator('input').pressSequentially('95.000')
  await expect(form.getByText('Equivale a $95.000 al mes')).toBeVisible()
  await form.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(`Gasto recurrente creado: el próximo pago vence el ${dmy(new Date())}.`)).toBeVisible()
  await expect(tile('Costo mensual real')).toContainText('$1.600.000')

  // Vencidos shows only the rent.
  await page.getByRole('button', { name: 'Vencidos', exact: true }).click()
  await expect(rent).toBeVisible()
  await expect(domain).toHaveCount(0)

  // Paid late and a bit more: the calendar keeps its day.
  await rent.getByRole('button', { name: `Registrar pago de Arriendo ${stamp}` }).click()
  const pay = page.getByRole('dialog')
  await expect(pay).toContainText(`Arriendo ${stamp} · vencimiento del`)
  const amount = pay.getByLabel('Valor pagado')
  await expect(amount).toHaveValue('1.500.000')
  await amount.fill('1.550.000')
  await pay.getByRole('button', { name: 'Registrar pago' }).click()
  await expect(page.getByText(`Pago de «Arriendo ${stamp}» registrado. El próximo vence el ${dmy(shift(1, -10))}.`)).toBeVisible()
  await expect(page.getByText('Nada por pagar en ese periodo.')).toBeVisible()
  await expect(tile('Vencidos')).toContainText('$0')

  // The payment is an ordinary expense, marked as recurring; the schedules are not.
  await page.getByRole('tab', { name: 'Registro de gastos' }).click()
  const paid = page.locator('tbody tr', { hasText: `Arriendo ${stamp}` })
  await expect(paid).toContainText('Recurrente')
  await expect(paid).toContainText('$1.550.000')
  await expect(page.locator('tbody tr', { hasText: `Dominio ${stamp}` })).toHaveCount(0)
  const summary = await (await request.get(`${API}/expenses/summary`, { headers: auth })).json()
  expect(Number(summary.data.total_expenses)).toBe(1550000)
})
