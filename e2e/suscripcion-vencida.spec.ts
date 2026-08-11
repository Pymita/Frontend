import { expect, test } from '@playwright/test'
import { API, apiLogin, loginUI } from './helpers'

/**
 * Una empresa con la suscripción vencida queda en SOLO LECTURA: puede
 * entrar y consultar su información, pero las acciones que escriben quedan
 * en gris (el backend las rechaza con 402).
 *
 * Los botones NO se esconden: apagados dejan claro qué se perdió y el
 * tooltip dice que hay que renovar.
 *
 * Patrón: preparar por API, verificar por interfaz.
 */

const PLATFORM = { email: 'plataforma@saboresdeltrigo.com', password: 'plataforma123' }

const BLOCK_REASON = 'Pago vencido de agosto: comunícate con soporte para reactivar'

/**
 * Crea una empresa con su admin y le deja la suscripción suspendida.
 */
async function createExpiredCompany(request: any, slug: string) {
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const headers = { Authorization: `Bearer ${superToken}` }

  const credentials = { email: `admin.${slug}@e2e.test`, password: 'vencida2026' }

  const created = await request.post(`${API}/platform/companies`, {
    headers,
    data: {
      name: `E2E ${slug}`,
      business_type: 'restaurant',
      admin: { name: 'Dueño moroso', ...credentials },
    },
  })
  expect(created.status()).toBe(201)
  const companyId = (await created.json()).data.id

  // Datos creados mientras la cuenta estaba al día: son los que después
  // solo se van a poder consultar.
  const adminToken = await apiLogin(request, credentials.email, credentials.password)
  const category = await request.post(`${API}/categories`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { name: 'Panadería' },
  })
  expect(category.status()).toBe(201)

  // Periodo vencido hace dos meses: la cuenta ya pasó la gracia.
  const expired = await request.put(`${API}/platform/companies/${companyId}/subscription`, {
    headers,
    data: {
      plan: 'standard',
      status: 'suspended',
      current_period_end: '2026-06-10',
      blocked_reason: BLOCK_REASON,
    },
  })
  expect(expired.ok()).toBeTruthy()

  return { companyId, credentials }
}

test('una empresa vencida ve el motivo y las acciones apagadas, no escondidas', async ({
  page,
  request,
}) => {
  const { credentials } = await createExpiredCompany(request, 'vencida')

  await loginUI(page, credentials.email, credentials.password)

  // El motivo del bloqueo se ve apenas entra, sin tener que fallar primero.
  await expect(page.getByText(BLOCK_REASON)).toBeVisible()

  // Puede consultar: las pantallas cargan...
  await page.goto('/mesas')
  await expect(page.getByRole('heading', { name: /mesas/i }).first()).toBeVisible()

  // ...y sigue viendo los botones, pero apagados.
  const nuevaMesa = page.getByRole('button', { name: 'Nueva Mesa' })
  await expect(nuevaMesa).toBeVisible()
  await expect(nuevaMesa).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Crear varias' })).toBeDisabled()

  // Al pasar el mouse explica por qué y qué hacer.
  await nuevaMesa.hover({ force: true })
  // Cada botón apagado tiene su tooltip en el DOM: solo interesa el abierto.
  const tooltip = page.locator('.v-tooltip .v-overlay__content:visible')
  await expect(tooltip).toContainText('Tu suscripción está vencida')
  await expect(tooltip).toContainText('Renueva el pago para volver a usar esta acción')

  // Y no abre ningún formulario aunque se insista.
  await nuevaMesa.click({ force: true })
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await page.goto('/productos-base')
  await expect(page.getByRole('button', { name: 'Nuevo Producto' })).toBeDisabled()

  await page.goto('/categorias')
  await expect(page.getByRole('button', { name: 'Nueva Categoría' })).toBeDisabled()

  await page.goto('/pedidos')
  await expect(page.getByRole('button', { name: 'Pedido Rápido' })).toBeDisabled()

  await page.goto('/empleados')
  await expect(page.getByRole('button', { name: /nuevo empleado/i })).toBeDisabled()

  await page.goto('/finanzas')
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toBeDisabled()

  // Editar y eliminar también quedan apagados: si no, el cliente choca
  // contra un error en vez de entender que se le venció la cuenta.
  await page.goto('/categorias')
  const editar = page.locator('button:has(.mdi-pencil)').first()
  await expect(editar).toBeVisible()
  await expect(editar).toBeDisabled()
  await expect(page.locator('button:has(.mdi-delete)').first()).toBeDisabled()
})

test('la misma empresa al día sí ofrece esas acciones', async ({ page, request }) => {
  const { companyId, credentials } = await createExpiredCompany(request, 'al-dia')

  // La plataforma registra el pago: la suscripción vuelve a estar activa.
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const payment = await request.post(`${API}/platform/companies/${companyId}/subscription/payments`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { amount: 100000, months: 1, method: 'transfer' },
  })
  expect(payment.ok()).toBeTruthy()

  await loginUI(page, credentials.email, credentials.password)

  // Sin bloqueo no hay banner y las acciones vuelven.
  await expect(page.getByText(BLOCK_REASON)).toHaveCount(0)

  // Mismos localizadores que el test anterior: si cambian, este falla y
  // deja en evidencia que el otro pasaba por buscar algo inexistente.
  await page.goto('/mesas')
  await expect(page.getByRole('button', { name: 'Nueva Mesa' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Crear varias' })).toBeEnabled()

  await page.goto('/productos-base')
  await expect(page.getByRole('button', { name: 'Nuevo Producto' })).toBeEnabled()

  await page.goto('/categorias')
  await expect(page.getByRole('button', { name: 'Nueva Categoría' })).toBeEnabled()

  await page.goto('/pedidos')
  await expect(page.getByRole('button', { name: 'Pedido Rápido' })).toBeEnabled()

  await page.goto('/empleados')
  await expect(page.getByRole('button', { name: /nuevo empleado/i })).toBeEnabled()

  await page.goto('/finanzas')
  await expect(page.getByRole('button', { name: 'Registrar movimiento' })).toBeEnabled()

  // Y el formulario sí abre.
  await page.goto('/mesas')
  await page.getByRole('button', { name: 'Nueva Mesa' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('el backend rechaza la escritura aunque se salte la interfaz', async ({ request }) => {
  const { credentials } = await createExpiredCompany(request, 'api-directa')

  const token = await apiLogin(request, credentials.email, credentials.password)
  const headers = { Authorization: `Bearer ${token}` }

  // Esconder botones no es el control: la API es la que bloquea.
  const write = await request.post(`${API}/tables`, {
    headers,
    data: { number: 99, capacity: 4 },
  })
  expect(write.status()).toBe(402)
  expect((await write.json()).message).toBe(BLOCK_REASON)

  // Y la lectura sigue funcionando.
  const read = await request.get(`${API}/tables`, { headers })
  expect(read.ok()).toBeTruthy()
})
