import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, displayDate, field, freezeTime, loginUI, raisePlanLimits, scrollToOption, watchPrinting } from './helpers'

/**
 * La web crea pedidos con productos reales (antes solo existía el pedido
 * rápido, un total escrito a mano que no se podía facturar) y permite
 * seguir agregándole productos a un pedido ya abierto.
 */

/**
 * Deja un producto publicado en el menú y devuelve su nombre y precio. Sin
 * `menu.category_id` le crea su propia categoría; `menu` también lleva el
 * precio propio del ítem (`custom_price` + `use_automatic_price: false`).
 */
async function seedMenuItem(
  request: any,
  auth: Record<string, string>,
  name: string,
  price: number,
  product: Record<string, unknown> = {},
  menu: Record<string, unknown> & { category_id?: number } = {},
) {
  const categoryId = menu.category_id ?? (await createCategory(request, auth, `Categoría ${name}`))

  const created = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name,
      type: 'final',
      unit: 'unidad',
      sale_price: price,
      tracks_stock: false,
      category_id: categoryId,
      ...product,
    },
  })
  const productId = (await created.json()).data.id

  const item = await request.post(`${API}/menu-items`, {
    headers: auth,
    data: { name, final_product_id: productId, category_id: categoryId, base_price: price, ...menu },
  })
  expect(item.status(), await item.text()).toBe(201)

  return { productId, categoryId }
}

/** Una categoría del menú (dentro de `parentId` si se da); devuelve su id. */
async function createCategory(request: any, auth: Record<string, string>, name: string, parentId?: number) {
  const response = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name, ...(parentId ? { parent_id: parentId } : {}) },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).data.id as number
}

/** Un cliente de la empresa sembrada; devuelve su id. */
async function createCustomer(request: any, auth: Record<string, string>, name: string, documentNumber: string) {
  const response = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: documentNumber, name },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()).data.id as number
}

/** "1234567" → "1.234.567": como se dicta una cédula. */
const dotted = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

test('crear un pedido con productos desde la web', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  await seedMenuItem(request, auth, 'Limonada Pedidos Web', 7300)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  await page.getByRole('button', { name: 'Nuevo pedido' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Limonada Pedidos Web')
  await dialog.getByText('Limonada Pedidos Web', { exact: true }).click()

  // El total del diálogo refleja lo elegido antes de guardar.
  await expect(dialog.getByText('Total: $7.300')).toBeVisible()

  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  // El pedido existe con su producto, no con un total escrito a mano.
  const orders = await request.get(`${API}/orders`, { headers: auth })
  const created = (await orders.json()).data.find((order: any) =>
    order.items?.some((item: any) => item.product_name === 'Limonada Pedidos Web'),
  )
  expect(created).toBeTruthy()
  expect(created.items).toHaveLength(1)
  expect(Number(created.total)).toBe(7300)
})

/**
 * Bajo la mesa, una fila de categorías (las principales, en el orden de la
 * app de meseros): una principal trae también lo de sus subcategorías, y el
 * filtro se suma a la búsqueda.
 */
test('el filtro por categoría deja sus productos, también los de sus subcategorías, y se suma a la búsqueda', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const drinks = await createCategory(request, auth, `Bebidas ${stamp}`)
  const beers = await createCategory(request, auth, `Cervezas ${stamp}`, drinks)
  const food = await createCategory(request, auth, `Comidas ${stamp}`)
  const lemonade = `Limonada ${stamp}`
  const beer = `Club Colombia ${stamp}`
  const arepa = `Arepa ${stamp}`
  await seedMenuItem(request, auth, lemonade, 4100, {}, { category_id: drinks })
  await seedMenuItem(request, auth, beer, 5200, {}, { category_id: beers })
  await seedMenuItem(request, auth, arepa, 3300, {}, { category_id: food })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const dialog = page.getByRole('dialog')
  const search = dialog.getByRole('textbox', { name: /Buscar producto/ })
  const chip = (name: string) => dialog.getByRole('button', { name, exact: true })

  await search.fill(String(stamp))
  for (const name of [lemonade, beer, arepa]) await expect(dialog.getByText(name)).toBeVisible()
  await expect(chip('Todas')).toHaveAttribute('aria-pressed', 'true')
  // Only the main categories: a subcategory is inside its parent.
  await expect(chip(`Cervezas ${stamp}`)).toHaveCount(0)

  await chip(`Bebidas ${stamp}`).click()
  await expect(chip(`Bebidas ${stamp}`)).toHaveAttribute('aria-pressed', 'true')
  await expect(chip('Todas')).toHaveAttribute('aria-pressed', 'false')
  await expect(dialog.getByText(lemonade)).toBeVisible()
  await expect(dialog.getByText(beer)).toBeVisible()
  await expect(dialog.getByText(arepa)).toHaveCount(0)

  // The search narrows the category; another category with the same search has nothing.
  await search.fill(beer)
  await expect(dialog.getByText(beer)).toBeVisible()
  await expect(dialog.getByText(lemonade)).toHaveCount(0)
  await chip(`Comidas ${stamp}`).click()
  await expect(dialog.getByText('Sin resultados')).toBeVisible()
  await chip('Todas').click()
  await expect(dialog.getByText(beer)).toBeVisible()

  // What is picked under a filter is what the order takes.
  await dialog.getByText(beer, { exact: true }).click()
  await expect(dialog.getByText('Total: $5.200')).toBeVisible()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()
})

/**
 * El cliente del pedido sale de la lista de clientes, no de un nombre
 * escrito a mano: Consumidor final por defecto, se busca sin tildes o por la
 * cédula con puntos, y el pedido se ve con su nombre en la lista y al cobrar.
 */
test('el cliente del pedido se elige de la lista y el pedido se ve con su nombre', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const name = `Lucía Peñalosa ${stamp}`
  const document = String(stamp).slice(-9)
  const customerId = await createCustomer(request, auth, name, document)
  const coffee = `Tinto Cliente ${stamp}`
  const bun = `Pandebono Consumidor ${stamp}`
  await seedMenuItem(request, auth, coffee, 2600)
  await seedMenuItem(request, auth, bun, 2700)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const dialog = page.getByRole('dialog')
  const customerField = dialog.locator('.v-input').filter({ has: page.getByText('Cliente', { exact: true }) })
  const customerBox = dialog.getByRole('combobox', { name: 'Cliente' })
  await expect(customerField).toContainText('Consumidor final')
  await expect(dialog.getByRole('textbox', { name: /Cliente \(opcional\)/ })).toHaveCount(0)

  // By name, without its accents.
  await customerBox.fill(`lucia penalosa ${stamp}`)
  await page.getByRole('option', { name: `${name} (${document})` }).click()
  await expect(customerField).toContainText(name)

  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(coffee)
  await dialog.getByText(coffee, { exact: true }).click()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()
  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toContainText('$2.600')

  // A new order starts again at Consumidor final; the document is found with its dots too.
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  await expect(customerField).toContainText('Consumidor final')
  await customerBox.fill(dotted(document))
  await expect(page.getByRole('option', { name: `${name} (${document})` })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(customerField).toContainText('Consumidor final')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(bun)
  await dialog.getByText(bun, { exact: true }).click()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  const orders = (await (await request.get(`${API}/orders`, { headers: auth })).json()).data
  const withCustomer = orders.find((order: any) => order.items?.some((item: any) => item.product_name === coffee))
  const withoutCustomer = orders.find((order: any) => order.items?.some((item: any) => item.product_name === bun))
  expect([withCustomer.customer_id, withCustomer.customer_name]).toEqual([customerId, name])
  expect([withoutCustomer.customer_id, withoutCustomer.customer_name]).toEqual([null, 'Cliente'])

  // Charging it already shows who it goes to.
  await row.getByRole('button', { name: 'Cobrar' }).click()
  const payDialog = page.getByRole('dialog').filter({ hasText: 'Cobrar pedido' })
  await expect(payDialog.locator('.v-input').filter({ has: page.getByText('Cliente (opcional)', { exact: true }) })).toContainText(name)
})

/** How the seeded company takes orders, set by its admin; every spec shares it, so each test puts tables back. */
async function setOrderMode(request: any, auth: Record<string, string>, mode: 'tables' | 'customers' | 'both') {
  const response = await request.put(`${API}/company/order-mode`, { headers: auth, data: { order_mode: mode } })
  expect(response.ok(), await response.text()).toBeTruthy()
}

/**
 * A shop sells to customers, not to tables: the admin says so in
 * Configuración, and Nuevo pedido opens on the customer, with no table to
 * pick, and the list shows each order under its customer. The API takes the
 * order without a table in any mode: this only changes what the page offers.
 */
test('por cliente: Configuración lo cambia y Nuevo pedido pide el cliente, sin mesa', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const name = `Valeria Tienda ${stamp}`
  const document = String(stamp).slice(-9)
  await createCustomer(request, auth, name, document)
  const shirt = `Camiseta Por Cliente ${stamp}`
  const cap = `Gorra Consumidor ${stamp}`
  await seedMenuItem(request, auth, shirt, 45000)
  await seedMenuItem(request, auth, cap, 28000)

  try {
    await loginUI(page, ADMIN.email, ADMIN.password)
    await page.goto('/configuracion')
    const card = page.locator('.v-card', { has: page.getByRole('heading', { name: 'Cómo tomas los pedidos' }) })
    await expect(card.getByRole('radio', { name: /^Con mesas\s*Cada pedido/ })).toBeChecked()
    await expect(card).toContainText('Cada pedido va a un cliente o al Consumidor final, sin mesas: una tienda, un almacén de ropa.')
    await expect(card.getByRole('button', { name: 'Guardar cómo tomas los pedidos' })).toBeDisabled()
    await card.getByRole('radio', { name: /^Con clientes/ }).check()
    await card.getByRole('button', { name: 'Guardar cómo tomas los pedidos' }).click()
    await expect(page.getByText('Listo: los pedidos se toman por cliente.')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Guardar cómo tomas los pedidos' })).toBeDisabled()

    await page.goto('/pedidos')
    await expect(page.getByRole('textbox', { name: 'Buscar cliente o pedido' })).toBeVisible()
    await page.getByRole('button', { name: 'Nuevo pedido' }).click()
    const dialog = page.getByRole('dialog')
    const customerField = dialog.locator('.v-input').filter({ has: page.getByText('Cliente', { exact: true }) })
    await expect(customerField).toContainText('Consumidor final')
    await expect(dialog.getByText('Mesa (opcional)')).toHaveCount(0)
    // The customer is the first field of the dialog.
    await expect(dialog.locator('.v-input').first()).toContainText('Cliente')

    await dialog.getByRole('combobox', { name: 'Cliente' }).fill(name)
    await page.getByRole('option', { name: `${name} (${document})` }).click()
    await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(shirt)
    await dialog.getByText(shirt, { exact: true }).click()
    await dialog.getByRole('button', { name: 'Crear pedido' }).click()
    await expect(page.getByText('Pedido creado')).toBeVisible()

    // The consumidor final, another order of its own.
    await page.getByRole('button', { name: 'Nuevo pedido' }).click()
    await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(cap)
    await dialog.getByText(cap, { exact: true }).click()
    await dialog.getByRole('button', { name: 'Crear pedido' }).click()
    await expect(page.getByText('Pedido creado')).toBeVisible()

    await expect(page.getByRole('columnheader', { name: 'Cliente' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Mesa' })).toHaveCount(0)
    const row = page.locator('tbody tr', { hasText: name })
    await expect(row).toContainText('$45.000')
    await expect(row).not.toContainText('Sin mesa')
    await expect(page.locator('tbody tr', { hasText: '$28.000' }).filter({ hasText: 'Consumidor final' }).first()).toBeVisible()

    // The list finds the order by its customer.
    await page.getByRole('textbox', { name: 'Buscar cliente o pedido' }).fill(name)
    await expect(page.locator('tbody tr', { hasText: '$45.000' })).toHaveCount(1)

    const orders = (await (await request.get(`${API}/orders?q=${encodeURIComponent(name)}`, { headers: auth })).json()).data
    expect(orders).toHaveLength(1)
    expect([orders[0].dining_table, orders[0].customer_name]).toEqual([null, name])
  } finally {
    await setOrderMode(request, auth, 'tables')
  }
})

test('con mesas y clientes, Nuevo pedido ofrece los dos', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  await setOrderMode(request, auth, 'both')

  try {
    await loginUI(page, ADMIN.email, ADMIN.password)
    await page.goto('/pedidos')
    await expect(page.getByRole('textbox', { name: 'Buscar mesa, cliente o pedido' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Mesa o cliente' })).toBeVisible()
    await page.getByRole('button', { name: 'Nuevo pedido' }).click()
    const dialog = page.getByRole('dialog')
    await expect(field(page, 'Mesa (opcional)')).toBeVisible()
    await expect(dialog.locator('.v-input').filter({ has: page.getByText('Cliente', { exact: true }) })).toContainText('Consumidor final')
    await dialog.getByRole('button', { name: 'Cancelar' }).click()

    // Back to tables from Configuración: the page is as it always was.
    await page.goto('/configuracion')
    const card = page.locator('.v-card', { has: page.getByRole('heading', { name: 'Cómo tomas los pedidos' }) })
    await expect(card.getByRole('radio', { name: /^Con mesas y clientes/ })).toBeChecked()
    await card.getByRole('radio', { name: /^Con mesas\s*Cada pedido/ }).check()
    await card.getByRole('button', { name: 'Guardar cómo tomas los pedidos' }).click()
    await expect(page.getByText('Listo: los pedidos se toman por mesa.')).toBeVisible()
    await page.goto('/pedidos')
    await expect(page.getByRole('textbox', { name: 'Buscar mesa o pedido' })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: 'Mesa', exact: true })).toBeVisible()
  } finally {
    await setOrderMode(request, auth, 'tables')
  }
})

/**
 * Lo que el diálogo suma es lo que el pedido cobra: un ítem con precio propio
 * se mostraba a su precio base y el pedido salía por más.
 */
test('el precio que muestra el nuevo pedido es el que se cobra, también con precio propio', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const name = `Jugo Precio Propio ${Date.now()}`
  await seedMenuItem(request, auth, name, 5000, {}, { custom_price: 6500, use_automatic_price: false })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(name)
  await expect(dialog.locator('.v-list-item', { hasText: name })).toContainText('$6.500')
  await dialog.getByText(name, { exact: true }).click()
  await expect(dialog.getByText('Total: $6.500')).toBeVisible()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  const orders = (await (await request.get(`${API}/orders`, { headers: auth })).json()).data
  const created = orders.find((order: any) => order.items?.some((item: any) => item.product_name === name))
  expect(Number(created.total)).toBe(6500)
})

/**
 * Tomar pedidos no pide el permiso de Menú: el catálogo del diálogo es el de
 * los meseros y los clientes salen de la búsqueda que no muestra sus datos.
 */
test('quien toma pedidos sin el permiso de menú crea el pedido desde la web, con su cliente', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const product = `Buñuelo Cajera ${stamp}`
  const name = `Cliente Cajera ${stamp}`
  await seedMenuItem(request, auth, product, 2800)
  await createCustomer(request, auth, name, String(stamp).slice(-8))
  const cashier = { username: `cajera.sinmenu.${stamp}`, password: 'secreto123' }
  const employee = await request.post(`${API}/users`, {
    headers: auth,
    data: { name: 'Cajera sin menú', role: 'employee', permissions: ['orders', 'reports'], ...cashier },
  })
  expect(employee.status()).toBe(201)

  await loginUI(page, cashier.username, cashier.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(product)
  await dialog.getByText(product, { exact: true }).click()
  await expect(dialog.getByText('Total: $2.800')).toBeVisible()
  await dialog.getByRole('combobox', { name: 'Cliente' }).fill(name)
  await page.getByRole('option', { name: new RegExp(name) }).click()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()
  await expect(page.getByText(/cargar el menú/)).toHaveCount(0)
  await expect(page.locator('tbody tr', { hasText: name })).toContainText('$2.800')
})

/**
 * A product without red sales can't be ordered past its kardex balance: the
 * order is not created and the person taking it reads why and what to do.
 */
test('pedir más de lo que hay de un producto sin ventas en rojo muestra que no hay stock suficiente', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const name = `Cerveza Club Stock ${Date.now()}`
  await seedMenuItem(request, auth, name, 6200, {
    tracks_stock: true,
    current_stock: 1,
    allows_negative_stock: false,
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(name)
  await dialog.getByText(name, { exact: true }).click()
  await dialog.getByRole('button', { name: `Agregar una unidad de ${name}` }).click()
  await expect(dialog.getByText('Total: $12.400')).toBeVisible()

  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText(new RegExp(`No hay stock suficiente de ${name}`))).toBeVisible()
  await expect(page.getByText('Pedido creado')).toHaveCount(0)
  await expect(dialog.getByText('Total: $12.400')).toBeVisible()

  const orders = (await (await request.get(`${API}/orders`, { headers: auth })).json()).data
  expect(orders.some((order: any) => order.items?.some((item: any) => item.product_name === name))).toBe(false)
})

test('agregar productos a un pedido que ya está abierto', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const { productId } = await seedMenuItem(request, auth, 'Empanada Pedidos Web', 3500)
  await seedMenuItem(request, auth, 'Gaseosa Pedidos Web', 4500)

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Abierta E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  // Abrir el detalle del pedido y pedir algo más.
  await page.locator('tr', { hasText: '$3.500' }).first().locator('.mdi-chevron-down').click()
  await page.getByRole('button', { name: 'Agregar productos' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Gaseosa Pedidos Web')
  await dialog.getByText('Gaseosa Pedidos Web', { exact: true }).click()
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click()

  await expect(page.getByText('Productos agregados al pedido')).toBeVisible()

  // Los dos productos quedaron en el MISMO pedido.
  const updated = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const data = (await updated.json()).data
  expect(data.items).toHaveLength(2)
  expect(Number(data.total)).toBe(8000)
})

test('el panel de pedidos filtra por rango de fechas', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const { productId } = await seedMenuItem(request, auth, 'Tamal Fecha E2E', 13579)
  const created = await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: productId, quantity: 1 }] },
  })
  expect(created.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Todos' }).click()
  const row = page.locator('tbody tr', { hasText: '$13.579' })
  await expect(row).toBeVisible()

  // Un rango en el pasado lo deja por fuera.
  await page.getByLabel('Desde').fill('2001-01-01')
  await page.getByLabel('Hasta').fill('2001-01-31')
  await expect(row).toHaveCount(0)

  // "Pedidos del día" pone el rango de hoy y el pedido vuelve.
  await page.getByRole('button', { name: 'Pedidos del día' }).click()
  const today = new Date().toLocaleDateString('en-CA')
  await expect(page.getByLabel('Desde')).toHaveValue(displayDate(today))
  await expect(page.getByLabel('Hasta')).toHaveValue(displayDate(today))
  await expect(row).toBeVisible()

  // En "Pendientes" con fechas avisa que se ocultan los de otros días.
  await page.getByRole('button', { name: 'Pendientes' }).click()
  await expect(page.getByText('Con un rango de fechas no ves los pendientes de otros días.')).toBeVisible()
  await page.getByRole('button', { name: 'Quitar fechas' }).click()
  await expect(page.getByLabel('Desde')).toHaveValue('')
  await expect(page.getByText('Con un rango de fechas no ves los pendientes de otros días.')).toHaveCount(0)
  await expect(row).toBeVisible()
})

/**
 * "Pedidos del día" son todos los de hoy, cobrados o no. El atajo "Hoy" solo
 * ponía las fechas sobre "Pendientes" (la vista por defecto): en cuanto se
 * cobraban las mesas la lista quedaba vacía y la opción parecía no estar.
 */
test('Pedidos del día muestra todos los pedidos de hoy, también los cobrados', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  // En una categoría que ya existe: cada categoría nueva alarga la lista que
  // productos.spec recorre en el formulario, y ahí la opción deja de pintarse.
  const categories = (await (await request.get(`${API}/categories`, { headers: auth })).json()).data
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Buñuelo Del Día E2E', type: 'final', unit: 'unidad', sale_price: 5791, tracks_stock: false, category_id: categories[0].id },
  })
  expect(product.status()).toBe(201)
  const productId = (await product.json()).data.id
  const createOrder = async (quantity: number) => {
    const response = await request.post(`${API}/orders`, {
      headers: auth,
      data: { items: [{ product_id: productId, quantity }] },
    })
    expect(response.status()).toBe(201)
    return (await response.json()).data
  }
  const charged = await createOrder(1)
  await createOrder(2)
  const paid = await request.post(`${API}/orders/${charged.id}/pay`, { headers: auth, data: { payment_method: 'cash' } })
  expect(paid.ok()).toBeTruthy()

  // El "hoy" del navegador es el día en que el API registró el pedido.
  await freezeTime(page, charged.created_at)
  const day = displayDate(charged.created_at.slice(0, 10))
  const chargedRow = page.locator('tbody tr', { hasText: '$5.791' })
  const pendingRow = page.locator('tbody tr', { hasText: '$11.582' })

  const seeTheDay = async () => {
    await page.goto('/pedidos')
    // Por defecto, lo pendiente de cobro: el ya cobrado no sale.
    await expect(pendingRow).toBeVisible()
    await expect(chargedRow).toHaveCount(0)

    const option = page.getByRole('button', { name: 'Pedidos del día' })
    await expect(option).toBeInViewport()
    await option.click()
    await expect(chargedRow).toBeVisible()
    await expect(pendingRow).toBeVisible()
    await expect(page.getByLabel('Desde')).toHaveValue(day)
    await expect(page.getByLabel('Hasta')).toHaveValue(day)
    await expect(page.getByRole('button', { name: 'Todos', exact: true })).toHaveClass(/v-btn--active/)
    await expect(option).toHaveAttribute('aria-pressed', 'true')
  }

  // La cajera (pedidos + reportes) en el celular y el admin en el escritorio.
  const cashier = { username: `cajera.dia.${Date.now()}`, password: 'secreto123' }
  const employee = await request.post(`${API}/users`, {
    headers: auth,
    data: { name: 'Cajera del día', role: 'employee', permissions: ['orders', 'reports'], ...cashier },
  })
  expect(employee.status()).toBe(201)
  await page.setViewportSize({ width: 390, height: 844 })
  await loginUI(page, cashier.username, cashier.password)
  await seeTheDay()

  await page.evaluate(() => localStorage.clear())
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await seeTheDay()
})

/**
 * Plano del salón: al tocar una mesa se ve su pedido completo y se gestiona
 * ahí mismo (agregar productos, cobrar), sin ir a la página de Pedidos.
 */
test('desde el plano se ve el pedido de la mesa y se gestiona ahí mismo', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const { productId } = await seedMenuItem(request, auth, 'Empanada Plano E2E', 3100)
  await seedMenuItem(request, auth, 'Gaseosa Plano E2E', 2900)

  // Una mesa libre ya ubicada en el plano: la de número más alto, para no
  // dejarle ventas a la primera mesa libre que usan otras specs.
  const tables = (await (await request.get(`${API}/tables`, { headers: auth })).json()).data
  const table = [...tables]
    .sort((a: any, b: any) => b.number - a.number)
    .find((t: any) => t.status === 'available' && t.active && t.pos_x !== null)
  expect(table, 'el plano sembrado debe tener una mesa libre ubicada').toBeTruthy()
  const tableName = table.nickname || `Mesa ${table.number}`
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { dining_table_id: table.id, items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  const printing = await watchPrinting(page)
  await page.goto('/plano')
  const tableNode = page.locator('g.table-node').filter({
    has: page.locator('text.table-number', { hasText: new RegExp(`^${table.number}$`) }),
  })
  await tableNode.click()

  // El pedido completo, abierto: productos, total y sus acciones.
  const planDialog = page.getByRole('dialog').filter({ hasText: 'Pedido abierto de la mesa' })
  await expect(planDialog).toContainText(tableName)
  await expect(planDialog.getByRole('cell', { name: 'Empanada Plano E2E', exact: true })).toBeVisible()
  await expect(planDialog.getByRole('button', { name: 'Cobrar' })).toBeVisible()

  // Agregar un producto sin salir del plano.
  await planDialog.getByRole('button', { name: 'Agregar productos' }).click()
  const addDialog = page.getByRole('dialog').last()
  await addDialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Gaseosa Plano E2E')
  await addDialog.getByText('Gaseosa Plano E2E', { exact: true }).click()
  await addDialog.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText('Productos agregados al pedido')).toBeVisible()
  await expect(planDialog.getByRole('cell', { name: 'Gaseosa Plano E2E', exact: true })).toBeVisible()
  await expect(planDialog).toContainText('$6.000')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/plano-mesa-pedido.png' })

  // Cobrar también desde aquí.
  await planDialog.getByRole('button', { name: 'Cobrar' }).click()
  // Sin cobrar todavía no tiene número: se nombra por su mesa.
  const payDialog = page.getByRole('dialog').filter({ hasText: `Cobrar pedido de ${tableName}` })
  await payDialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Imprimir tirilla' })).toBeVisible()
  expect(await printing()).toEqual({ opened: 0, printed: 0 })

  // La mesa queda libre y lista para un pedido nuevo con ella ya elegida.
  const freeDialog = page.getByRole('dialog').filter({ hasText: 'La mesa no tiene pedidos por cobrar.' })
  await expect(freeDialog).toBeVisible()
  await freeDialog.getByRole('button', { name: 'Nuevo pedido en esta mesa' }).click()
  await expect(page.getByRole('dialog').last()).toContainText(tableName)

  const paid = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(paid.payment_status).toBe('paid')
  expect(Number(paid.total)).toBe(6000)
})

/**
 * Pedidos se refresca solo cada pocos segundos: pide únicamente la página
 * visible (nunca la lista completa) y el buscador encuentra un pedido por su
 * número aunque esté en otra página.
 */
test('la lista de pedidos pide solo la página visible, también al refrescarse sola', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const { productId } = await seedMenuItem(request, auth, `Empanada Página ${Date.now()}`, 2468)
  const ids: number[] = []
  for (let n = 0; n < 11; n++) {
    const created = await request.post(`${API}/orders`, {
      headers: auth,
      data: { items: [{ product_id: productId, quantity: n === 0 ? 2 : 1 }] },
    })
    expect(created.status()).toBe(201)
    ids.push((await created.json()).data.id)
  }
  // An order takes its number at its first charge: one of the two units, so it stays pending.
  const first = (await (await request.get(`${API}/orders/${ids[0]}`, { headers: auth })).json()).data
  const charged = await request.post(`${API}/orders/${ids[0]}/partial-payment`, {
    headers: auth,
    data: { items: [{ order_item_id: first.items[0].id, quantity: 1 }] },
  })
  const number = (await charged.json()).data.number
  expect(number).toBeGreaterThan(0)

  const listRequests: string[] = []
  page.on('request', r => {
    if (/\/api\/orders(\?|$)/.test(r.url())) listRequests.push(r.url())
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.locator('.v-data-table-footer__items-per-page .v-select').click()
  await page.getByRole('option', { name: '10', exact: true }).click()
  await expect(page.getByText(/^1-10 de \d+$/)).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: '$2.468' })).toHaveCount(10)

  await page.getByRole('button', { name: 'Página siguiente' }).click()
  await expect(page.getByText(/^11-\d+ de \d+$/)).toBeVisible()

  // El primero de los once quedó en la segunda página; por número aparece solo.
  await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(`#${number}`)
  await expect(page.getByText('1-1 de 1')).toBeVisible()
  await expect(page.locator('tbody tr').first()).toContainText(`#${number}`)

  // Un pedido nuevo llega por el refresco en vivo, que también pide una página.
  const refreshed = page.waitForRequest(r => /\/api\/orders\?/.test(r.url()) && r.url().includes(`q=%23${number}`), { timeout: 15_000 })
  await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity: 1 }] } })
  await refreshed

  expect(listRequests.length).toBeGreaterThan(0)
  expect(listRequests.filter(url => !url.includes('per_page='))).toEqual([])
})

/**
 * A reserved table takes no orders: "Nuevo pedido" lists it greyed out with
 * who and when it waits for, and the API refuses an order sent anyway (the
 * waiter app already installed does not know about reservations).
 */
test('una mesa reservada no se puede elegir para un pedido y el API la rechaza', async ({ page, request }) => {
  await raisePlanLimits(request, { max_tables: 60 })
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const nickname = `Reservada ${stamp}`
  const created = await request.post(`${API}/tables`, {
    headers: auth,
    data: { number: 100 + ((stamp + 600) % 800), nickname, capacity: 4 },
  })
  expect(created.status()).toBe(201)
  const tableId = (await created.json()).data.id
  const reserved = await request.post(`${API}/tables/${tableId}/reserve`, {
    headers: auth,
    data: { reserved_for: 'Ana', reserved_time: '20:00' },
  })
  expect(reserved.status()).toBe(200)
  const { productId } = await seedMenuItem(request, auth, `Limonada Reservada ${stamp}`, 5000)

  const refused = await request.post(`${API}/orders`, {
    headers: auth,
    data: { dining_table_id: tableId, items: [{ product_id: productId, quantity: 1 }] },
  })
  expect(refused.status()).toBe(422)
  const body = await refused.json()
  expect(body.table_reserved).toBe(true)
  expect(body.message).toBe(
    `La mesa ${nickname} está reservada a nombre de Ana para las 08:00 p. m. Quita la reserva cuando lleguen para tomar el pedido.`,
  )
  const orders = (await (await request.get(`${API}/orders?dining_table_id=${tableId}`, { headers: auth })).json()).data
  expect(orders).toHaveLength(0)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  await field(page, 'Mesa (opcional)').click()
  const option = await scrollToOption(page, new RegExp(nickname))
  await expect(option).toContainText('Reservada · Ana · 08:00 p. m.')
  await expect(option).toHaveClass(/v-list-item--disabled/)

  // Without the reservation it is a table like any other.
  await request.post(`${API}/tables/${tableId}/unreserve`, { headers: auth })
  const accepted = await request.post(`${API}/orders`, {
    headers: auth,
    data: { dining_table_id: tableId, items: [{ product_id: productId, quantity: 1 }] },
  })
  expect(accepted.status()).toBe(201)
  await request.post(`${API}/orders/${(await accepted.json()).data.id}/cancel`, { headers: auth })
})
