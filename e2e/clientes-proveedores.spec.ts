import { readFileSync } from 'node:fs'
import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, buildXlsx, createCompany, displayDate, field, loginUI, nitDigit, pickOptions, xlsxRows } from './helpers'

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** A customer's row in the Clientes list; its cells read the selection box, Tipo doc, Documento, DV, Nombre… */
const customerRow = (page: Page, name: string) => page.locator('tbody tr', { hasText: name })

/** The cell of a Clientes row under `header`. */
async function cellUnder(page: Page, name: string, header: string) {
  const headers = (await page.locator('.v-data-table thead th').allInnerTexts()).map(text => text.trim())
  expect(headers).toContain(header)
  return customerRow(page, name).locator('td').nth(headers.indexOf(header))
}

/** Segments and customers of a company of its own, through the API. */
async function arrangeSegments(request: APIRequestContext, token: string) {
  const auth = { Authorization: `Bearer ${token}` }
  const segment = async (name: string): Promise<number> => {
    const created = await request.post(`${API}/customer-segments`, { headers: auth, data: { name } })
    expect(created.status(), await created.text()).toBe(201)
    return (await created.json()).data.id
  }
  const school = await segment('Colegio San José')
  const grade = await segment('Grado 5')
  const town = await segment('Chinchiná')
  const customer = async (name: string, document_number: string, segment_ids: number[], joined_at?: string): Promise<number> => {
    const created = await request.post(`${API}/customers`, {
      headers: auth,
      data: { document_type: 'CC', document_number, name, segment_ids, ...(joined_at ? { joined_at } : {}) },
    })
    expect(created.status(), await created.text()).toBe(201)
    return (await created.json()).data.id
  }
  await customer('Ana Grado 5', '7001', [school, grade], '2025-02-03')
  await customer('Beto Grado 4', '7002', [school], '2025-06-20')
  await customer('Carla Otro Colegio', '7003', [grade], '2025-04-11')
  return { auth, school, grade, town }
}

/**
 * Valentina's segments are tags: a customer shows its own, the filter with
 * several leaves whoever has all of them ("Colegio San José" and "Grado 5"
 * is that grade) and "Ingreso" reads dd/mm/aaaa and sorts.
 */
test('los segmentos se ven en cada cliente, el filtro con varios deja a quien los tiene todos y el ingreso se ordena', async ({ page, request }) => {
  const company = await createCompany(request, 'segmentos-lista', { business_type: 'restaurant' })
  await arrangeSegments(request, company.token)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/clientes')

  const ana = customerRow(page, 'Ana Grado 5')
  await expect(ana.locator('.v-chip', { hasText: 'Colegio San José' })).toBeVisible()
  await expect(ana.locator('.v-chip', { hasText: 'Grado 5' })).toBeVisible()
  await expect(customerRow(page, 'Beto Grado 4').locator('.v-chip', { hasText: 'Grado 5' })).toHaveCount(0)
  await expect(await cellUnder(page, 'Ana Grado 5', 'Ingreso')).toHaveText('03/02/2025')
  await expect(await cellUnder(page, 'Beto Grado 4', 'Ingreso')).toHaveText('20/06/2025')

  await expect(page.getByText('Si eliges varios, ves solo a quien los tiene todos: un colegio y un grado muestran ese grado.')).toBeVisible()
  await pickOptions(page, 'Filtrar por segmentos', ['Colegio San José'])
  await expect(page.getByText('1-2 de 2')).toBeVisible()
  await expect(customerRow(page, 'Carla Otro Colegio')).toHaveCount(0)
  await pickOptions(page, 'Filtrar por segmentos', ['Grado 5'])
  await expect(page.getByText('1-1 de 1')).toBeVisible()
  await expect(page.locator('tbody tr')).toHaveText([/Ana Grado 5/])

  // Clearing the filter brings everyone back; the oldest join date goes first.
  await page.getByRole('button', { name: 'Borrar Filtrar por segmentos' }).click()
  await expect(page.getByText('1-3 de 3')).toBeVisible()
  await page.locator('.v-data-table thead th', { hasText: 'Ingreso' }).click()
  await expect(page.locator('tbody tr')).toHaveText([/Ana Grado 5/, /Carla Otro Colegio/, /Beto Grado 4/])
})

/**
 * A customer is born with today's "Fecha de ingreso", which can be changed,
 * and with segments picked or created right there. Several rows at once get
 * a segment or lose one, and the "Segmentos" window renames and deletes them
 * (a deleted segment only takes its tag away).
 */
test('crea un cliente con su fecha de ingreso y segmentos, agrega y quita segmentos a varios y los renombra o elimina', async ({ page, request }) => {
  const company = await createCompany(request, 'segmentos-formulario', { business_type: 'restaurant' })
  const { auth } = await arrangeSegments(request, company.token)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/clientes')

  const dialog = page.getByRole('dialog')
  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  const joined = field(page, 'Fecha de ingreso *').locator('input')
  await expect(joined).toHaveValue(displayDate(new Date().toLocaleDateString('en-CA')))
  await field(page, 'Número de documento *').locator('input').fill('7010')
  await field(page, 'Nombre / Razón social *').locator('input').fill('Dora Torre Norte')
  await joined.fill('10/01/2026')
  await joined.press('Tab')
  await pickOptions(page, 'Segmentos', ['Grado 5'])
  await field(page, 'Segmentos').locator('input').fill('Torre Norte')
  await page.locator('.v-overlay--active').getByText('Crear el segmento «Torre Norte»').click()
  await page.keyboard.press('Escape')
  await expect(field(page, 'Segmentos').locator('.v-chip', { hasText: 'Torre Norte' })).toBeVisible()
  await expect(field(page, 'Segmentos').locator('.v-chip', { hasText: 'Grado 5' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  const dora = customerRow(page, 'Dora Torre Norte')
  await expect(dora.locator('.v-chip', { hasText: 'Torre Norte' })).toBeVisible()
  await expect(dora.locator('.v-chip', { hasText: 'Grado 5' })).toBeVisible()
  await expect(await cellUnder(page, 'Dora Torre Norte', 'Ingreso')).toHaveText('10/01/2026')
  const saved = (await (await request.get(`${API}/customers?q=7010`, { headers: auth })).json()).data[0]
  expect(saved.joined_at).toBe('2026-01-10')
  expect(saved.segments.map((s: { name: string }) => s.name)).toEqual(['Grado 5', 'Torre Norte'])

  // Editing brings both back.
  await dora.getByRole('button', { name: 'Editar el cliente Dora Torre Norte' }).click()
  await expect(joined).toHaveValue('10/01/2026')
  await expect(field(page, 'Segmentos').locator('.v-chip')).toHaveText(['Grado 5', 'Torre Norte'])
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  // Two rows at once into Chinchiná, then one out.
  await customerRow(page, 'Beto Grado 4').locator('input[type="checkbox"]').check()
  await customerRow(page, 'Carla Otro Colegio').locator('input[type="checkbox"]').check()
  await expect(page.getByText('2 clientes seleccionados')).toBeVisible()
  await page.getByRole('button', { name: 'Agregar a segmento' }).click()
  await pickOptions(page, 'Segmentos', ['Chinchiná'])
  await dialog.getByRole('button', { name: 'Agregar', exact: true }).click()
  await expect(page.getByText('Se agregaron 2 clientes al segmento «Chinchiná».')).toBeVisible()
  await expect(customerRow(page, 'Beto Grado 4').locator('.v-chip', { hasText: 'Chinchiná' })).toBeVisible()
  await expect(customerRow(page, 'Carla Otro Colegio').locator('.v-chip', { hasText: 'Chinchiná' })).toBeVisible()
  await expect(page.getByText('2 clientes seleccionados')).toHaveCount(0)

  await customerRow(page, 'Beto Grado 4').locator('input[type="checkbox"]').check()
  await page.getByRole('button', { name: 'Quitar de segmento' }).click()
  await pickOptions(page, 'Segmentos', ['Chinchiná'])
  await dialog.getByRole('button', { name: 'Quitar', exact: true }).click()
  await expect(page.getByText('Se quitó el segmento «Chinchiná» a 1 cliente.')).toBeVisible()
  await expect(customerRow(page, 'Beto Grado 4').locator('.v-chip', { hasText: 'Chinchiná' })).toHaveCount(0)

  // The window of segments: counts, a repeated name, rename and delete.
  await page.getByRole('button', { name: 'Segmentos', exact: true }).click()
  const manager = page.getByRole('dialog').filter({ hasText: 'Eliminar un segmento no elimina a sus clientes.' })
  await expect(manager.locator('.v-list-item', { hasText: 'Chinchiná' })).toContainText('1 cliente')
  await expect(manager.locator('.v-list-item', { hasText: 'Grado 5' })).toContainText('3 clientes')
  await manager.getByLabel('Nuevo segmento').fill('grado 5')
  await manager.getByRole('button', { name: 'Crear' }).click()
  await expect(manager).toContainText('Ya tienes el segmento «Grado 5»: elígelo de la lista en lugar de crearlo otra vez.')

  await manager.getByRole('button', { name: 'Renombrar el segmento Chinchiná' }).click()
  await manager.getByLabel('Nuevo nombre de Chinchiná').fill('Chinchiná Caldas')
  await manager.getByRole('button', { name: 'Guardar el nombre del segmento Chinchiná' }).click()
  await expect(page.getByText('Segmento renombrado: ahora se llama «Chinchiná Caldas».')).toBeVisible()
  await expect(manager.locator('.v-list-item', { hasText: 'Chinchiná Caldas' })).toContainText('1 cliente')

  page.once('dialog', confirm => {
    expect(confirm.message()).toBe('¿Seguro que quieres eliminar el segmento «Torre Norte»? Lo tiene 1 cliente: sigue en tu lista, solo pierde la etiqueta.')
    confirm.accept()
  })
  await manager.getByRole('button', { name: 'Eliminar el segmento Torre Norte' }).click()
  await expect(page.getByText('Segmento «Torre Norte» eliminado. El cliente que lo tenía sigue en tu lista.')).toBeVisible()
  await manager.getByRole('button', { name: 'Cerrar' }).click()

  await expect(customerRow(page, 'Carla Otro Colegio').locator('.v-chip', { hasText: 'Chinchiná Caldas' })).toBeVisible()
  await expect(dora).toBeVisible()
  await expect(dora.locator('.v-chip', { hasText: 'Torre Norte' })).toHaveCount(0)
})

/**
 * El tipo de persona y "cliente frecuente" se guardan: antes el backend los
 * descartaba y la tabla siempre decía "Natural" sin estrella.
 */
test('un cliente jurídico y frecuente se guarda así y se puede cambiar', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/clientes')

  const nombre = `Distribuidora E2E ${Date.now()}`
  await page.getByRole('button', { name: /Nuevo cliente/ }).click()

  const dialog = page.getByRole('dialog')
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: 'NIT' }).click()
  await field(page, 'Número de documento *').locator('input').fill(String(Date.now()))
  await field(page, 'Nombre / Razón social *').locator('input').fill(nombre)
  await field(page, 'Tipo de persona').click()
  await page.getByRole('option', { name: 'Persona jurídica' }).click()
  await dialog.getByLabel('Marcar como cliente frecuente').check()
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  const fila = page.locator('tr', { hasText: nombre })
  await expect(fila).toContainText('Jurídica')
  await expect(fila.locator('.mdi-star')).toBeVisible()

  // Al editar, el diálogo trae lo guardado; se vuelve natural y no frecuente.
  await fila.locator('.mdi-pencil').click()
  await expect(dialog.getByLabel('Marcar como cliente frecuente')).toBeChecked()
  await expect(field(page, 'Tipo de persona')).toContainText('Persona jurídica')
  await field(page, 'Tipo de persona').click()
  await page.getByRole('option', { name: 'Persona natural' }).click()
  await dialog.getByLabel('Marcar como cliente frecuente').uncheck()
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente actualizado exitosamente')).toBeVisible()
  await expect(fila).toContainText('Natural')
  await expect(fila.locator('.mdi-star-outline')).toBeVisible()
})

/**
 * Una cédula con puntos se guarda solo con números: antes quedaba tal cual,
 * el buscador no la encontraba por sus números y la misma persona se podía
 * crear dos veces.
 */
test('la cédula con puntos se guarda solo con números y escrita otra vez dice quién la tiene', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/clientes')

  const digits = `1${String(Date.now()).slice(-9)}`
  const dotted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const nombre = `Cédula Con Puntos ${digits}`
  const dialog = page.getByRole('dialog')
  const documento = field(page, 'Número de documento *').locator('input')

  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  await documento.fill('10O2.655.357')
  await documento.blur()
  await expect(dialog).toContainText('La cédula «10O2.655.357» tiene letras o símbolos: escribe solo los números del documento.')
  await page.waitForTimeout(400)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.screenshot({ path: '../screenshots/documentos-clientes-cedula-con-letra-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/documentos-clientes-cedula-con-letra-390.png' })
  await page.setViewportSize({ width: 1440, height: 900 })

  await documento.fill(dotted)
  await documento.blur()
  await expect(documento).toHaveValue(digits)
  await field(page, 'Nombre / Razón social *').locator('input').fill(nombre)
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  await expect(page.locator('tr', { hasText: nombre })).toContainText(digits)

  // La misma cédula, escrita con espacios: el backend la reconoce.
  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  await documento.fill(digits.replace(/(\d{3})(?=\d)/g, '$1 '))
  await field(page, 'Nombre / Razón social *').locator('input').fill(`${nombre} repetido`)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(`Ya existe un cliente con el documento ${digits}: ${nombre}. Búscalo en la lista en lugar de crearlo de nuevo.`)).toBeVisible()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  // Se encuentra buscándola con o sin puntos.
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(dotted)
  await expect(page.getByText('1-1 de 1')).toBeVisible()
  await expect(page.locator('tbody tr', { hasText: nombre })).toContainText(digits)
})

/**
 * La pestaña Proveedores vive junto a Clientes: trae un proveedor por defecto
 * (el nombre de la empresa, que no se puede borrar) y deja crear los demás.
 * Un NIT de proveedor tiene su DV como el de un cliente: se ve mientras se
 * escribe, lo calcula el sistema y uno equivocado dice el correcto. Antes
 * "900.123.456 - 7" se guardaba tal cual, aunque el DV de ese NIT es 8.
 */
test('la pestaña Proveedores trae el proveedor por defecto, calcula el DV del NIT y rechaza uno equivocado', async ({ page, request }) => {
  const company = await createCompany(request, 'dv-proveedores', { business_type: 'restaurant' })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/clientes')

  await page.getByRole('tab', { name: /Proveedores/ }).click()

  // El proveedor por defecto (nombre de la empresa) aparece marcado.
  await expect(page.getByText('Por defecto')).toBeVisible()

  const nombre = `Distribuidora E2E ${Date.now()}`
  await page.getByRole('button', { name: /Nuevo proveedor/ }).click()

  const dialog = page.getByRole('dialog')
  const documento = field(page, 'Número de documento').locator('input')
  const digit = field(page, 'DV').locator('input')
  await dialog.getByLabel('Nombre').fill(nombre)
  // A new supplier starts as a NIT, the DV next to it, read-only.
  await expect(field(page, 'Tipo de documento')).toContainText('NIT')
  await documento.fill('900.123.456')
  await expect(digit).toHaveValue(nitDigit('900123456'))
  await expect(digit).toHaveAttribute('readonly')

  await documento.fill('900.123.456 - 7')
  await documento.blur()
  await expect(dialog).toContainText('El dígito de verificación del NIT 900123456 es 8, no 7: revisa el número o escríbelo sin el dígito, que lo calcula el sistema.')
  await dialog.getByLabel('Teléfono').fill('3005551234')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Proveedor creado exitosamente')).toHaveCount(0)

  await documento.fill('900.123.456-8')
  await documento.blur()
  await expect(documento).toHaveValue('900123456')
  await expect(digit).toHaveValue('8')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Proveedor creado exitosamente')).toBeVisible()

  // In the list: the type, the number without its digit and the DV in its column.
  const row = page.locator('tbody tr', { hasText: nombre })
  // The Clientes tab keeps its own table in the page: only the open tab's headers.
  const headers = (await page.locator('.v-window-item--active .v-data-table thead th').allInnerTexts()).map(text => text.trim())
  expect(headers.slice(0, 4)).toEqual(['Nombre', 'Tipo doc', 'Documento', 'DV'])
  await expect(row.locator('td').nth(1)).toHaveText('NIT')
  await expect(row.locator('td').nth(2)).toHaveText('900123456')
  await expect(row.locator('td').nth(3)).toHaveText('8')

  // A cédula has its digit too; a passport has none.
  await row.getByRole('button', { name: `Editar el proveedor ${nombre}` }).click()
  await field(page, 'Tipo de documento').click()
  await page.getByRole('option', { name: 'Pasaporte' }).click()
  await expect(field(page, 'DV')).toHaveCount(0)
  await field(page, 'Tipo de documento').click()
  await page.getByRole('option', { name: 'Cédula de ciudadanía (CC)' }).click()
  await documento.fill('1.002.655.357')
  await expect(digit).toHaveValue(nitDigit('1002655357'))
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Proveedor actualizado exitosamente')).toBeVisible()
  await expect(row.locator('td').nth(1)).toHaveText('CC')
  await expect(row.locator('td').nth(2)).toHaveText('1002655357')
  await expect(row.locator('td').nth(3)).toHaveText('3')
})

/**
 * La lista pagina en el servidor: el buscador consulta al backend, así que
 * encuentra un cliente aunque esté en otra página, y el pie cuenta el total real.
 */
test('los clientes se ven por páginas y el buscador encuentra los de otra página', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const prefix = `Paginado ${Date.now()}`
  for (let n = 1; n <= 12; n++) {
    const created = await request.post(`${API}/customers`, {
      headers: auth,
      data: { document_type: 'CC', document_number: `${Date.now()}${n}`, name: `${prefix} ${String(n).padStart(2, '0')}` },
    })
    expect(created.status()).toBe(201)
  }

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/clientes')
  const searched = page.waitForRequest(r => r.url().includes('/api/customers?') && r.url().includes('q='))
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(prefix)
  expect((await searched).url()).toContain('per_page=')

  const rows = page.locator('tbody tr', { hasText: prefix })
  await expect(page.getByText('1-12 de 12')).toBeVisible()

  await page.locator('.v-data-table-footer__items-per-page .v-select').click()
  await page.getByRole('option', { name: '10', exact: true }).click()
  await expect(page.getByText('1-10 de 12')).toBeVisible()
  await expect(rows).toHaveCount(10)

  await page.getByRole('button', { name: 'Página siguiente' }).click()
  await expect(page.getByText('11-12 de 12')).toBeVisible()
  await expect(rows).toHaveCount(2)

  // Lo más reciente va primero: el 01 quedó en la segunda página y el buscador lo trae.
  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill(`${prefix} 01`)
  await expect(page.getByText('1-1 de 1')).toBeVisible()
  await expect(rows).toHaveText([new RegExp(`${prefix} 01`)])
})

/**
 * Valentina: "en la tab de clientes añadir la de importar clientes desde
 * Excel". A restaurant imports from Clientes with the same dialog as
 * Facturación automática, without the monthly fee: the tutorial and the
 * template leave those columns out, and a file that carries them sees them
 * ignored. A house of the same person keeps its letter; a NIT is stored
 * without its digit, and a wrong digit says the right one.
 */
test('importa clientes desde Clientes con la plantilla de un restaurante, sin las columnas de la cuota', async ({ page, request }) => {
  const company = await createCompany(request, 'importar-clientes', { business_type: 'restaurant' })
  const auth = { Authorization: `Bearer ${company.token}` }
  const existing = await request.post(`${API}/customers`, { headers: auth, data: { document_type: 'CC', document_number: '5001', name: 'Dora Existente' } })
  expect(existing.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/clientes')
  await page.getByRole('button', { name: 'Importar clientes desde Excel' }).click()

  const dialog = page.getByRole('dialog')
  const tutorial = dialog.locator('table').first()
  await expect(tutorial.getByRole('row', { name: /^numero_documento / })).toContainText('Obligatoria')
  await expect(tutorial.getByRole('row', { name: /^nombre / })).toContainText('Obligatoria')
  await expect(tutorial.getByRole('row', { name: /^cuota_mensual / })).toHaveCount(0)
  await expect(dialog).not.toContainText('facturación automática')
  await expect(dialog).toContainText('1000000001-A, 1000000001-B')

  // The template carries exactly the tutorial's columns, none of the fee.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Descargar plantilla' }).click(),
  ])
  expect(download.suggestedFilename()).toBe('plantilla_clientes.xlsx')
  const headers = xlsxRows(readFileSync(await download.path()))[0]!
  expect(headers).toEqual(await tutorial.locator('tbody tr td:first-child').allInnerTexts())
  expect(headers).not.toContain('cuota_mensual')

  // Its headers plus a condominium's fee column.
  const fileHeaders = [...headers, 'cuota_mensual']
  const fileRow = (cells: Record<string, string>) => fileHeaders.map(header => cells[header] ?? '')
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'clientes.xlsx',
    mimeType: XLSX,
    buffer: buildXlsx([
      fileHeaders,
      fileRow({ nombre: 'Ana Importada', numero_documento: '1001', cuota_mensual: '250.000' }),
      fileRow({ nombre: 'Ana Casa B', numero_documento: '1001-b' }),
      fileRow({ nombre: 'Bancolombia Importado', tipo_documento: 'NIT', numero_documento: '890.903.938-8' }),
      fileRow({ nombre: 'Davivienda Mal Escrito', tipo_documento: 'NIT', numero_documento: '860.034.313-1' }),
      fileRow({ nombre: 'Dora Cambiada', numero_documento: '5001' }),
    ]),
  })
  await dialog.getByRole('button', { name: 'Revisar archivo' }).click()
  await expect(dialog).toContainText('3 clientes se pueden crear. 1 fila se salta. 1 fila tiene errores y no se importa.')
  await expect(dialog).toContainText('Tu negocio no tiene facturación automática: no usamos las columnas de la cuota (cuota_mensual). Los clientes se crean sin cuota.')
  await expect(dialog).not.toContainText('No usamos estas columnas porque no las reconocimos')
  await expect(dialog.getByRole('columnheader', { name: 'Cuota' })).toHaveCount(0)
  const resultRow = (text: string) => dialog.locator('tbody tr', { hasText: text })
  await expect(resultRow('Davivienda Mal Escrito')).toContainText('El dígito de verificación del NIT 860034313 es 7, no 1: revisa el número o escríbelo sin el dígito, que lo calcula el sistema.')
  await expect(resultRow('Ana Casa B')).toContainText('El documento «1001-b» queda como 1001-B.')
  await expect(resultRow('Bancolombia Importado')).toContainText('El documento «890.903.938-8» queda como 890903938.')
  await expect(resultRow('Dora Cambiada')).toContainText('Ya existe: Dora Existente tiene el documento 5001. No se modificó.')

  await dialog.getByRole('button', { name: 'Importar 3 clientes' }).click()
  await expect(dialog.locator('.v-alert').first()).toContainText('Se crearon 3 clientes. 1 fila se salta. 1 fila tiene errores y no se importa.')
  await dialog.getByRole('button', { name: 'Cerrar' }).click()

  // In the list: the number as stored, the computed DV next to it, and the house with its letter.
  await expect(customerRow(page, 'Bancolombia Importado').locator('td').nth(2)).toHaveText('890903938')
  await expect(customerRow(page, 'Bancolombia Importado').locator('td').nth(3)).toHaveText('8')
  await expect(customerRow(page, 'Ana Casa B').locator('td').nth(2)).toHaveText('1001-B')
  await expect(customerRow(page, 'Ana Casa B').locator('td').nth(3)).toHaveText('2')
  await expect(customerRow(page, 'Dora Cambiada')).toHaveCount(0)
  const customers = await (await request.get(`${API}/customers`, { headers: auth })).json()
  expect(customers.data.find((c: { name: string }) => c.name === 'Ana Importada')).toMatchObject({ recurring_active: false, monthly_fee: null })
})

/**
 * "Todos los RUT tienen el NIT y un dígito de verificación": the form shows
 * it live, read-only, for a NIT and a cédula (the system computes it, DIAN
 * algorithm); a digit typed wrong says the right one, and the list shows it.
 */
test('el DV se calcula mientras se escribe el NIT o la cédula y un DV equivocado dice el correcto', async ({ page, request }) => {
  const company = await createCompany(request, 'dv-clientes', { business_type: 'restaurant' })
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/clientes')

  const dialog = page.getByRole('dialog')
  const documento = field(page, 'Número de documento *').locator('input')
  const digit = field(page, 'DV').locator('input')
  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: 'NIT' }).click()

  // Bancolombia's NIT 890903938 has the digit 8.
  await documento.fill('890.903.938')
  await expect(digit).toHaveValue('8')
  await expect(digit).toHaveAttribute('readonly')

  await documento.fill('860.034.313-1')
  await documento.blur()
  await expect(dialog).toContainText('El dígito de verificación del NIT 860034313 es 7, no 1: revisa el número o escríbelo sin el dígito, que lo calcula el sistema.')
  await expect(digit).toHaveValue('7')
  await documento.fill('860.034.313-7')
  await documento.blur()
  await expect(documento).toHaveValue('860034313')
  await expect(digit).toHaveValue('7')
  await field(page, 'Nombre / Razón social *').locator('input').fill('Davivienda SA')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  await expect(customerRow(page, 'Davivienda SA').locator('td').nth(2)).toHaveText('860034313')
  await expect(customerRow(page, 'Davivienda SA').locator('td').nth(3)).toHaveText('7')

  // A cédula has its digit too (a natural person's RUT); a CE has none.
  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  await documento.fill('1.002.655.357')
  await expect(digit).toHaveValue('3')
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: 'Cédula de extranjería (CE)' }).click()
  await expect(field(page, 'DV')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
})

/**
 * Valentina: "se puede guardar el número de documento del cliente con el
 * número y guion A, B, C": one person with two houses is two customers. The
 * list tells them apart by the letter, the number finds both, and an exact
 * repeat is refused saying which letter is free.
 */
test('dos clientes con el mismo documento se distinguen con -A y -B, y el repetido sugiere la letra que sigue', async ({ page, request }) => {
  const company = await createCompany(request, 'casas-clientes', { business_type: 'restaurant' })
  const created = await request.post(`${API}/customers`, {
    headers: { Authorization: `Bearer ${company.token}` },
    data: { document_type: 'CC', document_number: '1002655357-A', name: 'Ana Casa Norte' },
  })
  expect(created.status()).toBe(201)
  await loginUI(page, company.credentials.email, company.credentials.password)
  await page.goto('/clientes')

  const dialog = page.getByRole('dialog')
  const documento = field(page, 'Número de documento *').locator('input')
  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  await documento.fill('1.002.655.357-b')
  await documento.blur()
  await expect(documento).toHaveValue('1002655357-B')
  await expect(field(page, 'DV').locator('input')).toHaveValue('3')
  await field(page, 'Nombre / Razón social *').locator('input').fill('Ana Casa Sur')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()

  await expect(customerRow(page, 'Ana Casa Norte').locator('td').nth(2)).toHaveText('1002655357-A')
  await expect(customerRow(page, 'Ana Casa Sur').locator('td').nth(2)).toHaveText('1002655357-B')

  await page.getByRole('button', { name: /Nuevo cliente/ }).click()
  await documento.fill('1002655357-a')
  await field(page, 'Nombre / Razón social *').locator('input').fill('Ana repetida')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText(
    'Ya existe un cliente con el documento 1002655357-A: Ana Casa Norte. Búscalo en la lista en lugar de crearlo de nuevo. Si es otro cliente con el mismo documento (otra casa, otro local), agrega un guion y una letra al final: 1002655357-C, 1002655357-D…',
  )).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('textbox', { name: 'Buscar cliente' }).fill('1.002.655.357')
  await expect(page.getByText('1-2 de 2')).toBeVisible()
})
