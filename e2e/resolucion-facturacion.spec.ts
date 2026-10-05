import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, field, freezeTime, loginUI } from './helpers'

/**
 * Resolución de facturación DIAN: el admin registra el rango autorizado como
 * se escribe en Colombia ("1.000" es mil), cada venta toma el siguiente
 * consecutivo y el número es el prefijo tal cual lo escribió seguido del
 * consecutivo, sin guion: así sale en Ventas y como referencia en el kardex.
 */
test('la resolución numera las ventas tal cual y el consecutivo aparece en Ventas y en el kardex', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  // --- El admin registra la resolución por interfaz ---
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/configuracion')

  // El número de la resolución es texto: largo y con ceros a la izquierda.
  const resolutionNumber = page.getByLabel('Número de resolución *')
  await resolutionNumber.fill('018760001234567')
  await page.getByLabel('Prefijo').fill('POS')

  // Los rangos son texto con teclado numérico (sin flechas) y leen el punto de miles.
  const from = field(page, 'Rango desde *').locator('input')
  const to = field(page, 'Rango hasta *').locator('input')
  const start = field(page, 'La numeración empieza en').locator('input')
  await expect(from).not.toHaveAttribute('type', 'number')
  await expect(from).toHaveAttribute('inputmode', 'numeric')
  await from.fill('1.000')

  // Un fin antes del inicio no se guarda.
  await to.fill('500')
  await page.getByRole('button', { name: /Guardar resolución/ }).click()
  await expect(page.getByText('El fin del rango debe ser mayor o igual al inicio.')).toBeVisible()
  await expect(page.getByText('Resolución guardada')).toHaveCount(0)

  await to.fill('100.000')
  // La numeración puede empezar por encima del inicio del rango.
  await start.fill('1.001')
  // Vigencia por meses desde la fecha de la resolución.
  await page.getByLabel('Fecha de la resolución').fill('2026-01-15')
  await page.getByRole('button', { name: 'Por meses' }).click()
  await page.getByLabel('Meses de vigencia').fill('48')
  await expect(page.getByText('Vence el 2030-01-15')).toBeVisible()
  await page.getByRole('button', { name: /Guardar resolución/ }).click()
  await expect(page.getByText('Resolución guardada')).toBeVisible()
  await expect(page.getByText(/Quedan \d+ consecutivos/)).toBeVisible()

  const saved = (await (await request.get(`${API}/invoicing/resolution`, { headers: auth })).json()).data
  expect(saved.invoicing_resolution).toBe('018760001234567')
  expect(saved.range_from).toBe(1000)
  expect(saved.range_to).toBe(100000)
  expect(saved.current_sequence).toBe(1001)

  // Al volver, cada campo muestra lo guardado con sus puntos, y el próximo
  // número se lee como saldrá: el prefijo pegado al consecutivo.
  await page.reload()
  await expect(resolutionNumber).toHaveValue('018760001234567')
  await expect(from).toHaveValue('1.000')
  await expect(to).toHaveValue('100.000')
  await expect(start).toHaveValue('1.001')
  const nextNumber = page.locator('.v-alert', { hasText: 'Próximo consecutivo' })
  await expect(nextNumber.locator('strong')).toHaveText('POS1001')

  // La tarjeta entera, sin la barra fija encima; el aviso de vigencia cambia
  // con una transición al cargar, así que la captura espera a que termine.
  const card = page.locator('.v-card', { hasText: 'Resolución de facturación (DIAN)' })
  const shootCard = async (path: string) => {
    await expect(page.getByText('Vence el 2030-01-15')).toBeVisible()
    await page.waitForTimeout(400)
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = await card.boundingBox()
    await page.screenshot({ path, fullPage: true, clip: box! })
  }
  await shootCard('../screenshots/resolucion-configuracion-1440.png')
  await page.setViewportSize({ width: 390, height: 844 })
  await shootCard('../screenshots/resolucion-configuracion-390.png')
  await page.setViewportSize({ width: 1440, height: 900 })

  // --- Una venta toma el consecutivo (preparada por API) ---
  const productName = `Gaseosa Resolución ${Date.now()}`
  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: `Resolución E2E ${Date.now()}` },
  })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: productName,
      type: 'final',
      unit: 'unidad',
      unit_cost: 2000,
      sale_price: 5000,
      current_stock: 10,
      tracks_stock: true,
      category_id: (await category.json()).data.id,
    },
  })
  expect(product.status()).toBe(201)

  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: {
      customer_name: 'Mesa Resolución',
      items: [{ product_id: (await product.json()).data.id, quantity: 1 }],
    },
  })
  expect(order.status()).toBe(201)
  const orderId = (await order.json()).data.id

  const payment = await request.post(`${API}/orders/${orderId}/pay`, {
    headers: auth,
    data: { payment_method: 'cash' },
  })
  expect(payment.ok()).toBeTruthy()

  const paidOrder = (await (await request.get(`${API}/orders/${orderId}`, { headers: auth })).json()).data
  expect(paidOrder.invoice_number).toBe('POS1001')

  // --- Ventas lo muestra como comprobante, tal cual ---
  await freezeTime(page, paidOrder.created_at)
  await page.goto('/ventas')
  await page.getByRole('textbox', { name: 'Buscar factura o cliente' }).fill('POS1001')
  await expect(page.getByRole('columnheader').first()).toHaveText('Comprobante')
  const sale = page.locator('tbody tr', { hasText: 'Mesa Resolución' })
  await expect(sale.locator('td').first()).toHaveText('POS1001')

  // --- El kardex muestra el consecutivo como referencia ---
  await page.goto('/kardex')
  await field(page, 'Producto').locator('input').fill(productName)
  await page.getByRole('option', { name: productName }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  const saleRow = page.locator('tr', { hasText: 'FV' }).first()
  await expect(saleRow).toBeVisible()
  await expect(saleRow).toContainText('POS1001')
  await expect(saleRow).not.toContainText('POS-1001')
})
