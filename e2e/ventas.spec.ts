import { expect, test, type Locator, type Page } from '@playwright/test'
import { ADMIN, API, SHOP_WITH_FEES, apiLogin, createCompany, field, freezeTime, issueDocuments, loginUI, raisePlanLimits } from './helpers'

/** The cell of `row` under the column `header` of the sales list. */
async function cellUnder(page: Page, row: Locator, header: string): Promise<Locator> {
  const headers = (await page.locator('.v-data-table thead th').allInnerTexts()).map(text => text.trim())
  const index = headers.indexOf(header)
  expect(index, `columna «${header}»`).toBeGreaterThanOrEqual(0)
  return row.locator('td').nth(index)
}

/**
 * Pestaña de Ventas: solo los pedidos PAGADOS cuentan, los totales se ven
 * arriba, el método de pago filtra y el Excel se puede descargar.
 */
test('las ventas pagadas aparecen con su total y el filtro de método funciona', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Ventas E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Limonada E2E',
      type: 'final',
      unit: 'unidad',
      unit_cost: 1000,
      sale_price: 7000,
      current_stock: 20,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  // Una venta en efectivo y otra por transferencia; una tercera sin pagar. Cada
  // una a un cliente registrado: Ventas lee su nombre en la columna Cliente.
  const stamp = Date.now() % 1_000_000_000
  const registered = async (name: string, n: number): Promise<number> => {
    const customer = await request.post(`${API}/customers`, {
      headers: auth,
      data: { document_type: 'CC', document_number: `${stamp}${n}`, name },
    })
    expect(customer.status(), await customer.text()).toBe(201)
    return (await customer.json()).data.id
  }
  const newOrder = async (): Promise<number> => (await (await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: productId, quantity: 1 }] },
  })).json()).data.id
  const payOrder = async (method: string, customer: string, n: number) => {
    const payment = await request.post(`${API}/orders/${await newOrder()}/pay`, {
      headers: auth,
      data: { payment_method: method, customer_id: await registered(customer, n) },
    })
    expect(payment.ok()).toBeTruthy()
  }

  await payOrder('cash', 'Cliente Efectivo E2E', 1)
  await payOrder('transfer', 'Cliente Transfer E2E', 2)
  const unpaid = await request.put(`${API}/orders/${await newOrder()}`, {
    headers: auth,
    data: { customer_id: await registered('Cliente Impago E2E', 3) },
  })
  expect(unpaid.ok()).toBeTruthy()

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')

  // Las pagadas aparecen; la impaga no es una venta.
  await expect(page.locator('tr', { hasText: 'Cliente Efectivo E2E' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Cliente Transfer E2E' })).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Cliente Impago E2E' })).toHaveCount(0)

  // Quien tomó el pedido es el vendedor, la misma palabra de Informes.
  await expect(field(page, 'Vendedor')).toBeVisible()
  await expect(field(page, 'Mesero')).toHaveCount(0)

  // Filtrar por transferencia deja solo esa venta.
  await field(page, 'Método de pago').click()
  await page.getByRole('option', { name: 'Transferencia' }).click()
  await expect(page.locator('tr', { hasText: 'Cliente Efectivo E2E' })).toHaveCount(0)
  await expect(page.locator('tr', { hasText: 'Cliente Transfer E2E' })).toBeVisible()

  // El Excel se descarga con los filtros puestos.
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Descargar Excel/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^ventas_.*\.xlsx$/)
})

/**
 * A sale reads by the current name of its method; a close froze the names it
 * had, so renaming a method never rewrites a closed shift.
 */
test('renombrar una forma de pago cambia cómo se lee la venta, no el cierre de caja ya hecho', async ({ page, request }) => {
  const company = await createCompany(request, `ventas-formas-${Date.now()}`, { business_type: 'restaurant' })
  const auth = { Authorization: `Bearer ${company.token}`, Accept: 'application/json' }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Bebidas' } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Limonada Nequi', type: 'final', unit: 'und', sale_price: 6300, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: (await product.json()).data.id, quantity: 1 }] } })
  const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, { headers: auth, data: { payment_method: 'nequi' } })
  expect(paid.ok(), await paid.text()).toBeTruthy()
  // A payment in the close's own second belongs to the next shift.
  await new Promise(resolve => setTimeout(resolve, 1000))
  const shift = (await (await request.get(`${API}/cash-register/current`, { headers: auth })).json()).data
  expect((await request.post(`${API}/cash-register/${shift.id}/close`, { headers: auth, data: {} })).ok()).toBeTruthy()
  const methods = (await (await request.get(`${API}/payment-methods?all=1`, { headers: auth })).json()).data
  const nequi = methods.find((method: { key: string }) => method.key === 'nequi')
  const renamed = await request.put(`${API}/payment-methods/${nequi.id}`, { headers: auth, data: { name: 'Nequi del negocio' } })
  expect(renamed.ok(), await renamed.text()).toBeTruthy()

  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/ventas')
  const sale = page.locator('tbody tr', { hasText: '$6.300' })
  await expect(sale).toBeVisible()
  await expect(await cellUnder(page, sale, 'Método')).toHaveText('Nequi del negocio')
  await expect(page.getByText('Nequi del negocio: $6.300')).toBeVisible()

  await page.getByRole('button', { name: 'Cierres de caja' }).click()
  const close = page.locator('.v-data-table tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^\\s*${shift.number}\\s*$`) }) })
  await expect(close).toContainText('Nequi: $6.300')
  await expect(close).not.toContainText('Nequi del negocio')
})

/**
 * A sale nobody identified is the consumidor final's, whatever its order is
 * called: "Cliente" when nobody gave a name, or the table's name, which the
 * waiter app sends as the order's customer. The table reads under Mesa.
 */
test('una venta sin nombre es de un consumidor final, su mesa se lee en Mesa y se identifica con su comprobante', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Consumidor E2E ${Date.now()}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Tinto Anónimo E2E', type: 'final', unit: 'unidad', unit_cost: 500, sale_price: 2347,
      current_stock: 10, tracks_stock: true, category_id: (await category.json()).data.id,
    },
  })
  const productId = (await product.json()).data.id
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id
  expect((await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: {} })).ok()).toBeTruthy()

  await raisePlanLimits(request, { max_tables: 60 })
  const nickname = `Terraza ${Date.now()}`
  const tables = (await (await request.get(`${API}/tables`, { headers: auth })).json()).data
  const table = await request.post(`${API}/tables`, {
    headers: auth,
    data: { number: Math.max(0, ...tables.map((t: { number: number }) => t.number)) + 1, nickname, capacity: 4 },
  })
  expect(table.status()).toBe(201)
  const fromApp = await request.post(`${API}/orders`, {
    headers: auth,
    data: { dining_table_id: (await table.json()).data.id, customer_name: nickname, items: [{ product_id: productId, quantity: 2 }] },
  })
  expect(fromApp.status()).toBe(201)
  expect((await request.post(`${API}/orders/${(await fromApp.json()).data.id}/pay`, { headers: auth, data: {} })).ok()).toBeTruthy()

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/ventas')

  await expect(page.getByRole('columnheader', { name: 'Comprobante' })).toBeVisible()
  const row = page.locator('tr', { hasText: '$2.347' })
  await expect(row).toContainText('Consumidor final')
  await expect(row).not.toContainText(/^Cliente$/)
  // A counter sale has no table.
  await expect(await cellUnder(page, row, 'Mesa')).toHaveText('—')
  const tableRow = page.locator('tr', { hasText: '$4.694' })
  await expect(await cellUnder(page, tableRow, 'Mesa')).toHaveText(nickname)
  await expect(await cellUnder(page, tableRow, 'Cliente')).toHaveText('Consumidor final')
  // Without automatic billing the page reads as it always did.
  await expect(page.getByRole('columnheader', { name: 'Fecha de pago' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Propina' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Origen' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Origen de las ventas' })).toHaveCount(0)
})

/**
 * A condominium with a little shop: each issued document is a sale of its
 * day (paid or not), next to the orders, and the origin tells them apart.
 */
test('con facturación automática los documentos son ventas con su número, cliente, origen y estado', async ({ page, request }) => {
  const company = await createCompany(request, 'ventas-cuotas', { business_type: 'recurring', modules: SHOP_WITH_FEES })
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
    data: {
      order_type: 'takeaway', customer_name: 'Cliente Tienda E2E', payment_status: 'paid',
      items: [{ product_id: (await product.json()).data.id, quantity: 2 }],
    },
  })
  expect(order.ok(), await order.text()).toBeTruthy()

  const [ana, beto] = await issueDocuments(request, company.token, [
    { name: 'Ana Apto 101', document_number: '1001', monthly_fee: 250000 },
    { name: 'Beto Apto 102', document_number: '1002', monthly_fee: 180000 },
  ])
  await request.post(`${API}/recurring-billing/invoices/${ana!.id}/payments`, { headers: auth, data: { amount: 50000, payment_method: 'cash' } })
  // A cancelled document is not a sale.
  expect((await request.post(`${API}/recurring-billing/invoices/${beto!.id}/cancel`, { headers: auth })).ok()).toBeTruthy()

  await freezeTime(page, ana!.issued_at)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/ventas')

  const totalCard = page.locator('.v-card', { hasText: 'Total vendido' })
  await expect(totalCard).toContainText('$255.000')
  await expect(page.locator('.v-card', { hasText: /^Ventas\s*2$/ })).toBeVisible()
  await expect(page.getByText('Pedidos: $5.000')).toBeVisible()
  await expect(page.getByText('Facturación automática: $250.000')).toBeVisible()
  await expect(page.getByText('Efectivo: $5.000')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Origen' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Fecha', exact: true })).toBeVisible()

  const document = page.locator('tbody tr', { hasText: 'CC-1' })
  await expect(document).toContainText('Ana Apto 101')
  await expect(document).toContainText('Facturación automática')
  // Sold the day it was issued, and still partly owed.
  await expect(document).toContainText('Abonada')
  await expect(document).toContainText('$250.000')
  await expect(await cellUnder(page, document, 'Mesa')).toHaveText('—')
  // With Origen and Mesa the tip column gives way, so the row fits 1440 px without scrolling.
  await expect(page.getByRole('columnheader', { name: 'Propina' })).toHaveCount(0)
  const wrapper = page.locator('.v-data-table .v-table__wrapper')
  expect(await wrapper.evaluate(table => table.scrollWidth - table.clientWidth)).toBeLessThanOrEqual(0)
  // A name typed at the counter does not identify a buyer: without a customer it is a consumidor final.
  const sale = page.locator('tbody tr', { hasText: 'Consumidor final' })
  await expect(sale).toContainText('Pedido')
  await expect(sale).toContainText('$5.000')
  await expect(page.locator('tbody tr', { hasText: 'Beto Apto 102' })).toHaveCount(0)

  await page.mouse.move(0, 0)
  await page.screenshot({ path: '../screenshots/ventas-facturacion-ventas-1440.png', fullPage: true })

  // Origin filter: only the documents, then only the orders.
  const origin = page.getByRole('group', { name: 'Origen de las ventas' })
  await expect(origin.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
  await origin.getByRole('button', { name: 'Facturación automática' }).click()
  await expect(sale).toHaveCount(0)
  await expect(document).toBeVisible()
  await expect(totalCard).toContainText('$250.000')
  await origin.getByRole('button', { name: 'Pedidos' }).click()
  await expect(document).toHaveCount(0)
  await expect(sale).toBeVisible()
  await expect(totalCard).toContainText('$5.000')
  await origin.getByRole('button', { name: 'Todos' }).click()
  await expect(document).toBeVisible()

  // Found as printed.
  const search = page.getByRole('textbox', { name: 'Buscar factura o cliente' })
  await search.fill('CC-1')
  await expect(sale).toHaveCount(0)
  await expect(document).toBeVisible()
  await search.fill('')

  // Each concept is a "Servicios" row of "Por producto"; "Por mesa" says it is only orders.
  await page.getByRole('button', { name: 'Por producto' }).click()
  await expect(page.getByRole('columnheader', { name: 'Producto o concepto' })).toBeVisible()
  const concept = page.locator('tbody tr', { hasText: 'Cuota de administración' })
  await expect(concept).toContainText('Servicios')
  await expect(concept).toContainText('$250.000')
  await expect(page.locator('tbody tr', { hasText: 'Gaseosa Tienda' })).toContainText('$5.000')
  await expect(page.getByText('Lo facturado sale en la categoría Servicios, un concepto por fila y sin costo: no pasa por el kardex.')).toBeVisible()
  await page.getByRole('button', { name: 'Por mesa' }).click()
  await expect(page.getByText('Por mesa cuenta solo los pedidos: los documentos de facturación automática no tienen mesa.')).toBeVisible()

  await page.getByRole('button', { name: 'Ventas', exact: true }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(document).toBeVisible()
  await page.mouse.move(0, 0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/ventas-facturacion-ventas-390.png', fullPage: true })
})
