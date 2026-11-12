import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { API, PLATFORM, acceptPrivacyPolicy, apiLogin, field, loginUI, pickOption, sidebarItem } from './helpers'

/**
 * Capa comercial de la plataforma: vendedores, precio acordado en la
 * suscripción, pagos que exigen motivo cuando difieren, y la pestaña de
 * ventas por vendedor.
 */
test('vendedor, pago con motivo obligatorio y estadísticas de ventas', async ({ page, request }) => {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()

  await loginUI(page, PLATFORM.email, PLATFORM.password)

  // --- Crear el vendedor por interfaz (sección de la barra lateral) ---
  await sidebarItem(page, 'Vendedores').click()
  await page.getByRole('button', { name: /Nuevo vendedor/ }).click()
  await page.getByLabel('Nombre *').fill(`Vendedora E2E ${stamp}`)
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Vendedor creado')).toBeVisible()
  await expect(page.locator('tr', { hasText: `Vendedora E2E ${stamp}` })).toBeVisible()

  // --- Empresa con acuerdo comercial (por API, rápido) ---
  const sellers = await (await request.get(`${API}/platform/sellers`, { headers: auth })).json()
  const seller = sellers.data.find((s: any) => s.name === `Vendedora E2E ${stamp}`)

  const created = await request.post(`${API}/platform/companies`, {
    headers: auth,
    data: {
      name: `Comercial E2E ${stamp}`,
      admin: { name: 'Dueño', email: `comercial.${stamp}@e2e.test`, password: 'clave1234' },
      monthly_price: 150000,
      max_tables: 12,
      max_users: 8,
      seller_id: seller.id,
    },
  })
  expect(created.status()).toBe(201)
  const companyId = (await created.json()).data.id

  // --- Pago distinto al acuerdo: rechazado sin motivo, aceptado con él ---
  const noReason = await request.post(`${API}/platform/companies/${companyId}/subscription/payments`, {
    headers: auth,
    data: { amount: 100000 },
  })
  expect(noReason.status()).toBe(422)

  const withReason = await request.post(`${API}/platform/companies/${companyId}/subscription/payments`, {
    headers: auth,
    data: { amount: 100000, discrepancy_reason: 'Descuento de lanzamiento E2E' },
  })
  expect(withReason.status()).toBe(201)

  // --- Ventas › Por vendedor muestra a la vendedora con su recaudo ---
  await sidebarItem(page, 'Ventas').click()
  const statsRow = page.getByRole('region', { name: 'Por vendedor' }).locator('tr', { hasText: `Vendedora E2E ${stamp}` })
  await expect(statsRow).toBeVisible()
  await expect(statsRow).toContainText('$100.000')

  // --- El diálogo de suscripción avisa la diferencia por interfaz ---
  await sidebarItem(page, 'Empresas').click()
  const companyRow = page.locator('tr', { hasText: `Comercial E2E ${stamp}` })
  await companyRow.locator('.mdi-credit-card-outline').click()
  const payment = page.getByLabel('Monto (COP)')
  await expect(payment).not.toHaveAttribute('type', 'number')
  await payment.fill('120.000')
  await expect(page.getByText(/Indica el motivo de la diferencia/)).toBeVisible()
  // "150.000" is the agreed fee, not 150 pesos: no reason asked, and it is paid.
  await payment.fill('150.000')
  await expect(page.getByText(/Indica el motivo de la diferencia/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Registrar pago y extender periodo' }).click()
  await expect(page.getByText('Pago registrado y periodo extendido')).toBeVisible()

  // The agreed fee reads with its dots and a new one is typed the same way.
  await companyRow.locator('.mdi-credit-card-outline').click()
  const fee = page.getByLabel('Valor mensual (COP)')
  await expect(fee).toHaveValue('150.000')
  await expect(fee).not.toHaveAttribute('type', 'number')
  await fee.fill('1.250.000')
  await page.getByRole('button', { name: 'Guardar suscripción' }).click()
  await expect(page.getByText('Suscripción guardada')).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).click()

  await sidebarItem(page, 'Ventas').click()
  await expect(statsRow).toContainText('$1.250.000')
  await expect(statsRow).toContainText('$250.000')
})

/**
 * Seguimiento comercial: una empresa vendida aparece en Novedades y en Ventas
 * con quién la vendió, qué incluye y su precio; su pago se reparte (vendedor,
 * socios, mantenimiento); una ampliación se vuelve el acuerdo de la empresa,
 * y las ventas se corrigen o, si son ampliaciones, se eliminan.
 */
test('ventas: la venta inicial, el reparto del pago y una ampliación que cambia el acuerdo', async ({ page, request }) => {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const sellerName = `Vendedor Ventas ${stamp}`
  // The companies list pages by 10 ordered by name: this one sorts before every other company.
  const companyName = `Aaron Billar ${stamp}`

  const seller = await (await request.post(`${API}/platform/sellers`, { headers: auth, data: { name: sellerName } })).json()
  const created = await request.post(`${API}/platform/companies`, {
    headers: auth,
    data: {
      name: companyName,
      city: 'Pereira',
      business_type: 'billiard',
      admin: { name: 'Dueña Ventas', email: `ventas.${stamp}@e2e.test`, password: 'clave1234' },
      monthly_price: 150000,
      seller_id: seller.data.id,
    },
  })
  expect(created.status()).toBe(201)
  const companyId = (await created.json()).data.id
  expect((await request.post(`${API}/platform/companies/${companyId}/subscription/payments`, { headers: auth, data: { amount: 150000 } })).status()).toBe(201)

  await loginUI(page, PLATFORM.email, PLATFORM.password)

  // --- Empresas › Novedades: la empresa de hoy con su ciudad, su precio y quién la vendió ---
  const news = page.getByRole('region', { name: 'Novedades' })
  await expect(news.getByText(/^Hoy, \d{2} de .+ de \d{4}\. \d+ clientes? activos?: /)).toBeVisible()
  await news.getByRole('button', { name: /Empresas nuevas/ }).click()
  const newCompany = news.getByRole('list', { name: 'Empresas nuevas' }).getByRole('listitem').filter({ hasText: companyName })
  await expect(newCompany).toContainText('Pereira · Billar')
  await expect(newCompany).toContainText('$150.000/mes')
  await expect(newCompany).toContainText(`Vendió ${sellerName}`)
  await expect(newCompany).toContainText(`ventas.${stamp}@e2e.test`)
  await expect(newCompany).toContainText('Activa')
  await expect(page.locator('tr', { hasText: companyName }).filter({ hasText: 'usuarios' })).toContainText('· Pereira')

  // The payment's split, in the company's history.
  await page.getByRole('button', { name: `Ver detalle de ${companyName}` }).click()
  const detail = page.getByRole('dialog').filter({ hasText: 'Historial de pagos' })
  await expect(detail.locator('tr', { hasText: '$150.000' })).toContainText(`${sellerName} $45.000`)
  await detail.getByRole('button', { name: 'Cerrar' }).click()

  // --- Ventas: la venta inicial, el reparto y el vendedor ---
  await sidebarItem(page, 'Ventas').click()
  await expect(page.getByRole('heading', { name: 'Ventas', exact: true })).toBeVisible()
  const sales = page.getByRole('region', { name: 'Ventas del periodo' })
  const firstSale = sales.locator('tr', { hasText: companyName }).filter({ hasText: 'Nueva' })
  await expect(firstSale).toContainText('Pereira · Activa')
  await expect(firstSale).toContainText(sellerName)
  await expect(firstSale).toContainText('Cobro por tiempo')
  await expect(firstSale).toContainText('10 mesas · 5 empleados · plan standard')
  await expect(firstSale).toContainText('$150.000')

  const split = page.getByRole('region', { name: 'Reparto de lo recaudado' })
  await expect(split.locator('tr', { hasText: sellerName })).toContainText('$45.000')
  for (const partner of ['Valentina', 'Mauricio', 'Mantenimiento']) {
    await expect(split.locator('tr', { hasText: partner })).toBeVisible()
  }
  await expect(page.getByRole('region', { name: 'Por vendedor' }).locator('tr', { hasText: sellerName })).toContainText('$45.000')

  // Only this seller's sales.
  await field(page, 'Vendedor').click()
  await pickOption(page, sellerName)
  await expect(sales.locator('tbody tr')).toHaveCount(1)
  await expect(sales.locator('tbody tr')).toContainText(companyName)
  await page.getByRole('button', { name: 'Borrar Vendedor' }).click()
  await expect(sales.locator('tbody tr', { hasText: companyName })).toHaveCount(1)

  // --- Registrar ampliación: parte del acuerdo de hoy y lo reemplaza ---
  await page.getByRole('button', { name: 'Registrar ampliación' }).click()
  const upgrade = page.getByRole('dialog').filter({ hasText: 'Registrar ampliación' })
  await upgrade.getByLabel('Empresa *').fill(companyName)
  await pickOption(page, companyName)
  await expect(upgrade.getByText(`Hoy paga $150.000.`)).toBeVisible()
  const fee = upgrade.getByLabel('Nuevo valor mensual (COP) *')
  await expect(fee).toHaveValue('150.000')
  await fee.fill('200.000')
  await upgrade.getByLabel('Mesas incluidas').fill('15')
  await upgrade.getByLabel('Recetas').check()
  await upgrade.getByLabel('Notas (opcional)').fill('Le sumamos recetas')
  await upgrade.getByRole('button', { name: 'Registrar ampliación' }).click()
  await expect(page.getByText(`Ampliación registrada: "${companyName}" queda con los módulos, el valor mensual y los límites de esta venta.`)).toBeVisible()
  await expect(upgrade).toHaveCount(0)

  const upgradeRow = sales.locator('tr', { hasText: companyName }).filter({ hasText: 'Ampliación' })
  await expect(upgradeRow).toContainText('$200.000')
  await expect(upgradeRow).toContainText('antes $150.000')
  await expect(upgradeRow).toContainText('Recetas')
  await expect(upgradeRow).toContainText('15 mesas')
  await expect(upgradeRow).toContainText('Le sumamos recetas')
  await expect(upgradeRow).toContainText('Sin vendedor')

  // --- Corregir la venta inicial ---
  await page.getByRole('button', { name: `Editar la venta inicial de ${companyName}` }).click()
  const edit = page.getByRole('dialog').filter({ hasText: 'Editar venta' })
  await expect(edit.getByText('También es el vendedor de la suscripción. Los pagos ya registrados conservan su reparto.')).toBeVisible()
  await edit.getByLabel('Notas (opcional)').fill('Cerrada en la feria')
  await edit.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Venta actualizada')).toBeVisible()
  await expect(firstSale).toContainText('Cerrada en la feria')

  // --- Eliminar la ampliación: el acuerdo de la empresa no cambia ---
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: `Eliminar la ampliación de ${companyName}` }).click()
  await expect(page.getByText(`Se eliminó la ampliación de "${companyName}". La empresa conserva sus módulos, su valor mensual y sus límites actuales.`)).toBeVisible()
  await expect(upgradeRow).toHaveCount(0)
  await expect(page.getByRole('button', { name: `Eliminar la ampliación de ${companyName}` })).toHaveCount(0)

  await sidebarItem(page, 'Empresas').click()
  await page.getByRole('button', { name: `Suscripción de ${companyName}` }).click()
  await expect(page.getByLabel('Valor mensual (COP)')).toHaveValue('200.000')
  await expect(page.getByLabel('Límite de mesas')).toHaveValue('15')
})

/**
 * Una cuenta de prueba (una demo, una copia para ensayar) no es un cliente:
 * marcada desde su fila, sale de Novedades y de Ventas, y vuelve al marcarla
 * como cliente real.
 */
test('una cuenta de prueba no cuenta en Novedades ni en Ventas hasta marcarla como cliente real', async ({ page, request }) => {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const stamp = Date.now()
  // The companies list pages by 10 ordered by name: this one sorts before every other company.
  const name = `Aaron Demo ${stamp}`
  const created = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name, monthly_price: 90000, admin: { name: 'Dueña Demo', email: `demo.${stamp}@e2e.test`, password: 'clave1234' } },
  })
  expect(created.status()).toBe(201)

  await loginUI(page, PLATFORM.email, PLATFORM.password)
  const news = page.getByRole('region', { name: 'Novedades' })
  const listed = news.getByRole('listitem').filter({ hasText: name })
  await news.getByRole('button', { name: /Empresas nuevas/ }).click()
  await expect(listed).toBeVisible()
  const row = page.locator('tr', { hasText: name }).filter({ hasText: 'usuarios' })
  await expect(row.getByText('Cuenta de prueba')).toHaveCount(0)

  await page.getByRole('button', { name: `Marcar ${name} como cuenta de prueba` }).click()
  await expect(page.getByText(`"${name}" quedó como cuenta de prueba: ya no cuenta en Novedades, Ventas ni comisiones.`)).toBeVisible()
  await expect(row.getByText('Cuenta de prueba')).toBeVisible()
  await expect(listed).toHaveCount(0)
  await expect(news.getByText(/cuentas? de prueba no cuentan?\./)).toBeVisible()

  await sidebarItem(page, 'Ventas').click()
  const sales = page.getByRole('region', { name: 'Ventas del periodo' })
  await expect(sales.getByText('Nueva').first()).toBeVisible()
  await expect(sales.locator('tr', { hasText: name })).toHaveCount(0)

  // It became a customer after all: it counts again.
  await sidebarItem(page, 'Empresas').click()
  await page.getByRole('button', { name: `Marcar ${name} como cliente real` }).click()
  await expect(page.getByText(`"${name}" volvió a contar como cliente real.`)).toBeVisible()
  await expect(row.getByText('Cuenta de prueba')).toHaveCount(0)
  // Coming back from Ventas mounts the view again, with its panels closed.
  await news.getByRole('button', { name: /Empresas nuevas/ }).click()
  await expect(listed).toBeVisible()
  await sidebarItem(page, 'Ventas').click()
  await expect(sales.locator('tr', { hasText: name })).toContainText('$90.000')
})

/**
 * Los campos obligatorios de "Nueva empresa" se ven como tales al abrir el
 * formulario, no solo cuando falla el guardado.
 */
test('nueva empresa marca los campos obligatorios desde que se abre', async ({ page }) => {
  await loginUI(page, PLATFORM.email, PLATFORM.password)
  await page.getByRole('button', { name: /Nueva empresa/ }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Nueva empresa' })
  for (const label of ['Nombre de la empresa *', 'Nombre del administrador *', 'Correo de acceso *', 'Contraseña inicial *', 'Confirmar contraseña *']) {
    await expect(dialog.getByLabel(label)).toBeVisible()
  }
  // Los opcionales siguen diciendo que lo son, y aún no hay errores en rojo.
  await expect(dialog.getByLabel('Correo (opcional)')).toBeVisible()
  await expect(dialog.getByText('Nombre requerido')).toHaveCount(0)

  await page.waitForTimeout(400)
  await page.screenshot({ path: '../screenshots/nueva-empresa-obligatorios.png' })

  // The agreed fee is typed as pesos: "1.250.000" is a million and a quarter.
  const stamp = Date.now()
  await dialog.getByLabel('Nombre de la empresa *').fill(`Cuota E2E ${stamp}`)
  await dialog.getByLabel('Nombre del administrador *').fill('Dueña Cuota')
  await dialog.getByLabel('Correo de acceso *').fill(`cuota.${stamp}@e2e.test`)
  const fee = dialog.getByLabel('Valor mensual (COP)')
  await expect(fee).not.toHaveAttribute('type', 'number')
  await fee.fill('1.250.000')

  // The password is asked twice and each field shows what was typed on demand.
  const password = dialog.getByLabel('Contraseña inicial *')
  const confirmation = dialog.getByLabel('Confirmar contraseña *')
  await password.fill('clave1234')
  await confirmation.fill('clave1243')
  await expect(password).toHaveAttribute('type', 'password')
  await field(page, 'Contraseña inicial *').getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('clave1234')
  await expect(field(page, 'Contraseña inicial *').getByRole('button', { name: 'Ocultar contraseña' })).toBeVisible()
  await expect(confirmation).toHaveAttribute('type', 'password')
  await field(page, 'Confirmar contraseña *').getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(confirmation).toHaveAttribute('type', 'text')
  await expect(confirmation).toHaveValue('clave1243')

  // A typo in the confirmation blocks creating the company.
  await dialog.getByRole('button', { name: 'Crear empresa' }).click()
  await expect(dialog.getByText('Las contraseñas no coinciden.')).toBeVisible()
  await expect(dialog).toBeVisible()
  await confirmation.scrollIntoViewIfNeeded()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/confirmar-contrasena-nueva-empresa-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await confirmation.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/confirmar-contrasena-nueva-empresa-390.png' })
  await page.setViewportSize({ width: 1280, height: 720 })
  const token = await apiLogin(page.request, PLATFORM.email, PLATFORM.password)
  const companies = await (await page.request.get(`${API}/platform/companies`, { headers: { Authorization: `Bearer ${token}` } })).json()
  expect(companies.data.some((c: { name: string }) => c.name === `Cuota E2E ${stamp}`)).toBe(false)

  await confirmation.fill('clave1234')
  await expect(dialog.getByText('Las contraseñas no coinciden.')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Crear empresa' }).click()
  await expect(page.getByText('Empresa creada exitosamente')).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await apiLogin(page.request, `cuota.${stamp}@e2e.test`, 'clave1234')

  await page.locator('tr', { hasText: `Cuota E2E ${stamp}` }).locator('.mdi-credit-card-outline').click()
  await expect(page.getByLabel('Valor mensual (COP)')).toHaveValue('1.250.000')
  // The admin signs in with the password that was confirmed.
  await apiLogin(page.request, `cuota.${stamp}@e2e.test`, 'clave1234')
})

/**
 * "Eliminar empresa": una empresa que se fue se borra desde el panel con las
 * reglas de tenant:delete. Desactivada, con su copia descargada y su código
 * escrito; una activa tiene el botón apagado y dice por qué.
 */
test('eliminar una empresa desactivada después de descargar su copia', async ({ page, request }) => {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()

  const create = async (name: string, email: string) => {
    const response = await request.post(`${API}/platform/companies`, {
      headers: auth,
      data: { name, admin: { name: 'Dueña E2E', email, password: 'clave1234' } },
    })
    expect(response.status()).toBe(201)
    return (await response.json()).data as { id: number; name: string; slug: string }
  }
  // The list pages by 10 ordered by name: these sort before every other company.
  const leavingEmail = `adios.${stamp}@e2e.test`
  const leaving = await create(`Adiós E2E ${stamp}`, leavingEmail)
  const staying = await create(`Abierta E2E ${stamp}`, `abierta.${stamp}@e2e.test`)

  const ownerToken = await apiLogin(request, leavingEmail, 'clave1234')
  const category = await request.post(`${API}/categories`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: { name: `Bebidas ${stamp}` },
  })
  expect(category.status()).toBe(201)
  expect((await request.post(`${API}/platform/companies/${leaving.id}/toggle-active`, { headers: auth })).ok()).toBeTruthy()

  await loginUI(page, PLATFORM.email, PLATFORM.password)

  // Active: the button is there, off, and its tooltip says what to do.
  const activeButton = page.getByRole('button', { name: `Eliminar la empresa ${staying.name}` })
  await expect(activeButton).toBeDisabled()
  const activator = activeButton.locator('xpath=..')
  await activator.hover()
  const tooltip = page.locator(`#${await activator.getAttribute('aria-describedby')}`)
  await expect(tooltip).toBeVisible()
  await expect(tooltip).toHaveText('Desactívala primero para poder eliminarla')

  const row = page.locator('tr', { hasText: leaving.name })
  await expect(row.getByText('Inactiva', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Eliminar la empresa ${leaving.name}` }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: `Eliminar ${leaving.name}` })
  await expect(dialog.getByText('Lo que se borra')).toBeVisible()
  const planCount = (label: string) =>
    dialog.locator('tr').filter({ has: page.getByRole('cell', { name: label, exact: true }) }).getByRole('cell').nth(1)
  await expect(planCount('Categorías')).toHaveText('1')
  await expect(planCount('Usuarios')).toHaveText('1')
  await expect(dialog.getByText('Aún no has descargado una copia.')).toBeVisible()

  // Its trial ends in 15 days: only the business's request skips the 90 days.
  const remove = dialog.getByRole('button', { name: 'Eliminar definitivamente' })
  const confirm = dialog.getByLabel(`Escribe ${leaving.slug} para confirmar`)
  await confirm.fill(leaving.slug)
  await expect(remove).toBeDisabled()
  await expect(dialog.getByText(/Sin esa solicitud, se puede eliminar desde el/)).toBeVisible()
  await dialog.getByLabel('El negocio pidió la eliminación (no esperar 90 días)').check()
  await expect(remove).toBeDisabled()
  await expect(dialog.getByLabel('Eliminar sin copia')).toBeVisible()

  // The copy is the tenant:export file of this company, and it counts as its copy.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Descargar copia' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(new RegExp(`^${leaving.slug}-\\d{8}-\\d{6}\\.json$`))
  const bundle = JSON.parse(readFileSync(await download.path(), 'utf8'))
  expect(bundle.format).toBe('servify-tenant')
  expect(bundle.company.slug).toBe(leaving.slug)
  expect(bundle.tables.categories.map((c: { name: string }) => c.name)).toEqual([`Bebidas ${stamp}`])
  await expect(dialog.getByText(/^Última copia: /)).toBeVisible()
  await expect(dialog.getByLabel('Eliminar sin copia')).toHaveCount(0)

  // Only its exact code turns the button on.
  await confirm.fill(`${leaving.slug}x`)
  await expect(remove).toBeDisabled()
  await confirm.fill(leaving.slug)
  await expect(remove).toBeEnabled()
  await remove.click()

  await expect(
    page.getByText(`Se eliminaron los datos de "${leaving.name}". Quedan la empresa desactivada, su suscripción, sus pagos y sus ventas.`),
  ).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(row.getByText('Datos eliminados', { exact: true })).toBeVisible()
  await expect(row.getByText('Inactiva', { exact: true })).toHaveCount(0)
  await expect(row).toContainText('0 usuarios')
  await expect(page.locator('tr', { hasText: staying.name }).getByText('Activa', { exact: true })).toBeVisible()

  // Its admin no longer exists.
  const login = await request.post(`${API}/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { email: leavingEmail, password: 'clave1234' },
  })
  expect(login.status()).toBe(422)
  expect((await login.json()).message).toBe('Correo, usuario o contraseña incorrectos.')
})

/**
 * La dueña no se maneja con el enlace del correo: desde Plataforma le ponen
 * una contraseña temporal y se la dictan por teléfono. Al entrar con ella la
 * web no la deja hacer nada más que cambiarla; después sigue a Inicio y la
 * temporal ya no sirve.
 */
test('la plataforma le dicta una contraseña temporal a una dueña y al entrar debe cambiarla', async ({ page, request }) => {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const stamp = Date.now()
  const owner = `Dueña Temporal ${stamp}`
  const email = `temporal.${stamp}@e2e.test`
  // The list pages by 10 ordered by name: this one sorts before every other company.
  const companyName = `Abarrotes E2E ${stamp}`
  const created = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: companyName, admin: { name: owner, email, password: 'inicial2026' } },
  })
  expect(created.status()).toBe(201)
  // She accepted the policy with her first password, so its dialog does not cover the step under test.
  await acceptPrivacyPolicy(request, email, 'inicial2026')
  const ownerToken = await apiLogin(request, email, 'inicial2026')
  const employee = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
    data: { name: `Cajero ${stamp}`, username: `cajero${stamp}`, password: 'cajero2026', role: 'employee' },
  })
  expect(employee.status()).toBe(201)

  await loginUI(page, PLATFORM.email, PLATFORM.password)
  await page.getByRole('button', { name: `Ver detalle de ${companyName}` }).click()
  const detail = page.getByRole('dialog').filter({ hasText: 'Historial de pagos' })
  await expect(detail.locator('tr', { hasText: `Cajero ${stamp}` })).toBeVisible()
  // Only an admin gets the action: an employee's password is the admin's, in Empleados.
  await expect(page.getByRole('button', { name: `Restablecer la contraseña de Cajero ${stamp}` })).toHaveCount(0)
  await page.getByRole('button', { name: `Restablecer la contraseña de ${owner}` }).click()

  const dialog = page.getByRole('dialog').filter({ hasText: 'Restablecer contraseña' })
  await expect(dialog.getByText(`${owner} · ${email}`)).toBeVisible()
  await expect(dialog.getByText('Díctasela al dueño: al entrar, el sistema le pedirá cambiarla.')).toBeVisible()
  const temporary = dialog.getByLabel('Contraseña temporal *')
  const confirmation = dialog.getByLabel('Confirmar contraseña *')
  await temporary.fill('Temporal2026')
  await confirmation.fill('Temporal2062')
  await expect(temporary).toHaveAttribute('type', 'password')
  await field(page, 'Contraseña temporal *').getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(temporary).toHaveAttribute('type', 'text')
  await expect(temporary).toHaveValue('Temporal2026')
  await expect(confirmation).toHaveAttribute('type', 'password')
  await dialog.getByRole('button', { name: 'Guardar contraseña temporal' }).click()
  await expect(dialog.getByText('Las contraseñas no coinciden.')).toBeVisible()
  await expect(dialog).toBeVisible()

  await confirmation.fill('Temporal2026')
  await dialog.getByRole('button', { name: 'Guardar contraseña temporal' }).click()
  await expect(
    page.getByText(`Guardamos la contraseña temporal de ${owner}. Al entrar con ella, el sistema le pedirá cambiarla.`),
  ).toBeVisible()
  await expect(dialog).toHaveCount(0)
  await expect(detail.locator('tr', { hasText: owner }).getByText('Contraseña temporal', { exact: true })).toBeVisible()
  // Her first password stopped working the moment it was saved.
  const first = await request.post(`${API}/auth/login`, { headers: { Accept: 'application/json' }, data: { email, password: 'inicial2026' } })
  expect(first.status()).toBe(422)

  const signIn = async (password: string) => {
    await page.goto('/login')
    await page.getByLabel('Correo o usuario').fill(email)
    await page.getByLabel('Contraseña', { exact: true }).fill(password)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
  }
  await detail.getByRole('button', { name: 'Cerrar' }).click()
  await sidebarItem(page, 'Cerrar sesión').click()
  await page.waitForURL(/\/login/)

  // Right after signing in: only the new password is asked, with nothing of the app around it.
  await signIn('Temporal2026')
  await expect(page.getByText('Cambia tu contraseña', { exact: true })).toBeVisible()
  await expect(page.getByText('Entraste con una contraseña temporal. Elige una nueva que solo tú conozcas para seguir usando Servify POS.')).toBeVisible()
  await expect(page.getByLabel('Contraseña temporal')).toHaveCount(0)
  await expect(page.locator('.v-navigation-drawer')).toHaveCount(0)
  await page.getByLabel('Contraseña nueva').fill('Temporal2026')
  await page.getByLabel('Confirmar contraseña').fill('Temporal2026')
  await page.getByRole('button', { name: 'Guardar y continuar' }).click()
  await expect(page.getByText('Elige una contraseña distinta de la temporal que te dieron.')).toBeVisible()

  // Any other page lands back on the step, which now asks for the temporary password too.
  await page.goto('/pedidos')
  await expect(page).toHaveURL(/\/cambiar-contrasena$/)
  await expect(page.getByText('Cambia tu contraseña', { exact: true })).toBeVisible()
  await expect(page.locator('.v-navigation-drawer')).toHaveCount(0)
  await page.getByLabel('Contraseña temporal').fill('Temporal2062')
  await page.getByLabel('Contraseña nueva').fill('MiNegocio2026')
  await page.getByLabel('Confirmar contraseña').fill('MiNegocio2026')
  await page.getByRole('button', { name: 'Guardar y continuar' }).click()
  await expect(page.getByText('La contraseña temporal no es correcta.')).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/login$/)

  await signIn('Temporal2026')
  await page.getByLabel('Contraseña nueva').fill('MiNegocio2026')
  await page.getByLabel('Confirmar contraseña').fill('MiNegocio2026')
  await page.getByRole('button', { name: 'Guardar y continuar' }).click()
  await page.waitForURL(/\/dashboard/)
  await expect(page.locator('.v-app-bar-title')).toHaveText('Inicio')
  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()

  // The temporary one is gone; hers works.
  await sidebarItem(page, 'Cerrar sesión').click()
  await page.waitForURL(/\/login/)
  await signIn('Temporal2026')
  await expect(page.getByText('Correo, usuario o contraseña incorrectos.')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
  await signIn('MiNegocio2026')
  await page.waitForURL(/\/dashboard/)
  await expect(page.locator('.v-app-bar-title')).toHaveText('Inicio')
})
