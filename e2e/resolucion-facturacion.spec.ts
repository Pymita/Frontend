import { expect, test, type Page } from '@playwright/test'
import { ADMIN, API, PLATFORM, apiLogin, field, freezeTime, loginUI, sidebarItem } from './helpers'

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

/**
 * Una reimpresión nunca cambia: cada documento conserva la resolución con la
 * que se numeró. Con la resolución A se cobra una venta y se emite una
 * factura mensual; el admin registra la B y se emite una más de cada una. La
 * tirilla y la factura de las primeras siguen diciendo A; las nuevas, B. En
 * una empresa propia, para no mover la resolución del negocio sembrado.
 */
test('registrar una resolución nueva no cambia lo que ya se imprimió con la anterior', async ({ page, request }) => {
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const slug = `reimpresion-${Date.now()}`
  const credentials = { email: `admin.${slug}@e2e.test`, password: 'negocio2026' }
  const company = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `E2E ${slug}`, slug, business_type: 'other', admin: { name: 'Dueña Reimpresión', ...credentials } },
  })
  expect(company.status()).toBe(201)
  const auth = { Authorization: `Bearer ${await apiLogin(request, credentials.email, credentials.password)}` }
  const period = '2025-01'

  const registerResolution = async (data: Record<string, unknown>) => {
    const response = await request.put(`${API}/invoicing/resolution`, { headers: auth, data })
    expect(response.ok()).toBeTruthy()
  }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Bebidas' } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Limonada', type: 'final', unit: 'unidad', sale_price: 7311, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  expect(product.status()).toBe(201)
  const productId = (await product.json()).data.id
  const sell = async (quantity: number): Promise<string> => {
    const order = await request.post(`${API}/orders`, { headers: auth, data: { items: [{ product_id: productId, quantity }] } })
    expect(order.status()).toBe(201)
    const { id, created_at } = (await order.json()).data
    const paid = await request.post(`${API}/orders/${id}/pay`, { headers: auth, data: { payment_method: 'cash' } })
    expect(paid.ok()).toBeTruthy()
    return created_at
  }
  const bill = async (name: string, documentNumber: string): Promise<string> => {
    const customer = await request.post(`${API}/customers`, {
      headers: auth,
      data: { name, document_type: 'CC', document_number: documentNumber, recurring_active: true, monthly_fee: 250000, billing_day: 10 },
    })
    expect(customer.status()).toBe(201)
    const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
      headers: auth,
      data: { period, items: [{ customer_id: (await customer.json()).data.id }] },
    })
    expect(generated.status()).toBe(201)
    return (await generated.json()).data.created[0].document_number
  }

  await registerResolution({
    invoicing_resolution: '018764000000001',
    invoice_prefix: 'FE',
    range_from: 1,
    range_to: 100,
    resolution_date: '2026-01-15',
    valid_until: '2030-01-15',
  })
  const firstSaleAt = await sell(1)
  expect(await bill('Ana Resolución A', '7101')).toBe('FE2')

  await registerResolution({
    invoicing_resolution: '018764000000002',
    invoice_prefix: 'SETT',
    range_from: 5001,
    range_to: 9000,
    resolution_date: '2026-09-01',
    valid_until: '2032-09-01',
  })
  await sell(2)
  expect(await bill('Beto Resolución B', '7102')).toBe('SETT5002')

  await freezeTime(page, firstSaleAt)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, credentials.email, credentials.password)

  // Configuración sigue anunciando el próximo número de la resolución vigente.
  await page.goto('/configuracion')
  await expect(page.locator('.v-alert', { hasText: 'Próximo consecutivo' }).locator('strong')).toHaveText('SETT5003')

  // --- La tirilla POS de cada venta, reimpresa desde Pedidos ---
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pedidos del día' }).click()
  const printTicket = async (total: string): Promise<{ popup: Page; text: string }> => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('tbody tr', { hasText: total }).getByRole('button', { name: 'Factura' }).click(),
    ])
    await expect(popup.locator('body')).toContainText('FACTURA DE VENTA No.')
    return { popup, text: await popup.locator('body').innerText() }
  }

  const ticketA = await printTicket('$7.311')
  expect(ticketA.text).toContain('FACTURA DE VENTA No. FE1')
  expect(ticketA.text).toContain('Resol. DIAN 018764000000001 de 2026-01-15')
  expect(ticketA.text).toContain('Autoriza de FE1 a FE100')
  expect(ticketA.text).toContain('Vigencia 2026-01-15 hasta 2030-01-15')
  expect(ticketA.text).not.toContain('018764000000002')
  expect(ticketA.text).not.toContain('SETT')
  await ticketA.popup.screenshot({ path: '../screenshots/reimpresion-tirilla-resolucion-anterior.png', fullPage: true })
  await ticketA.popup.close()

  const ticketB = await printTicket('$14.622')
  expect(ticketB.text).toContain('FACTURA DE VENTA No. SETT5001')
  expect(ticketB.text).toContain('Resol. DIAN 018764000000002 de 2026-09-01')
  expect(ticketB.text).toContain('Autoriza de SETT5001 a SETT9000')
  expect(ticketB.text).toContain('Vigencia 2026-09-01 hasta 2032-09-01')
  await ticketB.popup.close()

  // --- La factura de venta mensual, reimpresa desde Facturación automática ---
  await sidebarItem(page, 'Facturación automática').click()
  await field(page, 'Mes a facturar').locator('input').fill(period)
  const printInvoice = async (customer: string, number: string): Promise<Page> => {
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.locator('.v-window-item--active tbody tr', { hasText: customer }).getByRole('button', { name: `Imprimir ${number}` }).click(),
    ])
    await expect(popup.locator('.doc-number .number')).toHaveText(number)
    return popup
  }

  const invoiceA = await printInvoice('Ana Resolución A', 'FE2')
  await expect(invoiceA.locator('.header .business .resolution')).toHaveText(
    'Resolución DIAN N.º 018764000000001 del 15/01/2026 · Rango FE1 a FE100 · Vigente hasta 15/01/2030',
  )
  await invoiceA.setViewportSize({ width: 1440, height: 900 })
  await invoiceA.screenshot({ path: '../screenshots/reimpresion-factura-resolucion-anterior-1440.png', fullPage: true })
  await invoiceA.close()

  const invoiceB = await printInvoice('Beto Resolución B', 'SETT5002')
  await expect(invoiceB.locator('.header .business .resolution')).toHaveText(
    'Resolución DIAN N.º 018764000000002 del 01/09/2026 · Rango SETT5001 a SETT9000 · Vigente hasta 01/09/2032',
  )
  await invoiceB.close()
})
