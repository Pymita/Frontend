import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
  ADMIN,
  API,
  PLATFORM,
  SHOP_WITH_FEES,
  apiLogin,
  createCompany,
  displayDate,
  e2eSql,
  field,
  freezeTime,
  issueDocuments,
  loginUI,
  pageRule,
  pdfPageSize,
  pdfPages,
  pdfText,
  pickOption,
  watchPrinting,
  xlsxRows,
} from './helpers'

/**
 * Cobro desde la web: el botón "Cobrar" está en la fila, el diálogo ofrece
 * propina voluntaria (con y sin), y la venta queda con la propina sumada al
 * total. Cobrar nunca imprime nada por sí solo.
 */
test('cobrar un pedido con propina desde el diálogo de cobro', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Cobro E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Sancocho E2E',
      type: 'final',
      unit: 'plato',
      sale_price: 20700,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Cobro E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')

  // La tabla ya no muestra el cliente: la fila se ubica por su total único.
  const row = page.locator('tr', { hasText: '$20.700' }).first()
  await row.getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')

  // Sin propina sugerida solo hay un total y un botón de confirmar.
  await expect(dialog.getByText('Total sin propina:')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Confirmar cobro' })).toBeVisible()

  // Con propina: se sugiere el 10% y se puede ajustar a mano.
  // Pesos with their dots ("2.000" is two thousand), no arrows that add one peso.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  const tip = dialog.getByLabel('Propina (opcional)')
  await expect(tip).toHaveValue('2.070')
  await expect(tip).not.toHaveAttribute('type', 'number')
  await tip.fill('2.000')
  await expect(dialog.getByText('$22.700')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cobrar sin propina' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Cobrar con propina' }).click()
  await expect(page.getByText('Pedido cobrado con propina')).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })
  await page.getByRole('button', { name: 'Pagados' }).click()
  await expect(page.locator('tr', { hasText: '$22.700' }).first()).toBeVisible()

  // La propina quedó en el pedido.
  const paid = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const data = (await paid.json()).data
  expect(data.tip).toBe(2000)
  expect(data.total).toBe(22700)
  expect(data.payment_status).toBe('paid')
})

test('cobrar sin propina deja el total tal cual', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Cobro sin propina E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Ajiaco E2E',
      type: 'final',
      unit: 'plato',
      sale_price: 18300,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Sin Propina E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')

  await page.locator('tr', { hasText: '$18.300' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(dialog.getByText('Total con propina:')).toBeVisible()

  // El cliente no quiso dejar propina.
  await dialog.getByRole('button', { name: 'Cobrar sin propina' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })

  const paid = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const data = (await paid.json()).data
  expect(data.tip).toBe(0)
  expect(data.total).toBe(18300)
  expect(data.payment_status).toBe('paid')
})

/**
 * A counter sale (no table) charged from Pedidos opens no window and asks for
 * no print dialog: the cashier who wants the ticket asks for it in the
 * success message, and only that click prints.
 */
test('una venta de mostrador cobrada no imprime nada hasta pedir la tirilla', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedSimpleProduct(request, auth, `Empanada Mostrador ${Date.now()}`, 24681)
  const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity: 1 }] } })
  expect(order.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$24.681' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Total sin propina:')).toBeVisible()
  await expect(dialog.getByLabel('Imprimir la factura al cobrar')).toHaveCount(0)
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cobrar-sin-imprimir-dialogo-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cobrar-sin-imprimir-dialogo-390.png' })
  await dialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })
  await expect(dialog).toHaveCount(0)
  await page.screenshot({ path: '../screenshots/cobrar-sin-imprimir-mensaje-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cobrar-sin-imprimir-mensaje-1440.png' })

  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Imprimir tirilla' }).click(),
  ])
  await expect(ticket.locator('body')).toContainText('$24.681')
  await expect(ticket.locator('body')).toContainText('GRACIAS POR SU COMPRA')
  expect(await printing()).toEqual({ opened: 1, printed: 1 })
})

async function seedSimpleProduct(request: any, auth: any, name: string, price: number) {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name, type: 'final', unit: 'und', sale_price: price, tracks_stock: false, category_id: categoryId },
  })
  return (await product.json()).data.id
}

/**
 * The order number is the company's and is taken when the order is charged:
 * one cancelled before anyone paid burns none, so the next charge follows the
 * consecutive, and the ticket, Pedidos and Ventas read that same number.
 */
test('un pedido cancelado sin cobrar no gasta número y el siguiente cobro sigue el consecutivo', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedSimpleProduct(request, auth, `Arepa Número ${Date.now()}`, 16253)
  const newOrder = async (quantity: number) => (await (await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: productId, quantity }] },
  })).json()).data

  // The last number the company gave.
  const before = await newOrder(1)
  const last = (await (await request.post(`${API}/orders/${before.id}/pay`, { headers: auth, data: {} })).json()).data.number
  expect(last).toBeGreaterThan(0)
  const toCancel = await newOrder(2)
  const toCharge = await newOrder(3)
  expect(toCancel.number).toBeNull()
  expect(toCharge.number).toBeNull()

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  page.once('dialog', confirmation => confirmation.accept())
  await page.locator('tbody tr', { hasText: '$32.506' }).getByRole('button', { name: 'Más acciones del pedido' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Cancelar pedido' }).click()
  await expect(page.getByText('Pedido cancelado')).toBeVisible()

  // Uncharged it has no number: the dialog names it by the time it came in.
  const row = page.locator('tbody tr', { hasText: '$48.759' })
  await expect(row).not.toContainText('#')
  await row.getByRole('button', { name: 'Cobrar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Cobrar pedido de las')
  await dialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()
  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Imprimir tirilla' }).click(),
  ])
  const next = last + 1
  await expect(ticket.locator('body')).toContainText(`PEDIDO  : #${next}`)
  await ticket.close()

  await page.getByRole('button', { name: 'Pagados' }).click()
  await expect(page.locator('tbody tr', { hasText: '$48.759' })).toContainText(`#${next}`)

  const paid = (await (await request.get(`${API}/orders/${toCharge.id}`, { headers: auth })).json()).data
  expect(paid.number).toBe(next)
  expect((await (await request.get(`${API}/orders/${toCancel.id}`, { headers: auth })).json()).data.number).toBeNull()

  await page.goto('/ventas')
  await page.getByRole('textbox', { name: 'Buscar factura o cliente' }).fill(`#${next}`)
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody tr', { hasText: '$48.759' })).toContainText(paid.invoice_number || `Pedido #${next}`)
})

test('un abono por monto es un anticipo, no una factura', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedSimpleProduct(request, auth, 'Bandeja Abono E2E', 30000)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Abono E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')

  const row = page.locator('tr', { hasText: '$30.000' }).first()
  await row.locator('.mdi-dots-vertical').click()
  await page.getByText('Registrar pago parcial').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Total a pagar:')).toBeVisible()
  await dialog.getByRole('button', { name: 'Por monto' }).click()
  // It starts at the balance, with its dots; "10.000" is ten thousand.
  const amount = dialog.getByLabel('Monto a pagar')
  await expect(amount).toHaveValue('30.000')
  await expect(amount).not.toHaveAttribute('type', 'number')
  await amount.fill('10.000')
  // El anticipo se avisa como recibo de abono (no factura ni kardex).
  await expect(dialog.getByText('recibo de abono')).toBeVisible()
  await dialog.getByRole('button', { name: /Cobrar/ }).click()
  await expect(page.getByText('Abono registrado')).toBeVisible()
  await expect(page.locator('tr', { hasText: 'Debe: $20.000' }).first()).toBeVisible()

  // El abono no es una venta: no hay factura y el pedido sigue parcial.
  const afterAbono = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(afterAbono.payment_status).toBe('partial')
  expect(afterAbono.amount_paid).toBe(10000)
  const abono = afterAbono.payments.find((p: any) => p.kind === 'abono')
  expect(abono).toBeTruthy()
  expect(abono.invoice_number).toBeFalsy()

  // Reabrir muestra el historial con el abono y el saldo restante.
  await page.locator('tr', { hasText: '$30.000' }).first().locator('.mdi-dots-vertical').click()
  await page.getByText('Registrar pago parcial').click()
  await expect(dialog.getByText('Pagos registrados')).toBeVisible()
  await expect(dialog.getByText('Abono', { exact: true })).toBeVisible()

  // The rest closes the account; nothing prints until the cashier asks for the ticket.
  await dialog.getByRole('button', { name: 'Por monto' }).click()
  await expect(dialog.getByLabel('Monto a pagar')).toHaveValue('20.000')
  await dialog.getByRole('button', { name: /Cobrar/ }).click()
  await expect(page.getByText('Cuenta saldada: pedido pagado por completo')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir tirilla' })).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })
})

test('cobrar por productos emite una factura de venta parcial', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedSimpleProduct(request, auth, 'Cerveza Factura E2E', 6000)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Factura E2E', items: [{ product_id: productId, quantity: 2 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  const row = page.locator('tr', { hasText: '$12.000' }).first()
  await row.locator('.mdi-dots-vertical').click()
  await page.getByText('Registrar pago parcial').click()

  const dialog = page.getByRole('dialog')
  // El modo "Por productos" anuncia que es una factura de venta parcial.
  await expect(dialog.getByText('factura de venta parcial')).toBeVisible()
  // Marcar selecciona las 2 unidades; se baja a 1 para dejar la cuenta abierta.
  await dialog.locator('.v-checkbox-btn').first().click()
  await dialog.getByRole('button', { name: 'Quitar una unidad del cobro' }).click()
  await dialog.getByRole('button', { name: /Cobrar/ }).click()
  await expect(page.getByText('Factura parcial registrada')).toBeVisible()

  // Es una venta con su secuencia #pedido-1 (el número que el pedido tomó al cobrarse) y descontó su parte.
  const afterSale = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(afterSale.payment_status).toBe('partial')
  expect(afterSale.number).toBeGreaterThan(0)
  const sale = afterSale.payments.find((p: any) => p.kind === 'sale')
  expect(sale).toBeTruthy()
  expect(sale.invoice_sequence).toBe(1)
  expect(sale.reference).toBe(`#${afterSale.number}-1`)
})

/** Adjusting a charge is the admin's: a corrected price and a fixed discount are typed as pesos. */
test('el precio corregido y el descuento por monto se escriben en pesos', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productName = `Cazuela Precio ${Date.now()}`
  const productId = await seedSimpleProduct(request, auth, productName, 43210)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: productId, quantity: 2 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  const orderRow = (total: string) =>
    page.locator('tbody tr', { hasText: total }).filter({ has: page.getByRole('button', { name: 'Más acciones del pedido' }) })

  await orderRow('$86.420').locator('.mdi-chevron-down').click()
  await page.getByRole('button', { name: `Editar ${productName}` }).click()
  const dialog = page.getByRole('dialog')
  const price = dialog.getByLabel('Precio unitario')
  await expect(price).toHaveValue('43.210')
  await expect(price).not.toHaveAttribute('type', 'number')
  await price.fill('46.250')
  await dialog.getByLabel('Descuento').fill('1.250')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Item actualizado')).toBeVisible()
  // 2 × $46.250 − $1.250.
  await expect(page.getByRole('row', { name: new RegExp(`^2 ${productName}`) })).toContainText('$46.250')
  await expect(orderRow('$91.250')).toBeVisible()

  await orderRow('$91.250').getByRole('button', { name: 'Más acciones del pedido' }).click()
  await page.getByText('Aplicar descuento').click()
  await dialog.getByLabel('Monto fijo').check()
  const discount = dialog.getByLabel('Monto', { exact: true })
  await expect(discount).not.toHaveAttribute('type', 'number')
  await discount.fill('6.300')
  await dialog.getByRole('button', { name: 'Aplicar' }).click()
  await expect(page.getByText('Descuento aplicado')).toBeVisible()
  await expect(orderRow('$84.950')).toBeVisible()

  const saved = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(saved.total).toBe(84950)
})

type Auth = Record<string, string>

/** "YYYY-MM-DD" of today plus `days`, on the Bogotá clock the API uses. */
const isoDay = (days = 0): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

/** A restaurant of its own, so moving its cuts never touches the seeded company's shift. */
async function createRestaurant(request: APIRequestContext, slug: string) {
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const credentials = { email: `admin.${slug}@e2e.test`, password: 'negocio2026' }
  const response = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `E2E ${slug}`, slug, business_type: 'restaurant', admin: { name: 'Dueña Caja', ...credentials } },
  })
  expect(response.status()).toBe(201)
  const token = await apiLogin(request, credentials.email, credentials.password)
  return { slug, credentials, auth: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
}

/**
 * A close cuts at its own second and a payment created in that second belongs
 * to the next shift (half-open window): wait it out so what was charged just
 * before stays on the side of the cut the test expects.
 */
const nextSecond = () => new Promise(resolve => setTimeout(resolve, 1000))

async function currentShift(request: APIRequestContext, auth: Auth) {
  return (await (await request.get(`${API}/cash-register/current`, { headers: auth })).json()).data
}

async function closeShift(request: APIRequestContext, auth: Auth, id: number, data: { counted_cash?: number; notes?: string } = {}) {
  const response = await request.post(`${API}/cash-register/${id}/close`, { headers: auth, data })
  expect(response.ok()).toBeTruthy()
  return response.json()
}

async function chargeOrder(request: APIRequestContext, auth: Auth, productId: number, method: string, quantity = 1) {
  const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity }] } })
  const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, { headers: auth, data: { payment_method: method } })
  expect(paid.ok()).toBeTruthy()
}

/** The row of shift `number` in Ventas › Cierres de caja (its first column). */
function shiftRow(page: Page, number: number) {
  return page.locator('.v-data-table tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^\\s*${number}\\s*$`) }) })
}

async function openCashCloses(page: Page, from?: string) {
  await page.goto('/ventas')
  if (from) {
    await field(page, 'Desde').locator('input').fill(displayDate(from))
    await field(page, 'Desde').locator('input').press('Enter')
  }
  await page.getByRole('button', { name: 'Cierres de caja' }).click()
}

/**
 * Nobody opens the register: the cashier only closes it. The close reviews
 * the live shift, asks to reconfirm and leaves a frozen summary that prints
 * from Pedidos and later from Ventas › Cierres de caja.
 */
test('la caja se abre sola, el cierre pide confirmación, resume el turno y se imprime', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

  // Start a fresh shift so it holds only this test's sales.
  await nextSecond()
  const shift = (await closeShift(request, auth, (await currentShift(request, auth)).id)).next
  const productName = `Ajiaco Caja ${Date.now()}`
  const productId = await seedSimpleProduct(request, auth, productName, 12345)
  for (const method of ['cash', 'nequi']) await chargeOrder(request, auth, productId, method)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')
  await expect(page.getByRole('button', { name: 'Abrir caja' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`Turno ${shift.number} · desde`)
  await expect(dialog.locator('tr', { hasText: 'Efectivo' })).toContainText('$12.345')
  await expect(dialog.locator('tr', { hasText: 'Nequi' })).toContainText('$12.345')
  await expect(dialog.getByTestId('cash-sales-total')).toHaveText('$24.690')
  await expect(dialog).toContainText('2 ventas · 2 pedidos')
  // No base any more: only the cash the shift's sales brought in. Nequi never reaches the drawer.
  await expect(dialog.getByText('+ Base')).toHaveCount(0)
  await expect(dialog.getByTestId('cash-expected')).toHaveText('$12.345')
  await expect(dialog.getByTestId('cash-product').filter({ hasText: productName })).toContainText('2')

  const counted = dialog.getByLabel('Efectivo contado (opcional)')
  await expect(counted).not.toHaveAttribute('type', 'number')
  await counted.fill('11.345')
  await expect(dialog.getByTestId('cash-difference')).toHaveText('Faltan $1.000')

  await dialog.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(dialog).toContainText('¿Seguro que quieres cerrar la caja?')
  await expect(dialog).toContainText(`El turno ${shift.number} queda cerrado con $24.690 en ventas`)
  // Going back leaves the shift running.
  await dialog.getByRole('button', { name: 'Volver' }).click()
  await expect(dialog.getByLabel('Efectivo contado (opcional)')).toHaveValue('11.345')
  expect((await currentShift(request, auth)).id).toBe(shift.id)

  await dialog.getByRole('button', { name: 'Cerrar caja' }).click()
  await dialog.getByRole('button', { name: 'Sí, cerrar caja' }).click()
  await expect(dialog).toContainText('Caja cerrada con un faltante de $1.000.')
  await expect(dialog.getByTestId('cash-difference')).toHaveText('Faltan $1.000')
  await expect(dialog.getByTestId('cash-sales-total')).toHaveText('$24.690')

  const [summary] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Imprimir resumen' }).click(),
  ])
  await expect(summary.locator('.doc-number')).toContainText('CIERRE DE CAJA')
  await expect(summary.locator('.doc-number')).toContainText(String(shift.number))
  const printed = await summary.locator('body').innerText()
  expect(printed).toMatch(/Efectivo\s+1\s+\$0\s+\$12\.345/)
  expect(printed).toMatch(/Nequi\s+1\s+\$0\s+\$12\.345/)
  expect(printed).toMatch(/EFECTIVO A ENTREGAR\s+\$12\.345/)
  expect(printed).toContain('Faltan $1.000')
  expect(printed).toContain(productName)
  expect(printed).not.toContain('Base')
  await summary.close()

  await dialog.getByRole('button', { name: 'Listo' }).click()
  await expect(dialog).toHaveCount(0)
  const next = await currentShift(request, auth)
  expect(next.number).toBe(shift.number + 1)
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')

  await openCashCloses(page)
  const row = shiftRow(page, shift.number)
  await expect(row).toContainText('Automática')
  await expect(row).toContainText('$24.690')
  await expect(row).toContainText('Nequi: $12.345')
  await expect(row).toContainText('Faltan $1.000')
  const [reprint] = await Promise.all([
    page.waitForEvent('popup'),
    row.getByRole('button', { name: `Imprimir el cierre del turno ${shift.number}` }).click(),
  ])
  await expect(reprint.locator('body')).toContainText('CIERRE DE CAJA')
  await expect(reprint.locator('body')).toContainText(productName)
})

/**
 * A wrong opening and a forgotten close, fixed by the admin in Ventas: moving
 * the shared cut recomputes the previous shift (audited), and closing the open
 * shift with yesterday's date leaves today's sale in the shift that follows.
 */
test('el admin corrige la apertura y cierra con la fecha de ayer un turno olvidado', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `caja-${Date.now()}`)
  const yesterday = isoDay(-1)
  const productId = await seedSimpleProduct(request, auth, 'Bandeja Turno E2E', 15000)
  await chargeOrder(request, auth, productId, 'cash')
  // Shift 1 keeps today's sale; shift 2 starts now. Shift 1 is moved to
  // yesterday morning so shift 2's opening has room to move back.
  const first = await currentShift(request, auth)
  await nextSecond()
  await closeShift(request, auth, first.id)
  const moved = await request.put(`${API}/cash-register/${first.id}`, {
    headers: auth,
    data: { opened_at: `${yesterday} 08:00`, reason: 'Abrió temprano' },
  })
  expect(moved.ok()).toBeTruthy()

  await loginUI(page, credentials.email, credentials.password)
  await openCashCloses(page, yesterday)
  await expect(shiftRow(page, 1)).toContainText('$15.000')
  await expect(shiftRow(page, 2)).toContainText('Abierta')

  await page.getByRole('button', { name: 'Cambiar la apertura del turno 2' }).click()
  const opening = page.getByRole('dialog')
  await expect(opening).toContainText('El cierre del turno 1 pasa a la misma hora y sus totales se recalculan')
  await field(page, 'Fecha').locator('input').fill(displayDate(yesterday))
  await field(page, 'Hora').locator('input').fill('20:00')
  await field(page, 'Motivo').locator('input').fill('La caja quedó abierta desde anoche')
  await opening.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Apertura corregida: se recalcularon los totales del turno 1.')).toBeVisible()

  // The sale moved to shift 2 and shift 1 was recomputed without it.
  await expect(shiftRow(page, 2)).toContainText('$15.000')
  await expect(shiftRow(page, 2)).toContainText('08:00 p. m.')
  await expect(shiftRow(page, 1)).toContainText('0 ventas')
  await shiftRow(page, 1).getByRole('button', { name: 'Corregida: ver los cambios del turno 1' }).click()
  const trail = page.getByRole('dialog').getByTestId('cash-adjustment').filter({ hasText: 'La caja quedó abierta desde anoche' })
  await expect(trail).toContainText('Cierre:')
  await expect(trail).toContainText('Ventas $15.000 → $0')
  await expect(trail).toContainText('Dueña Caja')
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()
  await expect(shiftRow(page, 2).getByRole('button', { name: 'Corregida: ver los cambios del turno 2' })).toBeVisible()

  await page.getByRole('button', { name: 'Cerrar el turno 2 con otra fecha' }).click()
  const close = page.getByRole('dialog')
  await expect(field(page, 'Fecha').locator('input')).toHaveValue(displayDate(isoDay()))
  await field(page, 'Fecha').locator('input').fill(displayDate(yesterday))
  await field(page, 'Hora').locator('input').fill('23:00')
  await close.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(close).toContainText(`¿Seguro que quieres cerrar el turno 2 el ${displayDate(yesterday)} a las 23:00?`)
  await close.getByRole('button', { name: 'Sí, cerrar caja' }).click()
  await expect(
    page.getByText(`Caja cerrada el ${displayDate(yesterday)} a las 23:00. Lo que se cobró después quedó en el turno 3, que sigue abierto.`),
  ).toBeVisible()

  await expect(shiftRow(page, 2)).toContainText('11:00 p. m.')
  await expect(shiftRow(page, 2)).toContainText('0 ventas')
  await expect(shiftRow(page, 3)).toContainText('Abierta')
  await expect(shiftRow(page, 3)).toContainText('Automática')
  await expect(shiftRow(page, 3)).toContainText('$15.000')
  const open = await currentShift(request, auth)
  expect(open.number).toBe(3)
  expect(open.opened_at).toContain(`${yesterday}T23:00:00`)
})

/** The count of a late close is pesos too: "250.000" is two hundred fifty thousand, not 250. */
test('el efectivo contado al cerrar con otra fecha se escribe en pesos', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `caja-conteo-${Date.now()}`)
  const yesterday = isoDay(-1)
  const shift = await currentShift(request, auth)
  const moved = await request.put(`${API}/cash-register/${shift.id}`, {
    headers: auth,
    data: { opened_at: `${yesterday} 08:00`, reason: 'Abrió ayer' },
  })
  expect(moved.ok()).toBeTruthy()

  await loginUI(page, credentials.email, credentials.password)
  await openCashCloses(page, yesterday)
  await page.getByRole('button', { name: `Cerrar el turno ${shift.number} con otra fecha` }).click()
  const close = page.getByRole('dialog')
  await field(page, 'Fecha').locator('input').fill(displayDate(yesterday))
  await field(page, 'Hora').locator('input').fill('23:00')
  const counted = field(page, 'Efectivo contado (opcional)').locator('input')
  await expect(counted).not.toHaveAttribute('type', 'number')
  await counted.fill('250.000')
  await close.getByRole('button', { name: 'Cerrar caja' }).click()
  await close.getByRole('button', { name: 'Sí, cerrar caja' }).click()

  // Nothing was charged in that window, so all of it is over.
  await expect(page.getByText('Caja cerrada con un sobrante de $250.000.')).toBeVisible()
  await expect(shiftRow(page, shift.number)).toContainText('$250.000')
  await expect(shiftRow(page, shift.number)).toContainText('Sobran $250.000')
})

/** Ventas without being admin: every close prints, nothing rewrites one. */
test('quien ve Ventas sin ser admin imprime los cierres pero no los corrige', async ({ page, request }) => {
  const { slug, auth } = await createRestaurant(request, `caja-cajera-${Date.now()}`)
  const cashier = { username: 'cajera.turno', password: 'secreto123' }
  const created = await request.post(`${API}/users`, {
    headers: auth,
    data: { name: 'Cajera Turno', role: 'employee', permissions: ['orders', 'reports'], ...cashier },
  })
  expect(created.status()).toBe(201)
  const productId = await seedSimpleProduct(request, auth, 'Limonada Turno E2E', 4500)
  await chargeOrder(request, auth, productId, 'cash', 2)
  const first = await currentShift(request, auth)
  await nextSecond()
  await closeShift(request, auth, first.id)

  await loginUI(page, cashier.username, cashier.password, slug)
  await openCashCloses(page)
  await expect(shiftRow(page, 1)).toContainText('$9.000')
  await expect(page.getByRole('button', { name: /^Cambiar la apertura del turno/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Cerrar el turno .* con otra fecha$/ })).toHaveCount(0)

  const [printout] = await Promise.all([
    page.waitForEvent('popup'),
    shiftRow(page, 1).getByRole('button', { name: 'Imprimir el cierre del turno 1' }).click(),
  ])
  await expect(printout.locator('body')).toContainText('CIERRE DE CAJA')
  await expect(printout.locator('body')).toContainText('Limonada Turno E2E')

  // Hiding is not the gate: the API refuses too.
  const cashierToken = await apiLogin(request, cashier.username, cashier.password, slug)
  const refused = await request.put(`${API}/cash-register/${first.id}`, {
    headers: { Authorization: `Bearer ${cashierToken}`, Accept: 'application/json' },
    data: { opened_at: `${isoDay(-1)} 08:00`, reason: 'Sin permiso' },
  })
  expect(refused.status()).toBe(403)
})

/**
 * A shop that also bills monthly fees has one drawer: the order's charge and
 * the abonos of the cartera close together, from Cartera too. The abonos come
 * by method and their cash joins the drawer; the monthly document is the sale
 * of its issue date in Ventas, never a charge or cash of the shift.
 */
test('con pedidos y facturación automática la caja es una y se cierra desde la Cartera con los abonos por medio', async ({ page, request }) => {
  const company = await createCompany(request, 'caja-una', { business_type: 'recurring', modules: SHOP_WITH_FEES })
  const auth = { Authorization: `Bearer ${company.token}`, Accept: 'application/json' }
  const productId = await seedSimpleProduct(request, auth, 'Empanada Caja Una', 15000)
  await chargeOrder(request, auth, productId, 'cash')
  const [document] = await issueDocuments(request, company.token, [
    { name: 'Local Caja Una', document_number: '3301', monthly_fee: 200000 },
  ])
  for (const [amount, payment_method] of [[50000, 'cash'], [30000, 'nequi']] as const) {
    const abono = await request.post(`${API}/recurring-billing/invoices/${document.id}/payments`, {
      headers: auth,
      data: { amount, payment_method },
    })
    expect(abono.status(), await abono.text()).toBe(201)
  }
  const shift = await currentShift(request, auth)
  await nextSecond()

  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/cartera')
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText(`Turno ${shift.number} · desde`)
  await expect(dialog).toContainText('Ventas de pedidos')
  await expect(dialog.getByTestId('cash-sales-total')).toHaveText('$15.000')
  await expect(dialog).toContainText('1 venta · 1 pedido')
  await expect(dialog.locator('tbody tr').filter({ hasText: /^\s*Efectivo/ })).toContainText('$15.000')
  const abonos = dialog.getByTestId('cash-abono-method')
  await expect(abonos.filter({ hasText: 'Abonos de cuotas · Efectivo' })).toContainText('$50.000')
  await expect(abonos.filter({ hasText: 'Abonos de cuotas · Nequi' })).toContainText('$30.000')
  await expect(dialog.getByTestId('cash-abonos-total')).toHaveText('$80.000')
  // The drawer: the cash sale and the cash abono. Nequi and the document stay out.
  await expect(dialog.getByTestId('cash-expected')).toHaveText('$65.000')
  await expect(dialog).not.toContainText('$200.000')
  await expect(dialog.getByText('Cuenta el efectivo de las ventas y los abonos, sin la base que dejas en el cajón')).toBeVisible()
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `../screenshots/caja-facturacion-automatica-cierre-con-pedidos-${viewport.width}.png` })
  }
  await page.setViewportSize({ width: 1440, height: 900 })

  await dialog.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(dialog).toContainText(`El turno ${shift.number} queda cerrado con $15.000 en ventas y $80.000 en abonos`)
  await dialog.getByRole('button', { name: 'Sí, cerrar caja' }).click()
  await expect(dialog).toContainText('Caja cerrada. Desde ahora corre un turno nuevo.')
  await dialog.getByRole('button', { name: 'Listo' }).click()
  // The shift Pedidos shows is the one Cartera closed.
  expect((await currentShift(request, auth)).number).toBe(shift.number + 1)
  await page.goto('/pedidos')
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')

  await openCashCloses(page)
  await expect(page.locator('.v-data-table thead')).toContainText('Ventas de pedidos')
  await expect(page.locator('.v-data-table thead')).toContainText('Abonos de cuotas')
  const row = shiftRow(page, shift.number)
  await expect(row).toContainText('$15.000')
  await expect(row).toContainText('$80.000')
  await expect(row).toContainText('Efectivo: $65.000')
  await expect(row).toContainText('Nequi: $30.000')

  // Ventas counts the document once, on its issue date; the abonos never add to it.
  await page.getByRole('button', { name: 'Ventas', exact: true }).click()
  await expect(page.locator('.v-card', { hasText: 'Total vendido' })).toContainText('$215.000')
})

/**
 * Ventas › Cierres de caja downloads the closes of the dates on screen, one
 * by one and then the period's totals: the Excel from the API, the PDF from
 * the same figures. The open shift is never in them; an empty period says so.
 */
test('los cierres del día o de un período se descargan en Excel y en PDF con sus totales', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `caja-exportar-${Date.now()}`)
  const today = isoDay()
  const productId = await seedSimpleProduct(request, auth, 'Tamal Cierre E2E', 15000)
  // Shift 1: cash and Nequi, counted exact, with a note. Shift 2: two in cash
  // and a cash expense, not counted. Shift 3 stays open with a sale of its own.
  await chargeOrder(request, auth, productId, 'cash')
  await chargeOrder(request, auth, productId, 'nequi')
  const first = await currentShift(request, auth)
  await nextSecond()
  await closeShift(request, auth, first.id, { counted_cash: 15000, notes: 'Cuadró al peso' })
  await chargeOrder(request, auth, productId, 'cash', 2)
  const category = await request.post(`${API}/expense-categories`, { headers: auth, data: { name: 'Insumos caja', type: 'fixed_expense' } })
  const expense = await request.post(`${API}/expenses`, {
    headers: auth,
    data: { expense_category_id: (await category.json()).data.id, concept: 'Hielo', amount: 5000, expense_date: today, payment_method: 'cash' },
  })
  expect(expense.status()).toBe(201)
  const second = await currentShift(request, auth)
  await nextSecond()
  await closeShift(request, auth, second.id)
  await chargeOrder(request, auth, productId, 'cash')

  await loginUI(page, credentials.email, credentials.password)
  await openCashCloses(page)
  await expect(shiftRow(page, 3)).toContainText('Abierta')
  await expect(page.getByText('El Excel y el PDF traen los turnos cerrados de estas fechas con los totales del período.')).toBeVisible()
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height })
    await expect(page.getByRole('button', { name: 'Descargar PDF' })).toBeVisible()
    await page.getByRole('button', { name: 'Cierres de caja' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: `../screenshots/cierres-de-caja-exportar-${width}.png`, fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1280, height: 720 })

  const download = async (name: string) => {
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
    return { name: file.suggestedFilename(), bytes: readFileSync((await file.path())!) }
  }

  const excel = await download('Descargar Excel')
  expect(excel.name).toBe(`cierres-de-caja-${today}.xlsx`)
  const [header, ...rows] = xlsxRows(excel.bytes)
  const cell = (row: string[] | undefined, title: string) => row?.[header!.indexOf(title)] ?? ''
  expect(rows.map(row => row[0] ?? '')).toEqual(['1', '2', '', 'Total del período (2 cierres)'])
  expect(cell(rows[0], 'Abrió')).toBe('Automática')
  expect(cell(rows[0], 'Cerró')).toBe('Dueña Caja')
  expect(cell(rows[0], 'Cobros · Nequi')).toBe('15000')
  expect(cell(rows[0], 'Diferencia')).toBe('0')
  expect(cell(rows[0], 'Nota')).toBe('Cuadró al peso')
  expect(cell(rows[1], 'Gastos en efectivo')).toBe('5000')
  expect(cell(rows[1], 'Efectivo a entregar')).toBe('25000')
  expect(cell(rows[1], 'Efectivo contado')).toBe('')
  expect(cell(rows[3], 'Ventas (sin propina)')).toBe('60000')
  expect(cell(rows[3], 'Cobros · Efectivo')).toBe('45000')
  expect(cell(rows[3], 'Total recibido')).toBe('60000')

  const pdf = await download('Descargar PDF')
  expect(pdf.name).toBe(`cierres-de-caja-${today}.pdf`)
  expect(pdfPageSize(pdf.bytes)).toEqual([612, 792])
  const text = pdfText(pdf.bytes)
  expect(text).toContain('Cierres de caja')
  expect(text).toContain(`Día: ${displayDate(today)} · Solo los turnos cerrados`)
  expect(text).not.toContain('Cierre N.º 3')
  const [, one, two, period] = text.split(/(?=Cierre N\.º \d+\n|Total del período)/)
  expect(one).toMatch(/^Cierre N\.º 1\n/)
  expect(one).toMatch(/Apertura: .* · Automática/)
  expect(one).toMatch(/Cierre: .* · Dueña Caja/)
  expect(one).toContain('Cobros · Nequi\n$15.000')
  expect(one).toContain('Efectivo contado\n$15.000')
  expect(one).toContain('Diferencia\nCuadra')
  expect(one).toContain('Nota: Cuadró al peso')
  expect(two).toMatch(/^Cierre N\.º 2\n/)
  expect(two).not.toContain('Nequi')
  expect(two).toContain('Gastos en efectivo\n$5.000')
  expect(two).toContain('Efectivo a entregar\n$25.000')
  expect(two).toContain('Efectivo contado\n—')
  expect(two).toContain('Diferencia\n—')
  expect(period).toMatch(/^Total del período \(2 cierres\)\n/)
  expect(period).toContain('Ventas (sin propina)\n$60.000')
  expect(period).toContain('N.º de ventas\n3')
  expect(period).toContain('Cobros · Efectivo\n$45.000')
  expect(period).toContain('Efectivo a entregar\n$40.000')
  expect(period).toContain('Efectivo contado (1 de 2 cierres)\n$15.000')
  expect(period).toContain('Total recibido\n$60.000')

  // A period: both dates go into the names and the PDF says which.
  const yesterday = isoDay(-1)
  await field(page, 'Desde').locator('input').fill(displayDate(yesterday))
  await field(page, 'Desde').locator('input').press('Enter')
  expect((await download('Descargar Excel')).name).toBe(`cierres-de-caja-${yesterday}_${today}.xlsx`)
  const periodPdf = await download('Descargar PDF')
  expect(periodPdf.name).toBe(`cierres-de-caja-${yesterday}_${today}.pdf`)
  expect(pdfText(periodPdf.bytes)).toContain(`Período: ${displayDate(yesterday)} – ${displayDate(today)}`)

  const before = isoDay(-3)
  for (const label of ['Desde', 'Hasta']) {
    await field(page, label).locator('input').fill(displayDate(before))
    await field(page, label).locator('input').press('Enter')
  }
  await expect(page.getByText('No hay cierres de caja en el rango seleccionado')).toBeVisible()
  const emptyPdf = await download('Descargar PDF')
  expect(emptyPdf.name).toBe(`cierres-de-caja-${before}.pdf`)
  const empty = pdfText(emptyPdf.bytes)
  expect(empty).toContain('No hay cierres de caja en estas fechas.')
  expect(empty).not.toContain('Total del período')
})

/**
 * "El cierre de caja debe permitir recoger dinero": a withdrawal asks for the
 * value, keeps the server's date and time and who registered it, prints its
 * own comprobante only when asked, and the close lists every withdrawal of
 * the shift and subtracts them from the cash to deliver, on screen, on paper,
 * in Ventas › Cierres de caja, the Excel and the PDF.
 */
test('los retiros de caja se registran, se imprimen y el cierre los relaciona y los resta del efectivo a entregar', async ({ page, request }) => {
  test.setTimeout(90_000)
  const { credentials, auth } = await createRestaurant(request, `caja-retiros-${Date.now()}`)
  const today = isoDay()
  const productId = await seedSimpleProduct(request, auth, 'Almuerzo Retiro E2E', 60000)
  await chargeOrder(request, auth, productId, 'cash', 2)   // $120.000 en efectivo
  await chargeOrder(request, auth, productId, 'nequi')     // $60.000 por Nequi: nunca está en el cajón

  const printing = await watchPrinting(page)
  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/pedidos')
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')
  await expect(page.getByTestId('cash-withdrawals-chip')).toHaveCount(0)

  await page.getByRole('button', { name: 'Retirar dinero' }).click()
  const withdraw = page.getByRole('dialog').filter({ hasText: 'Retirar dinero' })
  await expect(withdraw).toContainText('Sale del cajón del turno 1')
  await expect(withdraw).toContainText('Ahora debería haber $120.000 en el cajón')
  await expect(withdraw.getByText('Motivo o quién recibe el dinero')).toBeVisible()
  const value = withdraw.getByLabel('Valor')
  await expect(value).not.toHaveAttribute('type', 'number')
  await expect(withdraw.getByRole('button', { name: 'Registrar retiro' })).toBeDisabled()
  await value.fill('500.000')
  await expect(withdraw.getByTestId('withdraw-above-drawer')).toBeVisible()
  await value.fill('50.000')
  await expect(withdraw.getByTestId('withdraw-above-drawer')).toHaveCount(0)
  await withdraw.getByLabel('Nota (opcional)').fill('Lo recoge Juan, el dueño')
  await withdraw.getByRole('button', { name: 'Registrar retiro' }).click()
  const message = page.locator('.v-snackbar', { hasText: 'Retiro de caja No. 1 por $50.000 registrado.' })
  await expect(message).toBeVisible()
  await expect(withdraw).toHaveCount(0)
  // Registering never printed by itself: the message offers the comprobante.
  expect(await printing()).toEqual({ opened: 0, printed: 0 })

  const [comprobante] = await Promise.all([
    page.waitForEvent('popup'),
    message.getByRole('button', { name: 'Imprimir comprobante' }).click(),
  ])
  await expect(comprobante.locator('.doc-number')).toContainText('RETIRO DE CAJA')
  await expect(comprobante.locator('.doc-number .number')).toHaveText('1')
  const paper = await comprobante.locator('.document').innerText()
  expect(paper).toContain(`E2E caja-retiros`)
  expect(paper).toMatch(/FECHA \(D\/M\/A\):\s+\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}/)
  expect(paper).toContain('TURNO DE CAJA: No. 1')
  expect(paper).toContain('REGISTRÓ: Dueña Caja')
  expect(paper).toMatch(/VALOR RETIRADO\s+\$50\.000/)
  expect(paper).toContain('SON: CINCUENTA MIL PESOS M/CTE')
  expect(paper).toContain('Lo recoge Juan, el dueño')
  expect(paper).toContain('ENTREGA (CAJERO)')
  expect(paper).toContain('RECIBE')
  expect(paper).toMatch(/Impreso el \d{2}\/\d{2}\/\d{4}/)
  // It fits half letter: one half page.
  await comprobante.getByRole('button', { name: 'Media carta' }).click()
  await expect(comprobante.getByRole('button', { name: 'Media carta' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => pageRule(comprobante)).toContain('size: 5.5in 8.5in')
  const halfPdf = await comprobante.pdf({ preferCSSPageSize: true })
  expect(pdfPages(halfPdf)).toBe(1)
  expect(pdfPageSize(halfPdf)).toEqual([396, 612])
  await comprobante.close()

  // A second one, without a note.
  await page.getByRole('button', { name: 'Retirar dinero' }).click()
  await expect(withdraw).toContainText('Ahora debería haber $70.000 en el cajón')
  await withdraw.getByLabel('Valor').fill('20.000')
  await withdraw.getByRole('button', { name: 'Registrar retiro' }).click()
  await expect(page.locator('.v-snackbar', { hasText: 'Retiro de caja No. 2 por $20.000 registrado.' })).toBeVisible()

  // The panel: how many, how much, and the list with a reprint for each.
  const chip = page.getByTestId('cash-withdrawals-chip')
  await expect(chip).toHaveText('2 retiros · $70.000')
  await chip.click()
  const list = page.getByRole('dialog').filter({ hasText: 'Retiros del turno 1' })
  await expect(list).toContainText('2 retiros por $70.000. Al cerrar la caja se restan del efectivo a entregar.')
  const rows = list.getByTestId('cash-withdrawal')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText(/No\. 1 · \d{2}:\d{2}/)
  await expect(rows.nth(0)).toContainText('$50.000')
  await expect(rows.nth(0)).toContainText('Dueña Caja · Lo recoge Juan, el dueño')
  await expect(rows.nth(1)).toContainText(/No\. 2 · \d{2}:\d{2}/)
  await expect(rows.nth(1)).toContainText('$20.000')
  await expect(rows.nth(1)).toContainText('Dueña Caja')
  const [reprint] = await Promise.all([
    page.waitForEvent('popup'),
    list.getByRole('button', { name: 'Imprimir el retiro de caja No. 2' }).click(),
  ])
  await expect(reprint.locator('.doc-number .number')).toHaveText('2')
  await expect(reprint.locator('.document')).toContainText('VEINTE MIL PESOS M/CTE')
  await expect(reprint.locator('.notes')).not.toContainText('Lo recoge')
  await reprint.close()
  await list.getByRole('button', { name: 'Cerrar' }).click()

  // The close: the relación and the cash after the withdrawals, counted.
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const close = page.getByRole('dialog').filter({ hasText: 'Cerrar caja' })
  const relation = close.getByTestId('cash-withdrawals')
  await expect(relation).toContainText('Retiros de caja')
  await expect(relation.getByTestId('cash-withdrawal')).toHaveCount(2)
  await expect(relation.getByTestId('cash-withdrawal').nth(0)).toContainText('Lo recoge Juan, el dueño')
  await expect(close.getByTestId('cash-withdrawn')).toHaveText('$70.000')
  await expect(close.getByTestId('cash-expected')).toHaveText('$50.000')
  await expect(close.getByText('Cuenta el efectivo de las ventas que quedó después de los retiros, sin la base que dejas en el cajón')).toBeVisible()
  await close.getByLabel('Efectivo contado (opcional)').fill('50.000')
  await expect(close.getByTestId('cash-difference')).toHaveText('Cuadra: el efectivo está completo')
  await close.getByRole('button', { name: 'Cerrar caja' }).click()
  await close.getByRole('button', { name: 'Sí, cerrar caja' }).click()
  const done = page.getByRole('dialog').filter({ hasText: 'Caja cerrada' })
  await expect(done).toContainText('Caja cerrada: el efectivo cuadra.')
  await expect(done.getByTestId('cash-withdrawal')).toHaveCount(2)
  await expect(done.getByTestId('cash-withdrawn')).toHaveText('$70.000')
  await expect(done.getByTestId('cash-expected')).toHaveText('$50.000')

  const [summary] = await Promise.all([
    page.waitForEvent('popup'),
    done.getByRole('button', { name: 'Imprimir resumen' }).click(),
  ])
  await expect(summary.locator('.doc-number')).toContainText('CIERRE DE CAJA')
  const printed = await summary.locator('body').innerText()
  expect(printed).toMatch(/Efectivo\s+1\s+\$0\s+\$120\.000/)
  expect(printed).toMatch(/− Retiros de caja\s+\$70\.000/)
  expect(printed).toMatch(/EFECTIVO A ENTREGAR\s+\$50\.000/)
  expect(printed).toMatch(/Efectivo contado\s+\$50\.000/)
  expect(printed).toMatch(/DIFERENCIA\s+Cuadra/)
  expect(printed).toContain('RETIROS DE CAJA')
  expect(printed).toMatch(/1\s+\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} .*\s+Dueña Caja\s+Lo recoge Juan, el dueño\s+\$50\.000/)
  expect(printed).toMatch(/2\s+\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2} .*\s+Dueña Caja\s+\$20\.000/)
  expect(printed).toMatch(/TOTAL RETIRADO\s+\$70\.000/)
  await summary.close()
  await done.getByRole('button', { name: 'Listo' }).click()
  // The new shift starts with nothing taken out.
  await expect(page.getByTestId('cash-withdrawals-chip')).toHaveCount(0)

  // Ventas › Cierres de caja shows them per close, and the downloads carry them.
  await openCashCloses(page)
  await expect(page.locator('.v-data-table thead')).toContainText('Efectivo a entregar')
  const row = shiftRow(page, 1)
  await expect(row).toContainText('$50.000')
  await expect(row).toContainText('Cuadra')
  await row.getByRole('button', { name: '2 retiros · $70.000: ver los retiros del turno 1' }).click()
  const closedList = page.getByRole('dialog').filter({ hasText: 'Retiros del turno 1' })
  await expect(closedList).toContainText('Ya están restados del efectivo a entregar ($50.000).')
  const closedRows = closedList.getByTestId('cash-withdrawal')
  await expect(closedRows).toHaveCount(2)
  await expect(closedRows.nth(0)).toContainText(/No\. 1 · .*\$50\.000/)
  await expect(closedRows.nth(0)).toContainText('Dueña Caja · Lo recoge Juan, el dueño')
  await expect(closedRows.nth(1)).toContainText(/No\. 2 · .*\$20\.000/)
  await expect(closedList).toContainText(/Total retirado\s*\$70\.000/)
  const [fromVentas] = await Promise.all([
    page.waitForEvent('popup'),
    closedList.getByRole('button', { name: 'Imprimir el retiro de caja No. 1' }).click(),
  ])
  await expect(fromVentas.locator('.doc-number .number')).toHaveText('1')
  await expect(fromVentas.locator('.document')).toContainText('TURNO DE CAJA: No. 1')
  await fromVentas.close()
  await closedList.getByRole('button', { name: 'Cerrar' }).click()
  await expect(closedList).toHaveCount(0)

  const download = async (name: string) => {
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
    return readFileSync((await file.path())!)
  }
  const [header, ...sheet] = xlsxRows(await download('Descargar Excel'))
  const cell = (values: string[] | undefined, title: string) => values?.[header!.indexOf(title)] ?? ''
  expect(header!.slice(header!.indexOf('Gastos en efectivo'), header!.indexOf('Efectivo contado') + 1))
    .toEqual(['Gastos en efectivo', 'Retiros de caja', 'Efectivo a entregar', 'Efectivo contado'])
  expect(sheet.map(values => values[0] ?? '')).toEqual(['1', '', 'Total del período (1 cierre)'])
  for (const values of [sheet[0], sheet[2]]) {
    expect(cell(values, 'Cobros · Efectivo')).toBe('120000')
    expect(cell(values, 'Cobros · Nequi')).toBe('60000')
    expect(cell(values, 'Gastos en efectivo')).toBe('0')
    expect(cell(values, 'Retiros de caja')).toBe('70000')
    expect(cell(values, 'Efectivo a entregar')).toBe('50000')
    expect(cell(values, 'Efectivo contado')).toBe('50000')
    expect(cell(values, 'Diferencia')).toBe('0')
    expect(cell(values, 'Total recibido')).toBe('180000')
  }

  const text = pdfText(await download('Descargar PDF'))
  expect(text).toContain(`Día: ${displayDate(today)} · Solo los turnos cerrados`)
  const [, one, period] = text.split(/(?=Cierre N\.º \d+\n|Total del período)/)
  expect(one).toContain('Retiros de caja\n$70.000')
  expect(one).toContain('Efectivo a entregar\n$50.000')
  expect(period).toContain('Retiros de caja\n$70.000')
  expect(period).toContain('Efectivo a entregar\n$50.000')
})

/** One file carries at most 2,000 closes: a longer period is narrowed first, and both downloads say so. */
test('con más de 2.000 cierres en las fechas, el Excel y el PDF piden acotar el período', async ({ page, request }) => {
  test.setTimeout(60_000)
  const { credentials, auth } = await createRestaurant(request, `caja-limite-${Date.now()}`)
  await currentShift(request, auth)
  // 2,001 closes through the API would take 2,001 seconds: they go straight to the e2e database.
  const day = isoDay(-10)
  const summary = JSON.stringify({
    by_method: {}, recurring_by_method: {}, cash_sales: 0, cash_recurring: 0, cash_expenses: 0, expected_cash: 0, total_collected: 0,
  })
  e2eSql(`WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2001)
    INSERT INTO cash_sessions (company_id, number, opened_at, closed_at, opening_amount, expected_cash, summary, created_at, updated_at)
    SELECT (SELECT company_id FROM users WHERE email = '${credentials.email}'), 100 + i,
      datetime('${day} 00:00:00', '+' || (i * 30) || ' seconds'), datetime('${day} 00:00:00', '+' || (i * 30 + 20) || ' seconds'),
      0, 0, '${summary}', datetime('now'), datetime('now')
    FROM n`)

  await loginUI(page, credentials.email, credentials.password)
  await openCashCloses(page, day)
  const snackbar = page.locator('.v-snackbar')
  for (const name of ['Descargar Excel', 'Descargar PDF']) {
    await page.getByRole('button', { name }).click()
    await expect(snackbar).toContainText('Hay más de 2.000 cierres de caja en esas fechas. Acota el período para descargarlos.')
    // The message stays 6 seconds: the next download must show its own.
    await expect(snackbar).toBeHidden({ timeout: 10_000 })
  }
})

/**
 * A POS sale prints as a letter factura de venta, like the automatic-billing
 * one: the business header with the resolution its number came from, the
 * products of that sale with quantity, unit value, tax and total, the
 * payment method and the amount in words. From the charge's message in
 * Pedidos and from its row in Ventas.
 */
test('la venta se imprime en hoja como factura de venta, desde Pedidos y desde Ventas', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `factura-hoja-${Date.now()}`)
  const resolution = await request.put(`${API}/invoicing/resolution`, {
    headers: auth,
    data: {
      invoicing_resolution: '018764000000001',
      invoice_prefix: 'FE',
      range_from: 1,
      range_to: 100,
      resolution_date: '2026-01-15',
      valid_until: '2030-01-15',
    },
  })
  expect(resolution.ok()).toBeTruthy()
  const nit = `901${Date.now() % 1_000_000}`
  const business = await request.put(`${API}/invoicing/business`, {
    headers: auth,
    data: {
      legal_name: 'Hoja Carta SAS',
      nit,
      tax_regime: 'common',
      address: 'Calle 10 # 5-20',
      city: 'Popayán',
      phone: '3001234567',
      document_notes: 'Gracias por tu compra',
    },
  })
  expect(business.ok()).toBeTruthy()
  const tax = (await (await request.post(`${API}/taxes`, { headers: auth, data: { name: 'Impoconsumo E2E', rate: 8 } })).json()).data
  const categoryId = (await (await request.post(`${API}/categories`, { headers: auth, data: { name: 'Comidas' } })).json()).data.id
  const product = async (name: string, price: number, taxId?: number): Promise<number> => (await (await request.post(`${API}/products`, {
    headers: auth,
    data: { name, type: 'final', unit: 'und', sale_price: price, tracks_stock: false, category_id: categoryId, ...(taxId ? { tax_id: taxId } : {}) },
  })).json()).data.id
  const beer = await product('Cerveza Club', 6500)
  const empanada = await product('Empanada de pipián', 3000, tax.id)
  const table = await request.post(`${API}/tables`, { headers: auth, data: { number: 5, capacity: 4 } })
  expect(table.status()).toBe(201)
  // Taken as the waiter app takes it: on its table, named after the table.
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      dining_table_id: (await table.json()).data.id,
      customer_name: 'Mesa 5',
      items: [{ product_id: beer, quantity: 2 }, { product_id: empanada, quantity: 3 }],
    },
  })
  expect(order.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, credentials.email, credentials.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$22.000' }).first().getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir tirilla' })).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/factura-ventas-productos-mensaje-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/factura-ventas-productos-mensaje-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })

  const [invoice] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Generar factura' }).click(),
  ])
  await expect(invoice.locator('.doc-number')).toContainText('FACTURA DE VENTA')
  await expect(invoice.locator('.doc-number .number')).toHaveText('FE1')
  await expect(invoice.locator('.header .business')).toContainText('Hoja Carta SAS')
  await expect(invoice.locator('.header .business')).toContainText(`NIT: ${nit}`)
  await expect(invoice.locator('.header .business .resolution')).toHaveText(
    'Resolución DIAN N.º 018764000000001 del 15/01/2026 · Rango FE1 a FE100 · Vigente hasta 15/01/2030',
  )
  const rows = invoice.locator('.items tbody tr')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).locator('td')).toHaveText(['Cerveza Club', '2', '$6.500', '—', '$13.000'])
  await expect(rows.nth(1).locator('td')).toHaveText(['Empanada de pipián', '3', '$3.000', '8%', '$9.000'])
  // The subtotal is the value before the tax: 21.333 + 667 = 22.000.
  await expect(invoice.locator('.totals')).toContainText('SUBTOTAL: $21.333')
  await expect(invoice.locator('.totals')).toContainText('IMPUESTO: $667')
  await expect(invoice.locator('.totals')).toContainText('TOTAL: $22.000')
  await expect(invoice.locator('.totals')).not.toContainText('PROPINA')
  // Nobody identified the buyer: the consumidor final with the DIAN's NIT, never the table.
  await expect(invoice.locator('.party')).toContainText('CLIENTE: Consumidor final')
  await expect(invoice.locator('.party')).toContainText('NIT: 222222222222')
  await expect(invoice.locator('.party')).toContainText('MESA: Mesa 5')
  await expect(invoice.locator('.party')).not.toContainText('CLIENTE: Mesa')
  await expect(invoice.locator('.party')).toContainText('FORMA DE PAGO: Efectivo')
  await expect(invoice.locator('.son')).toHaveText('SON: VEINTIDÓS MIL PESOS M/CTE')
  await expect(invoice.locator('.notes')).toContainText('Gracias por tu compra')
  await expect(invoice.locator('body')).not.toContainText(/CUFE|electrónica/i)
  await invoice.setViewportSize({ width: 1440, height: 900 })
  await invoice.screenshot({ path: '../screenshots/factura-ventas-productos-factura-1440.png', fullPage: true })
  await invoice.setViewportSize({ width: 816, height: 1056 })
  await invoice.screenshot({ path: '../screenshots/factura-ventas-productos-factura-carta.png', fullPage: true })
  await invoice.close()

  // Later, from the paid order's row: "Tirilla" is the ticket, the menu has the factura.
  await page.getByRole('button', { name: 'Pagados' }).click()
  const paidRow = page.locator('tbody tr', { hasText: '$22.000' })
  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    paidRow.getByRole('button', { name: 'Tirilla' }).click(),
  ])
  await expect(ticket.locator('body')).toContainText('FACTURA DE VENTA No. FE1')
  const ticketText = await ticket.locator('body').innerText()
  expect(ticketText).toContain('CLIENTE : Consumidor final')
  expect(ticketText).toContain('NIT     : 222222222222')
  expect(ticketText).toContain('MESA    : Mesa 5')
  await ticket.close()
  await paidRow.getByRole('button', { name: 'Más acciones del pedido' }).click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/factura-ventas-productos-menu-1440.png' })
  const [fromRow] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('listitem').filter({ hasText: 'Generar factura' }).click(),
  ])
  await expect(fromRow.locator('.doc-number .number')).toHaveText('FE1')
  await fromRow.close()

  // The same document from its row in Ventas.
  await page.goto('/ventas')
  const saleRow = page.locator('tbody tr', { hasText: 'FE1' })
  await expect(saleRow).toContainText('$22.000')
  await page.screenshot({ path: '../screenshots/factura-ventas-productos-ventas-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/factura-ventas-productos-ventas-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  const [again] = await Promise.all([
    page.waitForEvent('popup'),
    saleRow.getByRole('button', { name: 'Imprimir la factura FE1' }).click(),
  ])
  await expect(again.locator('.doc-number .number')).toHaveText('FE1')
  await expect(again.locator('.items tbody tr')).toHaveCount(2)
  await expect(again.locator('.totals')).toContainText('TOTAL: $22.000')
})

/** A paid order, arranged through the API, with products whose prices include the tax named. */
async function paidOrderWithTaxes(
  request: APIRequestContext,
  auth: Auth,
  lines: { name: string; price: number; rate?: number; quantity: number }[],
  charge: { discountPercent?: number; tip?: number; table?: number } = {},
) {
  const categoryId = (await (await request.post(`${API}/categories`, { headers: auth, data: { name: `Bebidas ${Date.now()}` } })).json()).data.id
  const items = []
  for (const line of lines) {
    const tax = line.rate
      ? (await (await request.post(`${API}/taxes`, { headers: auth, data: { name: `Impuesto ${line.rate}% ${Date.now()}`, rate: line.rate } })).json()).data
      : null
    const product = await request.post(`${API}/products`, {
      headers: auth,
      data: { name: line.name, type: 'final', unit: 'und', sale_price: line.price, tracks_stock: false, category_id: categoryId, ...(tax ? { tax_id: tax.id } : {}) },
    })
    expect(product.status(), await product.text()).toBe(201)
    items.push({ product_id: (await product.json()).data.id, quantity: line.quantity })
  }
  const table = charge.table
    ? (await (await request.post(`${API}/tables`, { headers: auth, data: { number: charge.table, capacity: 4 } })).json()).data
    : null
  const order = (await (await request.post(`${API}/orders`, {
    headers: auth,
    data: { items, ...(table ? { dining_table_id: table.id, customer_name: table.display_name } : {}) },
  })).json()).data
  if (charge.discountPercent) {
    const discount = await request.post(`${API}/orders/${order.id}/discount`, { headers: auth, data: { type: 'percentage', value: charge.discountPercent } })
    expect(discount.ok()).toBeTruthy()
  }
  const paid = await request.post(`${API}/orders/${order.id}/pay`, { headers: auth, data: { payment_method: 'cash', tip: charge.tip ?? 0 } })
  expect(paid.ok(), await paid.text()).toBeTruthy()
  return order
}

/** The paid order's ticket ("Tirilla") and its letter document ("Generar factura" in the row menu), from Pedidos. */
async function printPaidOrder(page: Page, rowTotal: string): Promise<{ ticket: string; letter: Page }> {
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pedidos del día' }).click()
  const paidRow = page.locator('tbody tr', { hasText: rowTotal })
  const [ticketWindow] = await Promise.all([
    page.waitForEvent('popup'),
    paidRow.getByRole('button', { name: 'Tirilla' }).click(),
  ])
  await expect(ticketWindow.locator('body')).toContainText('GRACIAS POR SU COMPRA')
  const ticket = await ticketWindow.locator('body').innerText()
  await ticketWindow.close()
  await paidRow.getByRole('button', { name: 'Más acciones del pedido' }).click()
  const [letter] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('listitem').filter({ hasText: 'Generar factura' }).click(),
  ])
  await expect(letter.locator('.totals')).toBeVisible()
  return { ticket, letter }
}

/** `SUBTOTAL                    $20.168`: a ticket line with its label and its amount. */
const ticketLine = (label: string, amount: string) => new RegExp(`^${label} +${amount.replace(/[$.]/g, '\\$&')}$`, 'm')

/**
 * The owner's photo: 4 × Corona at $6.000 with IVA 19 % included printed
 * SUBTOTAL $24.000, IMPUESTO $3.832 and TOTAL $24.000, a subtotal that already
 * carried the tax. The printed subtotal is the value before taxes, so the
 * letter comprobante and the ticket add up: 20.168 + 3.832 = 24.000.
 */
test('el subtotal impreso es el valor antes de impuestos y suma el total con el impuesto', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `subtotal-foto-${Date.now()}`)
  const order = await paidOrderWithTaxes(request, auth, [{ name: 'CERVEZA CORONA x 330ML', price: 6000, rate: 19, quantity: 4 }], { table: 1 })

  await freezeTime(page, order.created_at)
  await loginUI(page, credentials.email, credentials.password)
  const { ticket, letter } = await printPaidOrder(page, '$24.000')

  expect(ticket).toMatch(ticketLine('SUBTOTAL', '$20.168'))
  expect(ticket).toMatch(ticketLine('IMPUESTO', '$3.832'))
  expect(ticket).toMatch(ticketLine('TOTAL', '$24.000'))
  expect(ticket).not.toContain('IVA INCL.')

  await expect(letter.locator('.doc-number')).toContainText('COMPROBANTE DE VENTA')
  await expect(letter.locator('.items tbody tr td')).toHaveText(['CERVEZA CORONA x 330ML', '4', '$6.000', '19%', '$24.000'])
  await expect(letter.locator('.totals > div')).toHaveText(['SUBTOTAL: $20.168', 'IMPUESTO: $3.832', 'TOTAL: $24.000'])
  await expect(letter.locator('.son')).toHaveText('SON: VEINTICUATRO MIL PESOS M/CTE')
})

/**
 * With a discount, two tax rates and a tip every printed line still adds up:
 * subtotal before taxes − discount + taxes = total, and the tip on top is the
 * total paid. The taxes are the accounting movement's, computed on the lines
 * before the discount: $12.000 of beer with 19 % and $9.000 of empanadas with
 * 8 % carry $2.583.
 */
test('con descuento, dos impuestos y propina las cifras impresas suman el total', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `subtotal-descuento-${Date.now()}`)
  const order = await paidOrderWithTaxes(request, auth, [
    { name: 'Cerveza Descuento', price: 6000, rate: 19, quantity: 2 },
    { name: 'Empanada Descuento', price: 3000, rate: 8, quantity: 3 },
  ], { discountPercent: 10, tip: 2000 })

  await freezeTime(page, order.created_at)
  await loginUI(page, credentials.email, credentials.password)
  const { ticket, letter } = await printPaidOrder(page, '$20.900')

  // 18.417 − 2.100 + 2.583 = 18.900, and 2.000 of tip make 20.900.
  for (const [label, amount] of [
    ['SUBTOTAL', '$18.417'],
    ['DESCUENTO', '-$2.100'],
    ['IMPUESTO', '$2.583'],
    ['TOTAL SIN PROPINA', '$18.900'],
    ['PROPINA VOLUNTARIA', '$2.000'],
    ['TOTAL PAGADO', '$20.900'],
  ]) {
    expect(ticket).toMatch(ticketLine(label!, amount!))
  }

  await expect(letter.locator('.totals > div')).toHaveText([
    'SUBTOTAL: $18.417',
    'DESCUENTO: -$2.100',
    'IMPUESTO: $2.583',
    'TOTAL: $18.900',
    'PROPINA VOLUNTARIA: $2.000',
    'TOTAL PAGADO: $20.900',
  ])
  await expect(letter.locator('.son')).toHaveText('SON: DIECIOCHO MIL NOVECIENTOS PESOS M/CTE')
})

/**
 * Without a resolution a sale is the internal comprobante de venta, numbered
 * with its reference; a table charged by person gets one per sale, with only
 * what that person paid. Pedidos and Ventas print the same document.
 */
test('sin resolución, la venta de una persona sale en hoja como comprobante con solo lo suyo', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `comprobante-hoja-${Date.now()}`)
  const arepa = await seedSimpleProduct(request, auth, 'Arepa Persona', 4200)
  const juice = await seedSimpleProduct(request, auth, 'Jugo Persona', 3100)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: arepa, quantity: 1, guest_number: 1 }, { product_id: juice, quantity: 2, guest_number: 2 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$10.400' }).first().getByRole('button', { name: 'Cobrar' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('.v-list-item', { hasText: 'Persona 1' }).getByRole('button', { name: 'Cobrar', exact: true }).click()
  await expect(page.getByText('Persona 1 pagó $4.200')).toBeVisible()
  const sale = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data.payments[0]

  const expectComprobante = async (doc: Page) => {
    await expect(doc.locator('.doc-number')).toContainText('COMPROBANTE DE VENTA')
    await expect(doc.locator('.doc-number .number')).toHaveText(sale.reference)
    await expect(doc.locator('.resolution')).toHaveCount(0)
    await expect(doc.locator('.items tbody tr td')).toHaveText(['Arepa Persona', '1', '$4.200', '—', '$4.200'])
    await expect(doc.locator('.totals')).toContainText('TOTAL: $4.200')
    await expect(doc.locator('.party')).toContainText('CLIENTE: Consumidor final')
    await expect(doc.locator('.party')).toContainText('NIT: 222222222222')
    await expect(doc.locator('body')).not.toContainText('Jugo Persona')
    await expect(doc.locator('body')).not.toContainText(/FACTURA DE VENTA|Resolución/)
  }
  const [fromPedidos] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Generar factura' }).click(),
  ])
  await expectComprobante(fromPedidos)
  await fromPedidos.setViewportSize({ width: 816, height: 1056 })
  await fromPedidos.screenshot({ path: '../screenshots/factura-ventas-productos-comprobante-carta.png', fullPage: true })
  await fromPedidos.close()

  await page.goto('/ventas')
  const [fromVentas] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: `Imprimir el comprobante ${sale.reference}` }).click(),
  ])
  await expectComprobante(fromVentas)
})

/**
 * A sale charged to a registered customer prints that customer, never the
 * consumidor final: the ticket and the letter comprobante carry the name and
 * the document as the customer has them, and Ventas reads the name.
 */
test('una venta a un cliente registrado imprime su nombre y su documento', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `cliente-hoja-${Date.now()}`)
  const arepa = await seedSimpleProduct(request, auth, 'Arepa Cliente', 5300)
  const customer = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: '1.002.655.357', name: 'Ana Registrada', address: 'Calle 1 # 2-3' },
  })
  expect(customer.status(), await customer.text()).toBe(201)
  const order = (await (await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa 2', items: [{ product_id: arepa, quantity: 1 }] },
  })).json()).data
  const paid = await request.post(`${API}/orders/${order.id}/pay`, {
    headers: auth,
    data: { payment_method: 'cash', customer_id: (await customer.json()).data.id },
  })
  expect(paid.ok()).toBeTruthy()
  const sale = (await (await request.get(`${API}/orders/${order.id}`, { headers: auth })).json()).data.payments[0]

  await freezeTime(page, order.created_at)
  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pedidos del día' }).click()
  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('tbody tr', { hasText: '$5.300' }).getByRole('button', { name: 'Tirilla' }).click(),
  ])
  await expect(ticket.locator('body')).toContainText('COMPROBANTE DE VENTA')
  const ticketText = await ticket.locator('body').innerText()
  expect(ticketText).toContain('CLIENTE : Ana Registrada')
  expect(ticketText).toContain('CC      : 1002655357')
  expect(ticketText).not.toContain('222222222222')
  await ticket.close()

  await page.goto('/ventas')
  const row = page.locator('tbody tr', { hasText: '$5.300' })
  await expect(row).toContainText('Ana Registrada')
  const [comprobante] = await Promise.all([
    page.waitForEvent('popup'),
    row.getByRole('button', { name: `Imprimir el comprobante ${sale.reference}` }).click(),
  ])
  const party = comprobante.locator('.party')
  await expect(party).toContainText('CLIENTE: Ana Registrada')
  // A cédula prints without its verification digit.
  await expect(party).toContainText('CC: 1002655357')
  await expect(party).not.toContainText('1002655357-')
  await expect(party).toContainText('DIRECCIÓN: Calle 1 # 2-3')
  await expect(party).not.toContainText(/Consumidor final|222222222222/)
  await comprobante.close()

  // A NIT prints with the digit the DIAN computes (Bancolombia, 890903938-8)
  // and never the letter that tells its sedes apart in the lists.
  const sede = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'NIT', document_number: '890.903.938-a', name: 'Bancolombia Sede A' },
  })
  expect(sede.status(), await sede.text()).toBe(201)
  expect((await sede.json()).data).toMatchObject({ document_number: '890903938-A', verification_digit: '8' })
  const nitOrder = (await (await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa 3', items: [{ product_id: arepa, quantity: 2 }] },
  })).json()).data
  expect((await request.post(`${API}/orders/${nitOrder.id}/pay`, {
    headers: auth,
    data: { payment_method: 'cash', customer_id: (await sede.json()).data.id },
  })).ok()).toBeTruthy()
  const nitSale = (await (await request.get(`${API}/orders/${nitOrder.id}`, { headers: auth })).json()).data.payments[0]

  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pedidos del día' }).click()
  const [nitTicket] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('tbody tr', { hasText: '$10.600' }).getByRole('button', { name: 'Tirilla' }).click(),
  ])
  await expect(nitTicket.locator('body')).toContainText('COMPROBANTE DE VENTA')
  const nitTicketText = await nitTicket.locator('body').innerText()
  expect(nitTicketText).toContain('CLIENTE : Bancolombia Sede A')
  expect(nitTicketText).toContain('NIT     : 890903938-8')
  expect(nitTicketText).not.toContain('890903938-A')
  await nitTicket.close()

  await page.goto('/ventas')
  const nitRow = page.locator('tbody tr', { hasText: '$10.600' })
  const [nitComprobante] = await Promise.all([
    page.waitForEvent('popup'),
    nitRow.getByRole('button', { name: `Imprimir el comprobante ${nitSale.reference}` }).click(),
  ])
  await expect(nitComprobante.locator('.party')).toContainText('CLIENTE: Bancolombia Sede A')
  await expect(nitComprobante.locator('.party')).toContainText('NIT: 890903938-8')
  await expect(nitComprobante.locator('.party')).not.toContainText('890903938-A')
})

/**
 * The factura grows with its lines, with no fixed empty area. Past one letter
 * page it is split: every page repeats the document number and the header
 * row, the totals close the last one and each says "Página n de m". A short
 * one also prints on half letter, chosen in the window before printing, and
 * the choice is remembered; a long one stays on letter and the window says
 * why. With 1, 5, 15, 40 and 120 products the PDF has exactly the pages the
 * window shows: nothing overflowed or was cut.
 */
test('la factura crece con sus líneas, se pagina en carta y la corta también sale en media carta', async ({ page, request }) => {
  test.setTimeout(180_000)
  const { credentials, auth } = await createRestaurant(request, `media-hoja-${Date.now()}`)
  const resolution = await request.put(`${API}/invoicing/resolution`, {
    headers: auth,
    data: { invoicing_resolution: '018764000000001', invoice_prefix: 'FE', range_from: 1, range_to: 100, resolution_date: '2026-01-15', valid_until: '2030-01-15' },
  })
  expect(resolution.ok()).toBeTruthy()
  const categoryId = (await (await request.post(`${API}/categories`, { headers: auth, data: { name: 'Surtido' } })).json()).data.id
  const productName = (n: number) => `Producto ${String(n).padStart(3, '0')}`
  const products: number[] = []
  for (let n = 1; n <= 120; n++) {
    const created = await request.post(`${API}/products`, {
      headers: auth,
      data: { name: productName(n), type: 'final', unit: 'und', sale_price: 1000 + n, tracks_stock: false, category_id: categoryId },
    })
    products.push((await created.json()).data.id)
  }
  // FE1 has 1 line, FE2 5, FE3 15, FE4 40 and FE5 120.
  for (const lines of [1, 5, 15, 40, 120]) {
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { items: products.slice(0, lines).map(product_id => ({ product_id, quantity: 1 })) },
    })
    const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, { headers: auth, data: { payment_method: 'cash' } })
    expect(paid.ok()).toBeTruthy()
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/ventas')
  const open = async (number: string): Promise<Page> => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: `Imprimir la factura ${number}` }).click(),
    ])
    await expect(popup.locator('.sheet').first()).toBeVisible()
    await popup.setViewportSize({ width: 900, height: 1100 })
    return popup
  }
  /** Every line once, the totals once on the last page, the number and header row on every page, and as many PDF pages. */
  const expectPages = async (popup: Page, number: string, lines: number, size: number[]): Promise<number> => {
    await expect(popup.locator('.items tbody tr')).toHaveCount(lines)
    await expect(popup.locator('.items tbody tr').last()).toContainText(productName(lines))
    const sheets = await popup.locator('.sheet').count()
    await expect(popup.locator('.totals')).toHaveCount(1)
    await expect(popup.locator('.sheet').last().locator('.totals')).toHaveCount(1)
    await expect(popup.locator('.sheet thead')).toHaveCount(sheets)
    if (sheets > 1) {
      await expect(popup.locator('.page-foot')).toHaveText(
        Array.from({ length: sheets }, (_, page) => `FACTURA DE VENTA No. ${number} · Página ${page + 1} de ${sheets}`),
      )
      await expect(popup.locator('.page-head .number')).toHaveText(Array(sheets - 1).fill(number))
    } else {
      await expect(popup.locator('.page-foot')).toHaveCount(0)
    }
    const pdf = await popup.pdf({ preferCSSPageSize: true })
    expect(pdfPages(pdf)).toBe(sheets)
    expect(pdfPageSize(pdf)).toEqual(size)
    return sheets
  }
  const LETTER = [612, 792]
  const HALF = [396, 612]
  const halfButton = (popup: Page) => popup.getByRole('button', { name: 'Media carta' })

  // One line: a letter page by default, and a half page when chosen.
  const one = await open('FE1')
  await expect.poll(() => pageRule(one)).toContain('size: letter')
  expect(await expectPages(one, 'FE1', 1, LETTER)).toBe(1)
  await one.screenshot({ path: '../screenshots/factura-media-hoja-1-linea-carta.png', fullPage: true })
  await halfButton(one).click()
  await expect.poll(() => pageRule(one)).toContain('size: 5.5in 8.5in')
  expect(await expectPages(one, 'FE1', 1, HALF)).toBe(1)
  await one.screenshot({ path: '../screenshots/factura-media-hoja-1-linea-media-carta.png', fullPage: true })
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    await one.setViewportSize({ width: width!, height: height! })
    await one.screenshot({ path: `../screenshots/factura-media-hoja-ventana-${width}.png` })
  }
  await one.close()

  // Five and fifteen lines open on the half letter chosen before, one page each.
  for (const [number, lines] of [['FE2', 5], ['FE3', 15]] as const) {
    const popup = await open(number)
    await expect(halfButton(popup)).toHaveAttribute('aria-pressed', 'true')
    expect(await expectPages(popup, number, lines, HALF)).toBe(1)
    if (lines === 15) {
      await popup.screenshot({ path: '../screenshots/factura-media-hoja-15-lineas-media-carta.png', fullPage: true })
      await popup.getByRole('button', { name: 'Carta', exact: true }).click()
      expect(await expectPages(popup, number, lines, LETTER)).toBe(1)
    }
    await popup.close()
  }

  // Forty and 120 lines do not fit half letter: letter pages, and the window says why.
  for (const [number, lines] of [['FE4', 40], ['FE5', 120]] as const) {
    const popup = await open(number)
    await expect(halfButton(popup)).toBeDisabled()
    await expect(popup.getByRole('status')).toHaveText(`No cabe en media carta: la factura de venta ${number} tiene ${lines} líneas. Se imprime en carta.`)
    const sheets = await expectPages(popup, number, lines, LETTER)
    expect(sheets).toBeGreaterThanOrEqual(lines === 40 ? 2 : 3)
    await popup.screenshot({ path: `../screenshots/factura-media-hoja-${lines}-lineas-carta.png`, fullPage: true })
    await popup.pdf({ path: `../screenshots/factura-media-hoja-${lines}-lineas-carta.pdf`, preferCSSPageSize: true })
    await popup.close()
  }
})


/**
 * "A crédito": the order is charged (numbered, counted once in Ventas) but no
 * money comes into the shift; what the customer owes is a document in
 * Cartera, paid with abonos (recibos de caja RC-n) that the shift does count.
 * Cartera never offers to cancel it, and once it has an abono the admin
 * cannot revert its charge either.
 */
test('vender a crédito: el pedido queda cobrado, Ventas lo cuenta una vez y Cartera recibe sus abonos', async ({ page, request }) => {
  const company = await createCompany(request, `credito-${Date.now()}`, { business_type: 'restaurant', modules: SHOP_WITH_FEES })
  const auth = { Authorization: `Bearer ${company.token}`, Accept: 'application/json' }
  const productId = await seedSimpleProduct(request, auth, `Bandeja Fiada ${Date.now()}`, 31400)
  const customer = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: '7001', name: 'Ana Fiado' },
  })
  expect(customer.status(), await customer.text()).toBe(201)
  // A monthly document of another payer: Cartera offers to cancel that one, never a credit sale.
  await issueDocuments(request, company.token, [{ name: 'Beto Cuota', document_number: '7002', monthly_fee: 90000 }])
  for (const quantity of [1, 2]) {
    const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity }] } })
    expect(order.status()).toBe(201)
  }
  const in30Days = isoDay(30)
  const in45Days = isoDay(45)

  await loginUI(page, company.credentials.email, company.credentials.password)
  const chargeOnCredit = async (total: string) => {
    await page.locator('tbody tr', { hasText: total }).getByRole('button', { name: 'Cobrar' }).click()
    await field(page, 'Método de pago').click()
    await pickOption(page, 'A crédito')
  }
  const dialog = page.getByRole('dialog')
  const pickAna = async () => {
    await dialog.getByRole('combobox', { name: /Cliente que queda debiendo/ }).fill('Ana')
    await page.getByRole('option', { name: /Ana Fiado/ }).click()
  }

  // On a phone first (the page loads at that width), then the sale at desktop width.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/pedidos')
  await chargeOnCredit('$31.400')
  await pickAna()
  await dialog.getByRole('button', { name: 'Vender a crédito' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/venta-a-credito-cobro-390.png' })
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/pedidos')

  // The first order, on credit to a customer who already exists.
  await chargeOnCredit('$31.400')
  await expect(dialog.getByLabel('Sugerir propina voluntaria')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Vender a crédito' })).toBeDisabled()
  await pickAna()
  await expect(field(page, 'Vence').locator('input')).toHaveValue(displayDate(in30Days))
  await expect(dialog).toContainText('Sin día de corte: vence en 30 días')
  await expect(dialog).toContainText('No entra dinero a la caja: la venta queda en la cartera de Ana Fiado')
  await expect(dialog).toContainText('Queda debiendo:')
  await expect(dialog).toContainText('$31.400')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/venta-a-credito-cobro-1440.png' })
  await dialog.getByRole('button', { name: 'Vender a crédito' }).click()
  await expect(page.getByText('Venta a crédito: Ana Fiado queda debiendo $31.400 en Cartera.')).toBeVisible()

  // The second one, to a customer created right there, due on a date typed by hand.
  await chargeOnCredit('$62.800')
  await dialog.getByRole('button', { name: 'Nuevo cliente' }).click()
  await field(page, 'Número de documento').locator('input').fill('7003')
  await field(page, 'Nombre').locator('input').fill('Carlos Nuevo')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/venta-a-credito-nuevo-cliente-1440.png' })
  await dialog.getByRole('button', { name: 'Crear cliente' }).click()
  await expect(dialog).toContainText('la venta queda en la cartera de Carlos Nuevo')
  await field(page, 'Vence').locator('input').fill(displayDate(in45Days))
  await field(page, 'Vence').locator('input').press('Enter')
  await dialog.getByRole('button', { name: 'Vender a crédito' }).click()
  await expect(page.getByText('Venta a crédito: Carlos Nuevo queda debiendo $62.800 en Cartera.')).toBeVisible()

  // Pedidos: both charged, read as on credit, nothing left to charge.
  await page.getByRole('button', { name: 'Pagados' }).click()
  for (const total of ['$31.400', '$62.800']) {
    const row = page.locator('tbody tr', { hasText: total })
    await expect(row.locator('.v-chip', { hasText: 'A crédito' })).toBeVisible()
    await expect(row.getByRole('button', { name: 'Cobrar' })).toHaveCount(0)
  }

  // Ventas: each one once, as an order charged on credit, next to the monthly document.
  await page.goto('/ventas')
  const sales = page.locator('.v-data-table tbody tr')
  await expect(sales.filter({ hasText: 'Pedido #1' })).toHaveCount(1)
  await expect(sales.filter({ hasText: 'Pedido #2' })).toHaveCount(1)
  await expect(sales.filter({ hasText: 'Pedido #1' })).toContainText('A crédito')
  await expect(sales.filter({ hasText: 'Pedido #1' })).toContainText('$31.400')
  await expect(page.locator('.v-chip', { hasText: 'A crédito: $94.200' })).toBeVisible()
  await expect(page.locator('.v-chip', { hasText: 'Facturación automática: $90.000' })).toBeVisible()

  // Cartera: what each one owes, as a "Venta a crédito" of its order.
  await page.goto('/cartera')
  const anaPanel = page.locator('.v-expansion-panel', { hasText: 'Ana Fiado' })
  await expect(anaPanel).toContainText('Saldo $31.400')
  await anaPanel.locator('.v-expansion-panel-title').click()
  const credit = anaPanel.locator('tbody tr', { hasText: '#1-1' })
  await expect(credit).toContainText('Venta a crédito')
  await expect(credit).toContainText('Pedido #1')
  await expect(credit).not.toContainText('(')
  await expect(credit).toContainText(dayLabel(in30Days))
  await expect(credit).toContainText('Por pagar')
  await expect(credit.getByRole('button', { name: 'Anular #1-1' })).toHaveCount(0)
  await expect(credit.getByRole('button', { name: 'Imprimir #1-1' })).toBeVisible()
  const carlos = page.locator('.v-expansion-panel', { hasText: 'Carlos Nuevo' })
  await carlos.locator('.v-expansion-panel-title').click()
  await expect(carlos.locator('tbody tr', { hasText: '#2-1' })).toContainText(dayLabel(in45Days))
  const beto = page.locator('.v-expansion-panel', { hasText: 'Beto Cuota' })
  await beto.locator('.v-expansion-panel-title').click()
  await expect(beto.getByRole('button', { name: 'Anular CC-1' })).toBeVisible()
  await credit.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/venta-a-credito-cartera-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await anaPanel.locator('.v-expansion-panel-title').click()
  await credit.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/venta-a-credito-cartera-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.reload()
  await anaPanel.locator('.v-expansion-panel-title').click()

  // Its factura is the POS one of the sale, "A crédito" as the way it was paid.
  const [factura] = await Promise.all([
    page.waitForEvent('popup'),
    credit.getByRole('button', { name: 'Imprimir #1-1' }).click(),
  ])
  await expect(factura.locator('body')).toContainText('COMPROBANTE DE VENTA')
  await expect(factura.locator('body')).toContainText('A crédito')
  await factura.close()

  // An abono of $10.000 in cash: recibo de caja RC-1, the balance drops.
  await anaPanel.getByRole('button', { name: 'Registrar abono', exact: true }).click()
  const abono = page.getByRole('dialog').filter({ hasText: 'Abono de Ana Fiado' })
  await field(page, 'Valor del abono').locator('input').fill('10000')
  await abono.getByRole('button', { name: 'Registrar abono' }).click()
  await expect(abono).toContainText('Abono registrado en el recibo de caja RC-1 por $10.000')
  await abono.getByRole('button', { name: 'Cerrar' }).click()
  await expect(anaPanel).toContainText('Saldo $21.400')
  await expect(credit).toContainText('Abonada')
  await expect(page.getByTestId('historico-abonos').locator('tbody tr', { hasText: 'RC-1' })).toContainText('$10.000')

  // The shift: the abono is its cash; the sales on credit brought none.
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const close = page.getByRole('dialog')
  await expect(close.getByTestId('cash-sales-total')).toHaveText('$94.200')
  await expect(close.getByTestId('cash-credit-sales')).toHaveText('$94.200 a crédito, en Cartera')
  await expect(close.getByText('+ Cobros en efectivo (con propinas)').locator('..')).toContainText('$0')
  await expect(close.getByText('+ Abonos de cuotas en efectivo').locator('..')).toContainText('$10.000')
  await expect(close.getByTestId('cash-expected')).toHaveText('$10.000')
  await close.getByRole('button', { name: 'Cerrar caja' }).click()
  // The abono must not fall in the second of the cut, which belongs to the next shift.
  await nextSecond()
  await close.getByRole('button', { name: 'Sí, cerrar caja' }).click()
  await expect(close.getByTestId('cash-credit-sales')).toHaveText('$94.200 a crédito, en Cartera')
  const [summary] = await Promise.all([
    page.waitForEvent('popup'),
    close.getByRole('button', { name: 'Imprimir resumen' }).click(),
  ])
  await expect(summary.locator('.doc-number')).toContainText('CIERRE DE CAJA')
  const printed = await summary.locator('body').innerText()
  expect(printed).toMatch(/Ventas a crédito \(en Cartera\)\s+\$94\.200/)
  expect(printed).toMatch(/Abonos de cuotas · Efectivo\s+\$10\.000/)
  expect(printed).toMatch(/EFECTIVO A ENTREGAR\s+\$10\.000/)
  await summary.close()
  await close.getByRole('button', { name: 'Listo' }).click()

  // The closes' Excel and PDF say it too, next to the sales.
  await openCashCloses(page)
  const download = async (name: string) => {
    const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).click()])
    return readFileSync((await file.path())!)
  }
  const [header, closed] = xlsxRows(await download('Descargar Excel'))
  expect(closed?.[header!.indexOf('Ventas (sin propina)')]).toBe('94200')
  expect(closed?.[header!.indexOf('Ventas a crédito (en Cartera)')]).toBe('94200')
  expect(closed?.[header!.indexOf('Total recibido')]).toBe('10000')
  expect(pdfText(await download('Descargar PDF'))).toContain('Ventas a crédito (en Cartera)\n$94.200')
  await page.goto('/pedidos')

  // With an abono, reverting the charge is refused and the order stays on credit.
  await page.getByRole('button', { name: 'Pagados' }).click()
  const anaRow = page.locator('tbody tr', { hasText: '$31.400' })
  await anaRow.getByRole('button', { name: 'Más acciones del pedido' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Revertir cobro' }).click()
  const revert = page.getByRole('dialog').filter({ hasText: 'Revertir cobro' })
  await revert.getByLabel(/¿Por qué se revierte\?/).fill('Era de otro cliente')
  await revert.getByRole('button', { name: 'Revertir cobro' }).click()
  await expect(page.getByText('La venta a crédito ya tiene abonos en Cartera: revierte esos abonos antes de revertir el cobro.')).toBeVisible()
  await revert.getByRole('button', { name: 'Cancelar' }).click()
  await expect(anaRow.locator('.v-chip', { hasText: 'A crédito' })).toBeVisible()
})

/** "19 nov 2026", as Cartera writes a due date. */
const dayLabel = (iso: string): string => {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** The card of Configuración › Formas de pago and the cell of one of its rows under a header. */
const methodsCard = (page: Page) => page.locator('.v-card').filter({ has: page.getByRole('heading', { name: 'Formas de pago' }) })
async function methodCell(page: Page, name: string, header: string) {
  const card = methodsCard(page)
  const headers = (await card.locator('thead th').allInnerTexts()).map(text => text.trim())
  const index = headers.indexOf(header)
  expect(index, `columna «${header}»`).toBeGreaterThanOrEqual(0)
  return card.locator('tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^\\s*${name}\\s*$`) }) }).locator('td').nth(index)
}

/**
 * Each business names its own payment methods: one created in Configuración
 * (not in the drawer, with its cuenta contable and its bank account shown as
 * an observation, for sales and recibos de caja) is renamed and moved,
 * charges a sale in Pedidos, prints its name under FORMA DE PAGO and its
 * bank account among the observations of the factura and the ticket, reads
 * by its name in Ventas, and once used it can only be turned off, never
 * deleted. Its cuenta contable is the one Configurar contabilidad edits.
 */
test('una forma de pago propia se crea en Configuración, cobra una venta con su cuenta bancaria y con movimientos no se borra', async ({ page, request }) => {
  test.setTimeout(120_000)
  const { credentials, auth } = await createRestaurant(request, `formas-pago-${Date.now()}`)
  const productId = await seedSimpleProduct(request, auth, 'Bandeja Bancolombia', 31500)
  const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity: 1 }] } })
  expect(order.status(), await order.text()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/configuracion')
  const card = methodsCard(page)
  // The seven a business starts with: only Efectivo goes into the drawer, each with its suggested account.
  await expect(card.locator('tbody tr td:first-child')).toHaveText(['Efectivo', 'Tarjeta crédito', 'Tarjeta débito', 'Transferencia', 'Nequi', 'Daviplata', 'Otro'])
  await expect(await methodCell(page, 'Efectivo', 'Entra al cajón')).toHaveText('Sí')
  await expect(await methodCell(page, 'Nequi', 'Entra al cajón')).toHaveText('No')
  await expect(await methodCell(page, 'Efectivo', 'Cuenta contable')).toHaveText('110505')
  await expect(card).toContainText('La cuenta contable es la que usa el movimiento contable.')
  await expect(card).not.toContainText('sale en las facturas')

  await card.getByRole('button', { name: 'Nueva forma de pago' }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva forma de pago' })
  await dialog.getByLabel('Nombre').fill('Bancolombia')
  await expect(dialog.getByLabel('Entra al cajón')).not.toBeChecked()
  await expect(dialog.getByText('Como el efectivo: suma en el efectivo a entregar del cierre')).toBeVisible()
  // The cuenta contable takes digits only, with the accounting settings' message.
  const account = dialog.getByLabel('Cuenta contable (opcional)')
  await expect(dialog.getByText('Ej: 110505. La usa el movimiento contable')).toBeVisible()
  await account.fill('1110 banco')
  await account.blur()
  await expect(dialog.getByText('La cuenta de Bancolombia debe tener solo números (p. ej., 110505).')).toBeVisible()
  await account.fill('111005')
  // Without a number there is nothing to show: the switch waits for it.
  const show = dialog.getByLabel('Mostrar como observación en los documentos')
  await expect(show).toBeDisabled()
  await expect(dialog.getByText('Escribe el número de cuenta bancaria para mostrarlo')).toBeVisible()
  await dialog.getByLabel('Número de cuenta bancaria (opcional)').fill('Bancolombia ahorros 123-456')
  await expect(show).toBeEnabled()
  await expect(show).not.toBeChecked()
  await show.check()
  await expect(dialog.getByText('Sale en las observaciones de facturas, cuentas de cobro, recibos de caja y tirillas')).toBeVisible()
  await expect(dialog).not.toContainText('Sale en facturas y recibos')
  await dialog.getByLabel('Abonos a pedidos').uncheck()
  await dialog.getByLabel('Movimientos financieros').uncheck()
  await expect(dialog.getByLabel('Ventas')).toBeChecked()
  await expect(dialog.getByLabel('Recibos de caja')).toBeChecked()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Forma de pago «Bancolombia» guardada.')).toBeVisible()
  await expect(dialog).toBeHidden()
  await expect(await methodCell(page, 'Bancolombia', 'Cuenta contable')).toHaveText('111005')
  await expect(await methodCell(page, 'Bancolombia', 'Cuenta bancaria')).toHaveText(/^\s*Bancolombia ahorros 123-456\s*Se imprime\s*$/)
  await expect(await methodCell(page, 'Nequi', 'Cuenta bancaria')).toHaveText('—')
  await expect(await methodCell(page, 'Bancolombia', 'Dónde se puede usar')).toHaveText('Ventas, Recibos de caja')
  await expect(await methodCell(page, 'Bancolombia', 'Entra al cajón')).toHaveText('No')
  await expect(await methodCell(page, 'Bancolombia', 'Estado')).toHaveText('Activa')

  // Renamed, and moved above Otro: the pickers follow this order.
  await card.getByRole('button', { name: 'Editar la forma de pago Bancolombia' }).click()
  const edit = page.getByRole('dialog').filter({ hasText: 'Editar Bancolombia' })
  await expect(edit.getByLabel('Cuenta contable (opcional)')).toHaveValue('111005')
  await expect(edit.getByLabel('Número de cuenta bancaria (opcional)')).toHaveValue('Bancolombia ahorros 123-456')
  await expect(edit.getByLabel('Mostrar como observación en los documentos')).toBeChecked()
  await edit.getByLabel('Nombre').fill('Bancolombia Ahorros')
  await edit.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Forma de pago «Bancolombia Ahorros» guardada.')).toBeVisible()
  await card.getByRole('button', { name: 'Subir la forma de pago Bancolombia Ahorros' }).click()
  await expect(card.locator('tbody tr td:first-child')).toHaveText([
    'Efectivo', 'Tarjeta crédito', 'Tarjeta débito', 'Transferencia', 'Nequi', 'Daviplata', 'Bancolombia Ahorros', 'Otro',
  ])
  await expect(card.getByRole('button', { name: 'Subir la forma de pago Efectivo' })).toBeDisabled()
  await expect(card.getByRole('button', { name: 'Bajar la forma de pago Otro' })).toBeDisabled()

  // The cuenta contable is the field Configurar contabilidad edits.
  await page.locator('.v-navigation-drawer').getByText('Contabilidad', { exact: true }).click()
  await page.getByRole('button', { name: 'Configurar contabilidad' }).click()
  const accounting = page.getByRole('dialog').filter({ hasText: 'Configurar contabilidad' })
  await expect(accounting.getByLabel('Cuenta de Bancolombia Ahorros', { exact: true })).toHaveValue('111005')
  await accounting.getByRole('button', { name: 'Cerrar', exact: true }).click()

  // Pedidos offers it for the sale, in that order, and charges with it.
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$31.500' }).first().getByRole('button', { name: 'Cobrar' }).click()
  const pay = page.getByRole('dialog')
  await expect(field(page, 'Método de pago')).toContainText('Efectivo')
  await field(page, 'Método de pago').click()
  const options = await page.getByRole('option').allInnerTexts()
  expect(options.indexOf('Bancolombia Ahorros')).toBe(options.indexOf('Otro') - 1)
  await page.getByRole('option', { name: 'Bancolombia Ahorros' }).click()
  await pay.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  // FORMA DE PAGO names the method; its bank account is an observation.
  const [invoice] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Generar factura' }).click()])
  await expect(invoice.locator('.party-row', { hasText: 'FORMA DE PAGO' })).toHaveText('FORMA DE PAGO: Bancolombia Ahorros')
  await expect(invoice.locator('.notes')).toContainText('OBSERVACIONES:')
  await expect(invoice.locator('.notes')).toContainText('Puedes pagar en Bancolombia Ahorros: Bancolombia ahorros 123-456')
  await invoice.close()
  await page.getByRole('button', { name: 'Pagados' }).click()
  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('tbody tr', { hasText: '$31.500' }).getByRole('button', { name: 'Tirilla' }).click(),
  ])
  await expect(ticket.locator('body')).toContainText('FORMA DE PAGO')
  const ticketText = await ticket.locator('body').innerText()
  const ticketLines = ticketText.split('\n').map(line => line.trim())
  expect(ticketLines).toContain('FORMA DE PAGO: Bancolombia Ahorros')
  const notesAt = ticketLines.indexOf('OBSERVACIONES:')
  expect(notesAt).toBeGreaterThan(ticketLines.indexOf('FORMA DE PAGO: Bancolombia Ahorros'))
  expect(ticketLines.slice(notesAt + 1, notesAt + 3).join(' ')).toBe('Puedes pagar en Bancolombia Ahorros: Bancolombia ahorros 123-456')
  // Wrapped to the ticket's width: no line runs off the paper.
  expect(Math.max(...ticketText.split('\n').map(line => line.length))).toBeLessThanOrEqual(38)
  await ticket.close()

  // Ventas reads the sale by the method's name, and its filter offers it.
  await page.goto('/ventas')
  await expect(page.locator('tbody tr', { hasText: '$31.500' })).toContainText('Bancolombia Ahorros')
  await field(page, 'Método de pago').click()
  await page.getByRole('option', { name: 'Bancolombia Ahorros' }).click()
  await expect(page.locator('tbody tr', { hasText: '$31.500' })).toBeVisible()

  // Used, it is not deleted: the API says to turn it off. One never used is deleted.
  await page.goto('/configuracion')
  page.once('dialog', confirmation => confirmation.accept())
  await card.getByRole('button', { name: 'Eliminar la forma de pago Bancolombia Ahorros' }).click()
  await expect(page.getByText('La forma de pago «Bancolombia Ahorros» ya tiene movimientos: desactívala en vez de borrarla.')).toBeVisible()
  await expect(card.locator('tbody tr', { hasText: 'Bancolombia Ahorros' })).toBeVisible()
  page.once('dialog', confirmation => {
    expect(confirmation.message()).toBe('¿Seguro que quieres eliminar la forma de pago «Daviplata»?')
    confirmation.accept()
  })
  await card.getByRole('button', { name: 'Eliminar la forma de pago Daviplata' }).click()
  await expect(page.getByText('Forma de pago «Daviplata» eliminada.')).toBeVisible()
  await expect(card.locator('tbody tr', { hasText: 'Daviplata' })).toHaveCount(0)
})

/**
 * A bank account the business did not choose to show stays off the paper:
 * the switch starts off, and neither the letter comprobante nor the ticket
 * print the number, only the method's name.
 */
test('con el interruptor apagado la cuenta bancaria no sale en la factura ni en la tirilla', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `cuenta-oculta-${Date.now()}`)
  const created = await request.post(`${API}/payment-methods`, {
    headers: auth,
    data: { name: 'Davivienda Local', bank_account: 'Davivienda corriente 555-000', documents: ['sale'] },
  })
  expect(created.status(), await created.text()).toBe(201)
  expect((await created.json()).data.show_bank_account).toBe(false)
  const productId = await seedSimpleProduct(request, auth, 'Sopa Oculta', 27300)
  const order = (await (await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity: 1 }] } })).json()).data
  const paid = await request.post(`${API}/orders/${order.id}/pay`, { headers: auth, data: { payment_method: 'davivienda-local' } })
  expect(paid.ok(), await paid.text()).toBeTruthy()
  const sale = (await (await request.get(`${API}/orders/${order.id}`, { headers: auth })).json()).data.payments[0]

  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/configuracion')
  await expect(await methodCell(page, 'Davivienda Local', 'Cuenta bancaria')).toHaveText('Davivienda corriente 555-000')

  await page.goto('/ventas')
  const [comprobante] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: `Imprimir el comprobante ${sale.reference}` }).click(),
  ])
  await expect(comprobante.locator('.party-row', { hasText: 'FORMA DE PAGO' })).toHaveText('FORMA DE PAGO: Davivienda Local')
  await expect(comprobante.locator('.notes')).toContainText('OBSERVACIONES:')
  await expect(comprobante.locator('body')).not.toContainText('555-000')
  await expect(comprobante.locator('body')).not.toContainText('Puedes pagar en')
  await comprobante.close()

  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pagados' }).click()
  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('tbody tr', { hasText: '$27.300' }).getByRole('button', { name: 'Tirilla' }).click(),
  ])
  await expect(ticket.locator('body')).toContainText('FORMA DE PAGO: Davivienda Local')
  await expect(ticket.locator('body')).not.toContainText('555-000')
  await expect(ticket.locator('body')).not.toContainText('OBSERVACIONES')
})

/** A method of the business's own marked "Entra al cajón" is cash of the close, as Efectivo is. */
test('una forma de pago propia que entra al cajón suma al efectivo a entregar del cierre', async ({ page, request }) => {
  const { credentials, auth } = await createRestaurant(request, `cajon-${Date.now()}`)
  const created = await request.post(`${API}/payment-methods`, {
    headers: auth,
    data: { name: 'Caja menor', is_cash: true, documents: ['sale'], active: true },
  })
  expect(created.status(), await created.text()).toBe(201)
  const drawerKey = (await created.json()).data.key
  const productId = await seedSimpleProduct(request, auth, 'Jugo Cajón', 7000)
  for (const method of ['cash', drawerKey, 'nequi']) await chargeOrder(request, auth, productId, method)

  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('tr', { hasText: 'Caja menor' })).toContainText('$7.000')
  await expect(dialog.locator('tr', { hasText: 'Nequi' })).toContainText('$7.000')
  // Efectivo and Caja menor are the drawer; Nequi never reaches it.
  await expect(dialog.getByText('+ Cobros en Efectivo y Caja menor (con propinas)').locator('..')).toContainText('$14.000')
  await expect(dialog.getByTestId('cash-expected')).toHaveText('$14.000')
})
