import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { API, PLATFORM, apiLogin, displayDate, field, loginUI, sidebarItem } from './helpers'

/**
 * Facturación automática: un conjunto cobra la misma cuota cada mes. Se
 * factura a seleccionados, a todos o a uno (editando lo que cambia para esa
 * persona) y la cartera muestra valor, abonos y saldo por cliente.
 *
 * Patrón: empresa y clientes por API, verificación por la interfaz.
 */

// Enero de 2025 ya pasó: sus cuotas vencen el 10 y aparecen como vencidas.
const PERIOD = '2025-01'

interface Company {
  credentials: { email: string; password: string }
  token: string
}

async function createRecurringCompany(request: APIRequestContext, slug: string): Promise<Company> {
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const credentials = { email: `admin.${slug}.${Date.now()}@e2e.test`, password: 'conjunto2026' }

  const response = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: {
      name: `E2E ${slug} ${Date.now()}`,
      business_type: 'recurring',
      admin: { name: 'Administradora E2E', ...credentials },
    },
  })
  expect(response.status()).toBe(201)

  return { credentials, token: await apiLogin(request, credentials.email, credentials.password) }
}

async function createResident(
  request: APIRequestContext,
  token: string,
  data: { name: string; document_number: string; monthly_fee?: number; billing_concept?: string; billing_day?: number },
): Promise<number> {
  const response = await request.post(`${API}/customers`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      document_type: 'CC',
      city: 'Bogotá',
      recurring_active: true,
      monthly_fee: 250000,
      billing_day: 10,
      ...data,
    },
  })
  expect(response.status()).toBe(201)

  return (await response.json()).data.id
}

async function openPeriod(page: Page, period: string) {
  await sidebarItem(page, 'Facturación automática').click()
  await expect(page.getByRole('heading', { name: 'Facturación automática' })).toBeVisible()
  await field(page, 'Mes a facturar').locator('input').fill(period)
}

// Las pestañas inactivas siguen montadas: se busca solo en la visible.
const row = (page: Page, text: string) => page.locator('.v-window-item--active tbody tr', { hasText: text })

test('factura a los seleccionados editando a una persona y después a todos', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'pinos')
  await createResident(request, company.token, { name: 'Ana Apto 101', document_number: '1001' })
  await createResident(request, company.token, { name: 'Beto Apto 102', document_number: '1002' })
  await createResident(request, company.token, {
    name: 'Carla Parqueadero 7',
    document_number: '1003',
    monthly_fee: 180000,
    billing_concept: 'Cuota parqueadero',
  })

  await loginUI(page, company.credentials.email, company.credentials.password)

  // Un conjunto no ve pedidos ni mesas: solo lo suyo.
  await expect(sidebarItem(page, 'Pedidos')).toHaveCount(0)
  await openPeriod(page, PERIOD)

  await expect(row(page, 'Ana Apto 101')).toContainText('Cuota de administración')
  await expect(row(page, 'Ana Apto 101')).toContainText('$250.000')
  await expect(row(page, 'Ana Apto 101')).toContainText('10 de ene de 2025')
  await expect(row(page, 'Carla Parqueadero 7')).toContainText('Cuota parqueadero')
  await expect(page.locator('.v-card', { hasText: 'Valor por facturar' })).toContainText('$680.000')

  // Beto ahora es arrendatario y paga también parqueadero: se edita solo su factura.
  await page.getByRole('button', { name: 'Editar y facturar a Beto Apto 102' }).click()
  const dialog = page.getByRole('dialog')
  await field(page, 'Nombre en la factura').locator('input').fill('Beto Pérez (arrendatario)')
  await field(page, 'Concepto').locator('input').fill('Administración + parqueadero')
  await field(page, 'Valor unitario').locator('input').fill('310000')
  await expect(dialog).toContainText('Total $310.000')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()

  await expect(row(page, 'Beto Pérez (arrendatario)')).toContainText('Editado')
  await expect(row(page, 'Beto Pérez (arrendatario)')).toContainText('$310.000')

  // Guardar la edición lo deja seleccionado; se suma a Ana.
  await row(page, 'Ana Apto 101').locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Facturar seleccionados (2)' }).click()
  await expect(page.getByRole('dialog')).toContainText('Se van a generar 2 documentos por $560.000')
  await page.getByRole('dialog').getByRole('button', { name: 'Generar' }).click()

  await expect(page.getByText('Se generaron 2 documentos')).toBeVisible()
  await expect(row(page, 'Ana Apto 101')).toContainText('CC-1 · Por pagar')
  await expect(row(page, 'Beto Apto 102')).toContainText('CC-2 · Por pagar')

  // "A todos" ya solo incluye a quien falta.
  await page.getByRole('button', { name: 'Facturar a todos (1)' }).click()
  await expect(page.getByRole('dialog')).toContainText('Se va a generar 1 documento por $180.000')
  await page.getByRole('dialog').getByRole('button', { name: 'Generar' }).click()

  await expect(page.getByText('Se generó 1 documento')).toBeVisible()
  await expect(row(page, 'Carla Parqueadero 7')).toContainText('CC-3 · Por pagar')
  await expect(page.getByRole('button', { name: 'Facturar a todos (0)' })).toBeDisabled()

  // La factura de Beto guardó lo editado; su ficha de cliente quedó igual.
  const invoices = await (
    await request.get(`${API}/recurring-billing/invoices?period=${PERIOD}`, {
      headers: { Authorization: `Bearer ${company.token}` },
    })
  ).json()
  const beto = invoices.data.invoices.find((i: any) => i.document_number === 'CC-2')
  expect(beto.customer_name).toBe('Beto Pérez (arrendatario)')
  expect(beto.concept).toBe('Administración + parqueadero')
  expect(beto.total).toBe(310000)
})

test('la cartera muestra el saldo por cliente y registra abonos hasta pagar', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'cartera')
  const ana = await createResident(request, company.token, { name: 'Ana Apto 101', document_number: '1001' })
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: { Authorization: `Bearer ${company.token}` },
    data: { period: PERIOD, items: [{ customer_id: ana }] },
  })
  expect(generated.status()).toBe(201)

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  await page.getByRole('tab', { name: /Cartera/ }).click()

  await expect(page.locator('.v-card', { hasText: 'Saldo por cobrar' })).toContainText('$250.000')
  await expect(page.locator('.v-card', { hasText: 'Vencido' }).first()).toContainText('$250.000')

  const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })
  await expect(panel).toContainText('Saldo $250.000')
  await expect(panel).toContainText('Vencido $250.000')
  await panel.locator('.v-expansion-panel-title').click()

  const document = panel.locator('tbody tr', { hasText: 'CC-1' })
  await expect(document).toContainText('Cuenta de cobro')
  await expect(document).toContainText('Vencida')
  await expect(document).toContainText('Por pagar')

  // Abono parcial.
  await document.getByRole('button', { name: 'Abonar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('CC-1 · Ana Apto 101')
  await field(page, 'Valor del abono').locator('input').fill('100000')
  await field(page, 'Método de pago').click()
  await page.getByRole('option', { name: 'Transferencia' }).click()
  await dialog.getByRole('button', { name: 'Registrar abono' }).click()

  await expect(page.getByText('Abono registrado exitosamente')).toBeVisible()
  await expect(dialog.locator('tbody tr', { hasText: 'Transferencia' })).toContainText('$100.000')
  await expect(dialog).toContainText('$150.000')
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  await expect(panel).toContainText('Saldo $150.000')
  await expect(document).toContainText('Abonada')

  // El resto: queda pagada y sale de la cartera pendiente.
  await document.getByRole('button', { name: 'Abonar' }).click()
  await expect(field(page, 'Valor del abono').locator('input')).toHaveValue('150000')
  await dialog.getByRole('button', { name: 'Registrar abono' }).click()
  await expect(page.getByText('Abono registrado: el documento quedó pagado')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  await expect(page.getByText('Nadie tiene saldo pendiente.')).toBeVisible()

  await page.getByLabel('Incluir documentos pagados').check()
  await expect(page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })).toContainText('Saldo $0')
})

test('crea un cliente con su cuota y le factura solo a él', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'individual')

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  await expect(page.getByText('Aún no hay clientes con cobro automático.')).toBeVisible()

  await page.getByRole('tab', { name: /Clientes/ }).click()
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()

  const dialog = page.getByRole('dialog')
  await field(page, 'NIT / Número de documento *').locator('input').fill('900123456')
  await field(page, 'Nombre *').locator('input').fill('Local 3 - Panadería')
  await field(page, 'Ciudad').locator('input').fill('Medellín')

  // Con el cobro automático encendido la cuota es obligatoria.
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toContainText('Escribe la cuota mensual para incluirlo en la facturación automática')

  await field(page, 'Cuota mensual *').locator('input').fill('95000')
  await field(page, 'Día de corte (vence)').locator('input').fill('15')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  const cliente = row(page, 'Local 3 - Panadería')
  await expect(cliente).toContainText('$95.000')
  await expect(cliente).toContainText('Día 15')
  await expect(cliente).toContainText('Activo')

  await page.getByRole('tab', { name: /Facturar/ }).click()
  await field(page, 'Mes a facturar').locator('input').fill(PERIOD)
  await expect(row(page, 'Local 3 - Panadería')).toContainText('15 de ene de 2025')

  await page.getByRole('button', { name: 'Editar y facturar a Local 3 - Panadería' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Facturar solo a esta persona' }).click()

  await expect(page.getByText('Se generó 1 documento')).toBeVisible()
  await expect(row(page, 'Local 3 - Panadería')).toContainText('CC-1 · Por pagar')
})

test('capturas de facturación y cartera en escritorio y en pantalla angosta', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'capturas')
  const ids = []
  for (const [n, name] of ['Ana Apto 101', 'Beto Apto 102', 'Carla Apto 103'].entries()) {
    ids.push(await createResident(request, company.token, { name, document_number: `10${n}` }))
  }
  await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: { Authorization: `Bearer ${company.token}` },
    data: { period: PERIOD, items: [{ customer_id: ids[0] }] },
  })

  await loginUI(page, company.credentials.email, company.credentials.password)

  for (const [name, viewport] of [
    ['desktop', { width: 1440, height: 900 }],
    ['narrow', { width: 820, height: 1000 }],
  ] as const) {
    await page.setViewportSize(viewport)
    await page.goto('/facturacion-automatica')
    await field(page, 'Mes a facturar').locator('input').fill(PERIOD)
    await expect(row(page, 'Ana Apto 101')).toContainText('CC-1')
    await page.screenshot({ path: `../screenshots/facturacion-automatica-${name}.png`, fullPage: true })

    await page.getByRole('tab', { name: /Cartera/ }).click()
    const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })
    await panel.locator('.v-expansion-panel-title').click()
    await expect(panel.locator('tbody tr', { hasText: 'CC-1' })).toBeVisible()
    // El panel se abre con una transición: la captura espera a que termine.
    await page.waitForTimeout(400)
    await page.screenshot({ path: `../screenshots/cartera-${name}.png`, fullPage: true })
  }
})

/** Día del mes de hoy en Bogotá (la config de Playwright fija esa zona). */
const todayLocal = () => new Date().toLocaleDateString('en-CA')

test('el día a facturar marca a quienes tienen el corte ese día', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'corte')
  const today = todayLocal()
  const day = Number(today.slice(8, 10))
  const otherDay = day === 10 ? 12 : 10
  await createResident(request, company.token, { name: 'Ana Corte Hoy', document_number: '2001', billing_day: day })
  await createResident(request, company.token, { name: 'Beto Corte Otro', document_number: '2002', billing_day: otherDay })

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()

  // Por defecto el día a facturar es hoy y queda marcado quien corta hoy.
  await expect(field(page, 'Día a facturar').locator('input')).toHaveValue(displayDate(today))
  await expect(row(page, 'Ana Corte Hoy').locator('input[type="checkbox"]')).toBeChecked()
  await expect(row(page, 'Beto Corte Otro').locator('input[type="checkbox"]')).not.toBeChecked()
  await expect(page.getByText(/Quedó marcado 1 cliente con corte el/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Facturar seleccionados (1)' })).toBeEnabled()

  // Otro día del mismo mes: la selección cambia sola.
  const other = `${today.slice(0, 8)}${String(otherDay).padStart(2, '0')}`
  await field(page, 'Día a facturar').locator('input').fill(other)
  await expect(row(page, 'Beto Corte Otro').locator('input[type="checkbox"]')).toBeChecked()
  await expect(row(page, 'Ana Corte Hoy').locator('input[type="checkbox"]')).not.toBeChecked()

  // El mes a facturar sigue al día elegido.
  await field(page, 'Día a facturar').locator('input').fill('2025-03-05')
  await expect(field(page, 'Mes a facturar').locator('input')).toHaveValue('marzo de 2025')
  await expect(page.getByText(/Nadie tiene su corte el/)).toBeVisible()
})

test('un abono al cliente paga lo más viejo primero e imprime su recibo de caja', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'recibo')
  const ana = await createResident(request, company.token, { name: 'Ana Recibo', document_number: '3001' })
  for (const period of ['2025-01', '2025-02']) {
    const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
      headers: { Authorization: `Bearer ${company.token}` },
      data: { period, items: [{ customer_id: ana }] },
    })
    expect(generated.status()).toBe(201)
  }

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  await page.getByRole('tab', { name: /Cartera/ }).click()

  const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Recibo' })
  await panel.getByRole('button', { name: 'Registrar abono', exact: true }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Abono de Ana Recibo' })
  await expect(dialog).toContainText('Debe $500.000')
  await field(page, 'Valor del abono').locator('input').fill('300000')
  // Vista previa: enero se paga completo y febrero recibe el resto.
  await expect(dialog.locator('tbody tr').nth(0)).toContainText('$250.000')
  await expect(dialog.locator('tbody tr').nth(0).locator('td').last()).toHaveText('$250.000')
  await expect(dialog.locator('tbody tr').nth(1).locator('td').last()).toHaveText('$50.000')
  await dialog.getByRole('button', { name: 'Registrar abono' }).click()

  await expect(dialog).toContainText('Abono registrado en el recibo de caja RC-1 por $300.000')
  await expect(panel).toContainText('Saldo $200.000')

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Imprimir recibo RC-1' }).click(),
  ])
  await expect(popup.locator('body')).toContainText('RECIBO DE CAJA')
  await expect(popup.locator('.doc-number')).toContainText('RC-1')
  await expect(popup.locator('body')).toContainText('RECIBIMOS DE: Ana Recibo')
  await expect(popup.locator('body')).toContainText('TRESCIENTOS MIL PESOS M/CTE ($300.000)')
  await expect(popup.locator('tbody tr').nth(0)).toContainText('Abono a cuenta de cobro CC-1')
  await expect(popup.locator('tbody tr').nth(1)).toContainText('$200.000')
  await popup.setViewportSize({ width: 900, height: 1100 })
  await popup.screenshot({ path: '../screenshots/recibo-de-caja.png', fullPage: true })
})

test('la cuenta de cobro sale con el encabezado del negocio y el valor en letras', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'formato')
  const auth = { Authorization: `Bearer ${company.token}` }
  const business = await request.put(`${API}/invoicing/business`, {
    headers: auth,
    data: {
      legal_name: 'Mauricio Obando Castrillón',
      nit: `75.068.382-${Date.now() % 10000}`,
      tax_regime: 'simplified',
      address: 'Quintas de Aragón M9 CS9',
      city: 'Dosquebradas',
      department: 'Risaralda',
      phone: '3159276091 - 3001571023',
      document_notes: 'Favor consignar en Cta ahorros 37342931449 Bancolombia a Mauricio Obando',
    },
  })
  expect(business.ok()).toBeTruthy()
  const client = await createResident(request, company.token, {
    name: 'Agregados del Valle de Toledo SAS',
    document_number: '901243990',
    monthly_fee: 70000,
    billing_concept: 'Asistencia técnica sistema Visión',
  })
  await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, items: [{ customer_id: client }] },
  })

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  // Con los datos del negocio completos no se muestra el aviso.
  await expect(page.getByText('Tus facturas y recibos salen solo con el nombre de la empresa.')).toHaveCount(0)
  await field(page, 'Mes a facturar').locator('input').fill(PERIOD)

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    row(page, 'Agregados del Valle de Toledo SAS').getByRole('button', { name: 'Imprimir CC-1' }).click(),
  ])
  const body = popup.locator('body')
  await expect(body).toContainText('Mauricio Obando Castrillón')
  await expect(body).toContainText('NO RESPONSABLE DE IVA')
  await expect(body).toContainText('TELÉFONO: 3159276091 - 3001571023 DOSQUEBRADAS - RISARALDA')
  await expect(popup.locator('.doc-number')).toContainText('CUENTA DE COBRO')
  await expect(popup.locator('.doc-number')).toContainText('CC-1')
  await expect(body).toContainText('NOMBRE: Agregados del Valle de Toledo SAS')
  await expect(body).toContainText('ASISTENCIA TÉCNICA SISTEMA VISIÓN')
  await expect(body).toContainText('SON: SETENTA MIL PESOS M/CTE')
  await expect(body).toContainText('Favor consignar en Cta ahorros 37342931449 Bancolombia')
  await expect(body).toContainText('FIRMA VENDEDOR')
  await popup.setViewportSize({ width: 900, height: 1100 })
  await popup.screenshot({ path: '../screenshots/cuenta-de-cobro.png', fullPage: true })
  await popup.close()

  // Todos los del mes en una sola ventana, uno por hoja.
  const other = await createResident(request, company.token, { name: 'Segundo Cliente SAS', document_number: '901000001' })
  await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, items: [{ customer_id: other }] },
  })
  await page.reload()
  await field(page, 'Mes a facturar').locator('input').fill(PERIOD)
  const printAll = page.getByRole('button', { name: 'Imprimir los del mes (2)' })
  await expect(printAll).toBeEnabled()
  const [batch] = await Promise.all([page.waitForEvent('popup'), printAll.click()])
  await expect(batch.locator('section.document')).toHaveCount(2)
  await expect(batch.locator('section.document').nth(1)).toContainText('Segundo Cliente SAS')
})

test('el valor en letras cubre los casos de la plata colombiana', async ({ page }) => {
  await page.goto('/login')
  const words = await page.evaluate(async () => {
    const { amountInWords } = await import('/src/utils/printDocuments.ts')
    return [1, 21, 100, 101, 250000, 1000000, 1521101, 2000000, 21000000].map(amountInWords)
  })
  expect(words).toEqual([
    'UN PESO M/CTE',
    'VEINTIÚN PESOS M/CTE',
    'CIEN PESOS M/CTE',
    'CIENTO UN PESOS M/CTE',
    'DOSCIENTOS CINCUENTA MIL PESOS M/CTE',
    'UN MILLÓN DE PESOS M/CTE',
    'UN MILLÓN QUINIENTOS VEINTIÚN MIL CIENTO UN PESOS M/CTE',
    'DOS MILLONES DE PESOS M/CTE',
    'VEINTIÚN MILLONES DE PESOS M/CTE',
  ])
})

test('el admin edita los datos del negocio que van en los documentos', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'datos')
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/configuracion')

  await expect(page.getByText('Faltan datos')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar datos del negocio' }).click()
  await expect(page.getByText('Este campo es obligatorio').first()).toBeVisible()

  await field(page, 'Nombre o razón social *').locator('input').fill('Conjunto Los Pinos PH')
  await field(page, 'NIT o documento *').locator('input').fill(`900${Date.now() % 1000000}-1`)
  await field(page, 'Teléfonos *').locator('input').fill('6011234567 - 3000000000')
  await field(page, 'Dirección *').locator('input').fill('Calle 10 # 20-30')
  await field(page, 'Ciudad').locator('input').fill('Pereira')
  await field(page, 'Observaciones de los documentos').locator('textarea').first().fill('Consignar en Cta corriente 123 Davivienda')
  await page.getByRole('button', { name: 'Guardar datos del negocio' }).click()

  await expect(page.getByText('Datos del negocio guardados')).toBeVisible()
  await expect(page.getByText('Completo', { exact: true })).toBeVisible()

  const saved = await (await request.get(`${API}/invoicing/business`, {
    headers: { Authorization: `Bearer ${company.token}` },
  })).json()
  expect(saved.data.legal_name).toBe('Conjunto Los Pinos PH')
  expect(saved.data.document_notes).toBe('Consignar en Cta corriente 123 Davivienda')
})
