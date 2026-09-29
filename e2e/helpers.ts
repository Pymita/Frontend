import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = 'http://127.0.0.1:8010/api'

/** Credenciales que crean los seeders (base e2e recién sembrada). */
export const ADMIN = { email: 'admin@saboresdeltrigo.com', password: 'admin123' }

/** Slug de la empresa sembrada: los empleados entran con usuario + negocio. */
export const COMPANY_SLUG = 'sabores-del-trigo'

/**
 * Login por API: para PREPARAR datos rápido (crear empleados, productos)
 * sin pasar por la interfaz. Devuelve el token Bearer.
 */
export async function apiLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email, password },
  })
  expect(response.ok()).toBeTruthy()

  return (await response.json()).token
}

/**
 * Login por interfaz: para los tests que VERIFICAN la experiencia real.
 * Un login sin '@' es un usuario interno: la web pide además el negocio.
 */
export async function loginUI(page: Page, login: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo o usuario').fill(login)
  if (!login.includes('@')) {
    await page.getByLabel('Código del negocio').fill(COMPANY_SLUG)
  }
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: /iniciar|ingresar|entrar|login/i }).click()
  // El login redirige fuera de /login al guardar la sesión.
  await page.waitForURL((url) => !url.pathname.includes('login'))
}

/**
 * Ítems del menú lateral. Los de una sección cerrada existen pero están
 * ocultos: para verlos o hacerles clic, primero `openSidebarGroup`.
 */
export function sidebarItem(page: Page, title: string) {
  return page.locator('.v-navigation-drawer').getByText(title, { exact: true })
}

/** Encabezado desplegable del menú lateral (Catálogo, Administración). */
export function sidebarGroup(page: Page, title: string) {
  return page.locator('.v-navigation-drawer .v-list-group__header', { hasText: title })
}

/** Abre una sección desplegable del menú lateral si está cerrada. */
export async function openSidebarGroup(page: Page, title: string): Promise<void> {
  const header = sidebarGroup(page, title)
  if ((await header.getAttribute('aria-expanded')) !== 'true') {
    await header.click()
  }
  await expect(header).toHaveAttribute('aria-expanded', 'true')
}

/**
 * Campo de formulario de Vuetify por su etiqueta.
 *
 * `getByRole('combobox', { name })` solo funciona con v-autocomplete: en un
 * v-select el rol vive en el contenedor y la etiqueta no le da nombre
 * accesible, así que se busca el input por su label.
 *
 * El texto se compara con `getByText(..., { exact: true })` y no con
 * `:text-is()`: los campos obligatorios llevan el asterisco en un `<span>`
 * rojo dentro de la etiqueta, y `:text-is()` no cruza los elementos hijos.
 */
export function field(page: Page, label: string) {
  return page.locator('.v-input').filter({ has: page.getByText(label, { exact: true }) })
}
