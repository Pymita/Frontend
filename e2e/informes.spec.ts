import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import {
  ADMIN,
  API,
  PLATFORM,
  apiLogin,
  createCompany,
  displayDate,
  field,
  freezeTime,
  issueDocuments,
  loginUI,
  openSidebarGroup,
  sidebarItem,
  xlsxRows,
} from './helpers'

/**
 * Informes: one page, driven by /reports/definitions. Arrange by API, read
 * what the owner reads: each seller's sales in COP, the "Total" row equal to
 * Ventas, the columns and grouping she chose, the Excel.
 */

type Auth = Record<string, string>

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/** A restaurant of its own: its sales are only what the test charges. */
async function createRestaurant(request: APIRequestContext, slug: string) {
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const credentials = { email: `admin.${slug}@e2e.test`, password: 'negocio2026' }
  const response = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `E2E ${slug}`, slug, business_type: 'restaurant', admin: { name: 'Dueña Informes', ...credentials } },
  })
  expect(response.status(), await response.text()).toBe(201)
  const token = await apiLogin(request, credentials.email, credentials.password)
  return { slug, credentials, auth: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
}

async function createProduct(request: APIRequestContext, auth: Auth, name: string, price: number): Promise<number> {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name, type: 'final', unit: 'und', sale_price: price, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  expect(product.status(), await product.text()).toBe(201)
  return (await product.json()).data.id
}

/** An order charged in one go; returns when it was created (the day it counts). */
async function chargeOrder(
  request: APIRequestContext,
  auth: Auth,
  productId: number,
  quantity: number,
  charge: { payment_method: string; tip?: number },
): Promise<string> {
  const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity }] } })
  expect(order.status(), await order.text()).toBe(201)
  const created = (await order.json()).data
  const paid = await request.post(`${API}/orders/${created.id}/pay`, { headers: auth, data: charge })
  expect(paid.ok(), await paid.text()).toBeTruthy()
  return created.created_at
}

/**
 * A seller with two sales (cash; Nequi with a $3.000 tip) and the admin with
 * one: $30.000 + $40.000 sold, the tip apart.
 */
async function arrangeSales(request: APIRequestContext) {
  const shop = await createRestaurant(request, `informes-${Date.now()}`)
  const seller = { name: 'Vendedora Informes', username: 'vendedora.informes', password: 'secreto123' }
  const created = await request.post(`${API}/users`, {
    headers: shop.auth,
    data: { name: seller.name, username: seller.username, password: seller.password, role: 'employee', permissions: ['orders', 'reports'], can_charge_orders: true },
  })
  expect(created.status(), await created.text()).toBe(201)
  const sellerAuth = { Authorization: `Bearer ${await apiLogin(request, seller.username, seller.password, shop.slug)}`, Accept: 'application/json' }

  const productId = await createProduct(request, shop.auth, 'Arepa Informe', 10000)
  await chargeOrder(request, sellerAuth, productId, 1, { payment_method: 'cash' })
  await chargeOrder(request, sellerAuth, productId, 2, { payment_method: 'nequi', tip: 3000 })
  const at = await chargeOrder(request, shop.auth, productId, 4, { payment_method: 'transfer' })
  return { ...shop, seller, at }
}

const table = (page: Page) => page.locator('.v-data-table')
const bodyRow = (page: Page, text: string) => table(page).locator('tbody tr', { hasText: text })
const totalRow = (page: Page) => table(page).locator('tfoot tr')
const headerTexts = async (page: Page) => (await table(page).locator('thead th').allInnerTexts()).map(text => text.trim())

/** The cell of `row` under the column `header`. */
async function cellUnder(page: Page, row: Locator, header: string): Promise<Locator> {
  const index = (await headerTexts(page)).indexOf(header)
  expect(index, `columna «${header}»`).toBeGreaterThanOrEqual(0)
  return row.locator('td').nth(index)
}

/**
 * Every report the picker offers. The menu renders only the options that fit,
 * so it is scrolled to the end, collecting the titles on the way.
 */
async function reportTitles(page: Page): Promise<string[]> {
  await field(page, 'Informe').click()
  const titles = new Set<string>()
  for (let step = 0; step < 30; step++) {
    for (const text of await page.locator('.v-overlay--active .v-list-item-title').allInnerTexts()) titles.add(text.trim())
    const atEnd = await page.getByRole('listbox').evaluate(list => {
      let node: HTMLElement | null = list as HTMLElement
      while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement
      if (!node) return true
      const end = node.scrollTop + node.clientHeight >= node.scrollHeight - 1
      node.scrollBy(0, node.clientHeight / 2)
      return end
    })
    await page.waitForTimeout(100)
    if (atEnd) break
  }
  await page.keyboard.press('Escape')
  return [...titles]
}

async function chooseReport(page: Page, title: string): Promise<void> {
  await field(page, 'Informe').click()
  const option = page.getByRole('option').filter({ has: page.locator('.v-list-item-title', { hasText: new RegExp(`^${title}$`) }) })
  for (let step = 0; step < 30 && (await option.count()) === 0; step++) {
    await page.getByRole('listbox').evaluate(list => {
      let node: HTMLElement | null = list as HTMLElement
      while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement
      node?.scrollBy(0, node.clientHeight / 2)
    })
    await page.waitForTimeout(100)
  }
  await option.click()
  await expect(field(page, 'Informe')).toContainText(title)
}

async function openColumns(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: /^Columnas/ }).click()
  const menu = page.locator('.v-overlay--active .v-card', { hasText: 'Restablecer columnas' })
  await expect(menu).toBeVisible()
  return menu
}

async function openInformesFromSidebar(page: Page): Promise<void> {
  await openSidebarGroup(page, 'Administración')
  await sidebarItem(page, 'Informes').click()
  await expect(page).toHaveURL(/\/informes$/)
  await expect(page.getByRole('heading', { name: 'Informes', level: 1 })).toBeVisible()
}

test('ventas por fecha y vendedor: cada vendedor con lo suyo, el total igual a Ventas y la propina aparte', async ({ page, request }) => {
  const shop = await arrangeSales(request)
  await freezeTime(page, shop.at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)
  await openInformesFromSidebar(page)
  await chooseReport(page, 'Ventas por fecha y vendedor')

  const seller = bodyRow(page, shop.seller.name)
  const admin = bodyRow(page, 'Dueña Informes')
  await expect(seller).toHaveCount(1)
  await expect(await cellUnder(page, seller, 'Ventas')).toHaveText('$30.000')
  await expect(await cellUnder(page, seller, 'N.º de ventas')).toHaveText('2')
  await expect(await cellUnder(page, admin, 'Ventas')).toHaveText('$40.000')
  await expect(await cellUnder(page, admin, 'N.º de ventas')).toHaveText('1')
  // The tip is not a sale: $70.000, not $73.000.
  await expect(await cellUnder(page, totalRow(page), 'Ventas')).toHaveText('$70.000')
  await expect(await cellUnder(page, totalRow(page), 'N.º de ventas')).toHaveText('3')
  await expect(totalRow(page).locator('td').first()).toHaveText('Total')

  // The same day in Ventas sells the same.
  await page.goto('/ventas')
  await expect(page.locator('.v-card', { hasText: 'Total vendido' })).toContainText('$70.000')
  await expect(page.locator('.v-card', { hasText: 'Propinas' }).first()).toContainText('$3.000')
})

test('las columnas elegidas se recuerdan al recargar, se restablecen y agrupar por mes dice el mes', async ({ page, request }) => {
  const shop = await arrangeSales(request)
  await freezeTime(page, shop.at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)
  await page.goto('/informes')
  await chooseReport(page, 'Ventas por fecha y vendedor')
  await expect(bodyRow(page, shop.seller.name)).toHaveCount(1)

  // On: the tips; off: the share.
  let menu = await openColumns(page)
  // The grouping's columns are always there.
  await expect(menu.getByLabel('Vendedor', { exact: true })).toBeDisabled()
  await expect(menu.getByLabel('Vendedor', { exact: true })).toBeChecked()
  await menu.getByLabel('Propinas', { exact: true }).check()
  await menu.getByLabel('Participación', { exact: true }).uncheck()
  await page.keyboard.press('Escape')
  await expect(table(page).getByRole('columnheader', { name: 'Propinas' })).toBeVisible()
  await expect(table(page).getByRole('columnheader', { name: 'Participación' })).toHaveCount(0)
  await expect(await cellUnder(page, bodyRow(page, shop.seller.name), 'Propinas')).toHaveText('$3.000')
  await expect(await cellUnder(page, totalRow(page), 'Propinas')).toHaveText('$3.000')

  await page.reload()
  await expect(field(page, 'Informe')).toContainText('Ventas por fecha y vendedor')
  await expect(table(page).getByRole('columnheader', { name: 'Propinas' })).toBeVisible()
  await expect(table(page).getByRole('columnheader', { name: 'Participación' })).toHaveCount(0)

  menu = await openColumns(page)
  await menu.getByRole('button', { name: 'Restablecer columnas' }).click()
  await page.keyboard.press('Escape')
  await expect(table(page).getByRole('columnheader', { name: 'Propinas' })).toHaveCount(0)
  await expect(table(page).getByRole('columnheader', { name: 'Participación' })).toBeVisible()

  // Grouped by month instead of day: the row reads the month in Spanish.
  await field(page, 'Agrupar por').click()
  await page.getByRole('option', { name: 'Día', exact: true }).click()
  await page.getByRole('option', { name: 'Mes', exact: true }).click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('listbox')).toBeHidden()
  await expect(table(page).getByRole('columnheader', { name: 'Mes', exact: true })).toBeVisible()
  await expect(table(page).getByRole('columnheader', { name: 'Día', exact: true })).toHaveCount(0)
  const day = new Date(shop.at)
  const month = `${MONTHS[day.getMonth()]} de ${day.getFullYear()}`
  await expect(await cellUnder(page, bodyRow(page, shop.seller.name), 'Mes')).toHaveText(month)
})

test('el Excel trae las columnas de la pantalla, la fila Total y los filtros en otra hoja', async ({ page, request }) => {
  const shop = await arrangeSales(request)
  await freezeTime(page, shop.at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)
  await page.goto('/informes')
  await chooseReport(page, 'Ventas por fecha y vendedor')
  await expect(bodyRow(page, shop.seller.name)).toHaveCount(1)
  const visible = await headerTexts(page)

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^informe-ventas-por-fecha-y-vendedor-.*\.xlsx$/)

  const file = readFileSync(await download.path())
  const rows = xlsxRows(file).filter(row => row.some(cell => cell !== ''))
  expect(rows[0]).toEqual(visible)
  const sellerRow = rows.find(row => row.includes(shop.seller.name))!
  expect(sellerRow[visible.indexOf('Ventas')]).toBe('30000')
  const total = rows.at(-1)!
  expect(total[0]).toBe('Total')
  expect(total[visible.indexOf('Ventas')]).toBe('70000')

  const filters = xlsxRows(file, 2)
  expect(filters).toContainEqual(['Informe', 'Ventas por fecha y vendedor'])
  expect(filters).toContainEqual(['Agrupado por', 'Día y Vendedor'])
})

test('productos con saldo: la compra de 10 a $2.000 vale $20.000 y queda bajo el mínimo de 15', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const name = `Harina Informe ${Date.now()}`
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name, type: 'raw_material', unit: 'kg', unit_cost: 0, current_stock: 0, minimum_stock: 15,
      tracks_stock: true, category_id: (await category.json()).data.id,
    },
  })
  expect(product.status(), await product.text()).toBe(201)
  const types = (await (await request.get(`${API}/document-types`, { headers: auth })).json()).data
  const purchase = await request.post(`${API}/kardex/movements`, {
    headers: auth,
    data: {
      document_type_id: types.find((type: { code: string }) => type.code === 'FC').id,
      movement_type: 'in',
      items: [{ product_id: (await product.json()).data.id, quantity: 10, unit_cost: 2000 }],
      counterparty: 'Molino Informes E2E',
      reference: `FC-${Date.now()}`,
    },
  })
  expect(purchase.status(), await purchase.text()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/informes')
  await chooseReport(page, 'Productos con saldo')
  await expect(field(page, 'Saldo al')).toBeVisible()
  await field(page, 'Buscar').locator('input').fill(name)

  const row = bodyRow(page, name)
  await expect(row).toHaveCount(1)
  await expect(await cellUnder(page, row, 'Saldo')).toHaveText('10')
  await expect(await cellUnder(page, row, 'Valor')).toHaveText('$20.000')
  await expect(await cellUnder(page, row, 'Estado')).toHaveText('Bajo mínimo')

  await field(page, 'Solo bajo mínimo o agotados').getByRole('checkbox').check()
  await expect(row).toHaveCount(1)
  await expect(await cellUnder(page, totalRow(page), 'Valor')).toHaveText('$20.000')
})

test('un conjunto ve sus informes, no los de pedidos ni kardex, y más de 366 días lo explica el API', async ({ page, request }) => {
  const company = await createCompany(request, 'informes-conjunto', { business_type: 'recurring' })
  const [document] = await issueDocuments(request, company.token, [
    { name: 'Ana Informes 101', document_number: '7101', monthly_fee: 250000 },
  ])
  await freezeTime(page, document!.issued_at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await openInformesFromSidebar(page)

  const titles = await reportTitles(page)
  for (const title of ['Ventas por fecha y vendedor', 'Clientes con saldo', 'Documentos de facturación automática por período']) {
    expect(titles).toContain(title)
  }
  for (const title of ['Propinas por mesero', 'Movimientos del kardex por producto', 'Productos con saldo']) {
    expect(titles).not.toContain(title)
  }

  await chooseReport(page, 'Clientes con saldo')
  await expect(await cellUnder(page, bodyRow(page, 'Ana Informes 101'), 'Saldo')).toHaveText('$250.000')

  await chooseReport(page, 'Ventas por fecha y vendedor')
  await field(page, 'Desde').locator('input').fill(displayDate('2024-01-01'))
  await field(page, 'Desde').locator('input').press('Enter')
  await expect(page.getByRole('alert').filter({ hasText: 'El rango puede ser de máximo 366 días. Elige un periodo más corto.' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled()
})
