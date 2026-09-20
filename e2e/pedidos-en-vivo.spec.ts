import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

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
  await expect(page.getByRole('button', { name: 'Nuevo Pedido' })).toBeVisible()
  await expect(page.locator('tr', { hasText: '$1.700' })).toHaveCount(0)

  // El mesero toma el pedido desde el celular.
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa En Vivo', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  // Sin tocar nada, la web lo muestra y avisa.
  await expect(page.locator('tr', { hasText: '$1.700' }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(`Nuevo pedido #${orderId}`)).toBeVisible()

  // Cobrarlo desde otro lado también se refleja: la fila deja de ser cobrable.
  await request.post(`${API}/orders/${orderId}/pay`, { headers: auth, data: { payment_method: 'cash' } })
  await expect(page.locator('tr', { hasText: '$1.700' })).toHaveCount(0, { timeout: 10_000 })
})
