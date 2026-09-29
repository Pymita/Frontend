import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * La web crea pedidos con productos reales (antes solo existía el pedido
 * rápido, un total escrito a mano que no se podía facturar) y permite
 * seguir agregándole productos a un pedido ya abierto.
 */

/** Deja un producto publicado en el menú y devuelve su nombre y precio. */
async function seedMenuItem(request: any, auth: Record<string, string>, name: string, price: number) {
  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: `Categoría ${name}` },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name,
      type: 'final',
      unit: 'unidad',
      sale_price: price,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  await request.post(`${API}/menu-items`, {
    headers: auth,
    data: { name, final_product_id: productId, category_id: categoryId, base_price: price },
  })

  return { productId, categoryId }
}

test('crear un pedido con productos desde la web', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  await seedMenuItem(request, auth, 'Limonada Pedidos Web', 7300)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  await page.getByRole('button', { name: 'Nuevo Pedido' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Limonada Pedidos Web')
  await dialog.getByText('Limonada Pedidos Web').first().click()

  // El total del diálogo refleja lo elegido antes de guardar.
  await expect(dialog.getByText('Total: $7.300')).toBeVisible()

  await dialog.getByRole('button', { name: 'Crear Pedido' }).click()
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
  await dialog.getByText('Gaseosa Pedidos Web').first().click()
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

  // "Hoy" pone el rango del día y el pedido vuelve.
  await page.getByRole('button', { name: 'Hoy', exact: true }).click()
  const today = new Date().toLocaleDateString('en-CA')
  await expect(page.getByLabel('Desde')).toHaveValue(today)
  await expect(page.getByLabel('Hasta')).toHaveValue(today)
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
 * Plano del salón: al tocar una mesa se ve su pedido completo y se gestiona
 * ahí mismo (agregar productos, cobrar), sin ir a la página de Pedidos.
 */
test('desde el plano se ve el pedido de la mesa y se gestiona ahí mismo', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const { productId } = await seedMenuItem(request, auth, 'Empanada Plano E2E', 3100)
  await seedMenuItem(request, auth, 'Gaseosa Plano E2E', 2900)

  // Una mesa libre que ya esté ubicada en el plano.
  const tables = (await (await request.get(`${API}/tables`, { headers: auth })).json()).data
  const table = tables.find((t: any) => t.status === 'available' && t.active && t.pos_x !== null)
  expect(table, 'el plano sembrado debe tener una mesa libre ubicada').toBeTruthy()
  const tableName = table.nickname || `Mesa ${table.number}`
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { dining_table_id: table.id, items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
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
  await addDialog.getByText('Gaseosa Plano E2E').first().click()
  await addDialog.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText('Productos agregados al pedido')).toBeVisible()
  await expect(planDialog.getByRole('cell', { name: 'Gaseosa Plano E2E', exact: true })).toBeVisible()
  await expect(planDialog).toContainText('$6.000')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/plano-mesa-pedido.png' })

  // Cobrar también desde aquí.
  await planDialog.getByRole('button', { name: 'Cobrar' }).click()
  const payDialog = page.getByRole('dialog').filter({ hasText: `Cobrar pedido #${orderId}` })
  await payDialog.getByLabel('Imprimir la factura al cobrar').uncheck()
  await payDialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  // La mesa queda libre y lista para un pedido nuevo con ella ya elegida.
  const freeDialog = page.getByRole('dialog').filter({ hasText: 'La mesa no tiene pedidos por cobrar.' })
  await expect(freeDialog).toBeVisible()
  await freeDialog.getByRole('button', { name: 'Nuevo pedido en esta mesa' }).click()
  await expect(page.getByRole('dialog').last()).toContainText(tableName)

  const paid = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(paid.payment_status).toBe('paid')
  expect(Number(paid.total)).toBe(6000)
})
