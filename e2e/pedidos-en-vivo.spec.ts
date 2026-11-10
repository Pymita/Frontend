import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI, raisePlanLimits } from './helpers'

/**
 * Un pedido tomado desde la app del mesero (aquí, por API) aparece en la
 * pestaña de pedidos de la web sin recargar, con su aviso.
 */
test('un pedido creado desde afuera aparece solo en la web', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'En vivo E2E' } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Tinto En Vivo', type: 'final', unit: 'und', sale_price: 1700, tracks_stock: false, category_id: categoryId },
  })
  const productId = (await product.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await expect(page.getByRole('button', { name: 'Nuevo pedido' })).toBeVisible()
  await expect(page.locator('tr', { hasText: '$1.700' })).toHaveCount(0)

  // El mesero toma el pedido desde el celular.
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa En Vivo', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  // Sin tocar nada, la web lo muestra y avisa.
  await expect(page.locator('tr', { hasText: '$1.700' }).first()).toBeVisible({ timeout: 10_000 })
  // Sin número: un pedido lo toma al cobrarse, y el id interno nunca se muestra.
  const alert = page.locator('.v-snackbar', { hasText: 'Llegó un pedido nuevo' })
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Ya está en la lista de pendientes')
  // Arriba y grande: se ve desde la caja sin acercarse a la pantalla.
  const box = (await alert.locator('.v-snackbar__wrapper').boundingBox())!
  expect(box.y).toBeLessThan(200)
  expect(box.width).toBeGreaterThanOrEqual(360)
  await expect(page.locator('tr', { hasText: '$1.700' }).first()).not.toContainText(`#${orderId}`)

  // Cobrarlo desde otro lado también se refleja: la fila deja de ser cobrable.
  await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
  await expect(page.locator('tr', { hasText: '$1.700' })).toHaveCount(0, { timeout: 10_000 })
})

/**
 * Quien tiene "Cambiar estado de pedidos" (el admin siempre) mueve el pedido
 * de Pendiente a En preparación, Listo y Entregado desde el chip del estado,
 * en Pedidos y dentro del plano del salón. Entregado no es cobrado: el
 * pedido sigue por cobrar y su mesa ocupada.
 */
test('el estado del pedido se cambia desde su chip, en Pedidos y en el plano del salón', async ({ page, request }) => {
  await raisePlanLimits(request, { max_tables: 60 })
  const auth = { Authorization: `Bearer ${await apiLogin(request, ADMIN.email, ADMIN.password)}`, Accept: 'application/json' }
  const stamp = Date.now()
  const nickname = `Estado ${stamp % 1_000_000}`
  const table = await request.post(`${API}/tables`, { headers: auth, data: { number: 2000 + (stamp % 7000), nickname, capacity: 4 } })
  expect(table.status()).toBe(201)
  const tableId = (await table.json()).data.id
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Estados E2E ${stamp}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: `Ajiaco Estado ${stamp}`, type: 'final', unit: 'plato', sale_price: 18300, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  const created = await request.post(`${API}/orders`, {
    headers: auth,
    data: { dining_table_id: tableId, items: [{ product_id: (await product.json()).data.id, quantity: 1 }] },
  })
  expect(created.status()).toBe(201)
  const orderId = (await created.json()).data.id
  const order = `Pedido de ${nickname}`
  const option = (name: string) => page.getByRole('listitem').filter({ hasText: new RegExp(`^${name}$`) })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(nickname)
  const row = page.locator('tbody tr', { hasText: nickname })
  await expect(row).toHaveCount(1)

  // The chip opens the four statuses, the current one marked.
  await row.getByRole('button', { name: `Cambiar el estado de ${order}: Pendiente` }).click()
  await expect(page.getByText('Cambiar estado', { exact: true })).toBeVisible()
  for (const name of ['Pendiente', 'En preparación', 'Listo', 'Entregado']) {
    await expect(option(name)).toBeVisible()
  }
  await expect(option('Pendiente')).toHaveClass(/v-list-item--active/)
  await option('En preparación').click()
  await expect(page.getByText(`${order} pasó a En preparación`)).toBeVisible()
  await expect(row.getByRole('button', { name: `Cambiar el estado de ${order}: En preparación` })).toHaveText('En preparación')

  // "Marcar entregado" from the row's menu, the quick way.
  await row.getByRole('button', { name: 'Más acciones del pedido' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Marcar entregado' }).click()
  await expect(page.getByText(`${order} pasó a Entregado`)).toBeVisible()
  await expect(row.getByRole('button', { name: `Cambiar el estado de ${order}: Entregado` })).toHaveText('Entregado')
  // Delivered, not charged: still in Pendientes, still to charge, the table still taken.
  await expect(row).toContainText('Por pagar')
  await expect(row.getByRole('button', { name: 'Cobrar' })).toBeVisible()
  await row.getByRole('button', { name: 'Más acciones del pedido' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Imprimir cuenta' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Marcar entregado' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect((await (await request.get(`${API}/tables/${tableId}`, { headers: auth })).json()).data.status).toBe('occupied')

  // The same chip inside the floor plan's table.
  await page.goto('/plano')
  await page.locator('svg g.table-node').filter({ has: page.locator('title', { hasText: nickname }) }).click()
  const detail = page.getByRole('dialog').filter({ hasText: 'Pedido abierto de la mesa' })
  await detail.getByRole('button', { name: `Cambiar el estado de ${order}: Entregado` }).click()
  await option('Listo').click()
  await expect(detail.getByRole('button', { name: `Cambiar el estado de ${order}: Listo` })).toHaveText('Listo')
  expect((await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data.status).toBe('ready')

  // Charged, the status is the sale's: the chip only reads.
  await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Todos' }).click()
  await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(nickname)
  await expect(row).toContainText('Pagado')
  await expect(row.getByText('Entregado', { exact: true })).toBeVisible()
  await expect(row.getByRole('button', { name: /^Cambiar el estado de/ })).toHaveCount(0)
})
