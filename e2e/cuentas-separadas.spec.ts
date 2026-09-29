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

test('poner nombre a una persona con el lapicito', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  await seedProduct(request, auth, 'Empanada Nombre', 4000)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Nuevo Pedido' }).click()

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
  await dialog.getByRole('button', { name: 'Crear Pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  const orders = await request.get(`${API}/orders`, { headers: auth })
  const created = (await orders.json()).data.find((o: any) =>
    o.items?.some((i: any) => i.product_name === 'Empanada Nombre'),
  )
  expect(created.guest_names).toEqual({ '1': 'Vale' })
  expect(created.guests.map((g: any) => g.label)).toContain('Vale')
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

  // La propina no se cobra sola: el campo arranca en 0 y solo se muestra el
  // monto sugerido como referencia. La persona deja propina si el cajero la escribe.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(persona1.getByLabel('Propina')).toHaveValue('0')
  await expect(persona1).toContainText('sugerida 10%')
  await persona1.getByLabel('Propina').fill('1000')
  await expect(persona1).toContainText('con propina $9.000')

  await persona1.getByRole('button', { name: 'Cobrar con propina' }).click()
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

  await dialog.getByRole('button', { name: 'Cobrar sin propina' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

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
  await dialog.getByLabel('Imprimir la factura al cobrar').uncheck()
  // Aunque la sugerencia esté encendida, si el cajero no escribe propina el
  // botón es "Cobrar" (no "con propina") y no se cobra ninguna.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  const persona1 = dialog.locator('.v-list-item', { hasText: 'Persona 1' })
  await expect(persona1.getByLabel('Propina')).toHaveValue('0')
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
  await dialog.getByLabel('Imprimir la factura al cobrar').uncheck()
  await dialog.getByRole('button', { name: 'Todos juntos' }).click()
  await expect(dialog.getByText('Total sin propina:')).toBeVisible()
  await dialog.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  const current = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(current.payment_status).toBe('paid')
})
