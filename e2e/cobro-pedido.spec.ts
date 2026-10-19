import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN, API, PLATFORM, apiLogin, displayDate, field, loginUI, watchPrinting } from './helpers'

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

  // Es una venta con su secuencia #pedido-1 y descontó su parte.
  const afterSale = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(afterSale.payment_status).toBe('partial')
  const sale = afterSale.payments.find((p: any) => p.kind === 'sale')
  expect(sale).toBeTruthy()
  expect(sale.invoice_sequence).toBe(1)
  expect(sale.reference).toBe(`#${orderId}-1`)
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

async function closeShift(request: APIRequestContext, auth: Auth, id: number) {
  const response = await request.post(`${API}/cash-register/${id}/close`, { headers: auth, data: {} })
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
  expect(printed).toMatch(/EFECTIVO DEL TURNO\s+\$12\.345/)
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
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Hoja', items: [{ product_id: beer, quantity: 2 }, { product_id: empanada, quantity: 3 }] },
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
  await expect(invoice.locator('.totals')).toContainText('IMPUESTO (INCLUIDO): $667')
  await expect(invoice.locator('.totals')).toContainText('TOTAL: $22.000')
  await expect(invoice.locator('.totals')).not.toContainText('PROPINA')
  await expect(invoice.locator('.party')).toContainText('CLIENTE: Mesa Hoja')
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
  await expect(paidRow.getByRole('button', { name: 'Tirilla' })).toBeVisible()
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
    page.getByRole('button', { name: `Imprimir el comprobante del pedido #${orderId}` }).click(),
  ])
  await expectComprobante(fromVentas)
})

