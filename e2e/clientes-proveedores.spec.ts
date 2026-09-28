import { expect, test } from '@playwright/test'
import { ADMIN, loginUI } from './helpers'

/**
 * La pestaña Proveedores vive junto a Clientes: trae un proveedor por defecto
 * (el nombre de la empresa, que no se puede borrar) y deja crear los demás.
 */
test('la pestaña Proveedores trae el proveedor por defecto y permite crear otro', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/clientes')

  await page.getByRole('tab', { name: /Proveedores/ }).click()

  // El proveedor por defecto (nombre de la empresa) aparece marcado.
  await expect(page.getByText('Por defecto')).toBeVisible()

  const nombre = `Distribuidora E2E ${Date.now()}`
  await page.getByRole('button', { name: /Nuevo Proveedor/ }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre').fill(nombre)
  await dialog.getByLabel('Teléfono').fill('3005551234')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Proveedor creado exitosamente')).toBeVisible()
  await expect(page.locator('tr', { hasText: nombre })).toBeVisible()
})
