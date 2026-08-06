import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = 'http://127.0.0.1:8010/api'

/** Credenciales que crean los seeders (base e2e recién sembrada). */
export const ADMIN = { email: 'admin@saboresdeltrigo.com', password: 'admin123' }

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
 */
export async function loginUI(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('button', { name: /iniciar|ingresar|entrar|login/i }).click()
  // El login redirige fuera de /login al guardar la sesión.
  await page.waitForURL((url) => !url.pathname.includes('login'))
}

/** Ítems del menú lateral visibles. */
export function sidebarItem(page: Page, title: string) {
  return page.locator('.v-navigation-drawer').getByText(title, { exact: true })
}
