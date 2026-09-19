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
