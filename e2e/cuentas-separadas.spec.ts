import { expect, test, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI, raisePlanLimits, watchPrinting } from './helpers'

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
