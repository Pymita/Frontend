import { expect, test } from '@playwright/test'
import { ADMIN, field, loginUI } from './helpers'

/**
 * El tipo de persona y "cliente frecuente" se guardan: antes el backend los
 * descartaba y la tabla siempre decía "Natural" sin estrella.
 */
test('un cliente jurídico y frecuente se guarda así y se puede cambiar', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/clientes')

  const nombre = `Distribuidora E2E ${Date.now()}`
  await page.getByRole('button', { name: /Nuevo Cliente/ }).click()

  const dialog = page.getByRole('dialog')
  await field(page, 'Tipo de Documento *').click()
  await page.getByRole('option', { name: 'NIT' }).click()
  await field(page, 'Número de Documento *').locator('input').fill(String(Date.now()))
  await field(page, 'Nombre / Razón Social *').locator('input').fill(nombre)
  await field(page, 'Tipo de Persona').click()
  await page.getByRole('option', { name: 'Persona Jurídica' }).click()
  await dialog.getByLabel('Marcar como Cliente Frecuente').check()
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente creado exitosamente')).toBeVisible()
  const fila = page.locator('tr', { hasText: nombre })
  await expect(fila).toContainText('Jurídica')
  await expect(fila.locator('.mdi-star')).toBeVisible()

  // Al editar, el diálogo trae lo guardado; se vuelve natural y no frecuente.
  await fila.locator('.mdi-pencil').click()
  await expect(dialog.getByLabel('Marcar como Cliente Frecuente')).toBeChecked()
  await expect(field(page, 'Tipo de Persona')).toContainText('Persona Jurídica')
  await field(page, 'Tipo de Persona').click()
  await page.getByRole('option', { name: 'Persona Natural' }).click()
  await dialog.getByLabel('Marcar como Cliente Frecuente').uncheck()
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Cliente actualizado exitosamente')).toBeVisible()
  await expect(fila).toContainText('Natural')
  await expect(fila.locator('.mdi-star-outline')).toBeVisible()
})

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
