import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

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

  // Filtrar por el producto y consultar.
  await page.getByRole('combobox', { name: 'Producto' }).click()
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
  await page.getByRole('combobox', { name: 'Producto' }).click()
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
  await page.getByRole('combobox', { name: 'Producto' }).click()
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
  await page.getByRole('option', { name: 'Sin Saldo E2E Cat' }).click()

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
  await page.getByRole('combobox', { name: 'Producto' }).click()
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
