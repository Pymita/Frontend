import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const API = 'http://127.0.0.1:8010/api'

/** Credenciales que crean los seeders (base e2e recién sembrada). */
export const ADMIN = { email: 'admin@saboresdeltrigo.com', password: 'admin123' }

/** Cuenta de la plataforma (super admin) que crea PlatformSeeder. */
export const PLATFORM = { email: 'plataforma@servifypos.co', password: 'plataforma123' }

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
  /** Código del negocio: lo necesita un empleado que entra con su usuario. */
  company?: string,
): Promise<string> {
  const response = await request.post(`${API}/auth/login`, {
    data: { email, password, ...(company ? { company } : {}) },
  })
  expect(response.ok()).toBeTruthy()

  return (await response.json()).token
}

/**
 * Sube el cupo del plan del negocio sembrado, como lo haría soporte desde la
 * plataforma: la base e2e trae 10 mesas y el plan estándar permite 10.
 */
export async function raisePlanLimits(
  request: APIRequestContext,
  limits: { max_tables?: number; max_users?: number },
): Promise<void> {
  const token = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  const companies = await (await request.get(`${API}/platform/companies`, { headers })).json()
  const company = companies.data.find((c: { slug: string }) => c.slug === COMPANY_SLUG)
  const response = await request.put(`${API}/platform/companies/${company.id}/subscription`, { headers, data: limits })
  expect(response.ok()).toBeTruthy()
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
 * Ítems del menú lateral. Los de Administración, si está plegada, existen
 * pero están ocultos: para verlos o hacerles clic, primero `openSidebarGroup`.
 */
export function sidebarItem(page: Page, title: string) {
  return page.locator('.v-navigation-drawer').getByText(title, { exact: true })
}

/** Encabezado desplegable del menú lateral (solo Administración se pliega). */
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
/** "2026-09-29" → "29/09/2026": así muestran las fechas los campos de la app. */
export function displayDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function field(page: Page, label: string) {
  return page.locator('.v-input').filter({ has: page.getByText(label, { exact: true }) })
}

/**
 * El código de 6 dígitos que mostraría una app de autenticación para esta
 * clave (RFC 6238, el mismo cálculo que hace el backend).
 */
export function totp(secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = [...secret.replace(/[\s=]/g, '').toUpperCase()]
    .map(char => alphabet.indexOf(char).toString(2).padStart(5, '0'))
    .join('')
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(byte => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)))
  const hash = createHmac('sha1', key).update(counter).digest()
  const offset = hash[hash.length - 1]! & 0x0f
  const value = ((hash[offset]! & 0x7f) << 24) | (hash[offset + 1]! << 16) | (hash[offset + 2]! << 8) | hash[offset + 3]!
  return String(value % 1_000_000).padStart(6, '0')
}

/**
 * El backend de e2e envía los correos al log (MAIL_MAILER=log): el enlace
 * de "¿Olvidaste tu contraseña?" más reciente para ese correo.
 */
export function lastResetLink(email: string): string {
  const raw = readFileSync('../backend/storage/logs/laravel.log', 'utf8')
  // Quoted-printable: líneas partidas con "=" y "=3D" en lugar de "=".
  const log = raw.replace(/=\r?\n/g, '').replace(/=3D/g, '=').replace(/&amp;/g, '&')
  const links = [...log.matchAll(/restablecer-contrasena\?token=([A-Za-z0-9]+)&email=([^\s"<>)\]]+)/g)]
    .filter(match => decodeURIComponent(match[2]!) === email)
  const last = links.at(-1)
  if (!last) throw new Error(`No hay enlace de restablecimiento para ${email} en el log`)
  return `/restablecer-contrasena?token=${last[1]}&email=${last[2]}`
}
