import { expect, test } from '@playwright/test'
import { API, apiLogin, loginUI, sidebarItem } from './helpers'

const PLATFORM = { email: 'plataforma@saboresdeltrigo.com', password: 'plataforma123' }

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
  await page.getByRole('button', { name: /Nuevo Vendedor/ }).click()
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
  await page.getByLabel('Monto (COP)').fill('120000')
  await expect(page.getByText(/Indica el motivo de la diferencia/)).toBeVisible()
})
