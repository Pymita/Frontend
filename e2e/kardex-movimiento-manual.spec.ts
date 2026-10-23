import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, apiLogin, displayDate, field, loginUI, pickOption, raisePlanLimits } from './helpers'

type Auth = { Authorization: string }

/** A line of the movement dialog: each product of the invoice is one. */
const line = (page: Page, n: number) => page.getByRole('group', { name: `Línea ${n}` })
const lineField = (page: Page, n: number, label: string) =>
  line(page, n).locator('.v-input').filter({ has: page.getByText(label, { exact: true }) })

/** Valor bruto, IVA and Valor neto of the open dialog. */
const summaryRow = (page: Page, label: 'Valor bruto' | 'IVA' | 'Valor neto') =>
  page.getByRole('dialog').getByRole('group', { name: 'Totales del movimiento' }).locator('div', { hasText: new RegExp(`^${label}`) })

/** Kardex rows of one document, told apart by its chip. */
const rowsOf = (page: Page, code: string) =>
  page.locator('tbody tr').filter({ has: page.locator('.v-chip').getByText(code, { exact: true }) })

/** A negative balance is drawn in bold red. */
const negativeBalances = (page: Page) => page.locator('tbody td.text-error.font-weight-bold')

/** Local date n days ago, as the API and the date fields write it. */
const daysAgo = (days: number) => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toLocaleDateString('en-CA')
}

/**
 * Focused, an autocomplete that already has a product writes its name in the
 * input: typing before that settles ends up appended to it.
 */
async function typeProduct(page: Page, input: Locator, name: string): Promise<void> {
  await input.click()
  await input.fill(name)
  await page.getByRole('option', { name }).click()
}

async function pickLineProduct(page: Page, n: number, name: string): Promise<void> {
  await typeProduct(page, lineField(page, n, 'Producto *').locator('input'), name)
}

async function adminAuth(request: APIRequestContext): Promise<Auth> {
  return { Authorization: `Bearer ${await apiLogin(request, ADMIN.email, ADMIN.password)}` }
}

/** The seeded company has no taxes of its own: each spec creates the one it uses. */
async function createTax(request: APIRequestContext, auth: Auth, name: string, rate: number): Promise<number> {
  const response = await request.post(`${API}/taxes`, { headers: auth, data: { name, rate } })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).data.id
}

async function documentTypeId(request: APIRequestContext, auth: Auth, code: string): Promise<number> {
  const types = (await (await request.get(`${API}/document-types`, { headers: auth })).json()).data
  return types.find((type: { code: string }) => type.code === code).id
}

async function createProducts(
  request: APIRequestContext,
  products: {
    name: string
    unit: string
    unit_cost: number
    current_stock: number
    type?: 'raw_material' | 'final'
    sale_price?: number
    tax_id?: number
    initial_stock_date?: string
  }[],
): Promise<number[]> {
  const auth = await adminAuth(request)
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Insumos compra ${Date.now()}` } })
  const categoryId = (await category.json()).data.id
  const ids: number[] = []
  for (const product of products) {
    const response = await request.post(`${API}/products`, {
      headers: auth,
      data: { type: 'raw_material', tracks_stock: true, category_id: categoryId, ...product },
    })
    expect(response.status(), await response.text()).toBe(201)
    ids.push((await response.json()).data.id)
  }
  return ids
}

/** One charged order per quantity: each one is a sale (FV) in the kardex, even with no stock. */
async function sell(request: APIRequestContext, auth: Auth, productId: number, quantities: number[]): Promise<void> {
  for (const quantity of quantities) {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { customer_name: 'Mesa Kardex E2E', items: [{ product_id: productId, quantity }] },
    })
    expect(order.status(), await order.text()).toBe(201)
    const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, {
      headers: auth,
      data: { payment_method: 'cash' },
    })
    expect(paid.ok(), await paid.text()).toBeTruthy()
  }
}

async function filterByProduct(page: Page, name: string): Promise<void> {
  await typeProduct(page, field(page, 'Producto').locator('input'), name)
  await expect(page.locator('.v-card', { hasText: 'Existencia actual' })).toBeVisible()
}

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

/**
 * A supplier invoice with several products is one purchase: one FC row per
 * line, all with the invoice number and the supplier. A line left blank is
 * dropped and a cost left empty enters at the product's average cost. Only
 * units and cost: the money is still registered in Gastos.
 */
test('una compra de varios productos queda en el kardex como una sola factura', async ({ page, request }) => {
  const stamp = Date.now()
  const flour = `Harina Factura ${stamp}`
  const sugar = `Azúcar Factura ${stamp}`
  const butter = `Mantequilla Factura ${stamp}`
  const invoice = `FE-${stamp}`
  await createProducts(request, [
    { name: flour, unit: 'kg', unit_cost: 2000, current_stock: 10 },
    { name: sugar, unit: 'kg', unit_cost: 3000, current_stock: 4 },
    { name: butter, unit: 'kg', unit_cost: 7000, current_stock: 1 },
  ])

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  await page.getByLabel('Proveedor *').fill('Molinos Factura E2E')
  await page.getByLabel('Número de factura').fill(invoice)

  await pickLineProduct(page, 1, flour)
  await expect(lineField(page, 1, 'Costo unitario').locator('input')).toHaveValue('2.000')
  await lineField(page, 1, 'Cantidad *').locator('input').fill('10')
  await lineField(page, 1, 'Costo unitario').locator('input').fill('2.500')

  // Line 2 stays blank; line 3 leaves its cost empty.
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 3, sugar)
  await lineField(page, 3, 'Cantidad *').locator('input').fill('2')
  await lineField(page, 3, 'Costo unitario').locator('input').fill('')

  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 4, butter)
  await lineField(page, 4, 'Cantidad *').locator('input').fill('3')
  await lineField(page, 4, 'Costo unitario').locator('input').fill('8.000')

  // 10 × $2.500 + 2 × $3.000 (average) + 3 × $8.000, with no tax.
  await expect(summaryRow(page, 'Valor bruto')).toContainText('$55.000')
  await expect(summaryRow(page, 'IVA')).toContainText('$0')
  await expect(summaryRow(page, 'Valor neto')).toContainText('$55.000')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('3 movimientos registrados en el kardex')).toBeVisible()

  await field(page, 'Tipo de documento').click()
  await pickOption(page, 'FC — Factura de compra')
  const rows = page.locator('tbody tr', { hasText: invoice })
  await expect(rows).toHaveCount(3)
  const flourRow = rows.filter({ hasText: flour })
  await expect(flourRow).toContainText('Molinos Factura E2E')
  await expect(flourRow).toContainText('$2.500')
  // (10 × $2.000 + 10 × $2.500) / 20.
  await expect(flourRow).toContainText('$2.250')
  await expect(rows.filter({ hasText: sugar })).toContainText('$3.000')
  await expect(rows.filter({ hasText: butter })).toContainText('$8.000')

  await page.goto('/productos-base')
  for (const [name, stock] of [[flour, '20 kg'], [sugar, '6 kg'], [butter, '4 kg']] as const) {
    await page.getByRole('textbox', { name: 'Buscar' }).fill(name)
    await expect(page.locator('tr', { hasText: name })).toContainText(stock)
  }
})

/**
 * A line with its product but no quantity is marked on that line and nothing
 * is sent; a line the API rejects (an exit above the stock) is marked too,
 * and the lines before it are not saved either.
 */
test('una línea inválida muestra su mensaje y no se guarda ninguna línea', async ({ page, request }) => {
  const stamp = Date.now()
  const milk = `Leche Línea ${stamp}`
  const cheese = `Queso Línea ${stamp}`
  await createProducts(request, [
    { name: milk, unit: 'litro', unit_cost: 3000, current_stock: 5 },
    { name: cheese, unit: 'kg', unit_cost: 9000, current_stock: 2 },
  ])

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  // The default supplier is prefilled only if the suppliers loaded before the dialog opened.
  await page.getByLabel('Proveedor *').fill('Lechería Línea E2E')
  await pickLineProduct(page, 1, milk)
  await lineField(page, 1, 'Cantidad *').locator('input').fill('4')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 2, cheese)

  // The same product twice says it is registered apart; this one goes away.
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 3, milk)
  await expect(line(page, 3)).toContainText('Ya está en otra línea: se registra aparte')
  await line(page, 3).getByRole('button', { name: `Quitar ${milk} del movimiento` }).click()
  await expect(line(page, 3)).toHaveCount(0)

  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(line(page, 2)).toContainText(`Escribe la cantidad de ${cheese}`)
  await expect(line(page, 1)).not.toContainText('Escribe')
  // Said inside the dialog too, where it never covers its buttons.
  await expect(page.getByRole('dialog').locator('.v-alert')).toHaveText(`Escribe la cantidad de ${cheese}`)
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // An exit the API rejects on line 2 leaves line 1 unsaved as well.
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /AJ — Ajuste de inventario/ }).click()
  await field(page, 'Dirección *').click()
  await page.getByRole('option', { name: 'Salida' }).click()
  await pickLineProduct(page, 1, milk)
  await lineField(page, 1, 'Cantidad *').locator('input').fill('3')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 2, cheese)
  await lineField(page, 2, 'Cantidad *').locator('input').fill('5')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(line(page, 2)).toContainText(`La salida de ${cheese} supera el stock disponible (2).`)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  await field(page, 'Producto').locator('input').fill(milk)
  await page.getByRole('option', { name: milk }).click()
  await expect(page.locator('.v-card', { hasText: 'Existencia actual' })).toContainText('5 litro')
  await expect(page.locator('tbody tr', { hasText: 'SI' })).toHaveCount(1)
  await expect(page.locator('tbody tr').filter({ hasText: /FC|AJ/ })).toHaveCount(0)
})

/**
 * A supplier invoice with IVA: the unit cost is before tax, each line takes
 * its product's tax, and both the dialog and the kardex read Valor bruto,
 * IVA and Valor neto.
 */
test('una compra con IVA muestra el valor bruto, el IVA y el valor neto', async ({ page, request }) => {
  const stamp = Date.now()
  const beer = `Cerveza IVA ${stamp}`
  const soda = `Gaseosa IVA ${stamp}`
  const invoice = `FE-IVA-${stamp}`
  const taxName = `IVA Compras ${stamp}`
  const auth = await adminAuth(request)
  const iva = await createTax(request, auth, taxName, 19)
  await createProducts(request, [
    { name: beer, unit: 'botella', unit_cost: 1800, current_stock: 0, tax_id: iva },
    { name: soda, unit: 'botella', unit_cost: 2500, current_stock: 0, tax_id: iva },
  ])

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  await page.getByLabel('Proveedor *').fill('Distribuidora IVA E2E')
  await page.getByLabel('Número de factura').fill(invoice)

  await pickLineProduct(page, 1, beer)
  await expect(lineField(page, 1, 'IVA')).toContainText(taxName)
  await lineField(page, 1, 'Cantidad *').locator('input').fill('10')
  await lineField(page, 1, 'Costo unitario').locator('input').fill('2.000')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 2, soda)
  await expect(lineField(page, 2, 'IVA')).toContainText(taxName)
  await lineField(page, 2, 'Cantidad *').locator('input').fill('5')
  await lineField(page, 2, 'Costo unitario').locator('input').fill('3.000')

  // 10 × $2.000 + 5 × $3.000 before tax, and 19 % of it.
  await expect(summaryRow(page, 'Valor bruto')).toContainText('$35.000')
  await expect(summaryRow(page, 'IVA')).toContainText('$6.650')
  await expect(summaryRow(page, 'Valor neto')).toContainText('$41.650')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('2 movimientos registrados en el kardex')).toBeVisible()

  await filterByProduct(page, beer)
  const purchase = rowsOf(page, 'FC').filter({ hasText: invoice })
  await expect(purchase).toContainText('$20.000')
  await expect(purchase).toContainText('$3.800')
  await expect(purchase).toContainText('19 %')
  await expect(purchase).toContainText('$23.800')
  // The opening balance carries no tax.
  await expect(rowsOf(page, 'SI')).toContainText('—')

  const entries = page.locator('tfoot tr', { hasText: 'Entradas del periodo' })
  await expect(entries).toContainText('$20.000')
  await expect(entries).toContainText('$3.800')
  await expect(entries).toContainText('$23.800')
  await expect(page.locator('tfoot tr', { hasText: 'Salidas del periodo' })).toContainText('$0')
})

/**
 * The reported case: a product is sold with no stock and the purchase that
 * covered those sales is typed days later with its real, earlier date. The
 * kardex is read by date, so it is computed by date: no sale stays below
 * zero or leaves at $0.
 */
test('una compra registrada después con su fecha real deja en positivo las ventas que cubría', async ({ page, request }) => {
  const stamp = Date.now()
  const bottle = `Botella Retro ${stamp}`
  const invoice = `1001-${stamp}`
  const auth = await adminAuth(request)
  const [bottleId] = await createProducts(request, [
    { name: bottle, unit: 'unidad', unit_cost: 1800, current_stock: 0, type: 'final', sale_price: 5000, initial_stock_date: daysAgo(20) },
  ])
  await sell(request, auth, bottleId!, [1, 2])

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await filterByProduct(page, bottle)
  await expect(negativeBalances(page).filter({ hasText: '-3' })).toBeVisible()

  // The filtered product is already on the first line.
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  await field(page, 'Fecha del movimiento *').locator('input').fill(displayDate(daysAgo(5)))
  await page.getByLabel('Proveedor *').fill('Demo Servify E2E')
  await page.getByLabel('Número de factura').fill(invoice)
  await lineField(page, 1, 'Cantidad *').locator('input').fill('48')
  await lineField(page, 1, 'Costo unitario').locator('input').fill('1.800')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('Movimiento registrado en el kardex')).toBeVisible()

  await expect(rowsOf(page, 'FC')).toContainText(invoice)
  await expect(negativeBalances(page)).toHaveCount(0)
  await expect(rowsOf(page, 'FV')).toHaveCount(2)
  for (const sale of await rowsOf(page, 'FV').all()) await expect(sale).toContainText('$1.800')
  await expect(page.locator('.v-card', { hasText: 'Existencia actual' })).toContainText('45 unidad')
})

/**
 * The same case fixed afterwards: the purchase was typed with today's date,
 * after the sales. Correcting its date from the kardex replays the product
 * by date and the row says who changed it.
 */
test('corregir en el kardex la fecha de una compra deja en positivo las ventas que cubría', async ({ page, request }) => {
  const stamp = Date.now()
  const bottle = `Botella Editada ${stamp}`
  const invoice = `1002-${stamp}`
  const auth = await adminAuth(request)
  const [bottleId] = await createProducts(request, [
    { name: bottle, unit: 'unidad', unit_cost: 1800, current_stock: 0, type: 'final', sale_price: 5000, initial_stock_date: daysAgo(20) },
  ])
  await sell(request, auth, bottleId!, [1, 2])
  const purchase = await request.post(`${API}/kardex/movements`, {
    headers: auth,
    data: {
      document_type_id: await documentTypeId(request, auth, 'FC'),
      movement_type: 'in',
      items: [{ product_id: bottleId, quantity: 10, unit_cost: 1800 }],
      counterparty: 'Demo Servify E2E',
      reference: invoice,
    },
  })
  expect(purchase.status(), await purchase.text()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await filterByProduct(page, bottle)
  await expect(negativeBalances(page).filter({ hasText: '-3' })).toBeVisible()

  await page.getByRole('button', { name: `Editar el movimiento FC ${invoice} de ${bottle}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.v-card-title')).toHaveText(`Editar FC ${invoice}`)
  await expect(field(page, 'Proveedor *').locator('input')).toHaveValue('Demo Servify E2E')
  await expect(summaryRow(page, 'Valor bruto')).toContainText('$18.000')
  await expect(summaryRow(page, 'Valor neto')).toContainText('$18.000')

  await field(page, 'Fecha del movimiento *').locator('input').fill(displayDate(daysAgo(1)))
  await field(page, 'Fecha del movimiento *').locator('input').press('Tab')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(`Movimiento actualizado: se recalculó el kardex de ${bottle}.`)).toBeVisible()

  await expect(negativeBalances(page)).toHaveCount(0)
  await expect(rowsOf(page, 'FV')).toHaveCount(2)
  for (const sale of await rowsOf(page, 'FV').all()) await expect(sale).toContainText('$1.800')
  await expect(page.locator('.v-card', { hasText: 'Existencia actual' })).toContainText('7 unidad')

  const edited = rowsOf(page, 'FC').getByRole('img', { name: /^Editado por Administrador el / })
  await expect(edited).toBeVisible()
  await edited.hover()
  await expect(page.getByText(/^Editado por Administrador el /)).toBeVisible()
})

/**
 * The owner's request: the pencil corrects the whole invoice, not one row.
 * Opened from one of its products, it brings every line; the supplier and
 * the number reach all of them, a line changes product, another is added and
 * another removed, and each product touched is replayed by date.
 */
test('el lápiz abre la factura completa y corrige el proveedor, el número y sus productos', async ({ page, request }) => {
  const stamp = Date.now()
  const flour = `Harina Documento ${stamp}`
  const sugar = `Azúcar Documento ${stamp}`
  const butter = `Mantequilla Documento ${stamp}`
  const salt = `Sal Documento ${stamp}`
  const before = `A-${stamp}`
  const after = `B-${stamp}`
  const auth = await adminAuth(request)
  const [flourId, sugarId] = await createProducts(request, [
    { name: flour, unit: 'kg', unit_cost: 2000, current_stock: 10 },
    { name: sugar, unit: 'kg', unit_cost: 3000, current_stock: 4 },
    { name: butter, unit: 'kg', unit_cost: 7000, current_stock: 1 },
    { name: salt, unit: 'kg', unit_cost: 1000, current_stock: 2 },
  ])
  const purchase = await request.post(`${API}/kardex/movements`, {
    headers: auth,
    data: {
      document_type_id: await documentTypeId(request, auth, 'FC'),
      movement_type: 'in',
      items: [
        { product_id: flourId, quantity: 5, unit_cost: 2000 },
        { product_id: sugarId, quantity: 3, unit_cost: 3000 },
      ],
      counterparty: 'Molinos Antes E2E',
      reference: before,
    },
  })
  expect(purchase.status(), await purchase.text()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  const stock = page.locator('.v-card', { hasText: 'Existencia actual' })
  await filterByProduct(page, sugar)
  await expect(stock).toContainText('7 kg')

  await page.getByRole('button', { name: `Editar el movimiento FC ${before} de ${sugar}` }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('.v-card-title')).toHaveText(`Editar FC ${before}`)
  await expect(field(page, 'Tipo de documento *')).toContainText('FC — Factura de compra')
  await expect(field(page, 'Tipo de documento *')).toHaveClass(/v-input--disabled/)
  await expect(field(page, 'Proveedor *').locator('input')).toHaveValue('Molinos Antes E2E')
  await expect(page.getByLabel('Número de factura')).toHaveValue(before)
  // The flour line comes too, although the table only shows sugar.
  await expect(dialog.getByRole('group', { name: /^Línea \d+$/ })).toHaveCount(2)
  await expect(lineField(page, 1, 'Producto *')).toContainText(flour)
  await expect(lineField(page, 1, 'Cantidad *').locator('input')).toHaveValue('5')
  await expect(lineField(page, 2, 'Producto *')).toContainText(sugar)
  await expect(lineField(page, 2, 'Costo unitario').locator('input')).toHaveValue('3.000')
  // 5 × $2.000 + 3 × $3.000.
  await expect(summaryRow(page, 'Valor bruto')).toContainText('$19.000')
  await expect(dialog).toContainText('Las líneas que quites se eliminan del kardex al guardar.')

  await field(page, 'Proveedor *').locator('input').fill('Molinos Después E2E')
  await page.getByLabel('Número de factura').fill(after)
  // The flour line becomes butter, with butter's last cost suggested and then corrected.
  await pickLineProduct(page, 1, butter)
  await expect(lineField(page, 1, 'Costo unitario').locator('input')).toHaveValue('7.000')
  await lineField(page, 1, 'Cantidad *').locator('input').fill('4')
  await lineField(page, 1, 'Costo unitario').locator('input').fill('7.500')
  await line(page, 2).getByRole('button', { name: `Quitar ${sugar} del movimiento` }).click()
  await expect(line(page, 2)).toHaveCount(0)
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 2, salt)
  await lineField(page, 2, 'Cantidad *').locator('input').fill('6')
  await lineField(page, 2, 'Costo unitario').locator('input').fill('1.200')
  // 4 × $7.500 + 6 × $1.200.
  await expect(summaryRow(page, 'Valor bruto')).toContainText('$37.200')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(dialog).toBeHidden()
  await expect(
    page.getByText(`Movimiento actualizado: se recalculó el kardex de ${sugar}, ${flour}, ${butter} y ${salt}.`),
  ).toBeVisible()

  // The removed sugar line is gone and sugar is back to its opening stock.
  await expect(stock).toContainText('4 kg')
  await expect(rowsOf(page, 'FC')).toHaveCount(0)

  // The whole invoice: both lines carry the new supplier and number, the old number is gone.
  await page.getByRole('button', { name: 'Borrar Producto' }).click()
  await field(page, 'Tipo de documento').click()
  await pickOption(page, 'FC — Factura de compra')
  const invoice = page.locator('tbody tr', { hasText: after })
  await expect(invoice).toHaveCount(2)
  for (const name of [butter, salt]) await expect(invoice.filter({ hasText: name })).toContainText('Molinos Después E2E')
  await expect(page.locator('tbody tr', { hasText: before })).toHaveCount(0)

  // Each product is replayed: butter 1 + 4 at (1 × $7.000 + 4 × $7.500) / 5, salt 2 + 6, flour back to 10.
  await filterByProduct(page, butter)
  await expect(stock).toContainText('5 kg')
  await expect(page.locator('.v-card', { hasText: 'Costo promedio' })).toContainText('$7.400')
  await expect(rowsOf(page, 'FC')).toContainText(after)
  await expect(rowsOf(page, 'FC').getByRole('img', { name: /^Editado por Administrador el / })).toBeVisible()
  await filterByProduct(page, salt)
  await expect(stock).toContainText('8 kg')
  await expect(rowsOf(page, 'FC')).toContainText('Molinos Después E2E')
  await filterByProduct(page, flour)
  await expect(stock).toContainText('10 kg')
  await expect(rowsOf(page, 'FC')).toHaveCount(0)
})

/**
 * Only what was typed by hand can be corrected: purchases (FC) and
 * adjustments (AJ). Sales, opening balances and returns get no pencil.
 */
test('el lápiz de editar solo aparece en las compras y los ajustes hechos a mano', async ({ page, request }) => {
  const stamp = Date.now()
  const juice = `Jugo Lápiz ${stamp}`
  const auth = await adminAuth(request)
  const [juiceId] = await createProducts(request, [
    { name: juice, unit: 'unidad', unit_cost: 2000, current_stock: 5, type: 'final', sale_price: 6000 },
  ])
  await sell(request, auth, juiceId!, [1])
  const register = async (code: string, data: Record<string, unknown>) => {
    const response = await request.post(`${API}/kardex/movements`, {
      headers: auth,
      data: { document_type_id: await documentTypeId(request, auth, code), items: [{ product_id: juiceId, quantity: 1 }], ...data },
    })
    expect(response.status(), await response.text()).toBe(201)
  }
  await register('FC', { movement_type: 'in', counterparty: 'Frutas E2E', reference: `FE-${stamp}` })
  await register('AJ', { movement_type: 'out', notes: 'Se rompió una E2E' })
  await register('DV', { movement_type: 'in', counterparty: 'Cliente Lápiz E2E', reference: `POS-${stamp}` })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await filterByProduct(page, juice)

  await expect(rowsOf(page, 'FC').getByRole('button', { name: `Editar el movimiento FC FE-${stamp} de ${juice}` })).toBeVisible()
  // Without a reference the label skips it.
  await expect(rowsOf(page, 'AJ').getByRole('button', { name: `Editar el movimiento AJ de ${juice}` })).toBeVisible()
  for (const code of ['FV', 'SI', 'DV']) {
    await expect(rowsOf(page, code)).toHaveCount(1)
    await expect(rowsOf(page, code).getByRole('button', { name: /^Editar el movimiento/ })).toHaveCount(0)
  }
})

test('un empleado con inventario pero sin permiso para editar el kardex no ve el lápiz', async ({ page, request }) => {
  const stamp = Date.now()
  const flour = `Harina Bodega ${stamp}`
  const auth = await adminAuth(request)
  const [flourId] = await createProducts(request, [{ name: flour, unit: 'kg', unit_cost: 2000, current_stock: 5 }])
  const purchase = await request.post(`${API}/kardex/movements`, {
    headers: auth,
    data: {
      document_type_id: await documentTypeId(request, auth, 'FC'),
      movement_type: 'in',
      items: [{ product_id: flourId, quantity: 3, unit_cost: 2100 }],
      counterparty: 'Molinos Bodega E2E',
      reference: `FE-${stamp}`,
    },
  })
  expect(purchase.status(), await purchase.text()).toBe(201)

  await raisePlanLimits(request, { max_users: 50 })
  const employee = { username: `bodega.${stamp % 1_000_000}`, password: 'clave123' }
  const created = await request.post(`${API}/users`, {
    headers: { ...auth, Accept: 'application/json' },
    data: { name: 'Bodeguero Kardex', role: 'employee', permissions: ['inventory'], ...employee },
  })
  expect(created.status(), await created.text()).toBe(201)

  await loginUI(page, employee.username, employee.password, COMPANY_SLUG)
  await page.goto('/kardex')
  await filterByProduct(page, flour)
  await expect(rowsOf(page, 'FC')).toHaveCount(1)
  await expect(page.getByRole('button', { name: /^Editar el movimiento/ })).toHaveCount(0)
})
