import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

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

test('armar un pedido por personas desde la web', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  await seedProduct(request, auth, 'Arepa Separada', 5000)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo Pedido' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox', { name: /Buscar producto/ }).fill('Arepa Separada')

  // Persona 1 pide una arepa, persona 2 pide dos.
  await dialog.getByText('Persona', { exact: true }).click()
  await dialog.getByText('Arepa Separada').first().click()
  await dialog.getByText('Persona', { exact: true }).click()
  await dialog.getByText('Arepa Separada').first().click()
  await dialog.getByText('Arepa Separada').first().click()

  await expect(dialog.getByText('P1')).toBeVisible()
  await expect(dialog.getByText('P2')).toBeVisible()
  await expect(dialog.getByText('Total: $15.000')).toBeVisible()
  await dialog.getByRole('button', { name: 'Crear Pedido' }).click()
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
  await page.goto('/pedidos')
  await page.locator('tr', { hasText: '$24.000' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Imprimir la factura al cobrar').uncheck()

  // La mesa separó la cuenta: el diálogo abre por persona.
  const persona1 = dialog.locator('.v-list-item', { hasText: 'Persona 1' })
  const persona2 = dialog.locator('.v-list-item', { hasText: 'Persona 2' })
  await expect(persona1).toContainText('$8.000')
  await expect(persona2).toContainText('$16.000')

  // Persona 1 deja propina: se sugiere el 10% y se puede cambiar.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(persona1.getByLabel('Propina')).toHaveValue('800')
  await persona1.getByLabel('Propina').fill('1000')
  await expect(persona1).toContainText('con propina $9.000')

  await persona1.getByRole('button', { name: 'Cobrar' }).click()
  await expect(page.getByText('Persona 1 pagó $9.000')).toBeVisible()
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
  await dialog.getByRole('button', { name: 'Cobrar sin propina' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.payment_status).toBe('paid')
  expect(current.total).toBe(25000)
  expect(current.tip).toBe(1000)
  expect(current.amount_paid).toBe(25000)
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
  await dialog.getByLabel('Imprimir la factura al cobrar').uncheck()
  await dialog.getByRole('button', { name: 'Todos juntos' }).click()
  await expect(dialog.getByText('Total sin propina:')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  const current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.payment_status).toBe('paid')
})
