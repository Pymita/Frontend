import { expect, test, type APIRequestContext } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI } from './helpers'

/**
 * Finanzas: movimientos que no son venta ni compra. Un aporte del dueño
 * entra a caja pero no es utilidad; un egreso suelto sí baja la utilidad.
 */
const pesos = (value: number): string =>
  `${value < 0 ? '-' : ''}$${Math.abs(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`

const todayIso = () => new Date().toLocaleDateString('en-CA')
const monthStart = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA')
}

async function figures(request: APIRequestContext, auth: Record<string, string>) {
  const balance = (await (await request.get(`${API}/reports/balance`, { headers: auth })).json()).data
  const income = (await (await request.get(`${API}/reports/income-statement`, {
    headers: auth,
    params: { from: monthStart(), to: todayIso() },
  })).json()).data
  return { cash: Number(balance.assets.cash), netProfit: Number(income.net_profit) }
}

test('un aporte del dueño suma a la caja sin ser utilidad y un egreso suelto sí la baja', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const before = await figures(request, auth)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/finanzas')

  // Aporte del dueño.
  await page.getByRole('button', { name: 'Registrar movimiento' }).click()
  const dialog = page.getByRole('dialog')
  await field(page, 'Tipo de movimiento').click()
  await page.getByRole('option', { name: 'Aporte del dueño' }).click()
  await expect(dialog.getByText('Mueve la caja pero no es utilidad ni pérdida')).toBeVisible()
  await dialog.getByLabel('Concepto').fill(`Aporte nevera ${stamp}`)
  // "500.000", typed key by key, is five hundred thousand pesos, in a field with no arrows.
  await expect(dialog.getByLabel('Monto')).not.toHaveAttribute('type', 'number')
  await expect(dialog.getByLabel('Monto')).toHaveValue('')
  await dialog.getByLabel('Monto').pressSequentially('500.000')
  await dialog.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Movimiento registrado')).toBeVisible()

  const contribution = page.locator('tbody tr', { hasText: `Aporte nevera ${stamp}` })
  await expect(contribution).toContainText('Aporte del dueño')
  await expect(contribution).toContainText('+$500.000')
  await expect(contribution).toContainText('Solo caja')
  // La fecha se lee en español, no "2026-09-29".
  await expect(contribution).toContainText(
    new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
  )
  await expect(page.locator('tr', { hasText: 'Caja (cobrado − pagado)' })).toContainText(pesos(before.cash + 500000))

  const afterContribution = await figures(request, auth)
  expect(afterContribution.cash).toBe(before.cash + 500000)
  expect(afterContribution.netProfit).toBe(before.netProfit)

  // Un egreso suelto baja la caja y la utilidad.
  await page.getByRole('button', { name: 'Registrar movimiento' }).click()
  await field(page, 'Tipo de movimiento').click()
  await page.getByRole('option', { name: 'Otro egreso' }).click()
  await dialog.getByLabel('Concepto').fill(`Arreglo puerta ${stamp}`)
  await dialog.getByLabel('Monto').fill('20.000')
  await dialog.getByRole('button', { name: 'Guardar' }).click()

  const expense = page.locator('tbody tr', { hasText: `Arreglo puerta ${stamp}` })
  await expect(expense).toContainText('−$20.000')
  await expect(expense).toContainText('Caja y utilidad')
  const afterExpense = await figures(request, auth)
  expect(afterExpense.netProfit).toBe(before.netProfit - 20000)

  // Borrarlo deja todo como estaba.
  page.once('dialog', confirmation => confirmation.accept())
  await expense.getByRole('button', { name: `Eliminar el movimiento Arreglo puerta ${stamp}` }).click()
  await expect(page.getByText('Movimiento eliminado')).toBeVisible()
  await expect(expense).toHaveCount(0)
  expect((await figures(request, auth)).netProfit).toBe(before.netProfit)
})
