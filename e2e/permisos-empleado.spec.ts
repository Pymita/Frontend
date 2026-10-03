import { expect, test } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, PLATFORM, apiLogin, lastResetLink, loginUI, openSidebarGroup, sidebarGroup, sidebarItem, totp } from './helpers'

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
  await expect(sidebarItem(page, 'Inicio')).toBeVisible()

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

/**
 * Quien toma pedidos crea mesas y cobra; editar o borrar mesas y cancelar un
 * pedido que ya tiene productos es del admin (como revertir un cobro).
 */
test('un cajero crea mesas pero no las edita ni cancela pedidos con productos', async ({ page, request }) => {
  const cashier = await createEmployee(request, 'cajero.mesas', ['orders', 'reports'])
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: 'Permisos E2E' } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: { name: 'Jugo Permisos', type: 'final', unit: 'vaso', sale_price: 7531, tracks_stock: false, category_id: (await category.json()).data.id },
  })
  const order = await request.post(`${API}/orders`, {
    headers: auth,
    data: { items: [{ product_id: (await product.json()).data.id, quantity: 1 }] },
  })
  const orderId = (await order.json()).data.id

  await loginUI(page, cashier.username, cashier.password)
  await page.goto('/mesas')
  await expect(page.getByRole('button', { name: 'Nueva mesa' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear varias' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Editar la mesa/ })).toHaveCount(0)

  await page.goto('/pedidos')
  await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(`#${orderId}`)
  const row = page.locator('tbody tr', { hasText: '$7.531' })
  await row.getByRole('button', { name: 'Más acciones del pedido' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Imprimir cuenta' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: 'Cancelar pedido' })).toHaveCount(0)

  // Aunque se salte la pantalla, el backend dice por qué no.
  const cashierToken = await apiLogin(request, cashier.username, cashier.password, COMPANY_SLUG)
  const cancel = await request.post(`${API}/orders/${orderId}/cancel`, {
    headers: { Authorization: `Bearer ${cashierToken}`, Accept: 'application/json' },
  })
  expect(cancel.status()).toBe(403)
  expect((await cancel.json()).message).toBe('Solo el administrador puede cancelar un pedido con productos. Pídeselo a tu administrador.')
})

test('admin ve todas las secciones incluidas las administrativas', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)

  // Las secciones van agrupadas bajo su encabezado, y el rol se ve junto al nombre.
  for (const group of ['Operación', 'Catálogo', 'Administración']) {
    await expect(sidebarItem(page, group)).toBeVisible()
  }
  await expect(page.locator('.v-app-bar').getByText('Admin', { exact: true })).toBeVisible()

  // Operación y Catálogo siempre están abiertos; Administración se despliega.
  for (const item of ['Inicio', 'Pedidos', 'Productos', 'Kardex']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }
  await openSidebarGroup(page, 'Administración')
  for (const item of ['Gastos', 'Finanzas', 'Empleados', 'Configuración']) {
    await expect(sidebarItem(page, item)).toBeVisible()
  }

  // Pero no la de plataforma (es de super admin):
  await expect(sidebarItem(page, 'Plataforma')).toHaveCount(0)
})

test('pedidos y kardex quedan fijos en el menú: solo Administración se pliega', async ({ page }) => {
  // Un portátil de 1366x768 deja unos 700 px de alto dentro del navegador.
  await page.setViewportSize({ width: 1366, height: 700 })
  await loginUI(page, ADMIN.email, ADMIN.password)

  const content = page.locator('.v-navigation-drawer__content')
  const fits = async () =>
    content.evaluate(el => el.scrollHeight <= el.clientHeight)
  const admin = sidebarGroup(page, 'Administración')
  const activeItem = (title: string) => page.locator('.v-navigation-drawer .v-list-item--active', { hasText: title })
  // Vuetify despliega con una transición: se espera a que termine.
  const settled = () => expect(page.locator('.v-list-group__items')).not.toHaveClass(/expand-transition/)

  // Operación y Catálogo son solo un título: no tienen botón para plegarse.
  for (const group of ['Operación', 'Catálogo']) {
    await expect(sidebarItem(page, group)).toBeVisible()
    await expect(sidebarGroup(page, group)).toHaveCount(0)
  }

  // Administración arranca plegada y así lo fijo cabe sin scroll.
  await expect(admin).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebarItem(page, 'Empleados')).toBeHidden()
  for (const item of ['Pedidos', 'Kardex', 'Variantes', 'Cerrar sesión']) {
    await expect(sidebarItem(page, item)).toBeInViewport()
  }
  await expect(admin).toBeInViewport({ ratio: 1 })
  await expect.poll(fits).toBe(true)
  // Tras el login la página se desliza para dejarle sitio al menú.
  await expect.poll(() => page.locator('.v-main').evaluate(el => getComputedStyle(el).paddingLeft)).toBe('264px')
  await page.screenshot({ path: '../screenshots/menu-lateral-fijo-plegado-1366.png' })

  // Desplegarla no esconde nada de lo fijo.
  await admin.click()
  await expect(admin).toHaveAttribute('aria-expanded', 'true')
  await settled()
  await expect(sidebarItem(page, 'Clientes')).toBeInViewport()
  for (const item of ['Pedidos', 'Kardex']) {
    await expect(sidebarItem(page, item)).toBeInViewport()
  }
  await page.screenshot({ path: '../screenshots/menu-lateral-fijo-desplegado-1366.png' })

  // Y se vuelve a plegar.
  await admin.click()
  await expect(admin).toHaveAttribute('aria-expanded', 'false')
  await expect(sidebarItem(page, 'Clientes')).toBeHidden()
  await expect(sidebarItem(page, 'Kardex')).toBeInViewport()
  await expect.poll(fits).toBe(true)

  // A 1440x900 cabe todo el menú, también con Administración abierta. Al
  // entrar directo a una de sus páginas se abre sola con el ítem activo.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/empleados')
  await expect(admin).toHaveAttribute('aria-expanded', 'true')
  await settled()
  await expect(activeItem('Empleados')).toBeInViewport()
  for (const item of ['Pedidos', 'Kardex', 'Configuración', 'Cerrar sesión']) {
    await expect(sidebarItem(page, item)).toBeInViewport()
  }
  await expect.poll(fits).toBe(true)
  await page.screenshot({ path: '../screenshots/menu-lateral-fijo-desplegado-1440.png' })

  // Ir a Kardex desde ahí no pliega Administración: nada se cierra solo.
  await sidebarItem(page, 'Kardex').click()
  await expect(page).toHaveURL(/\/kardex/)
  await expect(activeItem('Kardex')).toBeInViewport()
  await expect(admin).toHaveAttribute('aria-expanded', 'true')
  await expect(sidebarItem(page, 'Empleados')).toBeInViewport()
})

test('el panel del login presenta el producto sin opacar el formulario', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/login')

  const panel = page.getByRole('complementary')
  const form = page.locator('.v-card', { has: page.getByRole('heading', { name: 'Servify POS', level: 1 }) })
  const tagline = panel.getByRole('heading', { name: 'Sistema de gestión' })
  await expect(tagline).toBeVisible()
  const features = ['Pedidos y mesas', 'Inventario al día', 'Ventas y reportes', 'Facturación automática', 'Cartera, gastos y finanzas']
  for (const feature of features) {
    await expect(panel.getByText(feature, { exact: true })).toBeVisible()
  }
  await expect(panel.getByText('Cuentas de cobro del mes para todos tus clientes, listas para imprimir.')).toBeVisible()
  await expect(panel.getByText('Quién te debe, abonos con recibo de caja y estado de resultados.')).toBeVisible()

  // La facturación electrónica aún no existe: el login no la promete.
  await expect(page.locator('body')).not.toContainText('DIAN')

  // El mensaje ya no queda pegado abajo con el panel vacío encima: arranca
  // en la franja central, como el formulario.
  const box = await tagline.boundingBox()
  expect(box!.y).toBeGreaterThan(900 * 0.15)
  expect(box!.y).toBeLessThan(900 * 0.5)

  // El formulario es lo principal: más ancho que antes (400 px) y el panel
  // ocupa a lo sumo un tercio de la pantalla.
  expect((await form.boundingBox())!.width).toBeGreaterThanOrEqual(460)
  expect((await panel.boundingBox())!.width).toBeLessThanOrEqual(1440 / 3 + 1)

  await page.screenshot({ path: '../screenshots/login-1440x900.png' })
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(panel.getByText('Cartera, gastos y finanzas', { exact: true })).toBeInViewport()
  expect((await form.boundingBox())!.width).toBeGreaterThanOrEqual(460)
  await page.screenshot({ path: '../screenshots/login-1280x720.png' })

  // En el celular solo queda el formulario, de borde a borde.
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(panel).toBeHidden()
  await expect(form).toBeInViewport()
  expect((await form.boundingBox())!.width).toBeGreaterThanOrEqual(330)
  await page.screenshot({ path: '../screenshots/login-390x844.png' })

  // El enlace del correo abre la misma pantalla: tampoco menciona la DIAN.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/restablecer-contrasena?token=e2e&email=nadie%40e2e.test')
  await expect(page.getByText('Elige tu contraseña nueva')).toBeVisible()
  await expect(panel.getByText('Facturación automática', { exact: true })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('DIAN')
})

test('la app se llama Servify POS y habla español en tablas, paginación y fechas', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle('Servify POS — Sistema de gestión')
  await expect(page.getByRole('heading', { name: 'Servify POS', level: 1 })).toBeVisible()
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', /favicon\.svg$/)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await expect(page.locator('.v-navigation-drawer')).toContainText('Servify POS')

  // Las fechas se escriben y se leen como dd/mm/aaaa, sin importar el navegador.
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Todos' }).click()
  await page.getByLabel('Desde').fill('01/01/2001')
  await page.getByLabel('Hasta').fill('31/01/2001')
  await expect(page.getByLabel('Desde')).toHaveValue('01/01/2001')

  const table = page.locator('.v-data-table')
  await expect(table).toContainText('No hay datos disponibles')
  await expect(table).toContainText(/(Filas|Elementos) por página/)
  await expect(page.getByText(/No data available|Items per page/)).toHaveCount(0)

  // El calendario también sale en español.
  await page.getByRole('button', { name: 'Abrir calendario' }).first().click()
  const picker = page.locator('.v-date-picker')
  await expect(picker).toContainText(/enero/i)
  await expect(picker).toBeInViewport()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/fechas-en-espanol-1440.png' })

  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await page.getByLabel('Desde').fill('01/01/2001')
  await page.getByLabel('Desde').blur()
  await expect(page.getByLabel('Desde')).toHaveValue('01/01/2001')
  await expect(page.locator('.v-data-table--loading')).toHaveCount(0)
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/fechas-en-espanol-390.png' })
})

test('en el celular el menú no tapa la página: se abre con el botón y se cierra al navegar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginUI(page, ADMIN.email, ADMIN.password)

  const menu = page.locator('.v-navigation-drawer')
  const openMenu = page.getByRole('button', { name: 'Abrir menú' })
  await expect(menu).not.toBeInViewport()
  await expect(page.locator('.v-main').getByText('Pedidos hoy', { exact: true })).toBeInViewport()

  await openMenu.click()
  await expect(menu).toBeInViewport({ ratio: 1 })
  // Pedidos y Kardex están a mano sin desplegar nada.
  await expect(sidebarItem(page, 'Pedidos')).toBeInViewport()
  await expect(sidebarItem(page, 'Kardex')).toBeInViewport()
  await expect(sidebarGroup(page, 'Administración')).toHaveAttribute('aria-expanded', 'false')
  await page.screenshot({ path: '../screenshots/menu-lateral-fijo-plegado-390.png' })

  await openSidebarGroup(page, 'Administración')
  await expect(page.locator('.v-list-group__items')).not.toHaveClass(/expand-transition/)
  await expect(sidebarItem(page, 'Clientes')).toBeInViewport()
  await expect(sidebarItem(page, 'Pedidos')).toBeInViewport()
  await page.screenshot({ path: '../screenshots/menu-lateral-fijo-desplegado-390.png' })

  await sidebarItem(page, 'Kardex').click()

  await expect(page).toHaveURL(/\/kardex/)
  await expect(menu).not.toBeInViewport()
})

test('en escritorio el menú sigue fijo y sin botón para abrirlo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)

  await expect(sidebarItem(page, 'Inicio')).toBeInViewport()
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toHaveCount(0)
})

/**
 * La dueña de un negocio olvidó su contraseña: pide el enlace, llega al
 * correo (en e2e, al log del backend) y elige una nueva desde ese enlace.
 */
test('un admin recupera su contraseña con el enlace del correo', async ({ page, request }) => {
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const email = `duena.olvido.${Date.now()}@e2e.test`
  const created = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `E2E olvido ${Date.now()}`, business_type: 'restaurant', admin: { name: 'Dueña Olvido', email, password: 'vieja2026' } },
  })
  expect(created.status()).toBe(201)

  await page.goto('/login')
  await page.getByRole('button', { name: '¿Olvidaste tu contraseña?' }).click()
  await page.getByLabel('Correo con el que entras').fill(email)
  await page.getByRole('button', { name: 'Enviar enlace' }).click()
  await expect(page.getByText('Si el correo está registrado, te enviamos un enlace para cambiar la contraseña.')).toBeVisible()

  await page.goto(lastResetLink(email))
  await expect(page.getByText('Elige tu contraseña nueva')).toBeVisible()
  await page.getByLabel('Contraseña nueva').fill('corta')
  await page.getByLabel('Repite la contraseña').fill('corta')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByText('Debe tener al menos 8 caracteres')).toBeVisible()

  await page.getByLabel('Contraseña nueva').fill('NuevaClave2026')
  await page.getByLabel('Repite la contraseña').fill('NuevaClave2026')
  await page.getByRole('button', { name: 'Guardar contraseña' }).click()
  await expect(page.getByText('Tu contraseña quedó cambiada. Ya puedes iniciar sesión.')).toBeVisible()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByLabel('Correo o usuario')).toHaveValue(email)

  const oldPassword = await request.post(`${API}/auth/login`, { headers: { Accept: 'application/json' }, data: { email, password: 'vieja2026' } })
  expect(oldPassword.status()).toBe(422)
  await loginUI(page, email, 'NuevaClave2026')
  await expect(page).toHaveURL(/\/dashboard/)
})

test.describe('verificación en dos pasos de la cuenta de plataforma', () => {
  let secret = ''

  // La cuenta de plataforma es compartida por otras pruebas: pase lo que
  // pase, queda sin segundo factor al terminar.
  test.afterAll(async ({ request }) => {
    if (!secret) return
    const json = { Accept: 'application/json' }
    const login = await (await request.post(`${API}/auth/login`, { headers: json, data: { email: PLATFORM.email, password: PLATFORM.password } })).json()
    if (!login.two_factor_required) return
    const session = await (await request.post(`${API}/auth/two-factor/challenge`, { headers: json, data: { challenge: login.challenge, code: totp(secret) } })).json()
    await request.post(`${API}/auth/two-factor/disable`, {
      headers: { ...json, Authorization: `Bearer ${session.token}` },
      data: { password: PLATFORM.password, code: totp(secret) },
    })
  })

  test('se activa desde Seguridad y el login pide el código de la app', async ({ page }) => {
    await loginUI(page, PLATFORM.email, PLATFORM.password)
    await sidebarItem(page, 'Seguridad').click()
    await expect(page.getByRole('heading', { name: 'Seguridad' })).toBeVisible()
    await expect(page.getByText('Sin activar')).toBeVisible()

    await page.getByRole('button', { name: 'Activar verificación en dos pasos' }).click()
    secret = (await page.getByTestId('two-factor-secret').innerText()).replace(/\s/g, '')
    expect(secret).toMatch(/^[A-Z2-7]{32}$/)
    await expect(page.getByRole('link', { name: 'Abrir en la app' })).toHaveAttribute('href', /^otpauth:\/\/totp\//)

    await page.getByLabel('Código de 6 dígitos').fill(totp(secret))
    await page.getByRole('button', { name: 'Activar', exact: true }).click()
    await expect(page.getByText('Guarda estos códigos en un lugar seguro.')).toBeVisible()
    await page.getByRole('button', { name: 'Ya los guardé' }).click()
    await expect(page.getByText('Activa', { exact: true })).toBeVisible()

    // Cerrar sesión y volver a entrar: tras la contraseña pide el código.
    await sidebarItem(page, 'Cerrar sesión').click()
    await page.waitForURL(/\/login/)
    await page.getByLabel('Correo o usuario').fill(PLATFORM.email)
    await page.getByLabel('Contraseña', { exact: true }).fill(PLATFORM.password)
    await page.getByRole('button', { name: 'Iniciar sesión' }).click()
    await expect(page.getByText('Escribe el código de 6 dígitos de tu app de autenticación')).toBeVisible()

    await page.getByLabel('Código de 6 dígitos').fill('000000')
    await page.getByRole('button', { name: 'Verificar' }).click()
    await expect(page.getByText(/El código no coincide/)).toBeVisible()

    await page.getByLabel('Código de 6 dígitos').fill(totp(secret))
    await page.getByRole('button', { name: 'Verificar' }).click()
    await page.waitForURL(/\/plataforma/)
    await expect(sidebarItem(page, 'Empresas')).toBeVisible()
  })
})

