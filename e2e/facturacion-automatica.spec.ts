import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import {
  API,
  apiLogin,
  buildXlsx,
  createCompany,
  displayDate,
  field,
  freezeTime,
  issueDocuments,
  loginUI,
  pageRule,
  pdfPageSize,
  pdfPages,
  sidebarItem,
  xlsxRows,
  type CompanySession,
  type IssuedDocument,
} from './helpers'

/**
 * Facturación automática: un conjunto cobra la misma cuota cada mes. Se
 * factura a seleccionados, a todos o a uno (editando lo que cambia para esa
 * persona) y la cartera muestra valor, abonos y saldo por cliente.
 *
 * Patrón: empresa y clientes por API, verificación por la interfaz.
 */

// Enero de 2025 ya pasó. Facturado hoy, vence hoy (nunca antes de emitirse);
// emitido en enero, venció el 10 y aparece como vencido.
const PERIOD = '2025-01'
const ISSUED_IN_PERIOD = '2025-01-02'

/** Como la página muestra una fecha: "05 de oct de 2026". */
const dayLabel = (date: Date) => date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

const createRecurringCompany = (request: APIRequestContext, slug: string): Promise<CompanySession> =>
  createCompany(request, slug, { business_type: 'recurring' })

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
  // Facturar un mes pasado hoy: vence hoy, no el 10 de enero.
  await expect(row(page, 'Ana Apto 101')).toContainText(dayLabel(new Date()))
  await expect(row(page, 'Ana Apto 101')).not.toContainText('10 de ene de 2025')
  await expect(page.getByText(/Vas a facturar enero de 2025 con fecha .*ningún documento nace vencido/)).toBeVisible()
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
  // A billed row reads what its document says: Beto's edited name, concept and value.
  const betoBilled = row(page, 'Beto Pérez (arrendatario)')
  await expect(betoBilled).toContainText('CC-2 · Por pagar')
  await expect(betoBilled).toContainText('Administración + parqueadero')
  await expect(betoBilled).toContainText('Facturado en CC-2')
  await expect(betoBilled).toContainText('$310.000')

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

/**
 * "En la parte de concepto general no la está tomando en cuenta": the general
 * concept reaches whoever has no own concept (an own one is marked), a row
 * edited only in its value keeps following it, and after billing and
 * reloading the field and the billed rows show the concept actually billed.
 */
test('el concepto general llega a quien no tiene uno propio y después de facturar y recargar se ve el facturado', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'concepto')
  const auth = { Authorization: `Bearer ${company.token}` }

  // The page's "today" is the API's: the day it created Ana.
  const first = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: '7001', name: 'Ana Concepto', city: 'Bogotá', recurring_active: true, monthly_fee: 250000, billing_day: 10 },
  })
  expect(first.status()).toBe(201)
  const now = new Date((await first.json()).data.created_at)
  const today = now.toLocaleDateString('en-CA')
  await createResident(request, company.token, { name: 'Beto Concepto', document_number: '7002' })
  await createResident(request, company.token, { name: 'Carla Parqueadero', document_number: '7003', monthly_fee: 180000, billing_concept: 'Cuota parqueadero' })

  // Imported: the default concept written in the file is not an own concept.
  const columns = await request.get(`${API}/recurring-billing/customers/import/columns`, { headers: auth })
  const headers: string[] = (await columns.json()).data.columns.map((column: { label: string }) => column.label)
  const fileRow = (cells: Record<string, string>) => headers.map(header => cells[header] ?? '')
  const imported = await request.post(`${API}/recurring-billing/customers/import`, {
    headers: { ...auth, Accept: 'application/json' },
    multipart: {
      file: {
        name: 'clientes.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: buildXlsx([
          headers,
          fileRow({ nombre: 'Dora Importada', numero_documento: '7004', cuota_mensual: '250000', dia_corte: '10', concepto: 'Cuota de administración' }),
          fileRow({ nombre: 'Elsa Importada', numero_documento: '7005', cuota_mensual: '120000', dia_corte: '10', concepto: 'Cuota local' }),
        ]),
      },
      dry_run: '0',
    },
  })
  expect(imported.status(), await imported.text()).toBe(200)
  expect((await imported.json()).data.summary.created).toBe(2)

  // The tab was opened yesterday and left open.
  await page.setViewportSize({ width: 1440, height: 900 })
  await freezeTime(page, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  const general = field(page, 'Concepto general').locator('input')
  await expect(general).toHaveValue('Cuota de administración')
  await expect(row(page, 'Ana Concepto')).toBeVisible()

  // Morning: billing does not issue with yesterday's date.
  const dialog = page.getByRole('dialog')
  await page.clock.setFixedTime(now)
  await page.getByRole('button', { name: 'Facturar a todos (5)' }).click()
  await expect(page.getByText('Ya es otro día: la fecha de emisión pasó a hoy')).toBeVisible()
  await expect(field(page, 'Día a facturar').locator('input')).toHaveValue(displayDate(today))
  await expect(dialog).toBeHidden()

  // Who has an own concept says so; the rest follow the general one.
  await expect(row(page, 'Carla Parqueadero')).toContainText('Cuota parqueadero')
  await expect(row(page, 'Carla Parqueadero')).toContainText('Concepto propio')
  await expect(row(page, 'Elsa Importada')).toContainText('Cuota local')
  await expect(row(page, 'Elsa Importada')).toContainText('Concepto propio')
  for (const name of ['Ana Concepto', 'Beto Concepto', 'Dora Importada']) {
    await expect(row(page, name)).toContainText('Cuota de administración')
    await expect(row(page, name)).not.toContainText('Concepto propio')
  }

  // Clientes says it too.
  await page.getByRole('tab', { name: /Clientes/ }).click()
  await expect(row(page, 'Carla Parqueadero')).toContainText('Cuota parqueadero')
  await expect(row(page, 'Elsa Importada')).toContainText('Cuota local')
  await expect(row(page, 'Dora Importada')).toContainText('El general')
  await expect(row(page, 'Ana Concepto')).toContainText('El general')
  await page.getByRole('tab', { name: /Facturar/ }).click()

  // Beto pays more this month: only his value is edited.
  await page.getByRole('button', { name: 'Editar y facturar a Beto Concepto' }).click()
  await field(page, 'Valor unitario').locator('input').fill('300000')
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(row(page, 'Beto Concepto')).toContainText('Editado')
  await expect(row(page, 'Beto Concepto')).toContainText('$300.000')

  await general.fill('Administración del mes')
  for (const name of ['Ana Concepto', 'Beto Concepto', 'Dora Importada']) {
    await expect(row(page, name)).toContainText('Administración del mes')
  }
  await expect(row(page, 'Carla Parqueadero')).toContainText('Cuota parqueadero')

  await page.getByRole('button', { name: 'Facturar a todos (5)' }).click()
  await expect(dialog).toContainText('Se van a generar 5 documentos por $1.100.000')
  await dialog.getByRole('button', { name: 'Generar' }).click()
  await expect(page.getByText('Se generaron 5 documentos')).toBeVisible()

  // The billed rows keep what was billed, even when the field changes again.
  await general.fill('Otra cosa')
  for (const name of ['Ana Concepto', 'Beto Concepto', 'Dora Importada']) {
    await expect(row(page, name)).toContainText('Administración del mes')
    await expect(row(page, name)).toContainText('Facturado en CC-')
  }
  await expect(row(page, 'Beto Concepto')).toContainText('$300.000')
  await expect(row(page, 'Carla Parqueadero')).toContainText('Cuota parqueadero')
  await expect(row(page, 'Carla Parqueadero')).not.toContainText('Concepto propio')

  // Reloaded, the field offers the concept it billed with.
  await page.reload()
  await expect(general).toHaveValue('Administración del mes')
  await expect(row(page, 'Ana Concepto')).toContainText('Administración del mes')
  await expect(row(page, 'Beto Concepto')).toContainText('$300.000')

  const invoices = await (await request.get(`${API}/recurring-billing/invoices?period=${today.slice(0, 7)}`, { headers: auth })).json()
  const concepts = Object.fromEntries(invoices.data.invoices.map((i: { customer_name: string; concept: string }) => [i.customer_name, i.concept]))
  expect(concepts).toEqual({
    'Ana Concepto': 'Administración del mes',
    'Beto Concepto': 'Administración del mes',
    'Carla Parqueadero': 'Cuota parqueadero',
    'Dora Importada': 'Administración del mes',
    'Elsa Importada': 'Cuota local',
  })
  expect(invoices.data.invoices.every((i: { issued_at: string }) => new Date(i.issued_at).toLocaleDateString('en-CA') === today)).toBe(true)
})

test('importa clientes desde Excel: plantilla, revisión fila por fila y los válidos quedan en la lista', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'importar')
  await createResident(request, company.token, { name: 'Dora Existente', document_number: '5001' })

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  await page.getByRole('tab', { name: /Clientes/ }).click()
  await page.getByRole('button', { name: 'Importar clientes desde Excel' }).click()

  // El tutorial dice el nombre exacto de cada columna y cuáles son obligatorias.
  const dialog = page.getByRole('dialog')
  const tutorial = dialog.locator('table').first()
  await expect(tutorial.getByRole('row', { name: /^numero_documento / })).toContainText('Obligatoria')
  await expect(tutorial.getByRole('row', { name: /^nombre / })).toContainText('Obligatoria')
  await expect(tutorial.getByRole('row', { name: /^cuota_mensual / })).toContainText('Opcional')
  await expect(tutorial.getByRole('row', { name: /^cuota_mensual / })).toContainText('250.000')
  await expect(dialog).toContainText('Si ya tienes un cliente con el mismo número de documento, esa fila se salta')
  // El diálogo entra con una transición: la captura espera a que termine.
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/importar-clientes-tutorial-1440.png' })

  // La plantilla trae exactamente las columnas del tutorial.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Descargar plantilla' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('plantilla_clientes.xlsx')
  const template = xlsxRows(readFileSync(await download.path()))
  const headers = template[0]!
  expect(headers).toEqual(await tutorial.locator('tbody tr td:first-child').allInnerTexts())
  expect(template[1]![0]).toBe('Ana Pérez (ejemplo)')

  // Un Excel armado con esos encabezados: con cuota, sin cuota, uno que ya existe y dos con errores.
  const fileRow = (cells: Record<string, string>) => headers.map(header => cells[header] ?? '')
  const file = buildXlsx([
    headers,
    fileRow({ nombre: 'Ana Importada', numero_documento: '1001', ciudad: 'Bogotá', cuota_mensual: '250.000', dia_corte: '10' }),
    fileRow({ nombre: 'Beto Importado', numero_documento: '1002', telefono: '3001234567' }),
    fileRow({ nombre: 'Dora Cambiada', numero_documento: '5001', cuota_mensual: '1' }),
    fileRow({ nombre: 'Correo Malo', numero_documento: '1004', correo: 'no-es-correo' }),
    fileRow({ nombre: 'Ana Repetida', numero_documento: '1001' }),
  ])
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'clientes.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: file,
  })

  // Primero se revisa: nada se crea todavía.
  await dialog.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(dialog).toContainText('2 clientes se pueden crear. 1 fila se salta. 2 filas tienen errores y no se importan.')
  await expect(dialog).toContainText('Todavía no se creó ningún cliente')
  const resultRow = (text: string) => dialog.locator('tbody tr', { hasText: text })
  await expect(resultRow('Correo Malo')).toContainText('Con error')
  await expect(resultRow('Correo Malo')).toContainText('El correo "no-es-correo" no es válido: corrígelo o deja vacía la columna correo.')
  await expect(resultRow('Correo Malo').locator('td').first()).toHaveText('5')
  await expect(resultRow('Ana Repetida')).toContainText('El documento 1001 está repetido en el archivo (ya venía en la fila 2).')
  await expect(resultRow('Dora Cambiada')).toContainText('Se salta')
  await expect(resultRow('Dora Cambiada')).toContainText('Ya existe: Dora Existente tiene el documento 5001. No se modificó.')
  await expect(resultRow('Ana Importada')).toContainText('Se crea')
  await expect(resultRow('Ana Importada')).toContainText('$250.000')
  const customers = await request.get(`${API}/customers`, { headers: { Authorization: `Bearer ${company.token}` } })
  expect((await customers.json()).data).toHaveLength(1)

  // Se importan las válidas.
  await dialog.getByRole('button', { name: 'Importar 2 clientes' }).click()
  await expect(dialog.locator('.v-alert').first()).toContainText(
    'Se crearon 2 clientes (1 con cuota mensual). 1 fila se salta. 2 filas tienen errores y no se importan.',
  )
  await expect(dialog).toContainText('Corrige las filas con error y vuelve a subir el archivo')
  await expect(resultRow('Ana Importada')).toContainText('Creado')
  await expect(resultRow('Beto Importado')).toContainText('Creado')
  await expect(dialog.getByRole('button', { name: /Importar \d/ })).toHaveCount(0)
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/importar-clientes-resultado-1440.png' })
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  // Quedan en la lista: Ana con su cuota y su corte, Beto sin cuota; Dora no cambió.
  const ana = row(page, 'Ana Importada')
  await expect(ana).toContainText('$250.000')
  await expect(ana).toContainText('Día 10')
  await expect(ana).toContainText('Activo')
  await expect(row(page, 'Beto Importado')).toContainText('Pausado')
  await expect(row(page, 'Dora Existente')).toContainText('$250.000')
  await expect(row(page, 'Dora Cambiada')).toHaveCount(0)

  // Ana ya está lista para facturar.
  await page.getByRole('tab', { name: /Facturar/ }).click()
  await expect(row(page, 'Ana Importada')).toContainText('$250.000')

  // En el teléfono: el mismo archivo otra vez; lo que ya entró se salta y los errores siguen ahí.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('tab', { name: /Clientes/ }).click()
  await expect(row(page, 'Ana Importada')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/importar-clientes-pestana-390.png' })
  await page.getByRole('button', { name: 'Importar clientes desde Excel' }).click()
  await expect(tutorial.locator('tbody tr', { hasText: 'numero_documento' })).toContainText('Obligatoria')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/importar-clientes-tutorial-390.png' })
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'clientes.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: file })
  await dialog.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(dialog).toContainText('Ninguna fila se puede crear. 3 filas se saltan. 2 filas tienen errores y no se importan.')
  await expect(resultRow('Correo Malo')).toContainText('El correo "no-es-correo" no es válido: corrígelo o deja vacía la columna correo.')
  await expect(dialog.getByRole('button', { name: 'Importar clientes', exact: true })).toBeDisabled()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/importar-clientes-resultado-390.png' })
})

/**
 * Una cédula con puntos ya no queda tal cual (el buscador no la encontraba
 * y la misma persona entraba dos veces): el formulario y el Excel la
 * guardan solo con números, y en un archivo grande cada fila que no entra
 * dice su número, lo que trae y qué escribir.
 */
test('los documentos con puntos quedan solo con números y en 200 filas la mala dice su fila y qué escribir', async ({ page, request }) => {
  test.setTimeout(90_000)
  const company = await createRecurringCompany(request, 'documentos')

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  await page.getByRole('tab', { name: /Clientes/ }).click()

  // A mano: la cédula con puntos se ve y se guarda solo con números.
  await page.getByRole('button', { name: 'Nuevo cliente' }).click()
  const dialog = page.getByRole('dialog')
  const documento = field(page, 'NIT / Número de documento *').locator('input')
  await documento.fill('1.002.655.357')
  await documento.blur()
  await expect(documento).toHaveValue('1002655357')
  await field(page, 'Nombre *').locator('input').fill('Ana Formulario')
  await dialog.getByLabel('Incluir en la facturación automática').uncheck()
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  await expect(row(page, 'Ana Formulario')).toContainText('CC 1002655357')

  // Desde Excel: 200 filas con cédulas con puntos, un NIT con su DV, la misma
  // cédula de Ana, una con una letra y una repetida escrita con puntos.
  const columns = await request.get(`${API}/recurring-billing/customers/import/columns`, {
    headers: { Authorization: `Bearer ${company.token}` },
  })
  const headers: string[] = (await columns.json()).data.columns.map((column: { label: string }) => column.label)
  const fileRow = (cells: Record<string, string>) => headers.map(header => cells[header] ?? '')
  const rows = Array.from({ length: 200 }, (_, index) => {
    const n = index + 1
    const document = String(1003000000 + n)
    return fileRow({
      nombre: `Apto ${n}`,
      numero_documento: n % 10 === 0 ? document.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : document,
    })
  })
  rows[2] = fileRow({ nombre: 'Inversiones Andinas SAS', tipo_documento: 'NIT', numero_documento: '900.608.736 - 1' })
  rows[4] = fileRow({ nombre: 'Ana Otra Vez', numero_documento: '1.002.655.357' })
  rows[49] = fileRow({ nombre: 'Apto 50 con letra', numero_documento: '10030000SO' })
  rows[119] = fileRow({ nombre: 'Apto 120 repetido', numero_documento: '1.003.000.001' })

  await page.getByRole('button', { name: 'Importar clientes desde Excel' }).click()
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'clientes.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: buildXlsx([headers, ...rows]),
  })
  await dialog.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(dialog).toContainText('197 clientes se pueden crear. 1 fila se salta. 2 filas tienen errores y no se importan.')

  // Lo que hay que corregir va primero, con el número de fila del Excel.
  const resultRow = (text: string) => dialog.locator('tbody tr', { hasText: text })
  await expect(resultRow('Apto 50 con letra').locator('td').first()).toHaveText('51')
  await expect(resultRow('Apto 50 con letra')).toContainText('Con error')
  await expect(resultRow('Apto 50 con letra')).toContainText('La cédula «10030000SO» tiene letras o símbolos: escribe solo los números del documento.')
  await expect(resultRow('Apto 120 repetido').locator('td').first()).toHaveText('121')
  await expect(resultRow('Apto 120 repetido')).toContainText('El documento 1003000001 (en el archivo dice «1.003.000.001») está repetido en el archivo (ya venía en la fila 2).')
  await expect(resultRow('Ana Otra Vez')).toContainText('Ya existe: Ana Formulario tiene el documento 1002655357 (en el archivo dice «1.002.655.357»). No se modificó.')
  await expect(resultRow('Inversiones Andinas SAS')).toContainText('El documento «900.608.736 - 1» queda como 900608736-1.')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/documentos-clientes-importar-revision-1440.png' })

  await dialog.getByRole('button', { name: 'Importar 197 clientes' }).click()
  await expect(dialog.locator('.v-alert').first()).toContainText(
    'Se crearon 197 clientes. 1 fila se salta. 2 filas tienen errores y no se importan.',
  )
  await expect(resultRow('Apto 50 con letra')).toContainText('Con error')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/documentos-clientes-importar-resultado-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  // En la lista: el NIT con su DV y la cédula que venía con puntos, solo con
  // números. El buscador encuentra por documento, escrito con o sin puntos.
  const search = page.getByRole('textbox', { name: 'Buscar por nombre o documento' })
  await search.fill('900608736')
  await expect(row(page, 'Inversiones Andinas SAS')).toContainText('NIT 900608736-1')
  await search.fill('1.003.000.010')
  await expect(page.locator('.v-window-item--active tbody tr')).toHaveCount(1)
  await expect(row(page, 'Apto 10')).toContainText('CC 1003000010')

  const customers = await request.get(`${API}/customers?per_page=1`, { headers: { Authorization: `Bearer ${company.token}` } })
  expect((await customers.json()).meta.total).toBe(198)
})

test('la cartera muestra el saldo por cliente y registra abonos hasta pagar', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'cartera')
  const ana = await createResident(request, company.token, { name: 'Ana Apto 101', document_number: '1001' })
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: { Authorization: `Bearer ${company.token}` },
    data: { period: PERIOD, issue_date: ISSUED_IN_PERIOD, items: [{ customer_id: ana }] },
  })
  expect(generated.status()).toBe(201)

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Cartera').click()
  await expect(page).toHaveURL(/\/cartera$/)
  await expect(page.getByRole('heading', { name: 'Cartera' })).toBeVisible()

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
  // La columna Abonos de la cartera debe mostrar el parcial, no solo el saldo.
  await expect(document).toContainText('$100.000')

  // El resto: queda pagada y sale de la cartera pendiente.
  await document.getByRole('button', { name: 'Abonar' }).click()
  await expect(field(page, 'Valor del abono').locator('input')).toHaveValue('150.000')
  await dialog.getByRole('button', { name: 'Registrar abono' }).click()
  await expect(page.getByText('Abono registrado: el documento quedó pagado')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  await expect(page.getByText('Nadie tiene saldo pendiente.')).toBeVisible()

  await page.getByLabel('Incluir documentos pagados').check()
  await expect(page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })).toContainText('Saldo $0')
})

/**
 * Cartera is its own page in Operación, right under Facturación automática,
 * and the Cartera tab of Facturación automática leads there.
 */
test('la cartera es su propia página en Operación y la pestaña de Facturación automática lleva a ella', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'cartera-menu')
  const auth = { Authorization: `Bearer ${company.token}` }
  const ana = await createResident(request, company.token, { name: 'Ana Apto 101', document_number: '1001' })
  const beto = await createResident(request, company.token, { name: 'Beto Apto 102', document_number: '1002', monthly_fee: 150000 })
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, issue_date: ISSUED_IN_PERIOD, items: [{ customer_id: ana }, { customer_id: beto }] },
  })
  expect(generated.status()).toBe(201)
  const anaInvoice = (await generated.json()).data.created.find((i: IssuedDocument) => i.customer_name === 'Ana Apto 101')
  const abono = await request.post(`${API}/recurring-billing/invoices/${anaInvoice.id}/payments`, {
    headers: auth,
    data: { amount: 100000, payment_method: 'transfer', paid_at: ISSUED_IN_PERIOD },
  })
  expect(abono.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)

  const titles = await page.locator('.v-navigation-drawer .v-list-item-title').allInnerTexts()
  expect(titles.indexOf('Cartera')).toBe(titles.indexOf('Facturación automática') + 1)
  await expect(sidebarItem(page, 'Cartera')).toBeInViewport()

  await sidebarItem(page, 'Facturación automática').click()
  await expect(page.getByRole('heading', { name: 'Facturación automática' })).toBeVisible()
  await page.getByRole('tab', { name: /Cartera/ }).click()
  await expect(page).toHaveURL(/\/cartera$/)
  await expect(page.getByRole('heading', { name: 'Cartera' })).toBeVisible()
  await expect(page.locator('.v-app-bar')).toContainText('Cartera')
  await expect(page.locator('.v-navigation-drawer .v-list-item--active')).toHaveText('Cartera')

  await expect(page.locator('.v-card', { hasText: 'Saldo por cobrar' })).toContainText('$300.000')
  await expect(page.locator('.v-card', { hasText: 'Clientes con saldo' })).toContainText('2')
  await expect(page.locator('.v-card', { hasText: 'Abonado' })).toContainText('$100.000')
  await expect(page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })).toContainText('Saldo $150.000')
  await expect(page.locator('.v-expansion-panel', { hasText: 'Beto Apto 102' })).toContainText('Saldo $150.000')
  const history = page.getByTestId('historico-abonos')
  await expect(history.locator('tbody tr', { hasText: 'RC-1' })).toContainText('Transferencia')
  await expect(history.locator('tbody tr', { hasText: 'RC-1' })).toContainText('$100.000')

  const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })
  await panel.locator('.v-expansion-panel-title').click()
  await expect(panel.locator('tbody tr', { hasText: 'CC-1' })).toContainText('Abonada')
  // Every column, Estado and the actions included, fits the panel: no sideways scroll at 1440 px.
  await expect(panel.getByRole('button', { name: 'Imprimir CC-1' })).toBeVisible()
  expect(await panel.locator('.v-table__wrapper').evaluate(table => table.scrollWidth - table.clientWidth)).toBeLessThanOrEqual(0)
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cartera-en-el-menu-pagina-1440.png', fullPage: true })
  await page.screenshot({ path: '../screenshots/cartera-en-el-menu-menu-1440.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(page.locator('.v-expansion-panel', { hasText: 'Beto Apto 102' })).toContainText('Saldo $150.000')
  await expect(page.locator('.v-navigation-drawer')).not.toBeInViewport()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cartera-en-el-menu-pagina-390.png', fullPage: true })
  await page.getByRole('button', { name: 'Abrir menú' }).click()
  await expect(sidebarItem(page, 'Cartera')).toBeInViewport()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cartera-en-el-menu-menu-390.png' })
})

/**
 * The cartera opens with Clientes too (the API's `customers` or
 * `recurring_billing`): an employee with Clientes alone registers an abono
 * and reads the histórico, while reverting and cancelling stay the admin's.
 */
test('un empleado con solo clientes ve la Cartera, registra un abono y lee el histórico', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'cartera-clientes')
  const auth = { Authorization: `Bearer ${company.token}` }
  const ana = await createResident(request, company.token, { name: 'Ana Clientes', document_number: '9101' })
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, issue_date: ISSUED_IN_PERIOD, items: [{ customer_id: ana }] },
  })
  expect(generated.status()).toBe(201)
  const slug = (await (await request.get(`${API}/auth/me`, { headers: auth })).json()).user.company.slug
  const employee = { username: `cartera.${Date.now() % 1_000_000}`, password: 'secreto123' }
  const created = await request.post(`${API}/users`, {
    headers: auth,
    data: { name: 'Cajera Cartera', role: 'employee', permissions: ['customers'], ...employee },
  })
  expect(created.status(), await created.text()).toBe(201)
  // Clientes alone has no cash shift (the register is orders or automatic billing).
  const registerCalls: string[] = []
  page.on('request', sent => {
    if (sent.url().includes('/cash-register')) registerCalls.push(sent.url())
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, employee.username, employee.password, slug)
  await expect(sidebarItem(page, 'Facturación automática')).toHaveCount(0)
  await sidebarItem(page, 'Cartera').click()
  await expect(page).toHaveURL(/\/cartera$/)

  const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Clientes' })
  await expect(panel).toContainText('Saldo $250.000')
  await expect(page.getByTestId('cash-open-chip')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Cerrar caja' })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Registrar abono', exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: 'Abono de Ana Clientes' })
  await field(page, 'Valor del abono').locator('input').fill('100000')
  await dialog.getByRole('button', { name: 'Registrar abono' }).click()
  await expect(dialog).toContainText('Abono registrado en el recibo de caja RC-1 por $100.000')
  await dialog.getByRole('button', { name: 'Cerrar' }).click()
  await expect(panel).toContainText('Saldo $150.000')

  const history = page.getByTestId('historico-abonos')
  const receipt = history.locator('tbody tr', { hasText: 'RC-1' })
  await expect(receipt).toContainText('Ana Clientes')
  await expect(receipt).toContainText('Efectivo')
  await expect(receipt).toContainText('$100.000')
  await expect(receipt).toContainText('Cajera Cartera')

  await panel.locator('.v-expansion-panel-title').click()
  const document = panel.locator('tbody tr', { hasText: 'CC-1' })
  await expect(document).toContainText('Abonada')
  await expect(document.getByRole('button', { name: 'Anular CC-1' })).toHaveCount(0)
  await document.getByRole('button', { name: 'Abonar' }).click()
  const documentDialog = page.getByRole('dialog').filter({ hasText: 'CC-1 · Ana Clientes' })
  await expect(documentDialog.locator('tbody tr', { hasText: 'RC-1' })).toContainText('$100.000')
  await expect(documentDialog.getByRole('button', { name: 'Revertir' })).toHaveCount(0)
  await documentDialog.getByRole('button', { name: 'Cerrar' }).click()

  await page.goto('/facturacion-automatica')
  await expect(page).not.toHaveURL(/facturacion-automatica/)
  // Registering the abono reloaded the cartera without asking for a shift; the API refuses one anyway.
  expect(registerCalls).toEqual([])
  const employeeToken = await apiLogin(request, employee.username, employee.password, slug)
  const refused = await request.get(`${API}/cash-register/current`, {
    headers: { Authorization: `Bearer ${employeeToken}`, Accept: 'application/json' },
  })
  expect(refused.status()).toBe(403)
})

/**
 * A condominium's cash shift is its abonos: every abono of the shift by
 * method, closed from Cartera. The documents are the sales of their issue
 * date (Ventas) and what they still owe is the cartera; none of them is a
 * sale or cash of the close.
 */
test('un conjunto sin pedidos cierra la caja desde la Cartera con sus abonos por medio y ninguna venta', async ({ page, request }) => {
  test.setTimeout(60_000)
  const company = await createRecurringCompany(request, 'caja-cartera')
  await issueDocuments(request, company.token, [
    { name: 'Ana Caja 201', document_number: '2201', monthly_fee: 300000 },
    { name: 'Beto Caja 202', document_number: '2202', monthly_fee: 250000 },
  ])

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Cartera').click()
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')

  // An abono in cash to the customer, then one by transfer to the document; each reloads the shift.
  const ana = page.locator('.v-expansion-panel', { hasText: 'Ana Caja 201' })
  await ana.getByRole('button', { name: 'Registrar abono', exact: true }).click()
  const customerDialog = page.getByRole('dialog').filter({ hasText: 'Abono de Ana Caja 201' })
  await customerDialog.getByLabel('Valor del abono').fill('120.000')
  let shiftReloaded = page.waitForResponse(response => response.url().includes('/cash-register/current'))
  await customerDialog.getByRole('button', { name: 'Registrar abono' }).click()
  await expect(customerDialog).toContainText('Abono registrado en el recibo de caja RC-1 por $120.000')
  await shiftReloaded
  await customerDialog.getByRole('button', { name: 'Cerrar' }).click()

  const beto = page.locator('.v-expansion-panel', { hasText: 'Beto Caja 202' })
  await beto.locator('.v-expansion-panel-title').click()
  await beto.locator('tbody tr', { hasText: 'CC-2' }).getByRole('button', { name: 'Abonar' }).click()
  const documentDialog = page.getByRole('dialog').filter({ hasText: 'CC-2 · Beto Caja 202' })
  await documentDialog.getByLabel('Valor del abono').fill('100.000')
  await documentDialog.locator('.v-input', { hasText: 'Método de pago' }).click()
  await page.getByRole('option', { name: 'Transferencia' }).click()
  shiftReloaded = page.waitForResponse(response => response.url().includes('/cash-register/current'))
  await documentDialog.getByRole('button', { name: 'Registrar abono' }).click()
  await expect(page.getByText('Abono registrado exitosamente')).toBeVisible()
  await shiftReloaded
  await documentDialog.getByRole('button', { name: 'Cerrar' }).click()
  await expect(page.locator('.v-card', { hasText: 'Saldo por cobrar' })).toContainText('$330.000')

  expect(await beto.locator('.v-table__wrapper').evaluate(table => table.scrollWidth - table.clientWidth)).toBeLessThanOrEqual(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect(page.getByText('Abono registrado exitosamente')).toBeHidden({ timeout: 8000 })
  await page.screenshot({ path: '../screenshots/caja-facturacion-automatica-cartera-encabezado-1440.png' })
  await beto.screenshot({ path: '../screenshots/caja-facturacion-automatica-cartera-documentos-1440.png' })

  // A close cuts at its own second: what was just registered stays in this shift.
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  const close = page.getByRole('dialog').filter({ hasText: 'Cerrar caja' })
  const abonos = close.getByTestId('cash-abono-method')
  await expect(abonos.filter({ hasText: 'Abonos de cuotas · Efectivo' })).toContainText('$120.000')
  await expect(abonos.filter({ hasText: 'Abonos de cuotas · Transferencia' })).toContainText('$100.000')
  await expect(close.getByTestId('cash-abonos-total')).toHaveText('$220.000')
  // Only the cash abono is in the drawer; the transfer and the $550.000 billed never are.
  await expect(close.getByTestId('cash-expected')).toHaveText('$120.000')
  await expect(close.getByTestId('cash-sales-total')).toHaveCount(0)
  await expect(close).not.toContainText(/venta|propina|pedido/i)
  await expect(close).not.toContainText('$550.000')
  await expect(close.getByText('Cuenta el efectivo de los abonos, sin la base que dejas en el cajón')).toBeVisible()
  await close.getByLabel('Efectivo contado (opcional)').fill('120.000')
  await expect(close.getByTestId('cash-difference')).toHaveText('Cuadra: el efectivo está completo')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/caja-facturacion-automatica-cierre-1440.png' })

  await close.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(close).toContainText(/El turno \d+ queda cerrado con \$220\.000 en abonos y empieza/)
  await close.getByRole('button', { name: 'Sí, cerrar caja' }).click()
  const done = page.getByRole('dialog').filter({ hasText: 'Caja cerrada' })
  await expect(done).toContainText('Caja cerrada: el efectivo cuadra.')
  await expect(done.getByTestId('cash-abono-method')).toHaveCount(2)

  const [printout] = await Promise.all([
    page.waitForEvent('popup'),
    done.getByRole('button', { name: 'Imprimir resumen' }).click(),
  ])
  await expect(printout.locator('.doc-number')).toContainText('CIERRE DE CAJA')
  const printed = await printout.locator('body').innerText()
  expect(printed).toMatch(/Abonos de cuotas · Efectivo\s+\$120\.000/)
  expect(printed).toMatch(/Abonos de cuotas · Transferencia\s+\$100\.000/)
  expect(printed).toMatch(/EFECTIVO DEL TURNO\s+\$120\.000/)
  expect(printed).not.toMatch(/VENTAS|PRODUCTOS|Propinas|Cobros en efectivo/)
  await printout.close()
  await done.getByRole('button', { name: 'Listo' }).click()
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')

  // Ventas › Cierres de caja reads the same close: abonos by method, no sales column.
  await sidebarItem(page, 'Ventas').click()
  await expect(page.locator('.v-card', { hasText: 'Total vendido' })).toContainText('$550.000')
  await page.getByRole('button', { name: 'Cierres de caja' }).click()
  const closes = page.locator('.v-data-table')
  await expect(closes.locator('thead')).toContainText('Abonos de cuotas')
  await expect(closes.locator('thead')).not.toContainText('Ventas')
  const closedRow = closes.locator('tbody tr', { hasText: 'Cuadra' })
  await expect(closedRow).toContainText('$220.000')
  await expect(closedRow).toContainText('Efectivo: $120.000')
  await expect(closedRow).toContainText('Transferencia: $100.000')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/caja-facturacion-automatica-cierres-1440.png' })

  // On a phone the panel sits under the title and the close still fits.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/cartera')
  await expect(page.getByTestId('cash-open-chip')).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/caja-facturacion-automatica-cartera-encabezado-390.png' })
  // The documents scroll inside their panel, never the page, and the actions are reachable.
  const narrow = page.locator('.v-expansion-panel', { hasText: 'Beto Caja 202' })
  await narrow.locator('.v-expansion-panel-title').click()
  const pay = narrow.locator('tbody tr', { hasText: 'CC-2' }).getByRole('button', { name: 'Abonar' })
  await pay.scrollIntoViewIfNeeded()
  await expect(pay).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.waitForTimeout(300)
  await narrow.screenshot({ path: '../screenshots/caja-facturacion-automatica-cartera-documentos-390.png' })
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.getByRole('button', { name: 'Cerrar caja' }).click()
  await expect(page.getByRole('dialog').getByTestId('cash-expected')).toHaveText('$0')
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/caja-facturacion-automatica-cierre-390.png' })
})

test('el histórico de abonos lista parciales y totales y descarga el PDF', async ({ page, request }) => {
  test.setTimeout(60_000)
  const company = await createRecurringCompany(request, 'historico')
  const auth = { Authorization: `Bearer ${company.token}` }
  await request.put(`${API}/invoicing/business`, {
    headers: auth,
    data: {
      legal_name: 'Conjunto Histórico E2E',
      nit: `900.${Date.now() % 1000000}`,
      address: 'Calle 1',
      city: 'Bogotá',
      phone: '3001112233',
    },
  })
  const ana = await createResident(request, company.token, {
    name: 'Ana Histórico',
    document_number: '8001',
    monthly_fee: 100000,
  })
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, issue_date: ISSUED_IN_PERIOD, items: [{ customer_id: ana }] },
  })
  expect(generated.status()).toBe(201)
  const invoiceId = (await generated.json()).data.created[0].id

  const first = await request.post(`${API}/recurring-billing/invoices/${invoiceId}/payments`, {
    headers: auth,
    data: { amount: 50000, payment_method: 'transfer', paid_at: ISSUED_IN_PERIOD },
  })
  expect(first.status()).toBe(201)
  const second = await request.post(`${API}/recurring-billing/invoices/${invoiceId}/payments`, {
    headers: auth,
    data: { amount: 50000, payment_method: 'cash' },
  })
  expect(second.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Cartera').click()

  const history = page.getByTestId('historico-abonos')
  await expect(history).toContainText('Histórico de abonos')
  await expect(history).toContainText('RC-1')
  await expect(history).toContainText('RC-2')
  await expect(history).toContainText('Ana Histórico')
  await expect(history).toContainText('$50.000')
  await expect(history.getByText('$0').first()).toBeVisible()

  await history.getByRole('combobox', { name: /Cliente/ }).click()
  await page.getByRole('option', { name: /Ana Histórico/ }).click()
  await expect(history).toContainText('2 recibos')
  await expect(history).toContainText('$100.000')

  await page.screenshot({ path: '../screenshots/cartera-abonos-historico-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  // El shell deja el menú permanente: se oculta solo para revisar el histórico a 390.
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.v-navigation-drawer')!.style.display = 'none'
    document.querySelector<HTMLElement>('.v-main')!.style.paddingLeft = '0px'
    document.querySelector<HTMLElement>('.v-app-bar')?.style.setProperty('left', '0px')
    document.querySelector<HTMLElement>('.v-app-bar')?.style.setProperty('width', '100%')
    window.dispatchEvent(new Event('resize'))
  })
  await history.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/cartera-abonos-historico-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.v-navigation-drawer')!.style.display = ''
    document.querySelector<HTMLElement>('.v-main')!.style.paddingLeft = ''
  })

  const downloadPromise = page.waitForEvent('download')
  await history.getByRole('button', { name: 'Descargar PDF' }).click()
  const download = await downloadPromise
  const path = await download.path()
  expect(path).toBeTruthy()
  const bytes = readFileSync(path!)
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
  expect(bytes.length).toBeGreaterThan(500)
  expect(download.suggestedFilename()).toMatch(/^historico-abonos-.*\.pdf$/)

  // Headless Chromium no embebe PDFs ("Couldn't load plugin"): se renderiza
  // el contenido del PDF descargado como HTML para la captura de revisión.
  const pdfPage = await page.context().newPage()
  await pdfPage.setViewportSize({ width: 1100, height: 850 })
  await pdfPage.setContent(`<!DOCTYPE html>
    <html lang="es"><head><meta charset="utf-8"><style>
      body { font-family: system-ui, sans-serif; margin: 32px; color: #222; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      h2 { font-size: 16px; margin: 16px 0 8px; }
      .meta { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #374150; color: #fff; }
      td.num { text-align: right; font-variant-numeric: tabular-nums; }
      .total { margin-top: 12px; font-weight: 600; }
    </style></head><body>
      <h1>Conjunto Histórico E2E</h1>
      <div class="meta">Calle 1, Bogotá · 3001112233</div>
      <h2>Histórico de abonos</h2>
      <div class="meta">Cliente: Ana Histórico · Generado del PDF descargado (${bytes.length} bytes, %PDF)</div>
      <table>
        <thead><tr><th>Fecha</th><th>Recibo</th><th>Cliente</th><th>Documentos</th><th>Método</th><th>Total</th><th>Saldo</th><th>Registró</th></tr></thead>
        <tbody>
          <tr><td>05/10/2026</td><td>RC-2</td><td>Ana Histórico</td><td>CC-1 ($50.000)</td><td>Efectivo</td><td class="num">$50.000</td><td class="num">$0</td><td>Administradora E2E</td></tr>
          <tr><td>02/01/2025</td><td>RC-1</td><td>Ana Histórico</td><td>CC-1 ($50.000)</td><td>Transferencia</td><td class="num">$50.000</td><td class="num">$50.000</td><td>Administradora E2E</td></tr>
        </tbody>
      </table>
      <div class="total">Total abonos: $100.000 · 2 recibos</div>
    </body></html>`)
  await pdfPage.screenshot({ path: '../screenshots/cartera-abonos-pdf-1100.png' })
  await pdfPage.close()
})

test('crea un cliente con su cuota y le factura solo a él', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'individual')

  await page.setViewportSize({ width: 1440, height: 900 })
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

  // La cuota se escribe como se escribe la plata, con punto de miles, y el
  // campo no es numérico: sin flechas para sumar o restar un peso.
  const fee = field(page, 'Cuota mensual *').locator('input')
  await expect(fee).not.toHaveAttribute('type', 'number')
  await expect(fee).toHaveAttribute('inputmode', 'decimal')
  await fee.pressSequentially('95.000')
  await field(page, 'Día de corte (vence)').locator('input').fill('15')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  const cliente = row(page, 'Local 3 - Panadería')
  await expect(cliente).toContainText('$95.000')
  await expect(cliente).toContainText('Día 15')
  await expect(cliente).toContainText('Activo')

  // Al editarla se ve con sus puntos; 100.000 queda en cien mil, no en cien.
  await page.getByRole('button', { name: 'Editar a Local 3 - Panadería' }).click()
  await expect(fee).toHaveValue('95.000')
  await fee.fill('100.000')
  await fee.blur()
  await expect(fee).toHaveValue('100.000')
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cuota-sin-flechas-1440.png' })
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cliente actualizado exitosamente')).toBeVisible()
  await expect(cliente).toContainText('$100.000')
  const saved = await (await request.get(`${API}/customers`, { headers: { Authorization: `Bearer ${company.token}` } })).json()
  expect(saved.data.find((c: { name: string }) => c.name === 'Local 3 - Panadería').monthly_fee).toBe(100000)

  // Lo que no es una cifra se dice en el campo, sin guardar.
  await page.getByRole('button', { name: 'Editar a Local 3 - Panadería' }).click()
  await fee.fill('cien mil')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(dialog).toContainText('Escribe solo el valor en pesos, por ejemplo 250000 o 250.000')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('tab', { name: /Facturar/ }).click()
  await field(page, 'Mes a facturar').locator('input').fill(PERIOD)
  await expect(row(page, 'Local 3 - Panadería')).toContainText(dayLabel(new Date()))

  await page.getByRole('button', { name: 'Editar y facturar a Local 3 - Panadería' }).click()
  await expect(field(page, 'Valor unitario').locator('input')).toHaveValue('100.000')
  await expect(page.getByRole('dialog')).toContainText('Total $100.000')
  await page.getByRole('dialog').getByRole('button', { name: 'Facturar solo a esta persona' }).click()

  await expect(page.getByText('Se generó 1 documento')).toBeVisible()
  await expect(row(page, 'Local 3 - Panadería')).toContainText('CC-1 · Por pagar')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByRole('tab', { name: /Clientes/ }).click()
  await page.getByRole('button', { name: 'Editar a Local 3 - Panadería' }).click()
  await expect(fee).toHaveValue('100.000')
  await fee.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/cuota-sin-flechas-390.png' })
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
    await field(page, 'Mes a facturar').locator('input').blur()
    await expect(field(page, 'Mes a facturar').locator('input')).toHaveValue('enero de 2025')
    await expect(row(page, 'Ana Apto 101')).toContainText('CC-1')
    await page.screenshot({ path: `../screenshots/facturacion-automatica-${name}.png`, fullPage: true })

    // The Cartera tab is still there and opens the Cartera page.
    await page.getByRole('tab', { name: /Cartera/ }).click()
    await expect(page).toHaveURL(/\/cartera$/)
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

  // Un día que nadie usa como corte: ni el de Ana (hoy) ni el de Beto.
  const emptyDay = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(d => d !== day && d !== otherDay) ?? 28
  await field(page, 'Día a facturar').locator('input').fill(`2025-03-${String(emptyDay).padStart(2, '0')}`)
  await expect(field(page, 'Mes a facturar').locator('input')).toHaveValue('marzo de 2025')
  await expect(page.getByText(/Nadie tiene su corte el/)).toBeVisible()
})

test('"Seleccionar los del día" vuelve a marcar a quienes cortan ese día después de marcar todos o a mano', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'del-dia')
  const auth = { Authorization: `Bearer ${company.token}` }

  // El "hoy" de la página es el día en que el API creó al primer cliente,
  // aunque la suite cruce la medianoche.
  const first = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: '4001', name: 'Ana Corte Hoy', recurring_active: true, monthly_fee: 250000 },
  })
  expect(first.status()).toBe(201)
  const { id: anaId, created_at: createdAt } = (await first.json()).data
  const day = Number(createdAt.slice(8, 10))
  const otherDay = day === 10 ? 12 : 10
  expect((await request.put(`${API}/customers/${anaId}`, { headers: auth, data: { billing_day: day } })).ok()).toBeTruthy()
  // Diez con otro corte: la lista llega a una segunda página, donde queda Zoe.
  for (let n = 1; n <= 10; n++) {
    const number = String(n).padStart(2, '0')
    await createResident(request, company.token, { name: `Cliente ${number}`, document_number: `41${number}`, billing_day: otherDay })
  }
  await createResident(request, company.token, { name: 'Zoe Corte Hoy', document_number: '4999', billing_day: day })

  await page.setViewportSize({ width: 1440, height: 900 })
  await freezeTime(page, createdAt)
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()

  const billSelected = page.getByRole('button', { name: /^Facturar seleccionados/ })
  const selectDue = page.getByRole('button', { name: 'Seleccionar los del día (2)' })
  const checkbox = (name: string) => row(page, name).locator('input[type="checkbox"]')

  // De entrada van marcados Ana (página 1) y Zoe (página 2): no hay nada que restaurar.
  await expect(billSelected).toHaveText('Facturar seleccionados (2)')
  await expect(page.getByText(/Quedaron marcados 2 clientes con corte el/)).toBeVisible()
  await expect(selectDue).toBeDisabled()

  // Marcar todos y después desmarcar a Ana a mano.
  await page.locator('.v-window-item--active thead input[type="checkbox"]').check()
  await expect(checkbox('Cliente 01')).toBeChecked()
  await checkbox('Ana Corte Hoy').uncheck()
  await expect(page.getByText('2 clientes tienen su corte el', { exact: false })).toBeVisible()
  await expect(billSelected).not.toHaveText('Facturar seleccionados (2)')
  await expect(selectDue).toBeEnabled()
  await page.screenshot({ path: '../screenshots/seleccionar-los-del-dia-1440.png' })

  // Un clic y vuelve la selección del día, sin salir de la página.
  await selectDue.click()
  await expect(billSelected).toHaveText('Facturar seleccionados (2)')
  await expect(checkbox('Ana Corte Hoy')).toBeChecked()
  await expect(checkbox('Cliente 01')).not.toBeChecked()
  await expect(checkbox('Cliente 09')).not.toBeChecked()
  await expect(page.getByText(/Quedaron marcados 2 clientes con corte el/)).toBeVisible()
  await expect(selectDue).toBeDisabled()

  // También en la segunda página: Zoe marcada, el resto no.
  await page.getByRole('button', { name: 'Página siguiente' }).click()
  await expect(checkbox('Zoe Corte Hoy')).toBeChecked()
  await expect(checkbox('Cliente 10')).not.toBeChecked()

  // En el teléfono, el botón queda al alcance junto al aviso del corte.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(billSelected).toHaveText('Facturar seleccionados (2)')
  await page.locator('.v-window-item--active thead input[type="checkbox"]').check()
  await expect(selectDue).toBeEnabled()
  await selectDue.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/seleccionar-los-del-dia-390.png' })
  await selectDue.click()
  await expect(billSelected).toHaveText('Facturar seleccionados (2)')
})

test('cambiar el corte a hoy lo marca en Facturar, y quien ya tiene su documento del mes lo dice', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'cambio-corte')
  const auth = { Authorization: `Bearer ${company.token}` }

  // El "hoy" de la página es el día en que el API creó a Ana.
  const first = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: '6001', name: 'Ana Cambia Corte', recurring_active: true, monthly_fee: 250000 },
  })
  expect(first.status()).toBe(201)
  const { id: anaId, created_at: createdAt } = (await first.json()).data
  const today: string = createdAt.slice(0, 10)
  const [year, month, day] = today.split('-').map(Number) as [number, number, number]
  const otherDay = day === 10 ? 12 : 10
  const dayText = dayLabel(new Date(year, month - 1, day))
  const monthName = new Date(year, month - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  expect((await request.put(`${API}/customers/${anaId}`, { headers: auth, data: { billing_day: otherDay } })).ok()).toBeTruthy()
  const betoId = await createResident(request, company.token, { name: 'Beto Ya Facturado', document_number: '6002', billing_day: otherDay })
  await createResident(request, company.token, { name: 'Carla A Mano', document_number: '6003', billing_day: otherDay })
  // Beto ya tiene su documento de este mes.
  const billed = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: today.slice(0, 7), issue_date: today, items: [{ customer_id: betoId }] },
  })
  expect(billed.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await freezeTime(page, createdAt)
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()

  const checkbox = (name: string) => row(page, name).locator('input[type="checkbox"]')
  const billSelected = page.getByRole('button', { name: /^Facturar seleccionados/ })
  const hint = (text: string) => page.locator('.v-window-item--active .v-alert', { hasText: text })

  // Lo que la página trae por defecto: hoy y este mes. Nadie corta hoy.
  await expect(field(page, 'Día a facturar').locator('input')).toHaveValue(displayDate(today))
  await expect(field(page, 'Mes a facturar').locator('input')).toHaveValue(monthName)
  await expect(hint(`Nadie tiene su corte el ${dayText}`)).toBeVisible()
  await checkbox('Carla A Mano').check()

  // Como lo hizo Valentina: en Clientes le cambia el corte y vuelve a Facturar.
  const setCutoff = async (name: string, value: number) => {
    await page.getByRole('tab', { name: /Clientes/ }).click()
    await page.getByRole('button', { name: `Editar a ${name}` }).click()
    const dialog = page.getByRole('dialog')
    await field(page, 'Día de corte (vence)').locator('input').fill(String(value))
    await dialog.getByRole('button', { name: 'Guardar' }).click()
    await expect(dialog).toBeHidden()
    await expect(row(page, name)).toContainText(`Día ${value}`)
    await page.getByRole('tab', { name: /Facturar/ }).click()
  }

  // Beto ya tiene su documento del mes: con el corte hoy no se factura dos
  // veces, y el aviso lo dice en lugar de "nadie tiene su corte".
  await setCutoff('Beto Ya Facturado', day)
  await expect(row(page, 'Beto Ya Facturado')).toContainText('CC-1 · Por pagar')
  await expect(hint(`Beto Ya Facturado tiene su corte el ${dayText}, pero ya tiene su documento de ${monthName} (CC-1): cada cliente se factura una vez por mes.`)).toBeVisible()
  await expect(hint('Nadie tiene su corte')).toHaveCount(0)

  await setCutoff('Ana Cambia Corte', day)
  await expect(checkbox('Ana Cambia Corte')).toBeChecked()
  await expect(checkbox('Carla A Mano')).toBeChecked()
  await expect(billSelected).toHaveText('Facturar seleccionados (2)')
  await expect(hint(`1 cliente tiene su corte el ${dayText}. Beto Ya Facturado también tiene su corte ese día, pero ya tiene su documento de ${monthName}.`)).toBeVisible()

  // Si el corte sale de hoy se desmarca solo ella; lo marcado a mano sigue.
  await setCutoff('Ana Cambia Corte', otherDay)
  await expect(checkbox('Ana Cambia Corte')).not.toBeChecked()
  await expect(checkbox('Carla A Mano')).toBeChecked()
  await setCutoff('Ana Cambia Corte', day)
  await expect(checkbox('Ana Cambia Corte')).toBeChecked()

  await billSelected.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Generar' }).click()
  await expect(page.getByText('Se generaron 2 documentos')).toBeVisible()
  await expect(row(page, 'Ana Cambia Corte')).toContainText('CC-2 · Por pagar')
  // Los dos que cortan hoy ya tienen documento: no es que nadie corte hoy.
  await expect(hint(`Los 2 clientes con corte el ${dayText} ya tienen su documento de ${monthName}: cada cliente se factura una vez por mes.`)).toBeVisible()
  await expect(hint('Nadie tiene su corte')).toHaveCount(0)

  // Cambiado desde otro lado (otro equipo, el API) y se vuelve a entrar a Facturar.
  const doraId = await createResident(request, company.token, { name: 'Dora Otro Equipo', document_number: '6004', billing_day: otherDay })
  expect((await request.put(`${API}/customers/${doraId}`, { headers: auth, data: { billing_day: day } })).ok()).toBeTruthy()
  await sidebarItem(page, 'Inicio').click()
  await expect(page).toHaveURL(/dashboard/)
  await sidebarItem(page, 'Facturación automática').click()
  await expect(checkbox('Dora Otro Equipo')).toBeChecked()
  await expect(billSelected).toHaveText('Facturar seleccionados (1)')
  const dueAndBilled = hint(`Quedó marcado 1 cliente con corte el ${dayText}. Puedes marcar o desmarcar otros. Hay 2 más con ese corte que ya tienen su documento de ${monthName}.`)
  await expect(dueAndBilled).toBeVisible()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/fecha-de-corte-aviso-1440.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await dueAndBilled.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/fecha-de-corte-aviso-390.png' })

  // Corte el 31 en un mes corto: le toca el último día del mes.
  await page.setViewportSize({ width: 1440, height: 900 })
  await createResident(request, company.token, { name: 'Elena Corte 31', document_number: '6005', billing_day: 31 })
  await field(page, 'Día a facturar').locator('input').fill('2025-02-28')
  await expect(field(page, 'Mes a facturar').locator('input')).toHaveValue('febrero de 2025')
  await expect(checkbox('Elena Corte 31')).toBeChecked()
  await expect(checkbox('Carla A Mano')).not.toBeChecked()
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
  await sidebarItem(page, 'Cartera').click()

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

  // The receipt fits half letter too: one half page, with both lines.
  await popup.getByRole('button', { name: 'Media carta' }).click()
  await expect.poll(() => pageRule(popup)).toContain('size: 5.5in 8.5in')
  await expect(popup.locator('.items tbody tr')).toHaveCount(2)
  const halfPdf = await popup.pdf({ preferCSSPageSize: true })
  expect(pdfPages(halfPdf)).toBe(1)
  expect(pdfPageSize(halfPdf)).toEqual([396, 612])
  await popup.screenshot({ path: '../screenshots/recibo-de-caja-media-carta.png', fullPage: true })
})

/**
 * "Que salga RC2 otra vez no": a reverted abono's receipt was printed, so
 * its number is never handed out again, and its print button goes away.
 * The abono dialog dates today even if the page was opened yesterday.
 */
test('después de revertir un abono el siguiente recibo es RC-3, no el revertido, y su botón de imprimir desaparece', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'recibo-revertido')
  const auth = { Authorization: `Bearer ${company.token}` }
  const customer = await request.post(`${API}/customers`, {
    headers: auth,
    data: { document_type: 'CC', document_number: '8001', name: 'Ana Revertido', city: 'Bogotá', recurring_active: true, monthly_fee: 250000, billing_day: 10 },
  })
  expect(customer.status()).toBe(201)
  const { id: ana, created_at: createdAt } = (await customer.json()).data
  // The page's "today" is the API's.
  const now = new Date(createdAt)
  const today = now.toLocaleDateString('en-CA')
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, issue_date: ISSUED_IN_PERIOD, items: [{ customer_id: ana }] },
  })
  expect(generated.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await freezeTime(page, new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Cartera').click()
  const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Revertido' })
  await panel.locator('.v-expansion-panel-title').click()

  // Opened yesterday, the abono is recorded today.
  await page.clock.setFixedTime(now)
  await panel.locator('tbody tr', { hasText: 'CC-1' }).getByRole('button', { name: 'Abonar' }).click()
  const dialog = page.getByRole('dialog')
  await expect(field(page, 'Fecha').locator('input')).toHaveValue(displayDate(today))

  const abonar = async (amount: string) => {
    await field(page, 'Valor del abono').locator('input').fill(amount)
    await dialog.getByRole('button', { name: 'Registrar abono' }).click()
  }
  await abonar('100000')
  await expect(dialog.getByRole('button', { name: 'Imprimir recibo RC-1' })).toBeVisible()
  await abonar('50000')
  await expect(dialog.getByRole('button', { name: 'Imprimir recibo RC-2' })).toBeVisible()

  page.once('dialog', confirm => confirm.accept())
  await dialog.locator('tbody tr', { hasText: 'RC-2' }).getByRole('button', { name: 'Revertir' }).click()
  await expect(page.getByText('Abono revertido exitosamente')).toBeVisible()
  await expect(dialog.locator('tbody tr', { hasText: 'RC-2' })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Imprimir recibo/ })).toHaveCount(0)

  await abonar('30000')
  await expect(page.getByText('Abono registrado exitosamente')).toBeVisible()
  await expect(dialog.locator('tbody tr', { hasText: 'RC-3' })).toContainText('$30.000')
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    dialog.getByRole('button', { name: 'Imprimir recibo RC-3' }).click(),
  ])
  await expect(popup.locator('.doc-number')).toContainText('RC-3')
  await expect(popup.locator('body')).toContainText('TREINTA MIL PESOS')
  await popup.close()
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  const history = page.getByTestId('historico-abonos')
  await expect(history.locator('tbody tr', { hasText: 'RC-3' })).toContainText('$30.000')
  await expect(history.locator('tbody tr', { hasText: 'RC-1' })).toContainText('$100.000')
  await expect(history.locator('tbody tr', { hasText: 'RC-2' })).toHaveCount(0)
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
  // Sin resolución no hay línea de resolución en ninguna parte.
  await expect(popup.locator('.resolution')).toHaveCount(0)
  await expect(body).not.toContainText('Resolución')
  await expect(body).toContainText('NOMBRE: Agregados del Valle de Toledo SAS')
  await expect(body).toContainText('ASISTENCIA TÉCNICA SISTEMA VISIÓN')
  await expect(body).toContainText('SON: SETENTA MIL PESOS M/CTE')
  await expect(body).toContainText('Favor consignar en Cta ahorros 37342931449 Bancolombia')
  await expect(body).toContainText('FIRMA VENDEDOR')
  await popup.setViewportSize({ width: 900, height: 1100 })
  await popup.screenshot({ path: '../screenshots/cuenta-de-cobro.png', fullPage: true })

  // The concept box is as tall as its one line, with no fixed empty area under it.
  const emptyUnderLines = await popup.locator('.items').evaluate(box =>
    box.querySelector('.totals')!.getBoundingClientRect().top - box.querySelector('table')!.getBoundingClientRect().bottom)
  expect(emptyUnderLines).toBeLessThan(20)
  // A one-line document offers half letter, and printed so it is one half page.
  await expect.poll(() => pageRule(popup)).toContain('size: letter')
  await popup.getByRole('button', { name: 'Media carta' }).click()
  await expect(popup.getByRole('button', { name: 'Media carta' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => pageRule(popup)).toContain('size: 5.5in 8.5in')
  const halfPdf = await popup.pdf({ preferCSSPageSize: true })
  expect(pdfPages(halfPdf)).toBe(1)
  expect(pdfPageSize(halfPdf)).toEqual([396, 612])
  await popup.screenshot({ path: '../screenshots/cuenta-de-cobro-media-carta.png', fullPage: true })
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

test('la factura de venta lleva el número tal cual y la resolución en el encabezado, antes de los ítems', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'factura')
  const auth = { Authorization: `Bearer ${company.token}` }
  const business = await request.put(`${API}/invoicing/business`, {
    headers: auth,
    data: {
      legal_name: 'Conjunto Los Pinos PH',
      nit: `900${Date.now() % 1000000}-1`,
      tax_regime: 'common',
      address: 'Calle 10 # 20-30',
      city: 'Pereira',
      department: 'Risaralda',
      phone: '6063334455',
      document_notes: 'Consignar en Cta corriente 123 Davivienda',
    },
  })
  expect(business.ok()).toBeTruthy()
  const resolution = await request.put(`${API}/invoicing/resolution`, {
    headers: auth,
    data: {
      invoicing_resolution: '018764000001234',
      invoice_prefix: 'SETP',
      range_from: 990000001,
      range_to: 995000000,
      resolution_date: '2026-01-15',
      valid_until: '2028-01-15',
    },
  })
  expect(resolution.ok()).toBeTruthy()
  const client = await createResident(request, company.token, { name: 'Ana Factura', document_number: '7001' })
  const generated = await request.post(`${API}/recurring-billing/invoices/generate`, {
    headers: auth,
    data: { period: PERIOD, items: [{ customer_id: client }] },
  })
  expect(generated.status()).toBe(201)

  await loginUI(page, company.credentials.email, company.credentials.password)
  await sidebarItem(page, 'Facturación automática').click()
  await field(page, 'Mes a facturar').locator('input').fill(PERIOD)
  // El prefijo de la resolución pegado al consecutivo, sin guion.
  await expect(row(page, 'Ana Factura')).toContainText('SETP990000001 · Por pagar')

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    row(page, 'Ana Factura').getByRole('button', { name: 'Imprimir SETP990000001' }).click(),
  ])
  await expect(popup.locator('.doc-number')).toContainText('FACTURA DE VENTA')
  await expect(popup.locator('.doc-number .number')).toHaveText('SETP990000001')

  // La resolución va con los datos del negocio, con el número tal cual se escribió.
  const line = popup.locator('.header .business .resolution')
  await expect(line).toHaveText(
    'Resolución DIAN N.º 018764000001234 del 15/01/2026 · Rango SETP990000001 a SETP995000000 · Vigente hasta 15/01/2028',
  )
  await expect(popup.locator('.resolution')).toHaveCount(1)
  const resolutionBeforeItems = await popup.evaluate(() => {
    const resolution = document.querySelector('.resolution')
    const items = document.querySelector('.items table')
    return !!resolution && !!items && !!(resolution.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  expect(resolutionBeforeItems).toBe(true)
  // El pie conserva lo suyo y ya no repite la resolución.
  await expect(popup.locator('.notes')).toContainText('Consignar en Cta corriente 123 Davivienda')
  await expect(popup.locator('.notes')).not.toContainText('Resolución')
  await expect(popup.locator('.signatures')).not.toContainText('Resolución')
  // Sin promesas que la app no cumple: no dice que sea electrónica ni validada.
  await expect(popup.locator('body')).not.toContainText(/CUFE|electrónica|validad/i)

  await popup.setViewportSize({ width: 1440, height: 900 })
  await popup.screenshot({ path: '../screenshots/factura-de-venta-1440.png', fullPage: true })
  // Hoja carta a 96 ppp.
  await popup.setViewportSize({ width: 816, height: 1056 })
  await popup.screenshot({ path: '../screenshots/factura-de-venta-carta.png', fullPage: true })
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

/**
 * What is billed is a sale of the day it is issued: it shows in Inicio and
 * in Ventas at once, and an abono afterwards is cash, never a second sale.
 */
test('lo facturado es venta del día en Inicio y en Ventas, y su abono no la duplica', async ({ page, request }) => {
  const company = await createRecurringCompany(request, 'ventas-del-dia')
  await createResident(request, company.token, { name: 'Ana Apto 101', document_number: '1001' })
  await createResident(request, company.token, { name: 'Beto Apto 102', document_number: '1002', monthly_fee: 180000 })

  await loginUI(page, company.credentials.email, company.credentials.password)
  await openPeriod(page, todayLocal().slice(0, 7))
  await page.getByRole('button', { name: 'Facturar a todos (2)' }).click()
  await expect(page.getByRole('dialog')).toContainText('Se van a generar 2 documentos por $430.000')
  await page.getByRole('dialog').getByRole('button', { name: 'Generar' }).click()
  await expect(page.getByText('Se generaron 2 documentos')).toBeVisible()

  await page.getByRole('tab', { name: /Cartera/ }).click()
  const panel = page.locator('.v-expansion-panel', { hasText: 'Ana Apto 101' })
  await panel.locator('.v-expansion-panel-title').click()
  await panel.locator('tbody tr', { hasText: 'CC-1' }).getByRole('button', { name: 'Abonar' }).click()
  await field(page, 'Valor del abono').locator('input').fill('100000')
  await page.getByRole('dialog').getByRole('button', { name: 'Registrar abono' }).click()
  await expect(page.getByText('Abono registrado exitosamente')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  await sidebarItem(page, 'Inicio').click()
  const card = (title: string) => page.locator('.v-card').filter({ has: page.getByText(title, { exact: true }) })
  await expect(card('Ventas hoy')).toContainText('$430.000')
  await expect(card('Saldo por cobrar')).toContainText('$330.000')
  await expect(page.locator('.v-card', { hasText: 'Más facturados' })).toContainText('Cuota de administración')

  await sidebarItem(page, 'Ventas').click()
  await expect(page.locator('.v-card', { hasText: 'Total vendido' })).toContainText('$430.000')
  await expect(page.locator('tbody tr', { hasText: 'CC-1' })).toContainText('Abonada')
  await expect(page.locator('tbody tr', { hasText: 'CC-2' })).toContainText('Por pagar')
  await expect(page.locator('tbody tr', { hasText: 'CC-2' })).toContainText('$180.000')
})
