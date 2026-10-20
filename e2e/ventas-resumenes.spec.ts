import { expect, test } from '@playwright/test'
import { ADMIN, API, SHOP_WITH_FEES, apiLogin, createCompany, freezeTime, issueDocuments, loginUI } from './helpers'

/**
 * Ventas: además del listado, un resumen por producto (unidades, neto,
 * ganancia) y por mesa, cada uno descargable en Excel con los mismos filtros.
 */
test('resumen por producto y por mesa con descarga a Excel', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Resumen E2E' } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Empanada Resumen',
      type: 'final',
      unit: 'und',
      unit_cost: 1000,
      sale_price: 2500,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  // Una mesa libre de las que ya tiene el negocio (crear otra puede chocar
  // con el límite del plan).
  const tables = await request.get(`${API}/tables/available`, { headers: auth })
  const freeTable = (await tables.json()).data.find((t: any) => t.status === 'available')
  const tableId = freeTable.id
  const tableName: string = freeTable.display_name

  let paidAt = ''
  for (const quantity of [3, 1]) {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { dining_table_id: tableId, items: [{ product_id: productId, quantity }] },
    })
    const orderId = (await order.json()).data.id
    const paid = await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
    paidAt = (await paid.json()).data.paid_at
  }

  await freezeTime(page, paidAt)
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')

  // Por producto: 4 unidades en 2 ventas, neto 10.000, ganancia 6.000.
  await page.getByRole('button', { name: 'Por producto' }).click()
  const productRow = page.locator('tr', { hasText: 'Empanada Resumen' })
  await expect(productRow).toContainText('Resumen E2E')
  await expect(productRow).toContainText('4')
  await expect(productRow).toContainText('$10.000')
  await expect(productRow).toContainText('$6.000')
  // Without automatic billing the view reads as it always did: no services, no share, no origin.
  await expect(page.getByRole('columnheader', { name: 'Producto', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Participación' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Origen de las ventas' })).toHaveCount(0)

  // Por mesa: la mesa 77 con sus 2 ventas.
  await page.getByRole('button', { name: 'Por mesa' }).click()
  const tableRow = page.locator('tr', { hasText: tableName }).first()
  await expect(tableRow).toContainText('2')
  await expect(tableRow).toContainText('$10.000')

  // El Excel descarga la vista activa.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar Excel' }).click(),
  ])
  expect(download.suggestedFilename()).toContain('ventas_por_mesa')
})

/**
 * A shop next to the fees: what the documents billed is "Servicios", one row
 * per concept however each document wrote it, next to the products the
 * orders sold; the origin shows products only, services only or both.
 */
test('con facturación automática por producto agrupa lo facturado en Servicios y deja ver productos, servicios o todo', async ({ page, request }) => {
  const company = await createCompany(request, 'servicios', { business_type: 'recurring', modules: SHOP_WITH_FEES })
  const auth = { Authorization: `Bearer ${company.token}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Tienda' } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Gaseosa Tienda', type: 'final', unit: 'und', unit_cost: 1000, sale_price: 2500,
      tracks_stock: false, category_id: (await category.json()).data.id,
    },
  })
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { order_type: 'takeaway', payment_status: 'paid', items: [{ product_id: (await product.json()).data.id, quantity: 2 }] },
  })
  expect(order.ok(), await order.text()).toBeTruthy()

  // The fee written two ways is one service, named as most documents wrote it; a cancelled document is no sale.
  const [ana, , , , dario] = await issueDocuments(request, company.token, [
    { name: 'Ana Apto 101', document_number: '1001', monthly_fee: 250000 },
    { name: 'Eva Apto 105', document_number: '1005', monthly_fee: 100000 },
    { name: 'Beto Apto 102', document_number: '1002', monthly_fee: 150000, billing_concept: 'cuota de administración' },
    { name: 'Carla Parqueadero 7', document_number: '1003', monthly_fee: 80000, billing_concept: 'Cuota parqueadero' },
    { name: 'Darío Apto 104', document_number: '1004', monthly_fee: 60000 },
  ])
  expect((await request.post(`${API}/recurring-billing/invoices/${dario!.id}/cancel`, { headers: auth })).ok()).toBeTruthy()

  await freezeTime(page, ana!.issued_at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/ventas')
  await page.getByRole('button', { name: 'Por producto' }).click()

  const fee = page.locator('tbody tr', { hasText: /cuota de administración/i })
  const parking = page.locator('tbody tr', { hasText: 'Cuota parqueadero' })
  const soda = page.locator('tbody tr', { hasText: 'Gaseosa Tienda' })
  const netSold = page.getByText('Neto vendido', { exact: true }).locator('..')
  const totalSold = page.locator('.v-card', { hasText: 'Total vendido' })
  const origin = page.getByRole('group', { name: 'Origen de las ventas' })

  // Todos: $500.000 + $80.000 of services and $5.000 of products, each a share of $585.000.
  await expect(origin.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  await expect(origin.getByRole('button', { name: 'Productos' })).toBeVisible()
  await expect(origin.getByRole('button', { name: 'Servicios' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Participación' })).toBeVisible()
  await expect(netSold).toContainText('$585.000')
  await expect(fee).toHaveCount(1)
  await expect(fee.locator('td').first()).toHaveText('Cuota de administración')
  await expect(fee).toContainText('Servicios')
  await expect(fee).toContainText('$500.000')
  await expect(fee).toContainText('85,5 %')
  await expect(parking).toContainText('Servicios')
  await expect(parking).toContainText('$80.000')
  await expect(parking).toContainText('13,7 %')
  await expect(soda).toContainText('Tienda')
  await expect(soda).toContainText('$5.000')
  await expect(soda).toContainText('0,9 %')
  await expect(totalSold).toContainText('$585.000')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/ventas-servicios-por-producto-1440.png', fullPage: true })

  // Servicios: only what was billed, its share of $580.000; the totals on top follow.
  await origin.getByRole('button', { name: 'Servicios' }).click()
  await expect(soda).toHaveCount(0)
  await expect(netSold).toContainText('$580.000')
  await expect(totalSold).toContainText('$580.000')
  await expect(fee).toContainText('86,2 %')
  await expect(parking).toContainText('13,8 %')

  // Productos: only what the orders sold.
  await origin.getByRole('button', { name: 'Productos' }).click()
  await expect(fee).toHaveCount(0)
  await expect(parking).toHaveCount(0)
  await expect(netSold).toContainText('$5.000')
  await expect(totalSold).toContainText('$5.000')
  await expect(soda).toContainText('100 %')

  // The same choice is "Pedidos" in the list of sales.
  await page.getByRole('button', { name: 'Ventas', exact: true }).click()
  await expect(origin.getByRole('button', { name: 'Pedidos' })).toHaveAttribute('aria-pressed', 'true')

  await origin.getByRole('button', { name: 'Todos' }).click()
  await page.getByRole('button', { name: 'Por producto' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(fee).toContainText('85,5 %')
  await expect(totalSold).toContainText('$585.000')
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/ventas-servicios-por-producto-390.png', fullPage: true })
})

/**
 * Lo normal en un restaurante es vender ítems del menú. Con dos ítems
 * distintos vendidos, "Por producto" respondía 500 (Server Error) mientras
 * "Todas" y "Por mesa" funcionaban.
 */
test('por producto carga cuando se vendieron varios ítems del menú', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Menú Resumen ${Date.now()}` } })
  const categoryId = (await category.json()).data.id
  const menuItem = async (name: string, price: number, cost: number) => {
    const product = await request.post(`${API}/products`, {
      headers: auth,
      data: { name, type: 'final', unit: 'und', unit_cost: cost, sale_price: price, tracks_stock: false, category_id: categoryId },
    })
    const created = await request.post(`${API}/menu-items`, {
      headers: auth,
      data: { name, final_product_id: (await product.json()).data.id, category_id: categoryId, base_price: price },
    })
    return (await created.json()).data.id
  }
  const burger = await menuItem('Hamburguesa Menú E2E', 18000, 7000)
  const juice = await menuItem('Jugo Menú E2E', 6000, 2000)

  let paidAt = ''
  for (const [menuItemId, quantity] of [[burger, 2], [juice, 1]]) {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { items: [{ menu_item_id: menuItemId, quantity }] },
    })
    const orderId = (await order.json()).data.id
    const paid = await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
    paidAt = (await paid.json()).data.paid_at
  }

  await freezeTime(page, paidAt)
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')
  await page.getByRole('button', { name: 'Por producto' }).click()

  // Neto 36.000 y costo 14.000 del producto final: ganancia 22.000.
  const burgerRow = page.locator('tr', { hasText: 'Hamburguesa Menú E2E' })
  await expect(burgerRow).toContainText('$36.000')
  await expect(burgerRow).toContainText('$22.000')
  await expect(page.locator('tr', { hasText: 'Jugo Menú E2E' })).toContainText('$4.000')
  await expect(page.getByText('No fue posible cargar las ventas. Inténtalo de nuevo.')).toHaveCount(0)

  // El botón de Excel se ve como acción y explica qué descarga.
  const excel = page.getByRole('button', { name: 'Descargar Excel' })
  await expect(excel).toBeEnabled()
  await excel.hover()
  await expect(page.getByText('Descarga el resumen por producto con los filtros de arriba')).toBeVisible()
  const [download] = await Promise.all([page.waitForEvent('download'), excel.click()])
  expect(download.suggestedFilename()).toContain('ventas_por_producto')
})

test('sin ventas el botón de Excel dice por qué está apagado', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')
  await page.getByLabel('Desde').fill('2001-01-01')
  await page.getByLabel('Hasta').fill('2001-01-31')

  await expect(page.getByRole('button', { name: 'Descargar Excel' })).toBeDisabled()
  await page.getByRole('button', { name: 'Descargar Excel' }).locator('..').hover()
  await expect(page.getByText('No hay ventas con estos filtros para descargar')).toBeVisible()
})

/**
 * El orden de la tabla "Por producto" responde a la columna que se toca: el
 * usuario puede ver primero lo que más neto dejó o lo que menos.
 */
test('el sorting de por producto ordena por la columna elegida', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Sort E2E' } })
  const categoryId = (await category.json()).data.id

  const make = async (name: string, price: number) => {
    const res = await request.post(`${API}/products`, {
      headers: auth,
      data: {
        name, type: 'final', unit: 'und', unit_cost: 500,
        sale_price: price, tracks_stock: false, category_id: categoryId,
      },
    })
    return (await res.json()).data.id
  }

  // Barato (neto bajo) y caro (neto alto), cada uno en su venta.
  const cheap = await make('ZZZ Barato Sort', 1000)
  const pricey = await make('AAA Caro Sort', 9000)
  let paidAt = ''
  for (const productId of [cheap, pricey]) {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { items: [{ product_id: productId, quantity: 1 }] },
    })
    const orderId = (await order.json()).data.id
    const paid = await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
    paidAt = (await paid.json()).data.paid_at
  }

  await freezeTime(page, paidAt)
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')
  await page.getByRole('button', { name: 'Por producto' }).click()

  const names = () =>
    page.locator('tbody tr td:first-child').allInnerTexts()

  // Por defecto ordena por neto descendente: el caro va primero.
  const sortRows = page.locator('tbody tr', { hasText: 'Sort' })
  await expect(sortRows.first()).toContainText('AAA Caro Sort')

  // Al tocar "Neto" alterna a ascendente: el barato sube.
  await page.getByRole('columnheader', { name: 'Neto' }).click()
  await expect
    .poll(async () => (await names()).filter(n => n.includes('Sort'))[0])
    .toContain('ZZZ Barato Sort')
})
