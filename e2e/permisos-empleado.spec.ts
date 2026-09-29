import { expect, test } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, apiLogin, loginUI, openSidebarGroup, sidebarGroup, sidebarItem } from './helpers'

/**
 * Acceso por permisos: quien solo toma pedidos usa la app y no entra a la
 * web; quien tiene alguna sección de gestión entra, pero solo ve la suya.
 *
 * Patrón: preparar por API (rápido), verificar por interfaz (lo real).
 */
/** Crea un empleado con los permisos dados y devuelve sus credenciales. */
async function createEmployee(request: any, slug: string, permissions: string[]) {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  // Los empleados son del negocio: usuario interno, sin correo personal.
  const credentials = { username: slug, password: 'secreto123' }

  const response = await request.post(`${API}/users`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: slug, role: 'employee', permissions, ...credentials },
  })
  expect(response.status()).toBe(201)

  return credentials
}

test('un mesero (solo pedidos) no puede entrar a la web de gestión', async ({ page, request }) => {
  const waiter = await createEmployee(request, 'mesero.restringido', ['orders'])

  await page.goto('/login')
  await page.getByLabel('Correo o usuario').fill(waiter.username)
  await page.getByLabel('Código del negocio').fill(COMPANY_SLUG)
  await page.getByLabel('Contraseña', { exact: true }).fill(waiter.password)
  await page.getByRole('button', { name: /iniciar/i }).click()

  // La web lo rechaza y le explica que su cuenta es para la app.
  await expect(page.getByText(/app de meseros/i)).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
})

test('empleado con acceso limitado solo ve sus secciones', async ({ page, request }) => {
  // Con al menos una sección de gestión sí entra a la web.
  const cashier = await createEmployee(request, 'cajero.limitado', ['orders', 'reports'])

  await loginUI(page, cashier.username, cashier.password)

  await expect(sidebarItem(page, 'Pedidos')).toBeVisible()
  await expect(sidebarItem(page, 'Dashboard')).toBeVisible()

  // No ve lo que no le habilitaron:
  for (const hidden of ['Categorías', 'Productos', 'Recetas', 'Kardex', 'Clientes', 'Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, hidden)).toHaveCount(0)
  }

  // Todo lo suyo es de Operación: con una sola sección el menú no pone encabezados.
  await expect(sidebarItem(page, 'Operación')).toHaveCount(0)

  // Y aunque escriba la URL a mano, lo devuelve a una página permitida:
  await page.goto('/gastos')
  await expect(page).not.toHaveURL(/\/gastos/)
})

test('admin ve todas las secciones incluidas las administrativas', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)

  // Las secciones van agrupadas bajo su encabezado, y el rol se ve junto al nombre.
  for (const group of ['Operación', 'Catálogo', 'Administración']) {
    await expect(sidebarItem(page, group)).toBeVisible()
  }
  await expect(page.locator('.v-app-bar').getByText('Admin', { exact: true })).toBeVisible()

  // Operación siempre está abierta; Catálogo y Administración se despliegan.
  for (const item of ['Dashboard', 'Pedidos']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }
  await openSidebarGroup(page, 'Catálogo')
  for (const item of ['Productos', 'Kardex']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }
  await openSidebarGroup(page, 'Administración')
  for (const item of ['Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }

  // Pero no la de plataforma (es de super admin):
  await expect(sidebarItem(page, 'Plataforma')).toHaveCount(0)
})

test('las secciones del menú se despliegan de a una y el menú no necesita scroll', async ({ page }) => {
  // Un portátil de 1366x768 deja unos 700 px de alto dentro del navegador.
  await page.setViewportSize({ width: 1366, height: 700 })
  await loginUI(page, ADMIN.email, ADMIN.password)

  const content = page.locator('.v-navigation-drawer__content')
  const fits = async () =>
    content.evaluate(el => el.scrollHeight <= el.clientHeight)

  // Abrir una sección cierra la otra.
  await openSidebarGroup(page, 'Catálogo')
  await expect(sidebarItem(page, 'Kardex')).toBeVisible()
  await expect(sidebarItem(page, 'Empleados')).toBeHidden()
  await expect.poll(fits).toBe(true)

  await openSidebarGroup(page, 'Administración')
  await expect(sidebarItem(page, 'Empleados')).toBeVisible()
  await expect(sidebarItem(page, 'Kardex')).toBeHidden()
  await expect(sidebarGroup(page, 'Catálogo')).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(fits).toBe(true)

  // Al entrar directo a una página, su sección aparece abierta con el ítem activo.
  await page.goto('/kardex')
  await expect(sidebarGroup(page, 'Catálogo')).toHaveAttribute('aria-expanded', 'true')
  // Se abre con la transición de Vuetify: se espera a que termine.
  await expect(page.locator('.v-list-group--open .v-list-group__items')).not.toHaveClass(/expand-transition/)
  await expect(page.locator('.v-navigation-drawer .v-list-item--active', { hasText: 'Kardex' })).toBeVisible()
  await expect(sidebarItem(page, 'Tipos de Producto')).toBeInViewport()
  await expect(sidebarItem(page, 'Cerrar Sesión')).toBeInViewport()
  await expect.poll(fits).toBe(true)

  await page.screenshot({ path: '../screenshots/menu-desplegable-1366x700.png' })
})

test('el panel del login presenta el producto a la altura del formulario', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')

  const tagline = page.getByRole('heading', { name: 'Sistema de Gestión' })
  await expect(tagline).toBeVisible()
  for (const feature of ['Pedidos y mesas', 'Inventario al día', 'Ventas y reportes', 'Facturación']) {
    await expect(page.getByText(feature, { exact: true })).toBeVisible()
  }

  // El mensaje ya no queda pegado abajo con el panel vacío encima: arranca
  // en la franja central, como el formulario.
  const box = await tagline.boundingBox()
  expect(box!.y).toBeGreaterThan(900 * 0.15)
  expect(box!.y).toBeLessThan(900 * 0.5)

  await page.screenshot({ path: '../screenshots/login-1440x900.png' })
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.getByText('Facturación', { exact: true })).toBeInViewport()
  await page.screenshot({ path: '../screenshots/login-1280x720.png' })
})

test('en el celular el menú no tapa la página: se abre con el botón y se cierra al navegar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginUI(page, ADMIN.email, ADMIN.password)

  const menu = page.locator('.v-navigation-drawer')
  const openMenu = page.getByRole('button', { name: 'Abrir menú' })
  await expect(menu).not.toBeInViewport()
  await expect(page.locator('.v-main').getByText('Pedidos Hoy', { exact: true })).toBeInViewport()

  await openMenu.click()
  await expect(menu).toBeInViewport()
  await openSidebarGroup(page, 'Catálogo')
  await sidebarItem(page, 'Kardex').click()

  await expect(page).toHaveURL(/\/kardex/)
  await expect(menu).not.toBeInViewport()
})

test('en escritorio el menú sigue fijo y sin botón para abrirlo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)

  await expect(sidebarItem(page, 'Dashboard')).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveCount(0)
})
