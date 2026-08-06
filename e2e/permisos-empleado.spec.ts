import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI, sidebarItem } from './helpers'

/**
 * Un empleado con permiso solo de "Pedidos y mesas" no debe ver las
 * demás secciones ni poder entrar a ellas por URL.
 *
 * Patrón: preparar por API (rápido), verificar por interfaz (lo real).
 */
test('empleado con permiso solo de pedidos no ve las otras secciones', async ({ page, request }) => {
  // --- Preparación por API: crear el empleado restringido ---
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)

  const response = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: 'Mesero Restringido',
      email: 'mesero.restringido@e2e.test',
      password: 'secreto123',
      role: 'employee',
      permissions: ['orders'],
    },
  })
  expect(response.status()).toBe(201)

  // --- Verificación por interfaz ---
  await loginUI(page, 'mesero.restringido@e2e.test', 'secreto123')

  // Ve solo lo de pedidos:
  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()
  await expect(sidebarItem(page, 'Mesas')).toBeVisible()
  await expect(sidebarItem(page, 'Plano del Salón')).toBeVisible()

  // No ve el resto:
  for (const hidden of ['Dashboard', 'Categorías', 'Productos', 'Recetas', 'Kardex', 'Clientes', 'Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, hidden)).toHaveCount(0)
  }

  // Y aunque escriba la URL a mano, lo devuelve a su página permitida:
  await page.goto('/gastos')
  await expect(page).toHaveURL(/\/pedidos/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/pedidos/)
})

test('admin ve todas las secciones incluidas las administrativas', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)

  for (const item of ['Dashboard', 'Pedidos', 'Productos', 'Kardex', 'Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }

  // Pero no la de plataforma (es de super admin):
  await expect(sidebarItem(page, 'Plataforma')).toHaveCount(0)
})
