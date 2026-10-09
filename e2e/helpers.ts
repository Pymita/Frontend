import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { crc32, inflateRawSync } from 'node:zlib'
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
 * The user accepts the privacy policy in force through the API, as the
 * consent dialog would. Idempotent: accepting again keeps the first proof.
 */
export async function acceptPrivacyPolicy(
  request: APIRequestContext,
  login: string,
  password: string,
  company?: string,
): Promise<void> {
  const token = await apiLogin(request, login, password, company)
  const response = await request.post(`${API}/auth/privacy/accept`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  expect(response.ok()).toBeTruthy()
}

/**
 * Login por interfaz: para los tests que VERIFICAN la experiencia real.
 * Un login sin '@' es un usuario interno: la web pide además el negocio.
 * The policy is accepted first, so the consent dialog does not cover the
 * page under test; `privacidad.spec.ts` passes `acceptPrivacy: false`.
 */
export async function loginUI(
  page: Page,
  login: string,
  password: string,
  company = COMPANY_SLUG,
  { acceptPrivacy = true }: { acceptPrivacy?: boolean } = {},
): Promise<void> {
  if (acceptPrivacy) {
    await acceptPrivacyPolicy(page.request, login, password, login.includes('@') ? undefined : company)
  }
  await page.goto('/login')
  await page.getByLabel('Correo o usuario').fill(login)
  if (!login.includes('@')) {
    await page.getByLabel('Código del negocio').fill(company)
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
 * Fija el reloj del navegador en un instante que devolvió el API (el
 * `created_at` de lo que se acaba de crear): el "hoy" de la página es el día
 * de ese dato aunque la suite cruce la medianoche. El reloj del backend no se
 * puede fijar desde aquí; por eso se toma el suyo.
 */
export async function freezeTime(page: Page, at: string): Promise<void> {
  await page.clock.setFixedTime(new Date(at))
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
 * Picks an option of the open v-select by its text. The menu only renders the
 * options that fit (a virtual list), and every spec adds categories and
 * products to the seeded company: it scrolls the list until the option shows.
 */
export async function pickOption(page: Page, name: string): Promise<void> {
  const option = page.getByRole('option', { name, exact: true })
  for (let step = 0; step < 60 && (await option.count()) === 0; step++) {
    await page.getByRole('listbox').evaluate(list => {
      let node: HTMLElement | null = list as HTMLElement
      while (node && node.scrollHeight <= node.clientHeight) node = node.parentElement
      node?.scrollBy(0, node.clientHeight / 2)
    })
    await page.waitForTimeout(100)
  }
  await option.click()
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

const excelColumn = (index: number): string => {
  let letters = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  }
  return letters
}

/**
 * Un .xlsx de una hoja con textos en línea, como el que guarda alguien que
 * armó su lista en Excel. El zip va sin comprimir: no hace falta librería.
 */
export function buildXlsx(rows: string[][]): Buffer {
  const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const sheetRows = rows.map((cells, r) => {
    const xml = cells
      .map((value, c) => (value === '' ? '' : `<c r="${excelColumn(c)}${r + 1}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`))
      .join('')
    return `<row r="${r + 1}">${xml}</row>`
  })
  const main = 'http://schemas.openxmlformats.org'
  const files: Record<string, string> = {
    '[Content_Types].xml':
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="${main}/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    '_rels/.rels':
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${main}/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${main}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${main}/spreadsheetml/2006/main" xmlns:r="${main}/officeDocument/2006/relationships">` +
      `<sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="${main}/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="${main}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${main}/spreadsheetml/2006/main"><sheetData>${sheetRows.join('')}</sheetData></worksheet>`,
  }

  const parts: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8')
    const fileName = Buffer.from(name, 'utf8')
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(fileName.length, 26)
    const entry = Buffer.alloc(46)
    entry.writeUInt32LE(0x02014b50, 0)
    entry.writeUInt16LE(20, 4)
    entry.writeUInt16LE(20, 6)
    entry.writeUInt32LE(crc, 16)
    entry.writeUInt32LE(data.length, 20)
    entry.writeUInt32LE(data.length, 24)
    entry.writeUInt16LE(fileName.length, 28)
    entry.writeUInt32LE(offset, 42)
    parts.push(local, fileName, data)
    central.push(entry, fileName)
    offset += local.length + fileName.length + data.length
  }
  const centralSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, ...central, end])
}

/** Las filas de una hoja de un .xlsx que escribió el backend (textos en línea y números). */
export function xlsxRows(file: Buffer, sheet = 1): string[][] {
  const name = `xl/worksheets/sheet${sheet}.xml`
  let p = file.readUInt32LE(file.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) + 16)
  let xml = ''
  while (file.readUInt32LE(p) === 0x02014b50) {
    const nameLength = file.readUInt16LE(p + 28)
    const next = p + 46 + nameLength + file.readUInt16LE(p + 30) + file.readUInt16LE(p + 32)
    if (file.toString('utf8', p + 46, p + 46 + nameLength) === name) {
      const local = file.readUInt32LE(p + 42)
      const start = local + 30 + file.readUInt16LE(local + 26) + file.readUInt16LE(local + 28)
      const data = file.subarray(start, start + file.readUInt32LE(p + 20))
      xml = (file.readUInt16LE(p + 10) === 8 ? inflateRawSync(data) : data).toString('utf8')
      break
    }
    p = next
  }
  const unescape = (text: string) => text.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
  return [...xml.matchAll(/<row[^>]*>(.*?)<\/row>/gs)].map(([, row]) => {
    const cells: string[] = []
    for (const [, letters, text, value] of row!.matchAll(/<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>(.*?)<\/t><\/is>|<v>(.*?)<\/v>)<\/c>/gs)) {
      const index = [...letters!].reduce((n, letter) => n * 26 + letter.charCodeAt(0) - 64, 0) - 1
      cells[index] = unescape(text ?? value ?? '')
    }
    return Array.from(cells, cell => cell ?? '')
  })
}

const E2E_DATABASE = '../backend/database/e2e.sqlite'

/**
 * Runs one SQL statement on the e2e database, for what no endpoint can
 * arrange (e.g. a proof of an older policy version, as after a version bump).
 * PHP's PDO, because the backend already needs it: no extra dependency.
 */
export function e2eSql(sql: string): void {
  execFileSync('php', ['-r', '(new PDO("sqlite:" . $argv[1]))->exec($argv[2]);', E2E_DATABASE, sql])
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
