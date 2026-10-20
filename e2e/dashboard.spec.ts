import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
  ADMIN,
  API,
  SHOP_WITH_FEES,
  apiLogin,
  createCompany,
  displayDate,
  e2eSql,
  freezeTime,
  issueDocuments,
  loginUI,
} from './helpers'

/**
 * Dashboard: lo que el dueño mira primero. Las métricas cuentan lo mismo
 * que Ventas (pedidos cobrados, no cancelados) y el stock bajo sale del
 * saldo del kardex.
 */

type Auth = { Authorization: string }

async function createProduct(request: APIRequestContext, auth: Auth, data: Record<string, unknown>): Promise<number> {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Dashboard E2E ${Date.now()}` } })
  const response = await request.post(`${API}/products`, {
    headers: auth,
    data: { category_id: (await category.json()).data.id, ...data },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).data.id
}

async function chargedSale(request: APIRequestContext, auth: Auth, productId: number, quantity: number): Promise<number> {
  const response = await request.post(`${API}/orders`, {
    headers: auth,
    data: { order_type: 'takeaway', items: [{ product_id: productId, quantity }], payment_status: 'paid' },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).data.id
}

test('stock bajo muestra el saldo real y más vendidos solo cuenta lo cobrado', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const suffix = Date.now()

  const flourName = `Harina Tablero ${suffix}`
  await createProduct(request, auth, {
    name: flourName, type: 'raw_material', unit: 'kg', unit_cost: 3000,
    tracks_stock: true, current_stock: 0.5, minimum_stock: 500,
  })

  const empanadaName = `Empanada Tablero ${suffix}`
  const empanadaId = await createProduct(request, auth, {
    name: empanadaName, type: 'final', unit: 'und', unit_cost: 1000, sale_price: 2500, tracks_stock: false,
  })
  await chargedSale(request, auth, empanadaId, 25)
  await chargedSale(request, auth, empanadaId, 15)

  // Un pedido cancelado no es una venta.
  const cancelled = await request.post(`${API}/orders`, {
    headers: auth,
    data: { order_type: 'takeaway', items: [{ product_id: empanadaId, quantity: 30 }] },
  })
  const cancelledId = (await cancelled.json()).data.id
  expect((await request.post(`${API}/orders/${cancelledId}/cancel`, { headers: auth })).ok()).toBeTruthy()

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/dashboard')

  const lowStock = page.locator('.v-card', { hasText: 'Stock bajo' }).filter({ has: page.locator('.v-list') })
  const flourRow = lowStock.locator('.v-list-item', { hasText: flourName })
  await expect(flourRow).toContainText('Actual: 0,5 kg')
  await expect(flourRow).toContainText('Mínimo: 500 kg')

  // 25 + 15 cobradas a $2.500 en 2 pedidos; las 30 del cancelado no suman.
  const topProducts = page.locator('.v-card', { hasText: 'Más vendidos' })
  await expect(page.getByRole('button', { name: 'Mes', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(topProducts).toContainText('Este mes')
  const empanadaRow = topProducts.locator('.v-list-item', { hasText: empanadaName })
  await expect(empanadaRow).toContainText('40 vendidos · 2 pedidos')
  await expect(empanadaRow).toContainText('$100.000')
  await expect(empanadaRow).toContainText(/\d+(,\d)? % de las ventas/)

  // The top seller wears the brand teal; its number is ink, since white on it is 2.06:1.
  const firstPlace = topProducts.locator('.v-list-item').first().locator('.v-avatar')
  await expect(firstPlace).toHaveText('1')
  await expect(firstPlace).toHaveCSS('background-color', 'rgb(14, 202, 189)')
  await expect(firstPlace.getByText('1', { exact: true })).toHaveCSS('color', 'rgb(17, 26, 36)')
})

const money = (value: number): string => '$' + value.toLocaleString('es-CO', { maximumFractionDigits: 0 })
const localDate = (date: Date): string => date.toLocaleDateString('sv-SE')

test('el gráfico cambia entre semana, mes y rango, y más vendidos sigue el periodo', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const suffix = Date.now()

  const juiceName = `Jugo Periodo ${suffix}`
  const juiceId = await createProduct(request, auth, {
    name: juiceName, type: 'final', unit: 'und', unit_cost: 1000, sale_price: 2500, tracks_stock: false,
  })
  await chargedSale(request, auth, juiceId, 3)

  const today = new Date()
  const weekFrom = new Date(today)
  weekFrom.setDate(today.getDate() - 6)
  const monthFrom = localDate(new Date(today.getFullYear(), today.getMonth(), 1))
  const expected = async (from: string, to: string) =>
    (await (await request.get(`${API}/dashboard/sales-week`, { headers: auth, params: { from, to } })).json()).meta

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/dashboard')

  const chart = page.locator('.v-card').filter({ has: page.getByRole('button', { name: 'Semana' }) })
  const topProducts = page.locator('.v-card', { hasText: 'Más vendidos' })
  const mes = chart.getByRole('button', { name: 'Mes', exact: true })

  const month = await expected(monthFrom, localDate(today))
  await expect(mes).toHaveAttribute('aria-pressed', 'true')
  await expect(chart.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute('aria-pressed', 'false')
  await expect(chart).toContainText('Ventas del mes')
  await expect(chart).toContainText(`Este mes: ${money(month.total)} en ${month.orders_count}`)
  // A restaurant sells one way: the chart has no origin to choose.
  await expect(chart.getByRole('group', { name: 'Origen de las ventas' })).toHaveCount(0)
  await expect(topProducts).toContainText('Este mes')
  await expect(topProducts.locator('.v-list-item', { hasText: juiceName })).toContainText('3 vendidos · 1 pedido')
  await expect(chart.locator('canvas')).toBeVisible()

  await chart.getByRole('button', { name: 'Semana', exact: true }).click()
  const week = await expected(localDate(weekFrom), localDate(today))
  await expect(chart.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(chart).toContainText('Ventas de la Semana')
  const pedidos = week.orders_count === 1 ? 'pedido' : 'pedidos'
  await expect(chart).toContainText(`Últimos 7 días: ${money(week.total)} en ${week.orders_count} ${pedidos}`)

  // El rango arranca con el periodo que se estaba viendo. Hay que esperar la
  // respuesta del mes: el título cambia antes de que lleguen las fechas.
  const monthLoaded = page.waitForResponse(response =>
    response.url().includes('/dashboard/sales-week') && response.url().includes(monthFrom) && response.ok(),
  )
  await mes.click()
  await monthLoaded
  await expect(chart).toContainText('Ventas del mes')

  await chart.getByRole('button', { name: 'Rango' }).click()
  await expect(chart).toContainText('Ventas del periodo')
  const from = chart.getByLabel('Desde')
  const to = chart.getByLabel('Hasta')
  await expect(from).toHaveValue(displayDate(monthFrom))
  await expect(to).toHaveValue(displayDate(localDate(today)))

  // Un mes sin ventas: el gráfico sigue ahí, en cero, y más vendidos lo dice.
  await from.fill('2020-01-01')
  await to.fill('2020-01-31')
  await expect(chart).toContainText('$0 en 0 pedidos')
  await expect(chart.locator('canvas')).toBeVisible()
  await expect(topProducts).toContainText('No hay ventas en este periodo')

  // Un rango al revés se explica, no se rompe.
  await from.fill('2020-02-10')
  await to.fill('2020-02-01')
  await expect(chart.getByRole('alert')).toContainText('La fecha final debe ser igual o posterior a la inicial. Corrige el rango.')

  await from.fill('2019-01-01')
  await to.fill('2020-06-01')
  await expect(chart.getByRole('alert')).toContainText('El rango puede ser de máximo 366 días. Elige un periodo más corto.')

  // Rangos largos se agrupan para que el gráfico se pueda leer.
  await from.fill('2020-01-01')
  await to.fill('2020-04-30')
  await expect(chart).toContainText('un punto por semana')
  await to.fill('2020-12-31')
  await expect(chart).toContainText('un punto por mes')

  // Solo hoy: el jugo aparece con su valor.
  await from.fill(localDate(today))
  await to.fill(localDate(today))
  await expect(chart.getByRole('alert')).toHaveCount(0)
  const juiceRow = topProducts.locator('.v-list-item', { hasText: juiceName })
  await expect(juiceRow).toContainText('3 vendidos · 1 pedido')
  await expect(juiceRow).toContainText('$7.500')
})

test('primeros pasos queda bajo las métricas y solo muestra lo obligatorio pendiente', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const setup = (await (await request.get(`${API}/dashboard/setup`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()).data as {
    completed: number
    total: number
    steps: { key: string; done: boolean; optional: boolean }[]
  }
  const pending = setup.steps.filter(step => !step.done && !step.optional)
  const hidden = setup.steps.filter(step => step.done || step.optional)
  const invoicing = setup.steps.find(step => step.key === 'invoicing')
  if (invoicing) expect(invoicing.optional).toBe(true)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/dashboard')

  const guideCard = page.getByTestId('setup-guide')
  const metric = page.getByText('Pedidos hoy', { exact: true })
  await expect(metric).toBeVisible()
  await expect(guideCard).toBeVisible()
  await expect(page.getByText('Pedidos recientes')).toHaveCount(0)
  // A restaurant without automatic billing has no cartera on its dashboard.
  await expect(page.getByText('Saldo por cobrar')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mes', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Ventas del mes')).toBeVisible()

  const metricBox = await metric.boundingBox()
  const guideBox = await guideCard.boundingBox()
  expect(metricBox).toBeTruthy()
  expect(guideBox).toBeTruthy()
  expect(metricBox!.y).toBeLessThan(guideBox!.y)

  if (pending.length === 0) {
    await expect(guideCard).toContainText('Primeros pasos listos')
  } else {
    await expect(guideCard).toContainText(`${setup.completed} de ${setup.total} listos`)
    for (const step of pending) {
      const row = page.getByTestId(`setup-step-${step.key}`)
      await expect(row.getByLabel('Pendiente')).toBeVisible()
      await expect(row.locator('.text-error')).toBeVisible()
    }
  }
  for (const step of hidden) {
    await expect(page.getByTestId(`setup-step-${step.key}`)).toHaveCount(0)
  }
  if (invoicing && !invoicing.done) {
    await expect(page.getByTestId('setup-step-invoicing')).toHaveCount(0)
  }

  if (hidden.length === 0) return
  await guideCard.getByRole('button', { name: 'Ver los que ya están listos' }).click()
  for (const step of hidden) {
    const row = page.getByTestId(`setup-step-${step.key}`)
    await expect(row).toBeVisible()
    if (step.done) await expect(row.getByLabel('Listo')).toBeVisible()
    if (step.optional) await expect(row).toContainText('Opcional')
  }
  if (invoicing && !invoicing.done) {
    await expect(page.getByTestId('setup-step-invoicing').getByLabel('Pendiente')).toHaveCount(0)
  }
  await guideCard.getByRole('button', { name: 'Ocultar los que ya están listos' }).click()
  for (const step of hidden) {
    await expect(page.getByTestId(`setup-step-${step.key}`)).toHaveCount(0)
  }
})

/**
 * Finanzas valoriza el inventario desde el kardex. Los productos sembrados
 * (como en staging) tenían stock sin kardex y el balance mostraba $0; los que
 * tienen existencias sin costo se nombran para que el dueño sepa por qué.
 */
test('finanzas valoriza el inventario sembrado y avisa lo que no tiene costo', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/finanzas')

  const inventoryRow = page.locator('tr', { hasText: 'Inventario valorizado (costo promedio)' })
  await expect(inventoryRow).toBeVisible()
  await expect(inventoryRow.locator('td').last()).not.toHaveText('$0')

  const warning = page.getByText('Estos productos tienen existencias pero su costo en el kardex es $0')
  await expect(warning).toBeVisible()
  await expect(page.locator('.v-alert', { has: warning })).toContainText('Masa de Pan (12 kg)')
})

test('capturas del tablero en escritorio y en celular', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)

  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['mobile', { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/dashboard')
    await expect(page.locator('canvas')).toBeVisible()
    await expect(page.locator('.v-progress-circular')).toHaveCount(0)
    await page.screenshot({ path: `../screenshots/${name}.png`, fullPage: true })
  }

  // The app shell keeps the sidebar permanent even on a phone; this capture
  // hides it only to review how the dashboard itself stacks at 390px.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.v-navigation-drawer')!.style.display = 'none'
    document.querySelector<HTMLElement>('.v-main')!.style.paddingLeft = '0px'
    document.querySelector<HTMLElement>('.v-app-bar')?.style.setProperty('left', '0px')
    document.querySelector<HTMLElement>('.v-app-bar')?.style.setProperty('width', '100%')
    window.dispatchEvent(new Event('resize'))
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/mobile-sin-menu.png', fullPage: true })
})

/** A metric card of the dashboard, by its exact title. */
const metricCard = (page: Page, title: string) =>
  page.locator('.v-card').filter({ has: page.getByText(title, { exact: true }) })

/**
 * A condominium that also runs a little shop: its dashboard is about sales
 * (orders and documents) and the cartera, not about open orders.
 */
test('con facturación automática el inicio muestra ventas y cartera, no los pedidos pendientes', async ({ page, request }) => {
  const company = await createCompany(request, 'tienda-cuotas', { business_type: 'recurring', modules: SHOP_WITH_FEES })
  const auth = { Authorization: `Bearer ${company.token}` }
  const sodaName = `Gaseosa Tienda ${Date.now()}`
  const sodaId = await createProduct(request, auth, {
    name: sodaName, type: 'final', unit: 'und', unit_cost: 1000, sale_price: 2500, tracks_stock: false,
  })
  await chargedSale(request, auth, sodaId, 2)

  // Open since two days ago: a restaurant would get "pedido pendiente de cobro" on top.
  const open = await request.post(`${API}/orders`, {
    headers: auth,
    data: { order_type: 'takeaway', items: [{ product_id: sodaId, quantity: 1 }] },
  })
  expect(open.ok(), await open.text()).toBeTruthy()
  e2eSql(`UPDATE orders SET created_at = datetime('now', '-2 days') WHERE id = ${(await open.json()).data.id}`)

  const [ana] = await issueDocuments(request, company.token, [
    { name: 'Ana Apto 101', document_number: '1001', monthly_fee: 250000 },
    { name: 'Beto Apto 102', document_number: '1002', monthly_fee: 180000 },
  ])
  const abono = await request.post(`${API}/recurring-billing/invoices/${ana!.id}/payments`, {
    headers: auth,
    data: { amount: 50000, payment_method: 'cash' },
  })
  expect(abono.ok(), await abono.text()).toBeTruthy()
  // Billed in January 2025 and never paid: overdue.
  await issueDocuments(request, company.token, [{ name: 'Carla Apto 103', document_number: '1003', monthly_fee: 90000 }], {
    issue_date: '2025-01-02',
  })
  const stats = (await (await request.get(`${API}/dashboard/stats`, { headers: auth })).json()).data
  expect(stats.overdue_pending.count).toBe(1)

  await freezeTime(page, ana!.issued_at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/dashboard')

  // 2 sodas (5.000) + 250.000 + 180.000; the abono of 50.000 is cash, not a second sale.
  await expect(metricCard(page, 'Ventas hoy')).toContainText('$435.000')
  await expect(metricCard(page, 'Ventas hoy')).toContainText('$435.000 este mes')
  await expect(metricCard(page, 'Ventas hoy')).toContainText('Pedidos y facturación')
  await expect(metricCard(page, 'Saldo por cobrar')).toContainText('$470.000')
  await expect(metricCard(page, 'Saldo por cobrar')).toContainText('3 clientes con saldo')
  await expect(metricCard(page, 'Vencido')).toContainText('$90.000')
  await expect(metricCard(page, 'Vencido')).toContainText('1 documento vencido')
  await expect(metricCard(page, 'Vencido')).toContainText('Requiere cobro')
  // It has inventory: the stock card and list stay.
  await expect(page.getByText('Stock bajo', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Pedidos hoy', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Productos activos', { exact: true })).toHaveCount(0)
  await expect(page.getByText(/pendientes? de cobro/)).toHaveCount(0)

  const chart = page.locator('.v-card').filter({ has: page.getByRole('button', { name: 'Semana' }) })
  const caption = chart.locator('div', { hasText: /^\s*Este mes:/ })
  const origin = chart.getByRole('group', { name: 'Origen de las ventas' })
  const top = page.locator('.v-card').filter({ has: page.locator('.mdi-trophy') })
  const soda = top.locator('.v-list-item', { hasText: sodaName })
  const fees = top.locator('.v-list-item', { hasText: 'Cuota de administración' })

  // "Todo" first: both origins in the total and among the best sellers, each a share of everything sold.
  await expect(origin.getByRole('button', { name: 'Todo' })).toHaveAttribute('aria-pressed', 'true')
  await expect(caption).toHaveText(/^\s*Este mes: \$435\.000 en 1 pedido y 2 documentos\s*$/)
  await expect(chart.locator('canvas')).toBeVisible()
  await expect(top).toContainText('Más vendidos')
  await expect(fees).toContainText('2 documentos')
  await expect(fees).toContainText('$430.000')
  await expect(fees).toContainText('98,9 % de las ventas')
  await expect(soda).toContainText('2 vendidos · 1 pedido')
  await expect(soda).toContainText('1,1 % de las ventas')

  await expect(page.locator('.v-progress-circular')).toHaveCount(0)
  await page.mouse.move(0, 0)
  await page.screenshot({ path: '../screenshots/ventas-servicios-dashboard-todo-1440.png', fullPage: true })

  // "Productos": the shop alone, its share of what the orders sold.
  await origin.getByRole('button', { name: 'Productos' }).click()
  await expect(origin.getByRole('button', { name: 'Productos' })).toHaveAttribute('aria-pressed', 'true')
  await expect(caption).toHaveText(/^\s*Este mes: \$5\.000 en 1 pedido\s*$/)
  await expect(top).toContainText('Más vendidos')
  await expect(soda).toContainText('100 % de los pedidos')
  await expect(fees).toHaveCount(0)

  // "Facturación automática": the documents alone, ranked as the concepts billed.
  await origin.getByRole('button', { name: 'Facturación automática' }).click()
  await expect(caption).toHaveText(/^\s*Este mes: \$430\.000 en 2 documentos\s*$/)
  await expect(top).toContainText('Más facturados')
  await expect(fees).toContainText('2 documentos')
  await expect(fees).toContainText('100 % de lo facturado')
  await expect(soda).toHaveCount(0)
  await expect(page.locator('.v-progress-circular')).toHaveCount(0)
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/ventas-servicios-dashboard-facturacion-1440.png', fullPage: true })

  await origin.getByRole('button', { name: 'Todo' }).click()
  await expect(caption).toHaveText(/^\s*Este mes: \$435\.000 en 1 pedido y 2 documentos\s*$/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(metricCard(page, 'Vencido')).toBeVisible()
  await expect(page.locator('.v-progress-circular')).toHaveCount(0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/ventas-servicios-dashboard-todo-390.png', fullPage: true })
})

test('un conjunto sin pedidos ve lo facturado, su cartera y los conceptos más facturados', async ({ page, request }) => {
  const company = await createCompany(request, 'conjunto-inicio', { business_type: 'recurring' })
  const [first] = await issueDocuments(request, company.token, [
    { name: 'Ana Apto 101', document_number: '1001', monthly_fee: 250000 },
    { name: 'Beto Apto 102', document_number: '1002', monthly_fee: 250000 },
    { name: 'Carla Parqueadero 7', document_number: '1003', monthly_fee: 80000, billing_concept: 'Cuota parqueadero' },
  ])

  await freezeTime(page, first!.issued_at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/dashboard')

  await expect(metricCard(page, 'Ventas hoy')).toContainText('$580.000')
  await expect(metricCard(page, 'Ventas hoy')).toContainText('Facturación automática')
  await expect(metricCard(page, 'Saldo por cobrar')).toContainText('$580.000')
  await expect(metricCard(page, 'Vencido')).toContainText('$0')
  await expect(metricCard(page, 'Vencido')).toContainText('Ningún documento vencido')
  await expect(metricCard(page, 'Vencido')).toContainText('Al día')
  // No inventory module: neither the stock card nor the stock list.
  await expect(page.getByText('Stock bajo', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Todo el stock está bien')).toHaveCount(0)

  const chart = page.locator('.v-card').filter({ has: page.getByRole('button', { name: 'Semana' }) })
  await expect(chart).toContainText('Este mes: $580.000 en 3 documentos')
  // Documents are all it sells: nothing to choose between.
  await expect(chart.getByRole('group', { name: 'Origen de las ventas' })).toHaveCount(0)
  const top = page.locator('.v-card', { hasText: 'Más facturados' })
  const fee = top.locator('.v-list-item', { hasText: 'Cuota de administración' })
  await expect(fee).toContainText('2 documentos')
  await expect(fee).toContainText('$500.000')
  await expect(fee).toContainText('86,2 % de lo facturado')
  await expect(top.locator('.v-list-item', { hasText: 'Cuota parqueadero' })).toContainText('1 documento')
  await expect(page.getByText('Más vendidos')).toHaveCount(0)

  await expect(page.getByTestId('setup-guide')).toBeVisible()
  await expect(page.locator('.v-progress-circular')).toHaveCount(0)
  await page.screenshot({ path: '../screenshots/ventas-facturacion-dashboard-conjunto-1440.png', fullPage: true })
})

test('si el resumen no carga lo dice y deja reintentar, en vez de quedar en blanco', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)

  await page.route('**/api/dashboard/stats', route => route.abort())
  await page.reload()
  const alert = page.getByRole('alert').filter({ hasText: 'No hay conexión con el servidor' })
  await expect(alert).toContainText('Revisa tu internet e inténtalo de nuevo.')

  await page.unroute('**/api/dashboard/stats')
  await alert.getByRole('button', { name: 'Reintentar' }).click()
  await expect(alert).toHaveCount(0)
  await expect(page.getByText('Pedidos hoy', { exact: true })).toBeVisible()
})
