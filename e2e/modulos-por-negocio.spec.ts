import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI, sidebarItem } from './helpers'

/**
 * El tipo de negocio decide qué módulos ve la empresa: un billar no debe
 * ver recetas y un restaurante no debe ver cobro por tiempo.
 *
 * Patrón: crear la empresa por API (rápido), verificar por interfaz.
 */

/** Crea una empresa del tipo dado con su admin y devuelve sus credenciales. */
async function createCompany(request: any, businessType: string, slug: string) {
  const superToken = await apiLogin(request, 'plataforma@saboresdeltrigo.com', 'plataforma123')

  const credentials = { email: `admin.${slug}@e2e.test`, password: 'negocio2026' }

  const response = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: {
      name: `E2E ${slug}`,
      business_type: businessType,
      admin: { name: 'Dueño E2E', ...credentials },
    },
  })
  expect(response.status()).toBe(201)

  return credentials
}

test('un billar no ve recetas pero sí cobro por tiempo', async ({ page, request }) => {
  const admin = await createCompany(request, 'billiard', 'billar')

  await loginUI(page, admin.email, admin.password)

  // Ve lo suyo...
  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()
  await expect(sidebarItem(page, 'Productos')).toBeVisible()
  await expect(sidebarItem(page, 'Mesas')).toBeVisible()

  // ...pero no las recetas, que son de restaurante.
  await expect(sidebarItem(page, 'Recetas')).toHaveCount(0)

  // Y la URL directa lo devuelve a otra página.
  await page.goto('/recetas')
  await expect(page).not.toHaveURL(/\/recetas/)

  // En cambio sí puede crear mesas de billar (tiene cobro por tiempo).
  await page.goto('/mesas')
  await page.getByRole('button', { name: /Nueva Mesa/i }).click()
  await expect(page.getByRole('dialog').getByText('Tipo de mesa').first()).toBeVisible()
})

test('un restaurante ve recetas y no ofrece mesas de billar', async ({ page, request }) => {
  const admin = await createCompany(request, 'restaurant', 'restaurante')

  await loginUI(page, admin.email, admin.password)

  await expect(sidebarItem(page, 'Recetas')).toBeVisible()

  // El selector de tipo de mesa no aparece: no tiene cobro por tiempo.
  await page.goto('/mesas')
  await page.getByRole('button', { name: /Nueva Mesa/i }).click()
  await expect(page.getByRole('dialog').getByText('Tipo de mesa')).toHaveCount(0)
})

test('la plataforma puede personalizar los módulos de una empresa', async ({ page, request }) => {
  const admin = await createCompany(request, 'billiard', 'hibrido')

  // El super admin le activa recetas al billar (negocio híbrido: billar con cocina).
  const superToken = await apiLogin(request, 'plataforma@saboresdeltrigo.com', 'plataforma123')
  const companies = await (
    await request.get(`${API}/platform/companies`, {
      headers: { Authorization: `Bearer ${superToken}` },
    })
  ).json()
  const company = companies.data.find((c: any) => c.slug === 'e2e-hibrido')
  expect(company).toBeTruthy()

  const updated = await request.put(`${API}/platform/companies/${company.id}`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { modules: [...company.modules, 'recipes'] },
  })
  expect(updated.ok()).toBeTruthy()

  // Ahora el admin del billar sí ve recetas.
  await loginUI(page, admin.email, admin.password)
  await expect(sidebarItem(page, 'Recetas')).toBeVisible()
  await expect(sidebarItem(page, 'Mesas')).toBeVisible()
})
