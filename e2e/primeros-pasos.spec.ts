import { expect, test, type Page } from '@playwright/test'
import { API, PLATFORM, apiLogin, field, loginUI, sidebarItem } from './helpers'

/**
 * Una empresa recién creada, sin plantilla: la guía "Primeros pasos" dice
 * qué falta, y siguiéndola desde la interfaz el negocio queda listo para
 * vender con costo real. Cada paso se marca solo. Por defecto solo se ven
 * los obligatorios pendientes; al terminar, la tarjeta queda en una línea
 * aunque falte la resolución. La venta aparece en Ventas y sale del kardex
 * con su costo.
 *
 * Es un recorrido por varios módulos (configuración, mesas, catálogo,
 * inventario, empleados, caja, pedidos, ventas), por eso vive en su propio
 * archivo.
 */
test.setTimeout(150_000)

const guide = (page: Page) => page.getByTestId('setup-guide')
const step = (page: Page, key: string) => page.getByTestId(`setup-step-${key}`)
const shot = (name: string) => `../../../screenshots/feat-dashboard-primeros-pasos-${name}.png`

const REQUIRED = ['business', 'tables', 'products', 'stock', 'taxes', 'menu', 'team', 'first_sale']

async function expectMetricsAboveGuide(page: Page) {
  const metric = page.getByText('Pedidos hoy', { exact: true })
  await expect(metric).toBeVisible()
  await expect(guide(page)).toBeVisible()
  const metricBox = await metric.boundingBox()
  const guideBox = await guide(page).boundingBox()
  expect(metricBox).toBeTruthy()
  expect(guideBox).toBeTruthy()
  expect(metricBox!.y).toBeLessThan(guideBox!.y)
}

async function hideDrawer(page: Page) {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.v-navigation-drawer')!.style.display = 'none'
    document.querySelector<HTMLElement>('.v-main')!.style.paddingLeft = '0px'
    document.querySelector<HTMLElement>('.v-app-bar')?.style.setProperty('left', '0px')
    document.querySelector<HTMLElement>('.v-app-bar')?.style.setProperty('width', '100%')
    window.dispatchEvent(new Event('resize'))
  })
  await page.waitForTimeout(300)
}

test('una empresa nueva sigue los primeros pasos y hace su primera venta', async ({ page, request }) => {
  const stamp = Date.now()
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const admin = { email: `duena.nueva.${stamp}@e2e.test`, password: 'nueva2026' }
  const created = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `Fonda Nueva ${stamp}`, business_type: 'restaurant', admin: { name: 'Dueña Nueva', ...admin } },
  })
  expect(created.status()).toBe(201)

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, admin.email, admin.password)
  await expect(guide(page)).toContainText('0 de 8 listos')
  await expect(page.getByText('Pedidos recientes')).toHaveCount(0)
  await expectMetricsAboveGuide(page)
  await expect(page.getByRole('button', { name: 'Mes', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Ventas del mes')).toBeVisible()

  for (const key of REQUIRED) {
    const row = step(page, key)
    await expect(row.getByLabel('Pendiente')).toBeVisible()
    await expect(row.locator('.text-error')).toBeVisible()
  }
  await expect(step(page, 'recipes')).toHaveCount(0)
  await expect(step(page, 'invoicing')).toHaveCount(0)
  await page.screenshot({ path: shot('inicio-pendientes-1440'), fullPage: true })

  await guide(page).getByRole('button', { name: 'Ver los que ya están listos' }).click()
  await expect(step(page, 'recipes')).toContainText('Opcional')
  await expect(step(page, 'invoicing')).toContainText('Opcional')
  await expect(step(page, 'recipes').getByLabel('Pendiente')).toHaveCount(0)
  await expect(step(page, 'invoicing').getByLabel('Pendiente')).toHaveCount(0)
  await expect(step(page, 'recipes')).toBeInViewport()
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  await page.screenshot({ path: shot('inicio-detalles-1440'), fullPage: true })
  await guide(page).getByRole('button', { name: 'Ocultar los que ya están listos' }).click()
  await expect(step(page, 'recipes')).toHaveCount(0)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(guide(page)).toContainText('0 de 8 listos')
  await hideDrawer(page)
  await expectMetricsAboveGuide(page)
  await page.screenshot({ path: shot('inicio-pendientes-390'), fullPage: true })
  await guide(page).getByRole('button', { name: 'Ver los que ya están listos' }).click()
  await expect(step(page, 'invoicing')).toContainText('Opcional')
  await expect(step(page, 'recipes')).toBeInViewport()
  await page.evaluate(() => {
    window.scrollTo(0, 0)
    ;(document.activeElement as HTMLElement | null)?.blur()
  })
  await page.screenshot({ path: shot('inicio-detalles-390'), fullPage: true })

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.reload()
  await expect(step(page, 'business')).toBeVisible()

  // 1. Datos del negocio (desde el botón "Ir" de la guía).
  await step(page, 'business').getByRole('link', { name: /Ir a/ }).click()
  await expect(page).toHaveURL(/\/configuracion/)
  // El formulario llega con el nombre de la empresa: se escribe cuando cargó.
  await expect(field(page, 'Nombre o razón social *').locator('input')).toHaveValue(/Fonda Nueva/)
  await field(page, 'NIT o documento *').locator('input').fill('900555111-2')
  await field(page, 'Teléfonos *').locator('input').fill('3001234567')
  await field(page, 'Dirección *').locator('input').fill('Calle 10 # 5-20')
  await page.getByRole('button', { name: 'Guardar datos del negocio' }).click()
  await expect(page.getByText('Datos del negocio guardados')).toBeVisible()

  // 2. Una mesa.
  await sidebarItem(page, 'Mesas').click()
  await page.getByRole('button', { name: 'Nueva mesa' }).click()
  await page.getByRole('dialog').getByLabel('Número de mesa').fill('1')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Mesa 1', { exact: true })).toBeVisible()

  // 3. Una categoría y un producto con inventario, costo, impuesto y menú.
  await page.goto('/categorias')
  await page.getByRole('button', { name: 'Nueva categoría' }).click()
  await page.getByRole('dialog').getByLabel('Nombre de la categoría').fill('Almuerzos')
  await page.getByRole('dialog').getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Almuerzos').first()).toBeVisible()

  await page.goto('/productos-base')
  await page.getByRole('button', { name: 'Nuevo producto' }).click()
  const product = page.getByRole('dialog')
  await field(page, 'Nombre del producto *').locator('input').fill('Bandeja del día')
  await field(page, 'Categoría *').click()
  await page.getByRole('option', { name: 'Almuerzos' }).click()
  await field(page, 'Tipo de producto *').click()
  await page.getByRole('option', { name: 'Producto final' }).click()
  await field(page, 'Unidad de medida *').locator('input').fill('plato')
  await product.getByLabel('Precio de costo').fill('9000')
  await field(page, 'Precio de venta *').locator('input').fill('18000')
  await field(page, 'Impuesto *').click()
  await page.getByRole('option', { name: /Exento/ }).click()
  await product.getByLabel('Saldo inicial', { exact: true }).fill('20')
  await product.getByLabel('Publicar en el menú de venta').check()
  await product.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.locator('tr', { hasText: 'Bandeja del día' })).toBeVisible()

  // 4. La cuenta de un mesero.
  await page.goto('/empleados')
  await page.getByRole('button', { name: 'Nuevo empleado' }).click()
  const employee = page.getByRole('dialog')
  await employee.getByLabel('Nombre', { exact: true }).fill('Mesero Uno')
  await employee.getByLabel('Usuario de acceso').fill(`mesero${stamp}`)
  await employee.getByLabel('Contraseña').fill('mesero2026')
  await employee.getByRole('button', { name: 'Crear empleado' }).click()
  await expect(page.locator('tr', { hasText: 'Mesero Uno' })).toBeVisible()

  // La guía ya marcó todo lo configurado; falta vender. Lo hecho no se lista
  // hasta pedir el detalle, y la resolución sigue fuera de lo pendiente.
  await sidebarItem(page, 'Inicio').click()
  await expect(guide(page)).toContainText('7 de 8 listos')
  await expect(step(page, 'first_sale').getByLabel('Pendiente')).toBeVisible()
  await expect(step(page, 'invoicing')).toHaveCount(0)
  for (const key of ['business', 'tables', 'products', 'stock', 'taxes', 'menu', 'team']) {
    await expect(step(page, key)).toHaveCount(0)
  }
  await guide(page).getByRole('button', { name: 'Ver los que ya están listos' }).click()
  for (const key of ['business', 'tables', 'products', 'stock', 'taxes', 'menu', 'team']) {
    await expect(step(page, key).getByLabel('Listo')).toBeVisible()
  }
  await expect(step(page, 'invoicing')).toContainText('Opcional')
  await guide(page).getByRole('button', { name: 'Ocultar los que ya están listos' }).click()

  // 5. Primera venta: la caja ya está abierta sola; pedido desde la web y cobro.
  await step(page, 'first_sale').getByRole('link', { name: /Ir a/ }).click()
  await expect(page).toHaveURL(/\/pedidos/)
  await expect(page.getByTestId('cash-open-chip')).toContainText('Caja abierta desde')

  await page.getByRole('button', { name: 'Nuevo pedido' }).click()
  const order = page.getByRole('dialog')
  await order.getByRole('textbox', { name: /Buscar producto/ }).fill('Bandeja')
  await order.getByText('Bandeja del día').first().click()
  await expect(order.getByText('Total: $18.000')).toBeVisible()
  await order.getByRole('button', { name: 'Crear pedido' }).click()
  await expect(page.getByText('Pedido creado')).toBeVisible()

  const row = page.locator('tr', { hasText: '$18.000' }).first()
  await row.getByRole('button', { name: 'Cobrar' }).click()
  const charge = page.getByRole('dialog')
  await charge.getByLabel('Imprimir la factura al cobrar').uncheck()
  await charge.getByRole('button', { name: 'Confirmar cobro' }).click()
  await expect(charge).toHaveCount(0)

  // Todo lo obligatorio está listo, sin haber configurado la resolución.
  await sidebarItem(page, 'Inicio').click()
  await expect(page.getByText('Pedidos hoy', { exact: true })).toBeVisible()
  await expect(guide(page)).toContainText('Primeros pasos listos')
  await expect(step(page, 'first_sale')).toHaveCount(0)
  await expect(step(page, 'invoicing')).toHaveCount(0)
  await guide(page).getByRole('button', { name: 'Ver los que ya están listos' }).click()
  await expect(step(page, 'first_sale').getByLabel('Listo')).toBeVisible()
  await expect(step(page, 'invoicing')).toContainText('Opcional')
  await expect(step(page, 'invoicing').getByLabel('Pendiente')).toHaveCount(0)

  // La venta cuenta en Ventas y salió del kardex con su costo.
  await page.goto('/ventas')
  await expect(page.locator('tbody tr', { hasText: '$18.000' })).toContainText('Consumidor final')

  const token = await apiLogin(request, admin.email, admin.password)
  const products = await (await request.get(`${API}/products`, { headers: { Authorization: `Bearer ${token}` } })).json()
  const bandeja = products.data.find((p: any) => p.name === 'Bandeja del día')
  expect(Number(bandeja.current_stock)).toBe(19)
  const kardex = await (await request.get(`${API}/kardex?product_id=${bandeja.id}`, { headers: { Authorization: `Bearer ${token}` } })).json()
  const sale = kardex.data.movements.find((m: any) => m.document_code === 'FV')
  expect(Number(sale.unit_cost)).toBe(9000)
})
