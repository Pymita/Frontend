import { expect, test, type Locator, type Page } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, PLATFORM, apiLogin, e2eSql, loginUI, raisePlanLimits, sidebarItem } from './helpers'

/**
 * Política de privacidad y términos del servicio: las dos páginas son públicas
 * (Google Play y la Ley 1581 piden una URL que cualquiera abra) y cada usuario
 * acepta la política antes de usar la web; el backend guarda la prueba de cada
 * versión aceptada.
 */

const CONSENT = 'Leí y acepto la política de privacidad y tratamiento de datos personales'

const consentDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: CONSENT })

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
}

/** The responsible party's details, as section 1 lists them. */
const responsibleBlock = (page: Page) => page.locator('#responsable + ul')

/** Screenshots the page from the top down to the end of `block` (the responsible party's details by default). */
async function screenshotTop(page: Page, path: string, block: Locator = responsibleBlock(page)): Promise<void> {
  const box = await block.boundingBox()
  const width = page.viewportSize()!.width
  const scrollY = await page.evaluate(() => window.scrollY)
  await page.screenshot({ path, fullPage: true, clip: { x: 0, y: 0, width, height: scrollY + box!.y + box!.height + 24 } })
}

/** Waits for the dialog's opening animation, so a screenshot shows it as the user sees it. */
async function settled(dialog: Locator): Promise<void> {
  await dialog.evaluate(el =>
    Promise.all(
      el.getAnimations({ subtree: true })
        .filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map(animation => animation.finished),
    ),
  )
}

test('la política se lee sin iniciar sesión, se enlaza desde el login y abre en la sección de eliminación', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/login')
  const loginLink = page.getByRole('link', { name: 'Política de privacidad' })
  await expect(loginLink).toHaveAttribute('href', /\/privacidad$/)
  await expect(loginLink).toHaveAttribute('target', '_blank')

  await page.goto('/restablecer-contrasena?token=abc&email=ana%40ejemplo.co')
  await expect(page.getByText('Elige tu contraseña nueva')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Política de privacidad' })).toHaveAttribute('href', /\/privacidad$/)

  await page.goto('/privacidad')
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Política de privacidad · Servify POS')
  await expect(page.locator('.v-navigation-drawer')).toHaveCount(0)
  await expect(page.getByText('Versión 1.0. Fecha de entrada en vigencia: 10 de octubre de 2026.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '1. Responsable del tratamiento' })).toBeVisible()
  const responsible = responsibleBlock(page)
  await expect(responsible.getByText('Nombre: Valentina Morales Sanchez, persona natural,')).toBeVisible()
  await expect(responsible.getByText('Dirección: Carrera 20 # 25-59, Manizales.')).toBeVisible()
  await expect(responsible.getByText('Teléfono: 3205607590.')).toBeVisible()
  await expect(responsible.getByRole('link', { name: 'soporte@servifypos.com' })).toHaveAttribute('href', 'mailto:soporte@servifypos.com')
  // The owner's ID number is not published, not even as an empty label.
  await expect(responsible).not.toContainText(/cédula|identificad/i)
  await expect(page.getByText(/cédula de ciudadanía/i)).toHaveCount(0)
  await expect(page.getByText('por escrito a Carrera 20 # 25-59, Manizales. El trámite es gratuito.')).toBeVisible()
  await expect(page.getByText('se eliminan 90 días después de la terminación')).toBeVisible()
  await expect(page.getByText('mensuales se guardan 3 meses.')).toBeVisible()
  // The authorization paragraph describes what the app does, and nothing
  // written for the owner of the draft reaches the public page.
  await expect(page.getByText(`le pide marcar la casilla "${CONSENT}"`)).toBeVisible()
  await expect(page.getByText(/PENDIENTE DE IMPLEMENTAR|Nota para Valentina|Fuentes consultadas/)).toHaveCount(0)
  await expect(page.locator('article')).not.toContainText('[')
  expect(await page.locator('article').innerHTML()).not.toMatch(/\[[^\]]*\]/)
  await screenshotTop(page, '../screenshots/politica-privacidad-pagina-1440.png')
  await expect(page.getByRole('row', { name: /^Resend Envío de correos transaccionales/ })).toBeVisible()
  await page.locator('.providers').screenshot({ path: '../screenshots/politica-privacidad-proveedores-1440.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { level: 1, name: 'Política de privacidad', exact: true })).toBeVisible()
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await screenshotTop(page, '../screenshots/politica-privacidad-pagina-390.png')
  // The providers of section 9: a table on a desktop, one block each on a phone.
  const providerBlocks = page.locator('div:has(> dl.provider)')
  await expect(providerBlocks.getByText('Dónde:')).toHaveCount(5)
  await expect(page.getByRole('columnheader', { name: 'Dónde' })).toBeHidden()
  await providerBlocks.screenshot({ path: '../screenshots/politica-privacidad-proveedores-390.png' })

  // The data deletion URL declared in Google Play lands on section 13.
  await page.goto('/privacidad#eliminacion')
  await expect(page.getByRole('heading', { name: '13. Eliminación de la cuenta y de los datos' })).toBeInViewport()
  await expect(page.getByText('con el asunto "Eliminar mi cuenta de Servify POS"')).toBeVisible()
  await page.screenshot({ path: '../screenshots/politica-privacidad-eliminacion-390.png' })
})

test('los términos del servicio se leen sin iniciar sesión, se enlazan desde el login y la política, y llevan a cada sección de la política', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.goto('/login')
  const loginLink = page.getByRole('link', { name: 'Términos del servicio' })
  await expect(loginLink).toHaveAttribute('href', /\/terminos$/)
  await expect(loginLink).toHaveAttribute('target', '_blank')
  await page.screenshot({ path: '../screenshots/terminos-login-1440.png', fullPage: true })

  // The policy links the terms where it relies on them (sections 2 and 8).
  await page.goto('/privacidad')
  const policyLinks = page.getByRole('link', { name: 'términos del servicio', exact: true })
  await expect(policyLinks).toHaveCount(2)
  await policyLinks.first().click()

  await expect(page).toHaveURL(/\/terminos$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Términos del servicio', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('Términos del servicio · Servify POS')
  await expect(page.locator('.v-navigation-drawer')).toHaveCount(0)
  await expect(page.getByText('Versión 1.0. Fecha de entrada en vigencia: 4 de noviembre de 2026.')).toBeVisible()
  // Google Play asks for terms that apply to this app specifically.
  await expect(page.getByText('la aplicación Android para meseros "Servify POS" (paquete com.servifypos.app), distribuida en Google Play;')).toBeVisible()
  // The same provider details the policy publishes, without the ID number.
  const provider = page.locator('#prestador + ul')
  await expect(provider.getByText('Nombre: Valentina Morales Sanchez, persona natural,')).toBeVisible()
  await expect(provider.getByText('Dirección: Carrera 20 # 25-59, Manizales.')).toBeVisible()
  await expect(provider.getByText('Teléfono: 3205607590.')).toBeVisible()
  await expect(provider.getByRole('link', { name: 'soporte@servifypos.com' })).toHaveAttribute('href', 'mailto:soporte@servifypos.com')
  await expect(provider).not.toContainText(/cédula|identificad/i)
  // The subscription periods the backend applies by default, and the agreed limits.
  await expect(page.getByText('sin costo durante 15 días, o el plazo que se acuerde')).toBeVisible()
  await expect(page.getByText('el negocio tiene 7 días de gracia, o los que se acuerden, con el servicio completo')).toBeVisible()
  await expect(page.getByText('Si la cuenta sigue en solo lectura durante 90 días')).toBeVisible()
  await expect(page.getByText('en los 3 meses anteriores al hecho que la origina')).toBeVisible()
  await expect(page.getByText('Servify POS no es proveedor tecnológico de facturación electrónica')).toBeVisible()
  await expect(page.getByText('Esta sección es el contrato de transmisión de datos personales entre los dos')).toBeVisible()
  // Nothing written for the owner of the draft reaches the public page.
  await expect(page.getByText(/Nota para Valentina|Decisiones que te tocan|Fuentes consultadas/)).toHaveCount(0)
  expect(await page.locator('article').innerHTML()).not.toMatch(/\[[^\]]*\]/)
  await expect(page.getByRole('link', { name: 'política de privacidad y de tratamiento de datos personales' })).toHaveAttribute('href', /\/privacidad$/)
  await screenshotTop(page, '../screenshots/terminos-pagina-1440.png', provider)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { level: 1, name: 'Términos del servicio', exact: true })).toBeVisible()
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await screenshotTop(page, '../screenshots/terminos-pagina-390.png', provider)
  await page.locator('#informacion-y-datos + ul').screenshot({ path: '../screenshots/terminos-encargado-390.png' })

  // Every reference to a section of the policy points to one that exists.
  const sections = await page.locator('article a[href*="/privacidad#"]').evaluateAll(links =>
    [...new Set(links.map(link => new URL((link as HTMLAnchorElement).href).hash))],
  )
  expect(sections.length).toBeGreaterThan(5)
  await page.getByRole('link', { name: 'sección 12 de la política de privacidad' }).click()
  await expect(page).toHaveURL(/\/privacidad#conservacion$/)
  await expect(page.getByRole('heading', { name: '12. Conservación' })).toBeInViewport()
  for (const section of sections) {
    await expect(page.locator(`article h2${section}`)).toHaveCount(1)
  }
})

test('quien no ha aceptado la política no usa la web hasta aceptarla, y una versión nueva la vuelve a pedir', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const adminToken = await apiLogin(request, ADMIN.email, ADMIN.password)
  const cashier = { username: `privacidad.${Date.now() % 1_000_000}`, password: 'clave123' }
  const created = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${adminToken}`, Accept: 'application/json' },
    data: { name: 'Cajera Privacidad', role: 'employee', permissions: ['orders', 'reports'], ...cashier },
  })
  expect(created.status()).toBe(201)
  const cashierId = Number((await created.json()).data.id)
  const signIn = () => loginUI(page, cashier.username, cashier.password, COMPANY_SLUG, { acceptPrivacy: false })

  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn()

  const dialog = consentDialog(page)
  await expect(dialog.getByText('Política de privacidad', { exact: true })).toBeVisible()
  const accept = dialog.getByRole('button', { name: 'Aceptar y continuar' })
  await expect(accept).toBeDisabled()

  // Neither Escape nor a click outside gets past it.
  await page.keyboard.press('Escape')
  await page.mouse.click(1400, 450)
  await expect(dialog).toBeVisible()

  // The full text opens in a new tab, readable while signed in.
  const policyLink = dialog.getByRole('link', { name: 'Leer la política de privacidad (versión 1.0)' })
  await expect(policyLink).toHaveAttribute('target', '_blank')
  const [policyTab] = await Promise.all([page.waitForEvent('popup'), policyLink.click()])
  await expect(policyTab.getByRole('heading', { level: 1, name: 'Política de privacidad', exact: true })).toBeVisible()
  await expect(consentDialog(policyTab)).toHaveCount(0)
  await policyTab.close()

  await settled(dialog)
  await page.screenshot({ path: '../screenshots/politica-privacidad-dialogo-1440.png' })

  await dialog.getByLabel(CONSENT).check()
  await expect(accept).toBeEnabled()
  await accept.click()
  await expect(dialog).toHaveCount(0)
  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()

  // The backend keeps the proof, and the dialog does not come back.
  const cashierToken = await apiLogin(request, cashier.username, cashier.password, COMPANY_SLUG)
  const me = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${cashierToken}`, Accept: 'application/json' } })
  expect((await me.json()).user.privacy).toMatchObject({ version: '1.0', accepted: true })

  await page.reload()
  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()
  await expect(consentDialog(page)).toHaveCount(0)

  await page.evaluate(() => localStorage.clear())
  await signIn()
  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()
  await expect(consentDialog(page)).toHaveCount(0)

  // A new version of the policy: what the cashier accepted is now an older one.
  e2eSql(`UPDATE privacy_acceptances SET version = '0.9' WHERE user_id = ${cashierId}`)
  await page.evaluate(() => localStorage.clear())
  await signIn()
  await expect(accept).toBeDisabled()

  // Signing out from the dialog leaves without accepting; the box starts empty again.
  await dialog.getByLabel(CONSENT).check()
  await dialog.getByRole('button', { name: 'Cerrar sesión' }).click()
  await page.waitForURL(/\/login/)
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn()
  await expect(accept).toBeDisabled()
  await expect(accept).toBeInViewport()
  await expect(dialog.getByRole('button', { name: 'Cerrar sesión' })).toBeInViewport()
  await settled(dialog)
  await page.screenshot({ path: '../screenshots/politica-privacidad-dialogo-390.png' })

  await dialog.getByLabel(CONSENT).check()
  await accept.click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeVisible()
})

test('la cuenta de plataforma también acepta la política antes de entrar al panel', async ({ page }) => {
  e2eSql(`DELETE FROM privacy_acceptances WHERE user_id = (SELECT id FROM users WHERE email = '${PLATFORM.email}')`)

  await loginUI(page, PLATFORM.email, PLATFORM.password, COMPANY_SLUG, { acceptPrivacy: false })

  const dialog = consentDialog(page)
  await expect(dialog).toBeVisible()
  await dialog.getByLabel(CONSENT).check()
  await dialog.getByRole('button', { name: 'Aceptar y continuar' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(sidebarItem(page, 'Empresas')).toBeVisible()
})
