import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import {
  ADMIN,
  API,
  PLATFORM,
  apiLogin,
  chooseReport,
  createCompany,
  displayDate,
  field,
  freezeTime,
  issueDocuments,
  loginUI,
  openSidebarGroup,
  pickOption,
  reportTitles,
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
  for (const title of ['Propinas por mesero', 'Resumen movimiento por transacciones', 'Movimientos del kardex', 'Productos con saldo']) {
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

// --- Productos e inventario: compras por factura, el resumen del kardex y sus movimientos ---

/** Today in Bogotá (AAAA-MM-DD): the day the API dates what the test registers. */
const bogotaToday = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

/** The texts of one column of the report, top to bottom. */
async function columnTexts(page: Page, header: string): Promise<string[]> {
  const index = (await headerTexts(page)).indexOf(header)
  expect(index, `columna «${header}»`).toBeGreaterThanOrEqual(0)
  return (await table(page).locator(`tbody tr td:nth-child(${index + 1})`).allInnerTexts()).map(text => text.trim())
}

/**
 * A restaurant's purchases of the day: Molinos' first invoice (two products
 * with IVA) and its second, and an invoice of Dulces typed without a number.
 */
async function arrangePurchases(request: APIRequestContext) {
  const shop = await createRestaurant(request, `compras-${Date.now()}`)
  const stamp = Date.now() % 1_000_000
  const iva = await taxNamed(request, shop.auth, 'IVA 19%', 19)
  const flour = await createStockedProduct(request, shop.auth, `Harina Compras ${stamp}`, 3000)
  const sugar = await createStockedProduct(request, shop.auth, `Azúcar Compras ${stamp}`, 2000)
  const suppliers = { mill: `Molinos ${stamp}`, sweets: `Dulces ${stamp}` }
  const invoices = { first: `F1-${stamp}`, second: `F2-${stamp}` }
  await registerKardex(request, shop.auth, 'FC', {
    movement_type: 'in',
    counterparty: suppliers.mill,
    reference: invoices.first,
    items: [
      { product_id: flour, quantity: 10, unit_cost: 2000, tax_id: iva },
      { product_id: sugar, quantity: 5, unit_cost: 1000, tax_id: iva },
    ],
  })
  await registerKardex(request, shop.auth, 'FC', {
    movement_type: 'in',
    counterparty: suppliers.mill,
    reference: invoices.second,
    items: [{ product_id: flour, quantity: 5, unit_cost: 2200, tax_id: iva }],
  })
  await registerKardex(request, shop.auth, 'FC', {
    movement_type: 'in',
    counterparty: suppliers.sweets,
    items: [{ product_id: sugar, quantity: 2, unit_cost: 1000 }],
  })
  return { ...shop, suppliers, invoices }
}

test('compras por proveedor: cada factura del proveedor con su valor bruto, IVA y neto, la que no tiene número con su fecha, y el Excel igual', async ({ page, request }) => {
  const shop = await arrangePurchases(request)
  const today = bogotaToday()
  await freezeTime(page, new Date().toISOString())
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)

  // She had opened it when it grouped by supplier alone: it now opens per invoice anyway.
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem('user_data') ?? '{}')
    const before = { columns: ['supplier', 'invoices_count', 'gross', 'tax', 'net'], group_by: ['supplier'] }
    localStorage.setItem('pos.reports', JSON.stringify({ [user.id]: { last: 'purchases_by_supplier', purchases_by_supplier: before } }))
  })
  await page.goto('/informes')
  await expect(field(page, 'Informe')).toContainText('Compras por proveedor')
  await expect(field(page, 'Agrupar por')).toContainText('Proveedor')
  await expect(field(page, 'Agrupar por')).toContainText('Factura')
  await expect(page.getByRole('alert').filter({ hasText: 'la que se registró sin número dice «Sin número» y su fecha' })).toBeVisible()

  const noNumber = `Sin número (${displayDate(today)})`
  await expect(bodyRow(page, shop.invoices.first)).toHaveCount(1)
  expect(await headerTexts(page)).toEqual(['Proveedor', 'Factura', 'Fecha', 'Valor bruto', 'IVA', 'Valor neto', 'Unidades'])
  const expected: [string, string, string, string, string, string][] = [
    [shop.suppliers.sweets, noNumber, '$2.000', '$0', '$2.000', '2'],
    [shop.suppliers.mill, shop.invoices.first, '$25.000', '$4.750', '$29.750', '15'],
    [shop.suppliers.mill, shop.invoices.second, '$11.000', '$2.090', '$13.090', '5'],
  ]
  for (const [supplier, invoice, gross, tax, net, units] of expected) {
    const row = bodyRow(page, invoice)
    await expect(await cellUnder(page, row, 'Proveedor')).toHaveText(supplier)
    await expect(await cellUnder(page, row, 'Fecha')).toContainText(today.slice(0, 4))
    await expect(await cellUnder(page, row, 'Valor bruto')).toHaveText(gross)
    await expect(await cellUnder(page, row, 'IVA')).toHaveText(tax)
    await expect(await cellUnder(page, row, 'Valor neto')).toHaveText(net)
    await expect(await cellUnder(page, row, 'Unidades')).toHaveText(units)
  }
  // Each supplier, then its invoices in the order they came.
  expect(await columnTexts(page, 'Factura')).toEqual(expected.map(line => line[1]))
  await expect(totalRow(page).locator('td').first()).toHaveText('Total')
  await expect(await cellUnder(page, totalRow(page), 'Valor bruto')).toHaveText('$38.000')
  await expect(await cellUnder(page, totalRow(page), 'IVA')).toHaveText('$6.840')
  await expect(await cellUnder(page, totalRow(page), 'Valor neto')).toHaveText('$44.840')
  await expect(await cellUnder(page, totalRow(page), 'Unidades')).toHaveText('22')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^informe-compras-por-proveedor-.*\.xlsx$/)
  const file = readFileSync(await download.path())
  const rows = xlsxRows(file).filter(row => row.some(cell => cell !== ''))
  expect(rows[0]).toEqual(['Proveedor', 'Factura', 'Fecha', 'Valor bruto', 'IVA', 'Valor neto', 'Unidades'])
  expect(rows[1]).toEqual([shop.suppliers.sweets, noNumber, today, '2000', '0', '2000', '2'])
  expect(rows[2]).toEqual([shop.suppliers.mill, shop.invoices.first, today, '25000', '4750', '29750', '15'])
  expect(rows[3]).toEqual([shop.suppliers.mill, shop.invoices.second, today, '11000', '2090', '13090', '5'])
  expect(rows.at(-1)).toEqual(['Total', '', '', '38000', '6840', '44840', '22'])
  const filters = xlsxRows(file, 2)
  expect(filters).toContainEqual(['Informe', 'Compras por proveedor'])
  expect(filters).toContainEqual(['Agrupado por', 'Proveedor y Factura'])
})

/**
 * A product opened 40 days ago with 3 at $1.800, bought today (10 at $2.000
 * plus IVA, from a supplier of its own) and sold once.
 */
async function arrangeKardex(request: APIRequestContext) {
  const shop = await createRestaurant(request, `kardex-informe-${Date.now()}`)
  const stamp = Date.now() % 1_000_000
  const iva = await taxNamed(request, shop.auth, 'IVA 19%', 19)
  const name = `Cerveza Kardex ${stamp}`
  const productId = await createStockedProduct(request, shop.auth, name, 11900, iva, { stock: 3, cost: 1800 })
  const supplier = `Distribuidora Kardex ${stamp}`
  const reference = `FC-${stamp}`
  await registerKardex(request, shop.auth, 'FC', {
    movement_type: 'in',
    counterparty: supplier,
    reference,
    notes: 'Llegó completa',
    items: [{ product_id: productId, quantity: 10, unit_cost: 2000, tax_id: iva }],
  })
  const at = await chargeOrder(request, shop.auth, productId, 1, { payment_method: 'cash' })
  return { ...shop, name, supplier, reference, at }
}

test('resumen movimiento por transacciones: el informe renombrado cuadra saldo inicial, entradas, salidas y saldo final', async ({ page, request }) => {
  const shop = await arrangeKardex(request)
  await freezeTime(page, shop.at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)
  await page.goto('/informes')

  const titles = await reportTitles(page)
  expect(titles).toContain('Resumen movimiento por transacciones')
  expect(titles).toContain('Movimientos del kardex')
  expect(titles).not.toContain('Movimientos del kardex por producto')
  await chooseReport(page, 'Resumen movimiento por transacciones')
  await expect(field(page, 'Informe')).toContainText('¿Con qué saldo abrió y cerró cada producto, y cuánto entró y salió por cada tipo de transacción?')

  const row = bodyRow(page, shop.name)
  await expect(row).toHaveCount(1)
  await expect(await cellUnder(page, row, 'Saldo inicial')).toHaveText('3')
  await expect(await cellUnder(page, row, 'Entradas')).toHaveText('10')
  await expect(await cellUnder(page, row, 'Salidas')).toHaveText('1')
  await expect(await cellUnder(page, row, 'Saldo final')).toHaveText('12')
  await expect(await cellUnder(page, row, 'Valor final')).toHaveText('$23.446')

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^informe-resumen-movimiento-por-transacciones-.*\.xlsx$/)
  const file = readFileSync(await download.path())
  const rows = xlsxRows(file).filter(line => line.some(cell => cell !== ''))
  const headers = rows[0]!
  const product = rows.find(line => line.includes(shop.name))!
  expect(product[headers.indexOf('Saldo inicial')]).toBe('3')
  expect(product[headers.indexOf('Saldo final')]).toBe('12')
  expect(xlsxRows(file, 2)).toContainEqual(['Informe', 'Resumen movimiento por transacciones'])
})

test('movimientos del kardex: las filas y cifras de la página Kardex, columnas que se eligen y el Excel', async ({ page, request }) => {
  test.setTimeout(90_000)
  const shop = await arrangeKardex(request)
  const from = `${bogotaToday().slice(0, 8)}01`
  await freezeTime(page, shop.at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)

  // What the Kardex page reads for the product this month.
  await page.goto('/kardex')
  await page.getByRole('combobox', { name: 'Producto' }).click()
  await page.getByRole('option', { name: shop.name }).click()
  await expect(page.getByText('Existencia actual')).toBeVisible()
  await field(page, 'Desde').locator('input').fill(displayDate(from))
  await field(page, 'Desde').locator('input').press('Enter')
  const kardexOpening = page.locator('tbody tr', { hasText: 'SALDO ANTERIOR' })
  await expect(kardexOpening).toHaveCount(1)
  await expect(page.locator('tbody tr', { hasText: shop.reference })).toHaveCount(1)
  const kardexHeaders = (await page.locator('table thead th').allInnerTexts()).map(text => text.trim())
  const kardexCell = (text: string, header: string) =>
    page.locator('tbody tr', { hasText: text }).locator('td').nth(kardexHeaders.indexOf(header))
  // The opening row spans the movement columns: after its label come the balance, its cost and its total.
  const openingCells = (await kardexOpening.locator('td').allInnerTexts()).map(text => text.trim())
  const [openingBalance, , openingTotal] = openingCells.slice(openingCells.indexOf('SALDO ANTERIOR') + 1).filter(Boolean)
  const kardex = {
    opening: { balance: openingBalance, total: openingTotal },
    purchase: {
      cost: await kardexCell(shop.reference, 'Costo unit.').innerText(),
      gross: await kardexCell(shop.reference, 'Valor bruto').innerText(),
      net: await kardexCell(shop.reference, 'Valor neto').innerText(),
      balance: await kardexCell(shop.reference, 'Saldo cant.').innerText(),
      average: await kardexCell(shop.reference, 'Saldo costo').innerText(),
      total: await kardexCell(shop.reference, 'Saldo total').innerText(),
    },
    sale: { balance: await kardexCell('FV', 'Saldo cant.').innerText(), total: await kardexCell('FV', 'Saldo total').innerText() },
  }
  expect(kardex.opening).toEqual({ balance: '3', total: '$5.400' })
  expect(kardex.purchase.balance).toBe('13')

  await page.goto('/informes')
  await chooseReport(page, 'Movimientos del kardex')
  // One row per movement: nothing to group by.
  await expect(field(page, 'Agrupar por')).toHaveCount(0)
  await expect(field(page, 'Desde').locator('input')).toHaveValue(displayDate(from))
  await page.getByRole('combobox', { name: 'Producto' }).click()
  await page.getByRole('combobox', { name: 'Producto' }).fill(shop.name)
  await page.getByRole('option', { name: shop.name }).click()

  const opening = bodyRow(page, 'SALDO ANTERIOR')
  await expect(opening).toHaveCount(1)
  await expect(table(page).locator('tbody tr')).toHaveCount(3)
  await expect(await cellUnder(page, opening, 'Saldo cantidad')).toHaveText(kardex.opening.balance)
  await expect(await cellUnder(page, opening, 'Saldo total')).toHaveText(kardex.opening.total)
  // On by default, the Kardex page's own columns.
  expect(await headerTexts(page)).toEqual([
    'Fecha', 'Documento', 'Referencia', 'Producto', 'Cant. entrada', 'Cant. salida', 'Costo unitario', 'Valor bruto',
    'Valor IVA', 'Valor neto', 'Saldo cantidad', 'Saldo costo unit.', 'Saldo total', 'Usuario',
  ])
  const purchase = bodyRow(page, shop.reference)
  await expect(await cellUnder(page, purchase, 'Documento')).toHaveText('FC')
  await expect(await cellUnder(page, purchase, 'Producto')).toHaveText(shop.name)
  await expect(await cellUnder(page, purchase, 'Cant. entrada')).toHaveText('10')
  await expect(await cellUnder(page, purchase, 'Costo unitario')).toHaveText(kardex.purchase.cost)
  await expect(await cellUnder(page, purchase, 'Valor bruto')).toHaveText(kardex.purchase.gross)
  await expect(await cellUnder(page, purchase, 'Valor IVA')).toHaveText('$3.800')
  await expect(await cellUnder(page, purchase, 'Valor neto')).toHaveText(kardex.purchase.net)
  await expect(await cellUnder(page, purchase, 'Saldo cantidad')).toHaveText(kardex.purchase.balance)
  await expect(await cellUnder(page, purchase, 'Saldo costo unit.')).toHaveText(kardex.purchase.average)
  await expect(await cellUnder(page, purchase, 'Saldo total')).toHaveText(kardex.purchase.total)
  await expect(await cellUnder(page, purchase, 'Usuario')).toHaveText('Dueña Informes')
  const sale = bodyRow(page, 'FV')
  await expect(await cellUnder(page, sale, 'Cant. salida')).toHaveText('1')
  await expect(await cellUnder(page, sale, 'Valor neto')).toHaveText('—')
  await expect(await cellUnder(page, sale, 'Saldo cantidad')).toHaveText(kardex.sale.balance)
  await expect(await cellUnder(page, sale, 'Saldo total')).toHaveText(kardex.sale.total)
  await expect(await cellUnder(page, totalRow(page), 'Cant. entrada')).toHaveText('10')
  await expect(await cellUnder(page, totalRow(page), 'Cant. salida')).toHaveText('1')
  await expect(await cellUnder(page, totalRow(page), 'Valor IVA')).toHaveText('$3.800')
  await expect(await cellUnder(page, totalRow(page), 'Valor neto')).toHaveText('$23.800')
  await expect(await cellUnder(page, totalRow(page), 'Valor bruto')).toHaveText('')

  // The supplier, the IVA rate, the direction and the notes on (the Kardex Excel's columns), the user off.
  const menu = await openColumns(page)
  await expect(menu.getByText('Lo que agrupas siempre se muestra.')).toHaveCount(0)
  for (const label of ['Cliente/Proveedor', 'IVA %', 'Tipo', 'Notas']) await menu.getByLabel(label, { exact: true }).check()
  await menu.getByLabel('Usuario', { exact: true }).uncheck()
  await page.keyboard.press('Escape')
  await expect(table(page).getByRole('columnheader', { name: 'Notas' })).toBeVisible()
  await expect(table(page).getByRole('columnheader', { name: 'Usuario' })).toHaveCount(0)
  await expect(await cellUnder(page, purchase, 'Cliente/Proveedor')).toHaveText(shop.supplier)
  await expect(await cellUnder(page, purchase, 'IVA %')).toHaveText('19 %')
  await expect(await cellUnder(page, purchase, 'Tipo')).toHaveText('Entrada')
  await expect(await cellUnder(page, purchase, 'Notas')).toHaveText('Llegó completa')
  await expect(await cellUnder(page, sale, 'Tipo')).toHaveText('Salida')
  const visible = await headerTexts(page)

  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toMatch(/^informe-movimientos-del-kardex-.*\.xlsx$/)
  const file = readFileSync(await download.path())
  const rows = xlsxRows(file).filter(line => line.some(cell => cell !== ''))
  expect(rows[0]).toEqual(visible)
  const col = (header: string) => visible.indexOf(header)
  expect(rows[1]![col('Fecha')]).toBe(from)
  expect(rows[1]![col('Referencia')]).toBe('SALDO ANTERIOR')
  expect(rows[1]![col('Saldo cantidad')]).toBe('3')
  expect(rows[1]![col('Saldo total')]).toBe('5400')
  const sheetPurchase = rows.find(line => line.includes(shop.reference))!
  expect(sheetPurchase[col('Tipo')]).toBe('Entrada')
  expect(sheetPurchase[col('Cant. entrada')]).toBe('10')
  expect(sheetPurchase[col('Valor bruto')]).toBe('20000')
  expect(sheetPurchase[col('IVA %')]).toBe('19')
  expect(sheetPurchase[col('Valor IVA')]).toBe('3800')
  expect(sheetPurchase[col('Valor neto')]).toBe('23800')
  expect(sheetPurchase[col('Saldo cantidad')]).toBe('13')
  expect(sheetPurchase[col('Notas')]).toBe('Llegó completa')
  const total = rows.at(-1)!
  expect(total[0]).toBe('Total')
  expect(total[col('Cant. entrada')]).toBe('10')
  expect(total[col('Cant. salida')]).toBe('1')
  expect(total[col('Valor neto')]).toBe('23800')
  const filters = xlsxRows(file, 2)
  expect(filters).toContainEqual(['Informe', 'Movimientos del kardex'])
  expect(filters).toContainEqual(['Producto', shop.name])
})

// --- Contabilidad: Movimiento contable and Configurar contabilidad ---

/** The company's tax by that name; a new restaurant may already bring it. */
async function taxNamed(request: APIRequestContext, auth: Auth, name: string, rate: number): Promise<number> {
  const taxes = (await (await request.get(`${API}/taxes`, { headers: auth })).json()).data
  const existing = taxes.find((tax: { name: string; rate: number | string }) => tax.name === name && Number(tax.rate) === rate)
  if (existing) return existing.id
  const response = await request.post(`${API}/taxes`, { headers: auth, data: { name, rate } })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).data.id
}

/**
 * A product that manages stock. Its opening balance (SI, $0 unless `opening`
 * says otherwise) is dated 40 days back, before any month: the period holds
 * only what the test registers.
 */
async function createStockedProduct(
  request: APIRequestContext,
  auth: Auth,
  name: string,
  price: number,
  taxId?: number,
  opening: { stock: number; cost: number } = { stock: 0, cost: 0 },
): Promise<number> {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name, type: 'final', unit: 'und', sale_price: price, unit_cost: opening.cost, current_stock: opening.stock, tracks_stock: true,
      initial_stock_date: new Date(Date.now() - 40 * 86_400_000).toLocaleDateString('en-CA'),
      category_id: (await category.json()).data.id,
      ...(taxId ? { tax_id: taxId } : {}),
    },
  })
  expect(product.status(), await product.text()).toBe(201)
  return (await product.json()).data.id
}

async function registerKardex(request: APIRequestContext, auth: Auth, code: string, data: Record<string, unknown>): Promise<void> {
  const types = (await (await request.get(`${API}/document-types`, { headers: auth })).json()).data
  const response = await request.post(`${API}/kardex/movements`, {
    headers: auth,
    data: { document_type_id: types.find((type: { code: string }) => type.code === code).id, ...data },
  })
  expect(response.status(), await response.text()).toBe(201)
}

const accountingDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Configurar contabilidad' })
const templateEditor = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Así queda la primera fila del Excel' })
const preview = (page: Page) => page.getByRole('table', { name: 'Vista previa del movimiento contable' })
/** The preview lines that carry every one of these texts (an account, a voucher code). */
const previewRow = (page: Page, ...texts: string[]) =>
  texts.reduce((rows, text) => rows.filter({ hasText: text }), preview(page).locator('tbody tr'))
/** A figure of the summary over the preview (Asientos, Total débito…). */
const figure = (page: Page, label: string) =>
  page.getByRole('group', { name: 'Resumen del movimiento' }).getByRole('group', { name: label, exact: true })

async function previewCell(page: Page, row: Locator, header: string): Promise<Locator> {
  const index = (await preview(page).locator('thead th').allInnerTexts()).map(text => text.trim()).indexOf(header)
  expect(index, `columna «${header}»`).toBeGreaterThanOrEqual(0)
  return row.locator('td').nth(index)
}

test('contabilidad: las cuentas y los comprobantes quedan guardados, la plantilla propia ordena el Excel y el movimiento de una venta con IVA y una compra cuadra', async ({ page, request }) => {
  test.setTimeout(150_000)
  const shop = await createRestaurant(request, `contable-${Date.now()}`)
  const stamp = Date.now() % 1_000_000
  const iva = await taxNamed(request, shop.auth, 'IVA 19%', 19)
  const productId = await createStockedProduct(request, shop.auth, `Cerveza Contable ${stamp}`, 11900, iva)
  // The purchase: 10 at $5.000 before IVA, from a supplier that is not in Proveedores.
  const supplier = `Distribuidora Contable ${stamp}`
  await registerKardex(request, shop.auth, 'FC', {
    movement_type: 'in',
    items: [{ product_id: productId, quantity: 10, unit_cost: 5000, tax_id: iva }],
    counterparty: supplier,
    reference: `FC-${stamp}`,
  })
  // The sale: one at $11.900 with IVA included, in cash, with no customer.
  const at = await chargeOrder(request, shop.auth, productId, 1, { payment_method: 'cash' })
  const day = new Date(at).toLocaleDateString('en-CA')
  const from = `${day.slice(0, 8)}01`

  await freezeTime(page, at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)
  await page.goto('/informes')
  await chooseReport(page, 'Movimiento contable')
  await expect(field(page, 'Desde').locator('input')).toHaveValue(displayDate(from))
  await expect(field(page, 'Hasta').locator('input')).toHaveValue(displayDate(day))
  // The generic report controls do not apply to it.
  await expect(field(page, 'Agrupar por')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Columnas/ })).toHaveCount(0)

  // The cash account and the voucher codes of the sale and the purchase.
  await page.getByRole('button', { name: 'Configurar contabilidad' }).click()
  const dialog = accountingDialog(page)
  const cash = dialog.getByLabel('Cuenta de Efectivo', { exact: true })
  await expect(cash).toHaveValue('110505')
  await expect(dialog.getByRole('alert').filter({ hasText: /Faltan \d+ cuentas/ })).toContainText('Ingreso · Factura de facturación automática')
  await cash.fill('1105 caja')
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(dialog.getByText('La cuenta de Efectivo debe tener solo números (p. ej., 110505).').first()).toBeVisible()
  await expect(page.getByText('Contabilidad guardada.')).toHaveCount(0)
  await cash.fill('11050501')
  await dialog.getByRole('tab', { name: 'Documentos' }).click()
  const saleVoucher = dialog.getByLabel('Comprobante de Venta (factura o comprobante de venta)', { exact: true })
  const purchaseVoucher = dialog.getByLabel('Comprobante de Factura de compra', { exact: true })
  await saleVoucher.fill('F-1')
  await purchaseVoucher.fill('C-1')
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Contabilidad guardada.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Reloaded, Informes opens on the movement and the configuration kept what was typed.
  await page.reload()
  await expect(field(page, 'Informe')).toContainText('Movimiento contable')
  await page.getByRole('button', { name: 'Configurar contabilidad' }).click()
  await expect(cash).toHaveValue('11050501')
  await dialog.getByRole('tab', { name: 'Documentos' }).click()
  await expect(saleVoucher).toHaveValue('F-1')
  await expect(purchaseVoucher).toHaveValue('C-1')

  // A template of its own: "Cuenta" renamed and first, without "Base", with a fixed "Sucursal".
  await dialog.getByRole('tab', { name: 'Plantillas' }).click()
  await expect(dialog.getByText('Genérica', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Nueva plantilla' }).click()
  const editor = templateEditor(page)
  const templateName = `Siigo ${stamp}`
  await editor.getByLabel('Nombre', { exact: true }).fill(templateName)
  await field(page, 'Formato de fecha').click()
  await page.getByRole('option', { name: 'aaaa-mm-dd (2026-12-31)' }).click()
  await editor.getByLabel('Encabezado de la columna Cuenta', { exact: true }).fill('Cuenta contable')
  for (let step = 0; step < 3; step++) await editor.getByRole('button', { name: 'Subir la columna Cuenta contable', exact: true }).click()
  await expect(editor.getByRole('button', { name: 'Subir la columna Cuenta contable', exact: true })).toBeDisabled()
  await editor.getByRole('button', { name: 'Quitar la columna Base', exact: true }).click()
  await editor.getByRole('button', { name: 'Columna fija', exact: true }).click()
  await editor.getByLabel('Encabezado de la columna fija', { exact: true }).fill('Sucursal')
  await editor.getByLabel('Valor de la columna fija', { exact: true }).fill('01')
  const headers = ['Cuenta contable', 'Comprobante', 'Número', 'Fecha', 'NIT tercero', 'Nombre del tercero', 'Detalle', 'Débito', 'Crédito', 'Sucursal']
  await expect(editor.getByRole('table', { name: 'Encabezados de la plantilla' }).locator('tbody td')).toHaveText(headers)
  await editor.getByRole('button', { name: 'Guardar plantilla' }).click()
  await expect(page.getByText(`Plantilla «${templateName}» guardada.`)).toBeVisible()
  await expect(editor).toBeHidden()
  await expect(dialog.getByText(templateName, { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()

  // The preview in that template: the accounts of each line and the same total on both sides.
  await field(page, 'Plantilla').click()
  await pickOption(page, templateName)
  await page.getByRole('button', { name: 'Ver movimiento' }).click()
  await expect(preview(page).locator('thead th')).toHaveText(headers)
  const cashLine = previewRow(page, '11050501')
  await expect(cashLine).toHaveCount(1)
  await expect(await previewCell(page, cashLine, 'Débito')).toHaveText('$11.900')
  await expect(await previewCell(page, cashLine, 'Crédito')).toHaveText('')
  await expect(await previewCell(page, cashLine, 'Comprobante')).toHaveText('F-1')
  await expect(await previewCell(page, cashLine, 'Fecha')).toHaveText(day)
  await expect(await previewCell(page, cashLine, 'NIT tercero')).toHaveText('222222222222')
  await expect(await previewCell(page, cashLine, 'Nombre del tercero')).toHaveText('Consumidor final')
  await expect(await previewCell(page, cashLine, 'Sucursal')).toHaveText('01')
  const amounts: [string, string, string, string][] = [
    ['414015', 'F-1', 'Crédito', '$10.000'],
    ['240801', 'F-1', 'Crédito', '$1.900'],
    ['614015', 'F-1', 'Débito', '$5.000'],
    ['143505', 'F-1', 'Crédito', '$5.000'],
    ['143505', 'C-1', 'Débito', '$50.000'],
    ['240802', 'C-1', 'Débito', '$9.500'],
    ['220505', 'C-1', 'Crédito', '$59.500'],
  ]
  for (const [account, voucher, header, amount] of amounts) {
    const line = previewRow(page, account, voucher)
    await expect(line, `${account} ${voucher}`).toHaveCount(1)
    await expect(await previewCell(page, line, header), `${account} ${voucher}`).toHaveText(amount)
  }
  await expect(await previewCell(page, previewRow(page, '220505'), 'Nombre del tercero')).toHaveText(supplier)
  await expect(figure(page, 'Asientos')).toContainText('2')
  await expect(figure(page, 'Total débito')).toContainText('$76.400')
  await expect(figure(page, 'Total crédito')).toContainText('$76.400')
  await expect(page.getByRole('alert').filter({ hasText: 'Revisa antes de importar' })).toContainText(supplier)

  // The Excel: the template's headers in order on row 1, then every line, and no totals row.
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe(`movimiento-contable-${from}_${day}.xlsx`)
  const rows = xlsxRows(readFileSync(await download.path())).filter(row => row.some(cell => cell !== ''))
  expect(rows[0]).toEqual(headers)
  const lines = rows.slice(1)
  expect(lines).toHaveLength(8)
  const col = (header: string) => headers.indexOf(header)
  const sheetLine = (account: string, voucher: string) => {
    const found = lines.filter(line => line[col('Cuenta contable')] === account && line[col('Comprobante')] === voucher)
    expect(found, `${account} ${voucher}`).toHaveLength(1)
    return found[0]!
  }
  const cashRow = sheetLine('11050501', 'F-1')
  expect(cashRow[col('Número')]).not.toBe('')
  expect(cashRow[col('Fecha')]).toBe(day)
  expect(cashRow[col('NIT tercero')]).toBe('222222222222')
  expect(cashRow[col('Nombre del tercero')]).toBe('Consumidor final')
  // The file writes 0 on the side a line does not post on.
  expect(Number(cashRow[col('Débito')])).toBe(11900)
  expect(cashRow[col('Crédito')]).toBe('0')
  expect(cashRow[col('Sucursal')]).toBe('01')
  const payableRow = sheetLine('220505', 'C-1')
  expect(payableRow[col('Nombre del tercero')]).toBe(supplier)
  expect(payableRow[col('NIT tercero')]).toBe('')
  expect(payableRow[col('Débito')]).toBe('0')
  expect(Number(payableRow[col('Crédito')])).toBe(59500)
  for (const [account, voucher, header, amount] of amounts) {
    expect(Number(sheetLine(account, voucher)[col(header)]), `${account} ${voucher}`).toBe(Number(amount.replace(/\D/g, '')))
  }
  const sum = (header: string) => lines.reduce((total, line) => total + Number(line[col(header)] || 0), 0)
  expect(sum('Débito')).toBe(76400)
  expect(sum('Crédito')).toBe(76400)
  expect(lines.every(line => line[col('Fecha')] === day && line[col('Sucursal')] === '01')).toBe(true)
})

test('contabilidad: un período que necesita una cuenta en blanco lo explica y abre la configuración en esa cuenta', async ({ page, request }) => {
  test.setTimeout(90_000)
  const shop = await createRestaurant(request, `contable-falta-${Date.now()}`)
  const stamp = Date.now() % 1_000_000
  const productId = await createStockedProduct(request, shop.auth, `Harina Ajuste ${stamp}`, 4000)
  // Two found counting: the adjustment's "Sobrante" account comes blank.
  await registerKardex(request, shop.auth, 'AJ', {
    movement_type: 'in',
    items: [{ product_id: productId, quantity: 2, unit_cost: 1000 }],
    reference: `AJ-${stamp}`,
  })
  await freezeTime(page, new Date().toISOString())
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, shop.credentials.email, shop.credentials.password, shop.slug)
  await page.goto('/informes')
  await chooseReport(page, 'Movimiento contable')

  // Downloading says what is missing instead of a file.
  await page.getByRole('button', { name: 'Descargar Excel' }).click()
  const missing = page.getByRole('alert').filter({ hasText: 'Faltan cuentas por configurar' })
  await expect(missing).toContainText('Sobrante · Ajuste de inventario')
  await expect(missing).toContainText('Complétalas en Configurar contabilidad.')

  await missing.getByRole('button', { name: 'Configurar contabilidad' }).click()
  const dialog = accountingDialog(page)
  await expect(dialog.getByRole('tab', { name: 'Documentos' })).toHaveAttribute('aria-selected', 'true')
  const surplus = dialog.getByLabel('Cuenta de Sobrante · Ajuste de inventario', { exact: true })
  await expect(surplus).toBeFocused()
  await expect(surplus).toHaveValue('')
  await surplus.fill('425050')
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Contabilidad guardada.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click()

  // Closed, the movement is asked again with the new account.
  await expect(missing).toBeHidden()
  const surplusLine = previewRow(page, '425050')
  await expect(surplusLine).toHaveCount(1)
  await expect(await previewCell(page, surplusLine, 'Crédito')).toHaveText('$2.000')
  await expect(await previewCell(page, previewRow(page, '143505'), 'Débito')).toHaveText('$2.000')
  await expect(figure(page, 'Total débito')).toContainText('$2.000')
  await expect(figure(page, 'Total crédito')).toContainText('$2.000')
})
