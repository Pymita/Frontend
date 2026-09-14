import { expect, test } from '@playwright/test'
import { API, apiLogin, loginUI } from './helpers'

const PLATFORM = { email: 'plataforma@saboresdeltrigo.com', password: 'plataforma123' }

/**
 * Catálogos base: una empresa nueva arranca con productos ya cargados en vez
 * de con la app vacía. Se elige qué traerse de una empresa plantilla.
 */
test('la plataforma copia parte de un catálogo base a una empresa nueva', async ({ page, request }) => {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const auth = { Authorization: `Bearer ${token}` }

  const created = await request.post(`${API}/platform/companies`, {
    headers: auth,
    data: {
      name: 'Billar Copia E2E',
      business_type: 'billiard',
      admin: {
        name: 'Dueño Copia E2E',
        email: 'dueno.copia.e2e@ejemplo.com',
        password: 'Secreta123',
      },
    },
  })
  expect(created.status()).toBe(201)
  const companyId = (await created.json()).data.id

  await loginUI(page, PLATFORM.email, PLATFORM.password)
  await page.goto('/plataforma')

  // Las plantillas se distinguen de los clientes reales en la lista.
  await expect(page.getByText('Plantilla', { exact: true }).first()).toBeVisible()

  const row = page.locator('tr', { hasText: 'Billar Copia E2E' })
  await row.locator('.mdi-content-duplicate').click()

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Copiar catálogo base a Billar Copia E2E')).toBeVisible()

  // Traerse solo una categoría del catálogo de billar.
  const cervezas = dialog.locator('.v-expansion-panel', { hasText: 'Cervezas' })
  await cervezas.locator('input[type="checkbox"]').first().check()

  await dialog.getByRole('button', { name: 'Copiar', exact: true }).click()
  await expect(page.getByText(/Se copiaron \d+ productos/)).toBeVisible()

  // La empresa quedó con esos productos y sin inventario propio.
  const detail = await request.get(`${API}/platform/companies/${companyId}`, { headers: auth })
  expect(detail.ok()).toBeTruthy()

  const admin = await apiLogin(request, 'dueno.copia.e2e@ejemplo.com', 'Secreta123')
  const products = await request.get(`${API}/products`, {
    headers: { Authorization: `Bearer ${admin}` },
  })
  const list = (await products.json()).data

  expect(list.length).toBeGreaterThan(0)
  expect(list.every((product: any) => product.current_stock === null)).toBe(true)
})
