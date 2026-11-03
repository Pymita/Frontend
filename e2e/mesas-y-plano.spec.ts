import { expect, test } from '@playwright/test'
import { ADMIN, API, PLATFORM, apiLogin, loginUI, raisePlanLimits } from './helpers'

/**
 * Mesas y plano del salón: el admin crea, edita y borra mesas (una o
 * varias) y las ubica en el plano con su forma y su zona.
 */
test.beforeAll(async ({ request }) => {
  await raisePlanLimits(request, { max_tables: 60 })
})

test('una mesa se crea, se edita y se borra; también se crean varias de una vez', async ({ page }) => {
  const stamp = Date.now()
  const number = 100 + (stamp % 800)
  const nickname = `Ventana ${stamp}`

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/mesas')

  await page.getByRole('button', { name: 'Nueva mesa' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Número de mesa').fill(String(number))
  await dialog.getByLabel('Capacidad').fill('2')
  await dialog.getByLabel('Nombre personalizado (opcional)').fill(nickname)
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Mesa creada')).toBeVisible()

  const card = page.locator('.v-card', { hasText: nickname })
  await expect(card).toContainText(String(number))
  await expect(card).toContainText('2 personas')

  await card.getByRole('button', { name: `Editar la mesa ${number}` }).click()
  await dialog.getByLabel('Capacidad').fill('6')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Mesa actualizada')).toBeVisible()
  await expect(card).toContainText('6 personas')

  // Varias de una vez, con su zona.
  await page.getByRole('button', { name: 'Crear varias' }).click()
  await dialog.getByLabel('¿Cuántas mesas?').fill('2')
  await dialog.getByLabel('Zona (opcional)').fill(`Terraza ${stamp}`)
  await dialog.getByRole('button', { name: 'Crear 2 mesas' }).click()
  await expect(page.getByText('2 mesas creadas')).toBeVisible()

  // Borrar pide confirmación y la mesa sale de la lista.
  await card.getByRole('button', { name: `Editar la mesa ${number}` }).click()
  page.once('dialog', confirmation => confirmation.accept())
  await dialog.getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText('Mesa eliminada')).toBeVisible()
  await expect(page.locator('.v-card', { hasText: nickname })).toHaveCount(0)
})

test('una mesa nueva aparece en el plano y se le cambia la forma y la zona', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const number = 100 + ((stamp + 400) % 800)
  const nickname = `Plano ${stamp}`
  const created = await request.post(`${API}/tables`, {
    headers: auth,
    data: { number, nickname, capacity: 4 },
  })
  expect(created.status()).toBe(201)
  const tableId = (await created.json()).data.id

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/plano')

  // Una mesa nueva se ubica sola en un espacio libre; el nombre largo se corta
  // dentro de la figura y completo queda como título.
  const node = page.locator('svg g.table-node').filter({
    has: page.locator('text.table-number', { hasText: new RegExp(`^${number}$`) }),
  })
  await expect(node).toHaveCount(1)
  await expect(node.locator('text.table-name')).toHaveText(`${nickname.slice(0, 10)}…`)
  await expect(node.locator('title')).toHaveText(nickname)

  await page.getByLabel('Editar plano').check()
  await node.click()
  await expect(page.locator('.v-card', { hasText: 'Quitar del plano' })).toContainText(nickname)
  await page.getByRole('button', { name: 'Mesa redonda' }).click()
  await page.getByLabel('Zona (ej. Terraza, Pared derecha)').fill(`Terraza ${stamp}`)
  await expect(page.getByText('Tienes cambios sin guardar en el plano.')).toBeVisible()
  await page.getByRole('button', { name: 'Guardar plano' }).click()
  await expect(page.getByText('Plano guardado exitosamente')).toBeVisible()

  // Quedó guardada: redonda y en su zona.
  const table = (await (await request.get(`${API}/tables/${tableId}`, { headers: auth })).json()).data
  expect(table.shape).toBe('round')
  expect(table.zone).toBe(`Terraza ${stamp}`)

  await page.getByLabel('Editar plano').uncheck()
  await expect(node.locator('circle')).toHaveCount(1)
})

/**
 * Any table can bill by time (billiards, cards, a garita): the form names the
 * capability, "Cobra por tiempo", and the rate is typed as pesos: "12.000" is
 * twelve thousand an hour, not twelve. Its own company, since the seeded one
 * has no time billing.
 */
test('una mesa cobra por tiempo con su tarifa por hora escrita en pesos', async ({ page, request }) => {
  const slug = `billar-tarifa-${Date.now()}`
  const credentials = { email: `admin.${slug}@e2e.test`, password: 'negocio2026' }
  const superToken = await apiLogin(request, PLATFORM.email, PLATFORM.password)
  const created = await request.post(`${API}/platform/companies`, {
    headers: { Authorization: `Bearer ${superToken}` },
    data: { name: `E2E ${slug}`, slug, business_type: 'billiard', admin: { name: 'Dueño Billar', ...credentials } },
  })
  expect(created.status()).toBe(201)

  const nickname = `Garita ${Date.now()}`
  await loginUI(page, credentials.email, credentials.password)
  await page.goto('/mesas')

  await page.getByRole('button', { name: 'Nueva mesa' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Número de mesa').fill('1')
  await dialog.getByLabel('Nombre personalizado (opcional)').fill(nickname)
  await expect(dialog.getByText('Tipo de mesa')).toHaveCount(0)
  await expect(dialog.getByText('Billar', { exact: true })).toHaveCount(0)
  await expect(dialog.getByLabel('Tarifa por hora')).toHaveCount(0)
  await dialog.getByLabel('Cobra por tiempo').check()
  await expect(dialog.getByText('Billar, cartas, garitas: la mesa se abre con el reloj y se cobra su tarifa por hora')).toBeVisible()
  const rate = dialog.getByLabel('Tarifa por hora')
  await expect(rate).not.toHaveAttribute('type', 'number')
  await rate.fill('12.000')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Mesa creada')).toBeVisible()
  const garita = page.locator('.v-card', { hasText: nickname })
  await expect(garita).toContainText('Cobra por tiempo')
  await expect(garita).toContainText('$12.000/hora')

  // Editing it reads the capability back, not a table type.
  await garita.getByRole('button', { name: 'Editar la mesa 1' }).click()
  await expect(dialog.getByLabel('Cobra por tiempo')).toBeChecked()
  await expect(dialog.getByLabel('Tarifa por hora')).toHaveValue('12.000')
  await dialog.getByRole('button', { name: 'Cancelar' }).click()

  await page.getByRole('button', { name: 'Crear varias' }).click()
  await dialog.getByLabel('¿Cuántas mesas?').fill('2')
  await dialog.getByLabel('Cobran por tiempo').check()
  await dialog.getByLabel('Tarifa por hora').fill('9.500')
  await dialog.getByRole('button', { name: 'Crear 2 mesas' }).click()
  await expect(page.getByText('2 mesas creadas')).toBeVisible()
  await expect(page.locator('.v-card', { hasText: 'Cobra por tiempo' }).filter({ hasText: '$9.500/hora' })).toHaveCount(2)

  // The floor plan names the capability in its legend and the rate on each table.
  await page.goto('/plano')
  await expect(page.locator('.v-chip', { hasText: 'Cobra por tiempo' })).toBeVisible()
  const node = page.locator('svg g.table-node').filter({ has: page.locator('title', { hasText: nickname }) })
  await expect(node.locator('text.table-number')).toHaveText('⏱1')
  await expect(page.locator('svg text.table-name', { hasText: '$9.500/h' })).toHaveCount(2)
})
