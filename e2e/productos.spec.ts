import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, field, freezeTime, loginUI, pickOption } from './helpers'

/**
 * Crear varios productos (por API, rápido) y verificar que la tabla de
 * Productos muestra su información correctamente.
 */
test('los productos creados aparecen con su información en la tabla', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  // Categoría propia del test para no depender del seed.
  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Categoría E2E' },
  })
  expect(category.status()).toBe(201)
  const categoryId = (await category.json()).data.id

  const products = [
    { name: 'Harina E2E', type: 'raw_material', unit: 'kg', unit_cost: 3500, current_stock: 40, tracks_stock: true },
    { name: 'Pan Campesino E2E', type: 'final', unit: 'unidad', sale_price: 8000, tracks_stock: false },
  ]

  for (const product of products) {
    const response = await request.post(`${API}/products`, {
      headers: auth,
      data: { ...product, category_id: categoryId },
    })
    expect(response.status()).toBe(201)
  }

  // --- Verificación por interfaz ---
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')

  // La materia prima muestra nombre, categoría y su stock inicial (que
  // entró por el kardex como saldo inicial SI). El buscador trae cada fila
  // a la vista aunque la tabla esté paginada por datos de otros tests.
  await page.getByRole('textbox', { name: 'Buscar' }).fill('Harina E2E')
  const flourRow = page.locator('tr', { hasText: 'Harina E2E' })
  await expect(flourRow).toBeVisible()
  await expect(flourRow).toContainText('Categoría E2E')
  await expect(flourRow).toContainText('40')

  // El producto final muestra su precio de venta.
  await page.getByRole('textbox', { name: 'Buscar' }).fill('Pan Campesino E2E')
  const breadRow = page.locator('tr', { hasText: 'Pan Campesino E2E' })
  await expect(breadRow).toBeVisible()
  await expect(breadRow).toContainText('8.000')
})

test('el stock inicial del producto queda registrado en el kardex', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Insumos Kardex E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Mantequilla E2E',
      type: 'raw_material',
      unit: 'kg',
      unit_cost: 12000,
      current_stock: 15,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')

  // Filtrar por el producto y consultar. Searched by name: the list only
  // renders the first products, and the suite keeps adding more.
  await page.getByRole('combobox', { name: 'Producto' }).fill('Mantequilla E2E')
  await page.getByRole('option', { name: 'Mantequilla E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  // El movimiento SI aparece con el saldo correcto.
  await expect(page.locator('tr', { hasText: 'SI' }).first()).toBeVisible()
  await expect(page.getByText('15 kg')).toBeVisible()
  await expect(page.getByRole('button', { name: /Descargar Excel/ })).toBeEnabled()
})

test('el ajuste manual pide motivo y queda en el kardex con documento AJ', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Ajustes E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Queso E2E',
      type: 'raw_material',
      unit: 'kg',
      unit_cost: 20000,
      current_stock: 10,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')

  // El stock se ajusta desde su chip, nunca editando el producto.
  // (Con la base llena de otros tests, el buscador trae la fila a la vista.)
  await page.getByRole('textbox', { name: 'Buscar' }).fill('Queso E2E')
  const row = page.locator('tr', { hasText: 'Queso E2E' })
  await row.getByText('10 kg').click()
  await page.getByLabel('Ajuste', { exact: true }).fill('-2')

  // Sin motivo no hay ajuste: el kardex exige saber por qué.
  await page.getByRole('button', { name: /Actualizar stock/ }).click()
  await expect(page.getByText(/Indica el motivo/)).toBeVisible()

  await page.getByLabel('Motivo del ajuste *').fill('Merma E2E')
  await page.getByRole('button', { name: /Actualizar stock/ }).click()
  await expect(row.getByText('8 kg')).toBeVisible()

  // El movimiento queda en el kardex como AJ.
  await page.goto('/kardex')
  await page.getByRole('combobox', { name: 'Producto' }).fill('Queso E2E')
  await page.getByRole('option', { name: 'Queso E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()
  await expect(page.locator('tr', { hasText: 'AJ' }).first()).toBeVisible()
})

test('el saldo inicial retrofechado muestra su fecha real en el kardex', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Retrofechado E2E' },
  })
  const categoryId = (await category.json()).data.id

  // Inventario que existe hace 10 días: el saldo inicial lleva esa fecha.
  const realDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
  const isoDate = realDate.toLocaleDateString('sv-SE')

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Aceituna E2E',
      type: 'raw_material',
      unit: 'kg',
      unit_cost: 30000,
      current_stock: 5,
      initial_stock_date: isoDate,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('combobox', { name: 'Producto' }).fill('Aceituna E2E')
  await page.getByRole('option', { name: 'Aceituna E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  // La tabla muestra la fecha como "23 ago": se construye igual aquí.
  const expectedLabel = realDate.toLocaleString('es-CO', { day: '2-digit', month: 'short' })
  const siRow = page.locator('tr', { hasText: 'SI' }).first()
  await expect(siRow).toBeVisible()
  await expect(siRow).toContainText(expectedLabel)
})

/**
 * Un producto se puede crear sin existencias (saldo inicial 0): nace agotado
 * (rojo en la tabla), se puede pedir y cobrar, y al venderlo el kardex queda
 * en negativo (en rojo). El dashboard lo marca como agotado.
 */
test('un producto con saldo inicial 0 se crea, se vende y el kardex queda en negativo', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Sin Saldo E2E Cat' },
  })
  // El formulario exige impuesto; la empresa base no trae ninguno sembrado.
  await request.post(`${API}/taxes`, {
    headers: auth,
    data: { name: 'IVA Sin Saldo E2E', rate: 19 },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')

  // Alta por interfaz: por defecto es producto final en "unidad" y el saldo
  // inicial viene en 0, así que se crea sin existencias (ya no es obligatorio).
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  await field(page, 'Nombre del producto *').locator('input').fill('Gaseosa Sin Saldo E2E')

  await field(page, 'Categoría *').click()
  await pickOption(page, 'Sin Saldo E2E Cat')

  await expect(field(page, 'Unidad de medida *').locator('input')).toHaveValue('unidad')
  await expect(field(page, 'Saldo inicial').locator('input')).toHaveValue('0')

  await field(page, 'Precio de venta *').locator('input').fill('5000')
  await field(page, 'Impuesto *').locator('.v-field').click()
  await page.getByRole('option', { name: /Exento|IVA|%/ }).first().click()

  await page.getByRole('dialog').getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Producto creado')).toBeVisible()

  // Aparece en la tabla, agotado: el chip de stock está en rojo con 0.
  await page.getByRole('textbox', { name: 'Buscar' }).fill('Gaseosa Sin Saldo E2E')
  const row = page.locator('tr', { hasText: 'Gaseosa Sin Saldo E2E' })
  await expect(row).toBeVisible()
  await expect(row.locator('.v-chip.text-error')).toContainText('0')

  // Se puede pedir y cobrar aunque no haya stock: la venta lleva el saldo a
  // negativo (arreglamos el pedido por API para ir directo a lo que importa).
  const list = await request.get(`${API}/products`, { headers: auth })
  const created = (await list.json()).data.find((p: any) => p.name === 'Gaseosa Sin Saldo E2E')
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Agotado E2E', items: [{ product_id: created.id, quantity: 3 }] },
  })
  const orderId = (await order.json()).data.id
  expect((await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })).ok()).toBeTruthy()

  // Kardex: existencia y saldo en negativo, resaltados en rojo.
  await page.goto('/kardex')
  await page.getByRole('combobox', { name: 'Producto' }).fill('Gaseosa Sin Saldo E2E')
  await page.getByRole('option', { name: 'Gaseosa Sin Saldo E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  await expect(page.getByText('-3 unidad')).toBeVisible()
  const fvRow = page.locator('tr', { hasText: 'FV' }).first()
  await expect(fvRow).toBeVisible()
  // El saldo de cantidad, en negativo, resaltado en rojo.
  await expect(fvRow.locator('td.text-error', { hasText: '-3' })).toBeVisible()

  // Dashboard: el producto agotado (saldo negativo) sale como alerta.
  await page.goto('/dashboard')
  const alert = page
    .locator('.v-list-item', { hasText: 'Gaseosa Sin Saldo E2E' })
    .filter({ hasText: 'Agotado' })
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('-3 unidad')
})

/**
 * Prices are typed as pesos: "18.500" is eighteen thousand five hundred, not
 * 18,5. The menu price follows the sale price until it is changed by hand.
 * The whole form, every section on, fits a 1440×900 laptop without scrolling.
 */
test('el costo, el precio de venta y el del menú se escriben en pesos', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const name = `Lasaña Precio ${stamp}`
  await request.post(`${API}/categories`, { headers: auth, data: { name: `Precios ${stamp}` } })
  await request.post(`${API}/taxes`, { headers: auth, data: { name: `IVA Precios ${stamp}`, rate: 19 } })

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const dialog = page.getByRole('dialog')
  await field(page, 'Nombre del producto *').locator('input').fill(name)
  await field(page, 'Categoría *').click()
  await pickOption(page, `Precios ${stamp}`)

  const cost = dialog.getByLabel('Precio de costo')
  const sale = field(page, 'Precio de venta *').locator('input')
  const menu = dialog.getByLabel('Precio en el menú')
  for (const input of [cost, sale, menu]) await expect(input).not.toHaveAttribute('type', 'number')
  await cost.fill('9.500')
  await sale.fill('18.500')
  await expect(menu).toHaveValue('18.500')
  await menu.fill('19.000')
  await field(page, 'Impuesto *').locator('.v-field').click()
  await page.getByRole('option', { name: new RegExp(`IVA Precios ${stamp}`) }).click()
  await expect(dialog.getByLabel('Saldo inicial', { exact: true })).toBeVisible()
  const card = page.locator('.v-dialog > .v-overlay__content > .v-card')
  expect(await card.evaluate(el => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(0)
  for (const control of [field(page, 'Nombre del producto *'), dialog.getByLabel('Stock mínimo (alerta)'), menu, dialog.getByRole('button', { name: 'Guardar', exact: true })]) {
    await expect(control).toBeInViewport({ ratio: 1 })
  }
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Producto creado')).toBeVisible()

  await page.getByRole('textbox', { name: 'Buscar' }).fill(name)
  const row = page.locator('tr', { hasText: name })
  await expect(row).toContainText('$9.500')
  await expect(row).toContainText('$18.500')

  // Reopened, each price reads back with its dots.
  await row.getByRole('button', { name: `Editar ${name}` }).click()
  await expect(cost).toHaveValue('9.500')
  await expect(sale).toHaveValue('18.500')
  await expect(menu).toHaveValue('19.000')
})

/**
 * "Permite ventas en rojo" only exists while the product keeps stock. Off,
 * the product can't be sold past its kardex balance, and the table flags it.
 */
test('un producto sin ventas en rojo lo guarda así, la tabla lo marca y se puede volver a permitir', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const name = `Cerveza Sin Rojo ${stamp}`
  await request.post(`${API}/categories`, { headers: auth, data: { name: `Sin Rojo ${stamp}` } })
  await request.post(`${API}/taxes`, { headers: auth, data: { name: `IVA Sin Rojo ${stamp}`, rate: 19 } })
  const storedProduct = async () => {
    const response = await request.get(`${API}/products`, { headers: auth, params: { q: name, per_page: 10 } })
    return (await response.json()).data.find((p: { name: string }) => p.name === name)
  }

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const dialog = page.getByRole('dialog')
  await field(page, 'Nombre del producto *').locator('input').fill(name)
  await field(page, 'Categoría *').click()
  await pickOption(page, `Sin Rojo ${stamp}`)
  await field(page, 'Precio de venta *').locator('input').fill('4.000')
  await field(page, 'Impuesto *').locator('.v-field').click()
  await page.getByRole('option', { name: new RegExp(`IVA Sin Rojo ${stamp}`) }).click()

  // New products allow red sales, and the switch sits with the stock one.
  const tracksStock = dialog.getByLabel('Este producto maneja stock e inventario')
  const redSales = dialog.getByLabel('Permite ventas en rojo')
  await expect(redSales).toBeChecked()
  await expect(dialog.getByText('Puedes venderlo aunque el kardex no tenga existencias; el saldo queda en negativo hasta que registres la compra')).toBeVisible()

  // Without stock there is nothing to go red: the switch goes away.
  await tracksStock.uncheck()
  await expect(redSales).toHaveCount(0)
  await tracksStock.check()
  await expect(redSales).toBeChecked()

  await redSales.uncheck()
  await expect(dialog.getByText('No podrás vender ni sacar más de lo que hay en el kardex')).toBeVisible()
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Producto creado')).toBeVisible()
  expect((await storedProduct()).allows_negative_stock).toBe(false)

  await page.getByRole('textbox', { name: 'Buscar' }).fill(name)
  const row = page.locator('tr', { hasText: name })
  const flag = row.getByRole('img', { name: 'Sin ventas en rojo' })
  await expect(flag).toBeVisible()
  await flag.hover()
  await expect(page.getByRole('tooltip', { name: 'Sin ventas en rojo' })).toBeVisible()

  // Reopened it reads off; turned back on, it saves and the flag goes away.
  await row.getByRole('button', { name: `Editar ${name}` }).click()
  await expect(redSales).not.toBeChecked()
  await redSales.check()
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Producto actualizado')).toBeVisible()
  expect((await storedProduct()).allows_negative_stock).toBe(true)
  await expect(row).toBeVisible()
  await expect(flag).toHaveCount(0)
})

/** Con la tabla paginada en el servidor, ordenar una columna lo resuelve el backend. */
test('ordenar por nombre y filtrar por categoría se resuelven en el servidor', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const categoryName = `Orden E2E ${Date.now()}`
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: categoryName } })
  const categoryId = (await category.json()).data.id
  for (const name of ['Bocadillo Orden', 'Arepa Orden', 'Cuajada Orden']) {
    const created = await request.post(`${API}/products`, {
      headers: auth,
      data: { name, type: 'final', unit: 'unidad', sale_price: 3000, tracks_stock: false, category_id: categoryId },
    })
    expect(created.status()).toBe(201)
  }

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')
  await field(page, 'Categoría').click()
  await pickOption(page, categoryName)

  const names = page.locator('tbody tr td:nth-child(4)')
  await expect(names).toHaveText(['Arepa Orden', 'Bocadillo Orden', 'Cuajada Orden'])

  const sorted = page.waitForRequest(r => r.url().includes('/api/products?') && r.url().includes('sort_dir=desc'))
  await page.getByRole('columnheader', { name: 'Nombre' }).click()
  await page.getByRole('columnheader', { name: 'Nombre' }).click()
  expect((await sorted).url()).toContain('sort_by=name')
  await expect(names).toHaveText(['Cuajada Orden', 'Bocadillo Orden', 'Arepa Orden'])
})

/** "$15.437", as `money()` writes it. */
const pesos = (value: number) => `$${String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`

/**
 * The components of a combo, one of each kind: a soda resold from stock
 * ($2.000), fries bought by the kilo ($4.000 the kg) and a hamburger made
 * from a recipe (bread $500 + meat $3.000). Created through the API.
 */
async function comboComponents(request: APIRequestContext, auth: Record<string, string>, stamp: number) {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Combos ${stamp}` } })
  const categoryId = (await category.json()).data.id
  await request.post(`${API}/taxes`, { headers: auth, data: { name: `IVA Combos ${stamp}`, rate: 19 } })
  const product = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API}/products`, { headers: auth, data: { unit: 'unidad', category_id: categoryId, ...data } })
    expect(response.status(), await response.text()).toBe(201)
    return (await response.json()).data.id as number
  }
  const names = {
    category: `Combos ${stamp}`,
    tax: `IVA Combos ${stamp}`,
    soda: `Gaseosa Combo ${stamp}`,
    fries: `Papas Combo ${stamp}`,
    burger: `Hamburguesa Combo ${stamp}`,
  }
  const soda = await product({ name: names.soda, type: 'final', sale_price: 4000, current_stock: 20, unit_cost: 2000 })
  await product({ name: names.fries, type: 'raw_material', unit: 'kg', current_stock: 10, unit_cost: 4000 })
  const bread = await product({ name: `Pan Combo ${stamp}`, type: 'raw_material', current_stock: 30, unit_cost: 500 })
  const meat = await product({ name: `Carne Combo ${stamp}`, type: 'raw_material', current_stock: 30, unit_cost: 3000 })
  const burger = await product({ name: names.burger, type: 'final', sale_price: 12000, tracks_stock: false })
  const recipe = await request.post(`${API}/recipes`, {
    headers: auth,
    data: {
      product_id: burger,
      name: `Receta ${names.burger}`,
      yield_quantity: 1,
      ingredients: [
        { product_id: bread, quantity: 1, unit: 'unidad' },
        { product_id: meat, quantity: 1, unit: 'unidad' },
      ],
    },
  })
  expect(recipe.status(), await recipe.text()).toBe(201)

  return { names, soda }
}

/** Picks a product for the combo's line `n` by typing its name. */
async function pickComponent(page: Page, n: number, name: string, quantity?: string) {
  const line = page.getByRole('group', { name: `Producto ${n} del combo` })
  await line.locator('input[role="combobox"]').fill(name)
  await page.getByRole('option', { name: new RegExp(name) }).click()
  if (quantity) await line.getByLabel('Cantidad').fill(quantity)
}

/**
 * "Al vender un combo debe sacar del kardex los productos relacionados en el
 * combo con su respectivo costo… se mantiene el precio del combo." Built in
 * Productos, sold from Nuevo pedido and charged: the Kardex shows each
 * component leaving for the combo, and Ventas › Por producto its real cost.
 */
test('un combo se arma en Productos, se vende desde Nuevo pedido y el kardex y Ventas muestran lo que costó', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const { names } = await comboComponents(request, auth, stamp)
  const combo = `Combo Burger ${stamp}`
  // A price of its own, so its order is found by its total among the suite's.
  const price = 15000 + (stamp % 1000)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const dialog = page.getByRole('dialog')
  await field(page, 'Nombre del producto *').locator('input').fill(combo)
  await field(page, 'Categoría *').click()
  await pickOption(page, names.category)
  await field(page, 'Precio de venta *').locator('input').fill(String(price))
  await field(page, 'Impuesto *').locator('.v-field').click()
  await page.getByRole('option', { name: new RegExp(names.tax) }).click()

  // A combo has no stock nor cost of its own: its components do.
  await expect(dialog.getByText('Control de inventario')).toBeVisible()
  await dialog.getByLabel('Es un combo').check()
  await expect(dialog.getByText('Componentes del combo')).toBeVisible()
  await expect(dialog.getByLabel('Este producto maneja stock e inventario')).toHaveCount(0)
  await expect(dialog.getByLabel('Precio de costo')).toHaveCount(0)
  await pickComponent(page, 1, names.burger)
  await dialog.getByRole('button', { name: 'Agregar producto' }).click()
  await pickComponent(page, 2, names.soda)
  await dialog.getByRole('button', { name: 'Agregar producto' }).click()
  await pickComponent(page, 3, names.fries, '0,25')
  const fries = page.getByRole('group', { name: 'Producto 3 del combo' })
  await expect(fries).toContainText('$1.000')
  await expect(fries).toContainText('$4.000 c/u')
  await expect(dialog.getByText('Costo estimado del combo')).toBeVisible()
  await expect(dialog.getByText('$6.500', { exact: true })).toBeVisible()
  await expect(dialog.getByText(`Ganas ${pesos(price - 6500)} por unidad`)).toBeVisible()
  await dialog.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Producto creado')).toBeVisible()

  await page.getByRole('textbox', { name: 'Buscar' }).fill(combo)
  const row = page.locator('tr', { hasText: combo })
  await expect(row.locator('.v-chip', { hasText: /^Combo$/ })).toBeVisible()
  await expect(row).toContainText('No aplica')
  await expect(row).toContainText('$6.500')
  await expect(row.getByRole('button', { name: `Receta de ${combo}` })).toHaveCount(0)

  // Reopened, it brings its components back in the order they were added.
  await row.getByRole('button', { name: `Editar ${combo}` }).click()
  await expect(dialog.getByLabel('Es un combo')).toBeChecked()
  await expect(page.getByRole('group', { name: 'Producto 1 del combo' })).toContainText(names.burger)
  await expect(page.getByRole('group', { name: 'Producto 3 del combo' }).getByLabel('Cantidad')).toHaveValue('0.25')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  // Sold from Nuevo pedido, at its own price, and charged.
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill(combo)
  await dialog.getByText(combo, { exact: true }).click()
  await expect(dialog.getByText(`Total: ${pesos(price)}`)).toBeVisible()
  await dialog.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()
  await page.locator('tbody tr', { hasText: pesos(price) }).first().getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  const orders = (await (await request.get(`${API}/orders`, { headers: auth })).json()).data
  const sold = orders.find((order: any) => order.items?.some((item: any) => item.product_name === combo))
  expect(sold.items.map((item: any) => [item.product_name, Number(item.total_price)])).toEqual([[combo, price]])

  // The Kardex: the soda left for the combo, and the combo itself never appears.
  await page.goto('/kardex')
  await page.getByRole('combobox', { name: 'Producto' }).fill(names.soda)
  await page.getByRole('option', { name: names.soda }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()
  const exit = page.locator('tbody tr', { hasText: `${combo}: ${names.soda}` })
  await expect(exit).toBeVisible()
  await expect(exit).toContainText('FV')
  await expect(exit).toContainText('$2.000')
  await page.getByRole('combobox', { name: 'Producto' }).fill(combo)
  await expect(page.getByRole('option', { name: combo })).toHaveCount(0)

  // Ventas › Por producto: what its components cost, and its margin.
  await freezeTime(page, sold.paid_at)
  await page.goto('/ventas')
  await page.getByRole('button', { name: 'Por producto' }).click()
  const sale = page.locator('tr', { hasText: combo })
  await expect(sale).toContainText(pesos(price))
  await expect(sale).toContainText('$6.500')
  await expect(sale).toContainText(pesos(price - 6500))
  const margin = Math.round(((price - 6500) * 1000) / price) / 10
  await expect(sale).toContainText(`${margin.toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`)
  await expect(sale).not.toContainText('estimado')
})
