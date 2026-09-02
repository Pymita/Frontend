import { expect, test } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, apiLogin, loginUI, sidebarItem } from './helpers'

/**
 * Acceso por permisos: quien solo toma pedidos usa la app y no entra a la
 * web; quien tiene alguna sección de gestión entra, pero solo ve la suya.
 *
 * Patrón: preparar por API (rápido), verificar por interfaz (lo real).
 */
/** Crea un empleado con los permisos dados y devuelve sus credenciales. */
async function createEmployee(request: any, slug: string, permissions: string[]) {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  // Los empleados son del negocio: usuario interno, sin correo personal.
  const credentials = { username: slug, password: 'secreto123' }

  const response = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: slug, role: 'employee', permissions, ...credentials },
  })
  expect(response.status()).toBe(201)

  return credentials
}

test('un mesero (solo pedidos) no puede entrar a la web de gestión', async ({ page, request }) => {
  const waiter = await createEmployee(request, 'mesero.restringido', ['orders'])

  await page.goto('/login')
  await page.getByLabel('Correo o usuario').fill(waiter.username)
  await page.getByLabel('Código del negocio').fill(COMPANY_SLUG)
  await page.getByLabel('Contraseña', { exact: true }).fill(waiter.password)
  await page.getByRole('button', { name: /iniciar/i }).click()

  // La web lo rechaza y le explica que su cuenta es para la app.
  await expect(page.getByText(/app de meseros/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('empleado con acceso limitado solo ve sus secciones', async ({ page, request }) => {
  // Con al menos una sección de gestión sí entra a la web.
  const cashier = await createEmployee(request, 'cajero.limitado', ['orders', 'reports'])

  await loginUI(page, cashier.username, cashier.password)

  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()
  await expect(sidebarItem(page, 'Dashboard')).toBeVisible()

  // No ve lo que no le habilitaron:
  for (const hidden of ['Categorías', 'Productos', 'Recetas', 'Kardex', 'Clientes', 'Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, hidden)).toHaveCount(0)
  }

  // Y aunque escriba la URL a mano, lo devuelve a una página permitida:
  await page.goto('/gastos')
  await expect(page).not.toHaveURL(/\/gastos/)
})

test('admin ve todas las secciones incluidas las administrativas', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)

  for (const item of ['Dashboard', 'Pedidos', 'Productos', 'Kardex', 'Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }

  // Pero no la de plataforma (es de super admin):
  await expect(sidebarItem(page, 'Plataforma')).toHaveCount(0)
})
