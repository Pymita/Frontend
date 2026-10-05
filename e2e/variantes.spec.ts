import { expect, test } from '@playwright/test'
import { ADMIN, loginUI } from './helpers'

/**
 * Variantes: grupos (Tamaño) con sus variantes (Pequeño, Grande). Una
 * variante puede no cambiar el precio o sumarle una diferencia en pesos.
 */
test('un grupo con sus variantes se crea, muestra su precio y se borra', async ({ page }) => {
  const group = `Tamaño ${Date.now()}`

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/tipos-producto')
  await expect(page.getByRole('heading', { name: 'Variantes' })).toBeVisible()
  await expect(page.getByText('Elige un grupo para ver sus variantes')).toBeVisible()

  await page.getByRole('button', { name: 'Nuevo grupo' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre', { exact: true }).fill(group)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Grupo creado')).toBeVisible()

  await page.locator('.v-list-item', { hasText: group }).click()
  await expect(page.getByText('Este grupo todavía no tiene variantes')).toBeVisible()

  // Por defecto una variante no cambia el precio (un sabor, un término).
  await page.getByRole('button', { name: 'Nueva variante' }).click()
  await expect(dialog.getByText('Nueva variante')).toBeVisible()
  await dialog.getByLabel('Nombre', { exact: true }).fill('Pequeño')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Variante creada')).toBeVisible()

  // La grande suma $2.000 al precio base.
  await page.getByRole('button', { name: 'Nueva variante' }).click()
  await dialog.getByLabel('Nombre', { exact: true }).fill('Grande')
  await dialog.getByLabel('No cambia el precio (ej: sabor de jugo)').uncheck()
  const difference = dialog.getByLabel('Diferencia de precio ($)')
  await expect(difference).not.toHaveAttribute('type', 'number')
  await difference.fill('2.000')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const grande = page.locator('tbody tr', { hasText: 'Grande' })
  await expect(grande).toContainText('+$2.000')
  await expect(page.locator('tbody tr', { hasText: 'Pequeño' })).toContainText('$0')

  // A smaller size subtracts: the minus sign is read too.
  await page.getByRole('button', { name: 'Nueva variante' }).click()
  await dialog.getByLabel('Nombre', { exact: true }).fill('Mini')
  await dialog.getByLabel('No cambia el precio (ej: sabor de jugo)').uncheck()
  await dialog.getByLabel('Diferencia de precio ($)').fill('-1.500')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('tbody tr', { hasText: 'Mini' })).toContainText('-$1.500')

  page.once('dialog', confirmation => {
    expect(confirmation.message()).toBe('¿Eliminar la variante "Grande"?')
    confirmation.accept()
  })
  await grande.getByRole('button', { name: 'Eliminar la variante Grande' }).click()
  await expect(page.getByText('Variante eliminada')).toBeVisible()
  await expect(grande).toHaveCount(0)
})
