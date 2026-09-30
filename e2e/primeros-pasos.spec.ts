import { expect, test, type Page } from '@playwright/test'
import { API, PLATFORM, apiLogin, field, loginUI, sidebarItem } from './helpers'

/**
 * Una empresa recién creada, sin plantilla: la guía "Primeros pasos" dice
 * qué falta, y siguiéndola desde la interfaz el negocio queda listo para
 * vender con costo real. Cada paso se marca solo; al final la guía se va y
 * la venta aparece en Ventas y sale del kardex con su costo.
 *
 * Es un recorrido por varios módulos (configuración, mesas, catálogo,
 * inventario, empleados, caja, pedidos, ventas), por eso vive en su propio
 * archivo.
 */
test.setTimeout(150_000)

const guide = (page: Page) => page.getByTestId('setup-guide')
const step = (page: Page, key: string) => page.getByTestId(`setup-step-${key}`)

test('una empresa nueva sigue los primeros pasos y hace su primera venta', async ({ page, request }) => {
  const stamp = Date.now()
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const admin = { email: `duena.nueva.${stamp}@e2e.test`, password: 'nueva2026' }
  const created = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `Fonda Nueva ${stamp}`, business_type: 'restaurant', admin: { name: 'Dueña Nueva', ...admin } },
  })
  expect(created.status()).toBe(201)

  await loginUI(page, admin.email, admin.password)
  await expect(guide(page)).toBeVisible()
  await expect(guide(page)).toContainText('0 de 8 listos')
  await expect(step(page, 'recipes')).toContainText('Opcional')
  await page.screenshot({ path: '../screenshots/primeros-pasos-1440.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(guide(page)).toBeVisible()
  await page.screenshot({ path: '../screenshots/primeros-pasos-390.png', fullPage: true })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.reload()

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

  // La guía ya marcó todo lo configurado; falta vender.
  await sidebarItem(page, 'Inicio').click()
  await expect(guide(page)).toContainText('7 de 8 listos')
  for (const key of ['business', 'tables', 'products', 'stock', 'taxes', 'menu', 'team']) {
    await expect(step(page, key).getByLabel('Listo')).toBeVisible()
  }

  // 5. Primera venta: abrir caja, pedido desde la web y cobro.
  await step(page, 'first_sale').getByRole('link', { name: /Ir a/ }).click()
  await expect(page).toHaveURL(/\/pedidos/)
  await page.getByRole('button', { name: 'Abrir caja' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Abrir caja' }).click()
  await expect(page.getByTestId('cash-open-chip')).toBeVisible()

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

  // Todo listo: la guía desaparece.
  await sidebarItem(page, 'Inicio').click()
  await expect(page.getByText('Pedidos hoy', { exact: true })).toBeVisible()
  await expect(guide(page)).toHaveCount(0)

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
