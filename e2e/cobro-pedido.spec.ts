import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Cobro desde la web: el botón "Cobrar" está en la fila, el diálogo ofrece
 * propina voluntaria (con y sin), y la venta queda con la propina sumada al
 * total. La factura se imprime al cobrar: aquí se apaga para no abrir
 * ventanas en el test.
 */
test('cobrar un pedido con propina desde el diálogo de cobro', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Cobro E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Sancocho E2E',
      type: 'final',
      unit: 'plato',
      sale_price: 20700,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Cobro E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  // La tabla ya no muestra el cliente: la fila se ubica por su total único.
  const row = page.locator('tr', { hasText: '$20.700' }).first()
  await row.getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Imprimir la factura al cobrar').uncheck()

  // Sin propina sugerida solo hay un total y un botón de confirmar.
  await expect(dialog.getByText('Total sin propina:')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Confirmar cobro' })).toBeVisible()

  // Con propina: se sugiere el 10% y se puede ajustar a mano.
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(dialog.getByLabel('Propina (opcional)')).toHaveValue('2070')
  await dialog.getByLabel('Propina (opcional)').fill('2000')
  await expect(dialog.getByText('$22.700')).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cobrar sin propina' })).toBeVisible()

  await dialog.getByRole('button', { name: 'Cobrar con propina' }).click()
  await expect(page.getByText('Pedido cobrado con propina')).toBeVisible()

  // La propina quedó en el pedido.
  const paid = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const data = (await paid.json()).data
  expect(data.tip).toBe(2000)
  expect(data.total).toBe(22700)
  expect(data.payment_status).toBe('paid')
})

test('cobrar sin propina deja el total tal cual', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Cobro sin propina E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Ajiaco E2E',
      type: 'final',
      unit: 'plato',
      sale_price: 18300,
      tracks_stock: false,
      category_id: categoryId,
    },
  })
  const productId = (await product.json()).data.id

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Sin Propina E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  await page.locator('tr', { hasText: '$18.300' }).first().getByRole('button', { name: 'Cobrar' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Imprimir la factura al cobrar').uncheck()
  await dialog.getByLabel('Sugerir propina voluntaria').check()
  await expect(dialog.getByText('Total con propina:')).toBeVisible()

  // El cliente no quiso dejar propina.
  await dialog.getByRole('button', { name: 'Cobrar sin propina' }).click()
  await expect(page.getByText('Pedido cobrado', { exact: true })).toBeVisible()

  const paid = await request.get(`${API}/orders/${orderId}`, { headers: auth })
  const data = (await paid.json()).data
  expect(data.tip).toBe(0)
  expect(data.total).toBe(18300)
  expect(data.payment_status).toBe('paid')
})

async function seedSimpleProduct(request: any, auth: any, name: string, price: number) {
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const categoryId = (await category.json()).data.id
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name, type: 'final', unit: 'und', sale_price: price, tracks_stock: false, category_id: categoryId },
  })
  return (await product.json()).data.id
}

test('un abono por monto es un anticipo, no una factura', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedSimpleProduct(request, auth, 'Bandeja Abono E2E', 30000)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Abono E2E', items: [{ product_id: productId, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  const row = page.locator('tr', { hasText: '$30.000' }).first()
  await row.locator('.mdi-dots-vertical').click()
  await page.getByText('Registrar pago parcial').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Total a pagar:')).toBeVisible()
  await dialog.getByRole('button', { name: 'Por monto' }).click()
  await dialog.getByLabel('Monto a pagar').fill('10000')
  // El anticipo se avisa como recibo de abono (no factura ni kardex).
  await expect(dialog.getByText('recibo de abono')).toBeVisible()
  await dialog.getByRole('button', { name: /Cobrar/ }).click()
  await expect(page.getByText('Abono registrado')).toBeVisible()

  // El abono no es una venta: no hay factura y el pedido sigue parcial.
  const afterAbono = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(afterAbono.payment_status).toBe('partial')
  expect(afterAbono.amount_paid).toBe(10000)
  const abono = afterAbono.payments.find((p: any) => p.kind === 'abono')
  expect(abono).toBeTruthy()
  expect(abono.invoice_number).toBeFalsy()

  // Reabrir muestra el historial con el abono y el saldo restante.
  await page.locator('tr', { hasText: '$30.000' }).first().locator('.mdi-dots-vertical').click()
  await page.getByText('Registrar pago parcial').click()
  await expect(dialog.getByText('Pagos registrados')).toBeVisible()
  await expect(dialog.getByText('Abono', { exact: true })).toBeVisible()
})

test('cobrar por productos emite una factura de venta parcial', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const productId = await seedSimpleProduct(request, auth, 'Cerveza Factura E2E', 6000)
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { customer_name: 'Mesa Factura E2E', items: [{ product_id: productId, quantity: 2 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')

  const row = page.locator('tr', { hasText: '$12.000' }).first()
  await row.locator('.mdi-dots-vertical').click()
  await page.getByText('Registrar pago parcial').click()

  const dialog = page.getByRole('dialog')
  // El modo "Por productos" anuncia que es una factura de venta parcial.
  await expect(dialog.getByText('factura de venta parcial')).toBeVisible()
  // Marcar selecciona las 2 unidades; se baja a 1 para dejar la cuenta abierta.
  await dialog.locator('.v-checkbox-btn').first().click()
  await dialog.getByRole('button', { name: 'Quitar una unidad del cobro' }).click()
  await dialog.getByRole('button', { name: /Cobrar/ }).click()
  await expect(page.getByText('Factura parcial registrada')).toBeVisible()

  // Es una venta con su secuencia #pedido-1 y descontó su parte.
  const afterSale = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(afterSale.payment_status).toBe('partial')
  const sale = afterSale.payments.find((p: any) => p.kind === 'sale')
  expect(sale).toBeTruthy()
  expect(sale.invoice_sequence).toBe(1)
  expect(sale.reference).toBe(`#${orderId}-1`)
})

/**
 * Apertura y cierre de caja: la caja arranca con una base, se cobra en
 * efectivo y por Nequi, y al cerrar el conteo muestra el faltante. El cierre
 * queda en Ventas › Cierres de caja.
 */
test('abrir la caja, cobrar en efectivo y por Nequi, y cerrarla con el conteo', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' }

  // Una caja que haya quedado abierta de otra prueba se cierra primero.
  const current = (await (await request.get(`${API}/cash-register/current`, { headers: auth })).json()).data
  if (current) await request.post(`${API}/cash-register/${current.id}/close`, { headers: auth, data: { counted_cash: 0 } })

  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Caja E2E ${Date.now()}` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Ajiaco Caja E2E', type: 'final', unit: 'plato', sale_price: 12345, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  const productId = (await product.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Abrir caja' }).click()
  await page.getByRole('dialog').getByLabel('Base en efectivo').fill('50000')
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir caja' }).click()
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.screenshot({ path: '../screenshots/pedidos-caja-abierta-1280.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.getByTestId('cash-open-chip')).toBeVisible()
  await page.screenshot({ path: '../screenshots/pedidos-caja-abierta-390.png' })
  await page.setViewportSize({ width: 1280, height: 720 })

  for (const method of ['cash', 'nequi']) {
    const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity: 1 }] } })
    const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, { headers: auth, data: { payment_method: method } })
    expect(paid.ok()).toBeTruthy()
  }

  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('tr', { hasText: 'Efectivo' })).toContainText('$12.345')
  await expect(dialog.locator('tr', { hasText: 'Nequi' })).toContainText('$12.345')
  // Base 50.000 + 12.345 en efectivo; Nequi no entra al cajón.
  await expect(dialog.getByTestId('cash-expected')).toHaveText('$62.345')

  await dialog.getByLabel('Efectivo contado').fill('61345')
  await expect(dialog.getByTestId('cash-difference')).toHaveText('Faltan $1.000')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/cierre-de-caja.png' })
  await dialog.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(page.getByText('Caja cerrada con un faltante de $1.000.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abrir caja' })).toBeVisible()

  await page.goto('/ventas')
  await page.getByRole('button', { name: 'Cierres de caja' }).click()
  const closing = page.locator('tbody tr', { hasText: 'Faltan $1.000' })
  await expect(closing).toContainText('$50.000')
  await expect(closing).toContainText('Nequi: $12.345')
  await expect(closing).toContainText('$62.345')
})
