import { expect, test } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, loginUI, raisePlanLimits } from './helpers'

/**
 * Empleados: el admin crea la cuenta de alguien de su equipo con usuario
 * interno y elige qué funciones ve; desactivarla le cierra la entrada.
 */
test('el admin crea un empleado con sus funciones y, al desactivarlo, ya no entra', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const username = `cajera.${Date.now() % 1_000_000}`

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/empleados')
  await page.getByRole('button', { name: 'Nuevo empleado' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre', { exact: true }).fill('Cajera E2E')
  await dialog.getByLabel('Usuario de acceso').fill(username)
  await dialog.getByLabel('Contraseña', { exact: true }).fill('clave123')

  // Gastos viene apagado: mover plata es una decisión del admin.
  const expenses = dialog.getByLabel('Gastos')
  await expect(expenses).not.toBeChecked()
  await expenses.check()
  await dialog.getByRole('button', { name: 'Crear empleado' }).click()
  await expect(page.getByText('Empleado creado exitosamente')).toBeVisible()

  const row = page.locator('tbody tr', { hasText: 'Cajera E2E' })
  await expect(row).toContainText(username)
  await expect(row).toContainText('Empleado')
  await expect(row).toContainText('Activo')
  await expect(row).toContainText('Gastos')
  await expect(row).toContainText('Nunca')

  // Desactivar la cuenta.
  await row.getByRole('button', { name: 'Editar a Cajera E2E' }).click()
  await dialog.getByLabel('Cuenta activa').uncheck()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Empleado actualizado exitosamente')).toBeVisible()
  await expect(row).toContainText('Inactivo')

  // Con la contraseña correcta se le explica por qué no entra.
  const login = await request.post(`${API}/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { login: username, password: 'clave123', company: COMPANY_SLUG },
  })
  expect(login.status()).toBe(422)
  expect((await login.json()).errors.email[0]).toBe('Tu usuario está desactivado. Pídele a tu administrador que lo active.')
})
