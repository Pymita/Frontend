import { expect, test, type Page } from '@playwright/test'
import {
  ADMIN,
  API,
  apiLogin,
  createCompany,
  field,
  freezeTime,
  loginUI,
  pickOption,
  raisePlanLimits,
  watchPrinting,
} from './helpers'

/**
 * Cuentas separadas: varias personas en la misma mesa, cada una con lo
 * suyo dentro de UN pedido. En la web se arma el pedido por persona y al
 * cobrar se elige "por persona" o "todos juntos".
 */
async function seedProduct(request: any, auth: any, name: string, price: number) {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Cat ${name}` } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name, type: 'final', unit: 'und', sale_price: price, tracks_stock: false, category_id: categoryId },
  })
  const productId = (await product.json()).data.id
  await request.post(`${API}/menu-items`, {
    headers: auth,
    data: { name, final_product_id: productId, category_id: categoryId, base_price: price },
  })
  return productId
}

/**
 * An open order on a table of its own: the search finds it by the table's
 * timestamped name, whatever other specs left open.
 */
async function seedTableOrder(
  request: any,
  auth: any,
  data: { items: { guest_number?: number }[]; guest_names?: Record<number, string> },
) {
  await raisePlanLimits(request, { max_tables: 60 })
  const stamp = Date.now()
  const nickname = `Personas ${stamp}`
  const product = `Limonada ${stamp}`
  const productId = await seedProduct(request, auth, product, 3000)
  const tables = (await (await request.get(`${API}/tables`, { headers: auth })).json()).data
  const table = await request.post(`${API}/tables`, {
    headers: auth,
    data: { number: Math.max(0, ...tables.map((t: any) => t.number)) + 1, nickname, capacity: 4 },
  })
  expect(table.status()).toBe(201)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      dining_table_id: (await table.json()).data.id,
      items: data.items.map(item => ({ product_id: productId, quantity: 1, ...item })),
      guest_names: data.guest_names,
    },
  })
  expect(order.status()).toBe(201)
  return { nickname, product }
}

/** Pedidos with the order of that table found and its row expanded. */
async function openOrderSummary(page: Page, nickname: string) {
  await page.goto('/pedidos')
  await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(nickname)
  const row = page.locator('tbody tr', { hasText: nickname })
  await expect(row).toHaveCount(1)
  await row.locator('.v-data-table__td--expanded-row').getByRole('button').click()
  return page.locator('tr', { hasText: 'Productos del pedido' })
}

test('armar un pedido por personas desde la web', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  await seedProduct(request, auth, 'Arepa Separada', 5000)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Arepa Separada')

  // Persona 1 pide una arepa, persona 2 pide dos.
  await dialog.getByText('Persona', { exact: true }).click()
  await dialog.getByText('Arepa Separada').first().click()
  await dialog.getByText('Persona', { exact: true }).click()
  await dialog.getByText('Arepa Separada').first().click()
  await dialog.getByText('Arepa Separada').first().click()

  await expect(dialog.locator('.v-list-item', { hasText: 'Persona 1' })).toContainText('$5.000')
  await expect(dialog.locator('.v-list-item', { hasText: 'Persona 2' })).toContainText('$10.000')
  await expect(dialog.getByText('Total: $15.000')).toBeVisible()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  const orders = await request.get(`${API}/orders`, { headers: auth })
  const created = (await orders.json()).data.find((o: any) =>
    o.items?.some((i: any) => i.product_name === 'Arepa Separada'),
  )
  expect(created.guests.map((g: any) => [g.label, g.amount])).toEqual([
    ['Persona 1', 5000],
    ['Persona 2', 10000],
  ])
})

test('poner nombre a una persona con el lapicito', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  await seedProduct(request, auth, 'Empanada Nombre', 4000)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByText('Persona', { exact: true }).click()

  // El lapicito de "Persona 1" abre el editor y le ponemos nombre.
  await dialog.locator('.v-chip', { hasText: 'Persona 1' }).getByTitle('Editar nombre').click()
  await dialog.getByLabel('Nombre de la Persona 1').fill('Vale')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  const valeChip = dialog.locator('.v-chip', { hasText: 'Vale' })
  await expect(valeChip).toBeVisible()

  // Ese nombre queda en el pedido de la persona.
  await valeChip.click()
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Empanada Nombre')
  await dialog.getByText('Empanada Nombre').first().click()
  await expect(dialog.locator('.v-list-item', { hasText: 'Vale' })).toContainText('Empanada Nombre')
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  const orders = await request.get(`${API}/orders`, { headers: auth })
  const created = (await orders.json()).data.find((o: any) =>
    o.items?.some((i: any) => i.product_name === 'Empanada Nombre'),
  )
  expect(created.guest_names).toEqual({ '1': 'Vale' })
  expect(created.guests.map((g: any) => g.label)).toContain('Vale')
})

test('el resumen del pedido muestra el nombre que se le puso a cada persona', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const { nickname, product } = await seedTableOrder(request, auth, {
    items: [{ guest_number: 3 }, { guest_number: 1 }, { guest_number: 2 }, {}],
    guest_names: { 1: 'Ana', 2: 'Luis' },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  const summary = await openOrderSummary(page, nickname)
  await expect(summary.locator('tbody .v-chip')).toHaveText(['Persona 3', 'Ana', 'Luis', 'Compartido'])

  // Moving a line to someone else offers the same names, plus one more person.
  await summary
    .locator('tbody tr')
    .filter({ has: page.getByText('Ana', { exact: true }) })
    .getByRole('button', { name: `Editar ${product}` })
    .click()
  const persona = field(page, 'Persona (cuentas separadas)')
  await expect(persona).toContainText('Ana')
  await persona.click()
  await expect(page.locator('.v-select__content').getByRole('option')).toHaveText([
    'Compartido',
    'Ana',
    'Luis',
    'Persona 3',
    'Persona 4',
  ])
})

test('el nombre que se le pone a una persona de un pedido abierto queda en el resumen', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const { nickname } = await seedTableOrder(request, auth, { items: [{ guest_number: 1 }, { guest_number: 2 }] })

  await loginUI(page, ADMIN.email, ADMIN.password)
  const summary = await openOrderSummary(page, nickname)
  await expect(summary.locator('tbody .v-chip')).toHaveText(['Persona 1', 'Persona 2'])

  await summary.getByRole('button', { name: 'Agregar productos' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.locator('.v-chip', { hasText: 'Persona 2' }).getByTitle('Editar nombre').click()
  await dialog.getByLabel('Nombre de la Persona 2').fill('Marta')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog.locator('.v-chip', { hasText: 'Marta' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await expect(summary.locator('tbody .v-chip')).toHaveText(['Persona 1', 'Marta'])

  // The name was saved on the order: a fresh load still shows it.
  await expect((await openOrderSummary(page, nickname)).locator('tbody .v-chip')).toHaveText(['Persona 1', 'Marta'])
})

test('cobrar por persona hasta cerrar la mesa', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedProduct(request, auth, 'Sopa Separada', 8000)

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      customer_name: 'Mesa Separada E2E',
      items: [
        { product_id: productId, quantity: 1, guest_number: 1 },
        { product_id: productId, quantity: 2, guest_number: 2 },
      ],
    },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$24.000' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')

  // La mesa separó la cuenta: el diálogo abre por persona.
  const persona1 = dialog.locator('.v-list-item', { hasText: 'Persona 1' })
  const persona2 = dialog.locator('.v-list-item', { hasText: 'Persona 2' })
  await expect(persona1).toContainText('$8.000')
  await expect(persona2).toContainText('$16.000')

  // La propina no se cobra sola: el campo arranca vacío (0) y solo se muestra el
  // monto sugerido como referencia. La persona deja propina si el cajero la escribe.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(persona1.getByLabel('Propina')).toHaveValue('')
  await expect(persona1.getByLabel('Propina')).not.toHaveAttribute('type', 'number')
  await expect(persona1).toContainText('sugerida 10%')
  // "1.000" is a thousand pesos, not one.
  await persona1.getByLabel('Propina').fill('1.000')
  await expect(persona1).toContainText('con propina $9.000')

  await persona1.getByRole('button', { name: 'Cobrar con propina' }).click()
  await expect(page.getByText('Persona 1 pagó $9.000')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir tirilla' })).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })
  await expect(persona1).toContainText('Pagado')
  await expect(dialog.getByText('Pendiente de la mesa:')).toBeVisible()

  let current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.payment_status).toBe('partial')
  expect(current.amount_paid).toBe(9000)
  expect(current.tip).toBe(1000)
  // La propina de la persona 1 no le sube la cuenta a la persona 2.
  await expect(persona2).toContainText('$16.000')

  // Los demás pagan juntos: solo lo que falta, sin volver a cobrar a la persona 1.
  await dialog.getByRole('button', { name: 'Todos juntos' }).click()
  await expect(dialog.getByText('Ya pagado (personas que pagaron aparte):')).toBeVisible()
  await expect(dialog.getByText('$16.000')).toBeVisible()

  // La cuenta impresa cuadra con el diálogo: ABONADO es el consumo ya pagado
  // (sin la propina de la persona 1) y POR PAGAR lo que falta, sin propina.
  const [bill] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Imprimir cuenta' }).click(),
  ])
  await expect(bill.locator('body')).toContainText('CUENTA DE COBRO')
  const billText = await bill.locator('body').innerText()
  expect(billText).toContain('ABONADO')
  expect(billText).toContain('$8.000')
  expect(billText).toContain('POR PAGAR')
  expect(billText).toContain('$16.000')
  // Nobody identified the table's buyer: the pre-bill names the consumidor final, not the order's name.
  expect(billText).toContain('CLIENTE : Consumidor final')
  expect(billText).toContain('NIT     : 222222222222')
  expect(billText).not.toContain('Mesa Separada E2E')
  await bill.close()
  expect(await printing()).toEqual({ opened: 1, printed: 1 })

  await dialog.getByRole('button', { name: 'Cobrar sin propina' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()
  expect(await printing()).toEqual({ opened: 1, printed: 1 })

  current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.payment_status).toBe('paid')
  expect(current.total).toBe(25000)
  expect(current.tip).toBe(1000)
  expect(current.amount_paid).toBe(25000)
})

test('con la sugerencia encendida, cobrar sin escribir propina no cobra propina', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedProduct(request, auth, 'Tinto Sin Propina E2E', 4000)

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      customer_name: 'Mesa Sin Propina Separada E2E',
      items: [
        { product_id: productId, quantity: 1, guest_number: 1 },
        { product_id: productId, quantity: 1, guest_number: 2 },
      ],
    },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$8.000' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  // Aunque la sugerencia esté encendida, si el cajero no escribe propina el
  // botón es "Cobrar" (no "con propina") y no se cobra ninguna.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  const persona1 = dialog.locator('.v-list-item', { hasText: 'Persona 1' })
  await expect(persona1.getByLabel('Propina')).toHaveValue('')
  await expect(persona1.getByRole('button', { name: 'Cobrar con propina' })).toHaveCount(0)
  await persona1.getByRole('button', { name: 'Cobrar', exact: true }).click()
  await expect(page.getByText('Persona 1 pagó $4.000')).toBeVisible()

  const current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.tip).toBe(0)
  expect(current.amount_paid).toBe(4000)
})

test('el diálogo de cobro se puede cerrar con la X', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedProduct(request, auth, 'Pan Cerrar', 2500)
  await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity: 1 }] } })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$2.500' }).first().getByRole('button', { name: 'Cobrar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await expect(dialog).toHaveCount(0)
})

/** "2026-11-02 21:00:00" in Bogotá, the form the API stores (an ISO "Z" would be read as local time). */
const apiDateTime = (ms: number): string => {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/**
 * A card table charged per person: the owner's example, $1.000 an hour and
 * five players, so the hour costs $5.000 and each player pays $1.000. Its own
 * company, since the seeded restaurant does not bill by time.
 */
test('una mesa que cobra por tiempo se abre por persona y cada jugador paga su hora', async ({ page, request }) => {
  const stamp = Date.now()
  const company = await createCompany(request, `cartas-${stamp}`, { business_type: 'billiard' })
  const auth = { Authorization: `Bearer ${company.token}` }
  const nickname = `Cartas ${stamp}`
  const table = await request.post(`${API}/tables`, {
    headers: auth,
    data: { number: 1, nickname, table_type: 'billiard', hourly_rate: 1000, billing_increment_minutes: 15 },
  })
  expect(table.status()).toBe(201)

  await loginUI(page, company.credentials.email, company.credentials.password)
  const printing = await watchPrinting(page)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const newOrder = page.getByRole('dialog')
  await field(page, 'Mesa (opcional)').click()
  await pickOption(page, nickname)

  // The table opens with its clock alone: who pays the time is asked here.
  await expect(newOrder.getByText('Cobro del tiempo · $1.000/h')).toBeVisible()
  await expect(newOrder.getByText('La mesa paga $1.000 por hora, sin importar cuántos jueguen.')).toBeVisible()
  await newOrder.getByRole('button', { name: 'Por persona' }).click()
  await expect(newOrder.getByRole('button', { name: 'Abrir mesa' })).toBeDisabled()
  await newOrder.getByLabel('Jugadores').fill('5')
  await expect(newOrder.getByText('Cada jugador paga $1.000 por hora: con 5 personas la mesa suma $5.000 por hora.')).toBeVisible()
  await newOrder.getByRole('button', { name: 'Abrir mesa' }).click()
  await expect(page.getByText('Mesa abierta: el tiempo empezó a contar')).toBeVisible()

  const open = (await (await request.get(`${API}/orders?open=1`, { headers: auth })).json()).data
    .find((o: any) => o.dining_table?.display_name === nickname)
  expect([open.time.billing, open.time.players]).toEqual(['person', 5])

  // An hour later. The API's clock cannot be moved from here: the admin's
  // correction puts the start an hour back and the page adopts that hour.
  const openedAt = new Date(open.time.started_at).getTime()
  const hourBefore = apiDateTime(openedAt - 60 * 60_000)
  expect((await request.put(`${API}/orders/${open.id}/time`, { headers: auth, data: { time_started_at: hourBefore } })).ok()).toBeTruthy()
  await freezeTime(page, open.time.started_at)

  const summaryOf = async () => {
    await page.goto('/pedidos')
    await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(nickname)
    const row = page.locator('tbody tr', { hasText: nickname })
    await expect(row).toHaveCount(1)
    await row.locator('.v-data-table__td--expanded-row').getByRole('button').click()
    return { row, card: page.locator('tr', { hasText: 'Productos del pedido' }) }
  }
  let { card } = await summaryOf()
  // Running, the time reads live: five players for an hour.
  await expect(card.getByText('Por persona · 5 personas · $1.000/h')).toBeVisible()
  await expect(card.locator('.v-card-text > div', { hasText: 'Tiempo' }).first()).toContainText('$5.000')

  // Stopped at the hour, the table's total is $5.000.
  expect((await request.put(`${API}/orders/${open.id}/time`, {
    headers: auth,
    data: { time_started_at: hourBefore, time_ended_at: apiDateTime(openedAt) },
  })).ok()).toBeTruthy()
  let row
  ;({ row, card } = await summaryOf())
  await expect(card).toContainText('(60 min)')
  await expect(card.locator('.d-flex', { hasText: 'Total:' }).last()).toContainText('$5.000')
  await expect(row).toContainText('$5.000')

  // Charging opens on the players, each with their hour.
  await row.getByRole('button', { name: 'Cobrar' }).click()
  const dialog = page.getByRole('dialog')
  const players = dialog.locator('.v-list-item')
  await expect(players).toHaveCount(5)
  for (const n of [1, 2, 3, 4, 5]) {
    await expect(players.nth(n - 1)).toContainText(`Persona ${n}`)
    await expect(players.nth(n - 1)).toContainText('tiempo $1.000')
  }
  const first = dialog.locator('.v-list-item', { hasText: 'Persona 1' })
  await first.getByRole('button', { name: 'Cobrar', exact: true }).click()
  await expect(page.getByText('Persona 1 pagó $1.000')).toBeVisible()
  await expect(first).toContainText('Pagado')
  await expect(first).toContainText('tiempo pagado')

  // Persona 1's slip carries their one share of the time.
  const [slip] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Imprimir tirilla' }).click(),
  ])
  await expect(slip.locator('body')).toContainText('COMPROBANTE DE PAGO')
  const slipText = await slip.locator('body').innerText()
  expect(slipText).toContain('PERSONA 1')
  expect(slipText).toMatch(/Tiempo de mesa\s+\$1\.000/)
  expect(slipText).toContain('1 h × 1 persona × $1.000/h')
  expect(slipText).toMatch(/TOTAL\s+\$1\.000/)
  await slip.close()

  // The other four pay together: the close takes their four hours.
  await dialog.getByRole('button', { name: 'Todos juntos' }).click()
  await expect(dialog.locator('.d-flex', { hasText: 'Total sin propina:' })).toContainText('$4.000')
  await dialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  // The table's ticket: one time line for the five players, adding up.
  const [ticket] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Imprimir tirilla' }).click(),
  ])
  await expect(ticket.locator('body')).toContainText('COMPROBANTE DE VENTA')
  const ticketText = await ticket.locator('body').innerText()
  expect(ticketText).toMatch(/Tiempo de mesa\s+\$5\.000/)
  expect(ticketText).toContain('1 h × 5 personas × $1.000/h')
  expect(ticketText).toMatch(/SUBTOTAL\s+\$5\.000/)
  expect(ticketText).toMatch(/TOTAL\s+\$5\.000/)
  await ticket.close()

  const paid = (await (await request.get(`${API}/orders/${open.id}`, { headers: auth })).json()).data
  expect(paid.payment_status).toBe('paid')
  expect(paid.payments.map((p: any) => [p.guest_number, p.time_shares, p.sale_amount])).toEqual([[1, 1, 1000], [null, 4, 4000]])

  // Each sale's factura names its own shares.
  await page.getByRole('button', { name: 'Pagados' }).click()
  const paidRow = page.locator('tbody tr', { hasText: nickname })
  await paidRow.getByRole('button', { name: 'Más acciones del pedido' }).click()
  const [facturas] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('listitem').filter({ hasText: 'Generar factura' }).click(),
  ])
  await expect(facturas.locator('body')).toContainText('Tiempo de mesa: 1 h × 1 persona × $1.000/h')
  await expect(facturas.locator('body')).toContainText('Tiempo de mesa: 1 h × 4 personas × $1.000/h')
  await facturas.close()
  expect((await printing()).opened).toBe(3)
})

test('la mesa que separó la cuenta también puede pagar todo junto', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedProduct(request, auth, 'Jugo Separado', 3000)

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      items: [
        { product_id: productId, quantity: 1, guest_number: 1 },
        { product_id: productId, quantity: 1, guest_number: 2 },
      ],
    },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$6.000' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Todos juntos' }).click()
  await expect(dialog.getByText('Total sin propina:')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  const current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.payment_status).toBe('paid')
})
