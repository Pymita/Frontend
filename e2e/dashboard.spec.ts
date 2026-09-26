import { expect, test, type APIRequestContext } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

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

  const lowStock = page.locator('.v-card', { hasText: 'Stock Bajo' }).filter({ has: page.locator('.v-list') })
  const flourRow = lowStock.locator('.v-list-item', { hasText: flourName })
  await expect(flourRow).toContainText('Actual: 0,5 kg')
  await expect(flourRow).toContainText('Mínimo: 500 kg')

  // 25 + 15 cobradas a $2.500 en 2 pedidos; las 30 del cancelado no suman.
  const topProducts = page.locator('.v-card', { hasText: 'Más Vendidos' })
  await expect(topProducts).toContainText('Últimos 7 días')
  const empanadaRow = topProducts.locator('.v-list-item', { hasText: empanadaName })
  await expect(empanadaRow).toContainText('40 vendidos · 2 pedidos')
  await expect(empanadaRow).toContainText('$100.000')
  await expect(empanadaRow).toContainText(/\d+(,\d)? % de las ventas/)
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
  const topProducts = page.locator('.v-card', { hasText: 'Más Vendidos' })

  const week = await expected(localDate(weekFrom), localDate(today))
  await expect(chart).toContainText('Ventas de la Semana')
  await expect(chart).toContainText(`Últimos 7 días: ${money(week.total)} en ${week.orders_count} pedidos`)
  await expect(chart.locator('canvas')).toBeVisible()

  await chart.getByRole('button', { name: 'Mes' }).click()
  const month = await expected(monthFrom, localDate(today))
  await expect(chart).toContainText('Ventas del Mes')
  await expect(chart).toContainText(`Este mes: ${money(month.total)} en ${month.orders_count}`)
  await expect(topProducts).toContainText('Este mes')
  await expect(topProducts.locator('.v-list-item', { hasText: juiceName })).toContainText('3 vendidos · 1 pedido')

  // El rango arranca con el periodo que se estaba viendo.
  await chart.getByRole('button', { name: 'Rango' }).click()
  await expect(chart).toContainText('Ventas del Periodo')
  const from = chart.getByLabel('Desde')
  const to = chart.getByLabel('Hasta')
  await expect(from).toHaveValue(monthFrom)
  await expect(to).toHaveValue(localDate(today))

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
