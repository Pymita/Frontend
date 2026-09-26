import { expect, test, type APIRequestContext } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Dashboard: lo que el dueño mira primero. Las métricas cuentan lo mismo
 * que Ventas (pedidos cobrados, no cancelados) y el stock bajo sale del
 * saldo del kardex.
 */

type Auth = { Authorization: string }

async function createProduct(request: APIRequestContext, auth: Auth, data: Record<string, unknown>): Promise<number> {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Dashboard E2E ${Date.now()}` } })
  const response = await request.post(`${API}/products`, {
    headers: auth,
    data: { category_id: (await category.json()).data.id, ...data },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).data.id
}

async function chargedSale(request: APIRequestContext, auth: Auth, productId: number, quantity: number): Promise<number> {
  const response = await request.post(`${API}/orders`, {
    headers: auth,
    data: { order_type: 'takeaway', items: [{ product_id: productId, quantity }], payment_status: 'paid' },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return (await response.json()).data.id
}

test('stock bajo muestra el saldo real y más vendidos solo cuenta lo cobrado', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const suffix = Date.now()

  const flourName = `Harina Tablero ${suffix}`
  await createProduct(request, auth, {
    name: flourName, type: 'raw_material', unit: 'kg', unit_cost: 3000,
    tracks_stock: true, current_stock: 0.5, minimum_stock: 500,
  })

  const empanadaName = `Empanada Tablero ${suffix}`
  const empanadaId = await createProduct(request, auth, {
    name: empanadaName, type: 'final', unit: 'und', unit_cost: 1000, sale_price: 2500, tracks_stock: false,
  })
  await chargedSale(request, auth, empanadaId, 25)
  await chargedSale(request, auth, empanadaId, 15)

  // Un pedido cancelado no es una venta.
  const cancelled = await request.post(`${API}/orders`, {
    headers: auth,
    data: { order_type: 'takeaway', items: [{ product_id: empanadaId, quantity: 30 }] },
  })
  const cancelledId = (await cancelled.json()).data.id
  expect((await request.post(`${API}/orders/${cancelledId}/cancel`, { headers: auth })).ok()).toBeTruthy()

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/dashboard')

  const lowStock = page.locator('.v-card', { hasText: 'Stock Bajo' }).filter({ has: page.locator('.v-list') })
  const flourRow = lowStock.locator('.v-list-item', { hasText: flourName })
  await expect(flourRow).toContainText('Actual: 0,5 kg')
  await expect(flourRow).toContainText('Mínimo: 500 kg')

  const topProducts = page.locator('.v-card', { hasText: 'Más Vendidos' })
  const empanadaRow = topProducts.locator('.v-list-item', { hasText: empanadaName })
  await expect(empanadaRow).toContainText('40 vendidos')
})
