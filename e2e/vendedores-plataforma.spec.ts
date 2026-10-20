import { expect, test } from '@playwright/test'
import { API, PLATFORM, apiLogin, field, loginUI, sidebarItem } from './helpers'

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

  // --- La sección de estadísticas muestra a la vendedora con su recaudo ---
  await sidebarItem(page, 'Ventas por vendedor').click()
  const statsRow = page.locator('tr', { hasText: `Vendedora E2E ${stamp}` })
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

  await sidebarItem(page, 'Ventas por vendedor').click()
  await expect(statsRow).toContainText('$1.250.000')
  await expect(statsRow).toContainText('$250.000')
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
