import { expect, test } from '@playwright/test'
import { ADMIN, API, COMPANY_SLUG, apiLogin, field, loginUI, raisePlanLimits } from './helpers'

/**
 * Empleados: el admin crea la cuenta de alguien de su equipo con usuario
 * interno y elige qué funciones ve; desactivarla le cierra la entrada.
 */
test('el admin crea un empleado con sus funciones y, al desactivarlo, ya no entra', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const username = `cajera.${Date.now() % 1_000_000}`

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/empleados')
  await page.getByRole('button', { name: 'Nuevo empleado' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre', { exact: true }).fill('Cajera E2E')
  await dialog.getByLabel('Usuario de acceso').fill(username)

  // The password is asked twice and each field shows what was typed on demand.
  const password = dialog.getByLabel('Contraseña', { exact: true })
  const confirmation = dialog.getByLabel('Confirmar contraseña')
  await password.fill('clave123')
  await confirmation.fill('clave132')
  await expect(password).toHaveAttribute('type', 'password')
  await field(page, 'Contraseña').getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(password).toHaveValue('clave123')
  await expect(confirmation).toHaveAttribute('type', 'password')
  await field(page, 'Confirmar contraseña').getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(confirmation).toHaveValue('clave132')
  await expect(field(page, 'Confirmar contraseña').getByRole('button', { name: 'Ocultar contraseña' })).toBeVisible()

  // Gastos viene apagado: mover plata es una decisión del admin.
  const expenses = dialog.getByLabel('Gastos')
  await expect(expenses).not.toBeChecked()
  await expenses.check()

  // A typo in the confirmation blocks creating the account.
  await dialog.getByRole('button', { name: 'Crear empleado' }).click()
  await expect(dialog.getByText('Las contraseñas no coinciden.')).toBeVisible()
  await expect(page.getByText('Empleado creado exitosamente')).toHaveCount(0)
  const adminToken = await apiLogin(request, ADMIN.email, ADMIN.password)
  const users = await (await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()
  expect(JSON.stringify(users)).not.toContain(username)
  await page.setViewportSize({ width: 1440, height: 900 })
  await confirmation.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/confirmar-contrasena-empleado-1440.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await confirmation.scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/confirmar-contrasena-empleado-390.png' })
  await page.setViewportSize({ width: 1280, height: 720 })

  await confirmation.fill('clave123')
  await dialog.getByRole('button', { name: 'Crear empleado' }).click()
  await expect(page.getByText('Empleado creado exitosamente')).toBeVisible()

  const row = page.locator('tbody tr', { hasText: 'Cajera E2E' })
  await expect(row).toContainText(username)
  await expect(row).toContainText('Empleado')
  await expect(row).toContainText('Activo')
  await expect(row).toContainText('Gastos')
  await expect(row).toContainText('Nunca')

  // Desactivar la cuenta.
  await row.getByRole('button', { name: 'Editar a Cajera E2E' }).click()
  await dialog.getByLabel('Cuenta activa').uncheck()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Empleado actualizado exitosamente')).toBeVisible()
  await expect(row).toContainText('Inactivo')

  // Con la contraseña correcta se le explica por qué no entra.
  const login = await request.post(`${API}/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { login: username, password: 'clave123', company: COMPANY_SLUG },
  })
  expect(login.status()).toBe(422)
  expect((await login.json()).errors.email[0]).toBe('Tu usuario está desactivado. Pídele a tu administrador que lo active.')
})

/**
 * "Cobrar pedidos" va aparte de las funciones: un mesero que solo toma
 * pedidos puede, si el admin se lo da, cobrar desde la app. Lo que cobra
 * sale en Pedidos y en Ventas a su nombre; sin el permiso el API lo frena.
 */
test('el admin le da a un mesero el permiso de cobrar y lo que cobra desde la app sale en Pedidos y Ventas', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const stamp = Date.now() % 1_000_000
  const name = `Mesera Cobra ${stamp}`
  const username = `mesera.cobra.${stamp}`

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/empleados')
  await page.getByRole('button', { name: 'Nuevo empleado' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre', { exact: true }).fill(name)
  await dialog.getByLabel('Usuario de acceso').fill(username)
  await dialog.getByLabel('Contraseña', { exact: true }).fill('clave123')
  await dialog.getByLabel('Confirmar contraseña').fill('clave123')

  // A waiter: only orders, nothing to manage on the web.
  for (const label of ['Menú y categorías', 'Productos e inventario', 'Recetas y costeo', 'Cobro por tiempo (billar)', 'Clientes y cartera', 'Inicio, ventas y reportes', 'Facturación automática y cartera']) {
    const box = dialog.getByLabel(label, { exact: true })
    if ((await box.count()) && (await box.isChecked())) await box.uncheck()
  }

  // Charging sits next to Pedidos and depends on it.
  const charge = dialog.getByLabel('Cobrar pedidos')
  await expect(charge).toBeChecked()
  await expect(dialog.getByText('Registra pagos y propinas, también desde la app')).toBeVisible()
  await dialog.getByLabel('Pedidos y mesas').uncheck()
  await expect(charge).toBeDisabled()
  await expect(charge).not.toBeChecked()
  await dialog.getByLabel('Pedidos y mesas').check()
  await expect(charge).toBeChecked()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/cobro-en-la-app-empleados-permiso-1440.png' })

  await dialog.getByRole('button', { name: 'Crear empleado' }).click()
  await expect(page.getByText('Empleado creado exitosamente')).toBeVisible()
  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toContainText('Pedidos y mesas')
  await expect(row).toContainText('Cobrar pedidos')
  await expect(row).not.toContainText('Inicio, ventas y reportes')

  // The same dialog on a phone.
  await page.setViewportSize({ width: 390, height: 844 })
  await row.getByRole('button', { name: `Editar a ${name}` }).click()
  await expect(dialog.getByLabel('Cobrar pedidos')).toBeChecked()
  await dialog.getByLabel('Cobrar pedidos').scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: '../screenshots/cobro-en-la-app-empleados-permiso-390.png' })
  await dialog.getByRole('button', { name: 'Cancelar' }).click()
  await page.setViewportSize({ width: 1440, height: 900 })

  // The waiter, from the app: a table that splits the bill.
  const adminAuth = { Authorization: `Bearer ${await apiLogin(request, ADMIN.email, ADMIN.password)}`, Accept: 'application/json' }
  const categories = (await (await request.get(`${API}/categories`, { headers: adminAuth })).json()).data
  const product = await request.post(`${API}/products`, {
    headers: adminAuth,
    data: { name: `Arepa Cobro App ${stamp}`, type: 'final', unit: 'unidad', sale_price: 6173, tracks_stock: false, category_id: categories[0].id },
  })
  expect(product.status()).toBe(201)
  const productId = (await product.json()).data.id

  const waiterLogin = await request.post(`${API}/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { login: username, password: 'clave123', company: COMPANY_SLUG, device: 'mobile' },
  })
  expect(waiterLogin.ok()).toBeTruthy()
  expect((await waiterLogin.json()).user.can_charge_orders).toBe(true)
  const waiter = { Authorization: `Bearer ${(await waiterLogin.json()).token}`, Accept: 'application/json' }
  const created = await request.post(`${API}/orders`, {
    headers: waiter,
    data: {
      guest_names: { 1: 'Ana', 2: 'Luis' },
      items: [
        { product_id: productId, quantity: 2, guest_number: 1 },
        { product_id: productId, quantity: 1, guest_number: 2 },
      ],
    },
  })
  expect(created.status()).toBe(201)
  const order = (await created.json()).data

  // Ana pays her lines by Nequi with a tip; the answer is lost and the app retries with the same key.
  const anaPays = {
    headers: { ...waiter, 'Idempotency-Key': `app-cobro-${stamp}-ana` },
    data: { items: [{ order_item_id: order.items[0].id, quantity: 2 }], payment_method: 'nequi', tip: 1000 },
  }
  expect((await request.post(`${API}/orders/${order.id}/partial-payment`, anaPays)).ok()).toBeTruthy()
  const retried = await request.post(`${API}/orders/${order.id}/partial-payment`, anaPays)
  expect(retried.headers()['idempotent-replayed']).toBe('true')
  expect((await retried.json()).data.pending_balance).toBe(6173)

  // Luis pays the rest by Daviplata: balance 0.
  const closed = await request.post(`${API}/orders/${order.id}/pay`, {
    headers: { ...waiter, 'Idempotency-Key': `app-cobro-${stamp}-luis` },
    data: { payment_method: 'daviplata', tip: 0 },
  })
  expect(closed.ok()).toBeTruthy()
  const paid = (await closed.json()).data
  expect(paid.payment_status).toBe('paid')
  expect(paid.payments).toHaveLength(2)

  // Pedidos: charged, by her, with the tip in the total.
  await page.goto('/pedidos')
  await page.getByRole('button', { name: 'Pagados' }).click()
  await page.getByRole('textbox', { name: 'Buscar mesa o pedido' }).fill(`#${paid.number}`)
  const orderRow = page.locator('tbody tr', { hasText: name })
  await expect(orderRow).toHaveCount(1)
  await expect(orderRow).toContainText('Pagado')
  await expect(orderRow).toContainText('$19.519')
  await expect(orderRow).toContainText(`#${paid.number}`)

  // Ventas: one sale per person, each with its method.
  await page.goto('/ventas')
  await page.getByRole('textbox', { name: 'Buscar factura o cliente' }).fill(`#${paid.number}`)
  const sales = page.locator('tbody tr', { hasText: name })
  await expect(sales).toHaveCount(2)
  await expect(sales.filter({ hasText: 'Nequi' })).toContainText('$1.000')
  await expect(sales.filter({ hasText: 'Daviplata' })).toContainText('$6.173')

  // Taken away, the app's charge is refused with what to do.
  await page.goto('/empleados')
  await row.getByRole('button', { name: `Editar a ${name}` }).click()
  await dialog.getByLabel('Cobrar pedidos').uncheck()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Empleado actualizado exitosamente')).toBeVisible()
  await expect(row).not.toContainText('Cobrar pedidos')
  await expect(row).toContainText('Pedidos y mesas')

  const next = await request.post(`${API}/orders`, {
    headers: waiter,
    data: { items: [{ product_id: productId, quantity: 1 }] },
  })
  expect(next.status()).toBe(201)
  const refused = await request.post(`${API}/orders/${(await next.json()).data.id}/pay`, { headers: waiter, data: { payment_method: 'cash' } })
  expect(refused.status()).toBe(403)
  expect((await refused.json()).message).toBe('Tu usuario no puede cobrar pedidos. Pídele al administrador el permiso Cobrar pedidos.')
})

/**
 * "Editar movimientos del kardex" lives inside Inventario, like charging
 * inside Pedidos: off for a new employee, granted and taken away by the admin.
 */
test('el admin le da y le quita a un empleado el permiso de editar movimientos del kardex', async ({ page, request }) => {
  await raisePlanLimits(request, { max_users: 50 })
  const stamp = Date.now() % 1_000_000
  const name = `Bodeguero Kardex ${stamp}`
  const username = `bodeguero.kardex.${stamp}`
  const adminAuth = { Authorization: `Bearer ${await apiLogin(request, ADMIN.email, ADMIN.password)}` }
  const created = await request.post(`${API}/users`, {
    headers: adminAuth,
    data: { name, username, password: 'clave123', role: 'employee', permissions: ['inventory', 'reports'] },
  })
  expect(created.status()).toBe(201)
  expect((await created.json()).data.can_edit_kardex).toBe(false)
  const storedUser = async () => {
    const users = (await (await request.get(`${API}/users`, { headers: adminAuth })).json()).data
    return users.find((user: { username: string }) => user.username === username)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/empleados')
  const dialog = page.getByRole('dialog')
  const editKardex = dialog.getByLabel('Editar movimientos del kardex', { exact: true })
  const inventory = dialog.getByLabel('Productos e inventario', { exact: true })

  // A new employee starts without it.
  await page.getByRole('button', { name: 'Nuevo empleado' }).click()
  await expect(inventory).toBeChecked()
  await expect(editKardex).toBeEnabled()
  await expect(editKardex).not.toBeChecked()
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  const row = page.locator('tbody tr', { hasText: name })
  await expect(row).toContainText('Productos e inventario')
  await expect(row).not.toContainText('Editar movimientos del kardex')
  await row.getByRole('button', { name: `Editar a ${name}` }).click()
  await expect(editKardex).not.toBeChecked()
  await expect(dialog.getByText('Corrige compras (FC) y ajustes (AJ) registrados a mano')).toBeVisible()

  // Without Inventario there is no kardex to edit.
  await editKardex.check()
  await inventory.uncheck()
  await expect(editKardex).toBeDisabled()
  await expect(editKardex).not.toBeChecked()
  await inventory.check()
  await expect(editKardex).toBeEnabled()
  await expect(editKardex).toBeChecked()

  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Empleado actualizado exitosamente')).toBeVisible()
  await expect(row).toContainText('Editar movimientos del kardex')
  expect((await storedUser()).can_edit_kardex).toBe(true)
  const login = await request.post(`${API}/auth/login`, {
    headers: { Accept: 'application/json' },
    data: { login: username, password: 'clave123', company: COMPANY_SLUG },
  })
  expect((await login.json()).user.can_edit_kardex).toBe(true)

  // Taken away, the chip goes with it.
  await row.getByRole('button', { name: `Editar a ${name}` }).click()
  await expect(editKardex).toBeChecked()
  await editKardex.uncheck()
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText('Empleado actualizado exitosamente')).toBeVisible()
  await expect(row).not.toContainText('Editar movimientos del kardex')
  await expect(row).toContainText('Productos e inventario')
  expect((await storedUser()).can_edit_kardex).toBe(false)
})
