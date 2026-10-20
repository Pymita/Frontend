import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI, pickOption } from './helpers'

/** A line of the movement dialog: each product of the invoice is one. */
const line = (page: Page, n: number) => page.getByRole('group', { name: `Línea ${n}` })
const lineField = (page: Page, n: number, label: string) =>
  line(page, n).locator('.v-input').filter({ has: page.getByText(label, { exact: true }) })

async function pickLineProduct(page: Page, n: number, name: string): Promise<void> {
  await lineField(page, n, 'Producto *').locator('input').fill(name)
  await page.getByRole('option', { name }).click()
}

async function createProducts(
  request: APIRequestContext,
  products: { name: string; unit: string; unit_cost: number; current_stock: number }[],
): Promise<void> {
  const auth = { Authorization: `Bearer ${await apiLogin(request, ADMIN.email, ADMIN.password)}` }
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `Insumos compra ${Date.now()}` } })
  const categoryId = (await category.json()).data.id
  for (const product of products) {
    const response = await request.post(`${API}/products`, {
      headers: auth,
      data: { ...product, type: 'raw_material', tracks_stock: true, category_id: categoryId },
    })
    expect(response.status()).toBe(201)
  }
}

/**
 * Movimiento manual del kardex: una devolución de ventas (DV) entra al
 * inventario desde la propia pantalla del kardex. Las observaciones son
 * opcionales; el tercero se elige o se escribe libremente.
 */
test('una devolución de ventas se registra desde el kardex y aparece como DV', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }

  const category = await request.post(`${API}/categories`, {
    headers: auth,
    data: { name: 'Devoluciones E2E' },
  })
  const categoryId = (await category.json()).data.id

  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name: 'Vino E2E',
      type: 'raw_material',
      unit: 'botella',
      unit_cost: 25000,
      current_stock: 5,
      tracks_stock: true,
      category_id: categoryId,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')

  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Producto *').locator('input').fill('Vino E2E')
  await page.getByRole('option', { name: 'Vino E2E' }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /DV — Devolución de ventas/ }).click()
  await page.getByLabel('Cantidad *').fill('2')
  await page.getByLabel('Cliente *').fill('Cliente Devolución E2E')
  await page.getByLabel('Referencia').fill('POS-999')
  // Observaciones ya no es obligatorio, pero se sigue pudiendo escribir.
  await page.getByLabel('Observaciones').fill('Cliente devolvió botellas E2E')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()

  await expect(page.getByText('Movimiento registrado en el kardex')).toBeVisible()

  // El movimiento queda visible filtrando por el producto.
  await field(page, 'Producto').locator('input').fill('Vino E2E')
  await page.getByRole('option', { name: 'Vino E2E' }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()

  const dvRow = page.locator('tr', { hasText: 'DV' }).first()
  await expect(dvRow).toBeVisible()
  await expect(dvRow).toContainText('POS-999')
})

/**
 * A purchase (FC) enters at the unit cost typed as pesos: "26.000" is
 * twenty-six thousand, and the weighted average follows it.
 */
test('una compra entra al kardex con el costo unitario escrito en pesos', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const name = `Café Compra ${Date.now()}`
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: `${name} Cat` } })
  const product = await request.post(`${API}/products`, {
    headers: auth,
    data: {
      name, type: 'raw_material', unit: 'kg', unit_cost: 20000, current_stock: 5, tracks_stock: true,
      category_id: (await category.json()).data.id,
    },
  })
  expect(product.status()).toBe(201)

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Producto *').locator('input').fill(name)
  await page.getByRole('option', { name }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  await page.getByLabel('Cantidad *').fill('10')
  await page.getByLabel('Proveedor *').fill('Tostadora E2E')

  // The product's last cost is suggested with its dots, in a field with no arrows.
  const cost = page.getByLabel('Costo unitario')
  await expect(cost).toHaveValue('20.000')
  await expect(cost).not.toHaveAttribute('type', 'number')
  await cost.fill('26.000')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('Movimiento registrado en el kardex')).toBeVisible()

  await field(page, 'Producto').locator('input').fill(name)
  await page.getByRole('option', { name }).click()
  await page.getByRole('button').filter({ has: page.locator('.mdi-magnify') }).click()
  await expect(page.locator('tr', { hasText: 'FC' }).first()).toContainText('$26.000')
  // (5 × $20.000 + 10 × $26.000) / 15.
  await expect(page.locator('.v-card', { hasText: 'Costo promedio' })).toContainText('$24.000')
})

/**
 * A supplier invoice with several products is one purchase: one FC row per
 * line, all with the invoice number and the supplier. A line left blank is
 * dropped and a cost left empty enters at the product's average cost. Only
 * units and cost: the money is still registered in Gastos.
 */
test('una compra de varios productos queda en el kardex como una sola factura', async ({ page, request }) => {
  const stamp = Date.now()
  const flour = `Harina Factura ${stamp}`
  const sugar = `Azúcar Factura ${stamp}`
  const butter = `Mantequilla Factura ${stamp}`
  const invoice = `FE-${stamp}`
  await createProducts(request, [
    { name: flour, unit: 'kg', unit_cost: 2000, current_stock: 10 },
    { name: sugar, unit: 'kg', unit_cost: 3000, current_stock: 4 },
    { name: butter, unit: 'kg', unit_cost: 7000, current_stock: 1 },
  ])

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  await page.getByLabel('Proveedor *').fill('Molinos Factura E2E')
  await page.getByLabel('Número de factura').fill(invoice)

  await pickLineProduct(page, 1, flour)
  await expect(lineField(page, 1, 'Costo unitario').locator('input')).toHaveValue('2.000')
  await lineField(page, 1, 'Cantidad *').locator('input').fill('10')
  await lineField(page, 1, 'Costo unitario').locator('input').fill('2.500')

  // Line 2 stays blank; line 3 leaves its cost empty.
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 3, sugar)
  await lineField(page, 3, 'Cantidad *').locator('input').fill('2')
  await lineField(page, 3, 'Costo unitario').locator('input').fill('')

  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 4, butter)
  await lineField(page, 4, 'Cantidad *').locator('input').fill('3')
  await lineField(page, 4, 'Costo unitario').locator('input').fill('8.000')

  // 10 × $2.500 + 2 × $3.000 (average) + 3 × $8.000.
  await expect(page.getByRole('dialog')).toContainText('Costo total: $55.000')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(page.getByText('3 movimientos registrados en el kardex')).toBeVisible()

  await field(page, 'Tipo de documento').click()
  await pickOption(page, 'FC — Factura de compra')
  const rows = page.locator('tbody tr', { hasText: invoice })
  await expect(rows).toHaveCount(3)
  const flourRow = rows.filter({ hasText: flour })
  await expect(flourRow).toContainText('Molinos Factura E2E')
  await expect(flourRow).toContainText('$2.500')
  // (10 × $2.000 + 10 × $2.500) / 20.
  await expect(flourRow).toContainText('$2.250')
  await expect(rows.filter({ hasText: sugar })).toContainText('$3.000')
  await expect(rows.filter({ hasText: butter })).toContainText('$8.000')

  await page.goto('/productos-base')
  for (const [name, stock] of [[flour, '20 kg'], [sugar, '6 kg'], [butter, '4 kg']] as const) {
    await page.getByRole('textbox', { name: 'Buscar' }).fill(name)
    await expect(page.locator('tr', { hasText: name })).toContainText(stock)
  }
})

/**
 * A line with its product but no quantity is marked on that line and nothing
 * is sent; a line the API rejects (an exit above the stock) is marked too,
 * and the lines before it are not saved either.
 */
test('una línea inválida muestra su mensaje y no se guarda ninguna línea', async ({ page, request }) => {
  const stamp = Date.now()
  const milk = `Leche Línea ${stamp}`
  const cheese = `Queso Línea ${stamp}`
  await createProducts(request, [
    { name: milk, unit: 'litro', unit_cost: 3000, current_stock: 5 },
    { name: cheese, unit: 'kg', unit_cost: 9000, current_stock: 2 },
  ])

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/kardex')
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /FC — Factura de compra/ }).click()
  // The default supplier is prefilled only if the suppliers loaded before the dialog opened.
  await page.getByLabel('Proveedor *').fill('Lechería Línea E2E')
  await pickLineProduct(page, 1, milk)
  await lineField(page, 1, 'Cantidad *').locator('input').fill('4')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 2, cheese)

  // The same product twice says it is registered apart; this one goes away.
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 3, milk)
  await expect(line(page, 3)).toContainText('Ya está en otra línea: se registra aparte')
  await line(page, 3).getByRole('button', { name: `Quitar ${milk} del movimiento` }).click()
  await expect(line(page, 3)).toHaveCount(0)

  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(line(page, 2)).toContainText(`Escribe la cantidad de ${cheese}`)
  await expect(line(page, 1)).not.toContainText('Escribe')
  // Said inside the dialog too, where it never covers its buttons.
  await expect(page.getByRole('dialog').locator('.v-alert')).toHaveText(`Escribe la cantidad de ${cheese}`)
  await page.getByRole('button', { name: 'Cancelar' }).click()

  // An exit the API rejects on line 2 leaves line 1 unsaved as well.
  await page.getByRole('button', { name: /Registrar movimiento/ }).click()
  await field(page, 'Tipo de documento *').click()
  await page.getByRole('option', { name: /AJ — Ajuste de inventario/ }).click()
  await field(page, 'Dirección *').click()
  await page.getByRole('option', { name: 'Salida' }).click()
  await pickLineProduct(page, 1, milk)
  await lineField(page, 1, 'Cantidad *').locator('input').fill('3')
  await page.getByRole('button', { name: 'Agregar producto' }).click()
  await pickLineProduct(page, 2, cheese)
  await lineField(page, 2, 'Cantidad *').locator('input').fill('5')
  await page.getByRole('button', { name: 'Registrar', exact: true }).click()
  await expect(line(page, 2)).toContainText(`La salida de ${cheese} supera el stock disponible (2).`)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Cancelar' }).click()

  await field(page, 'Producto').locator('input').fill(milk)
  await page.getByRole('option', { name: milk }).click()
  await expect(page.locator('.v-card', { hasText: 'Existencia actual' })).toContainText('5 litro')
  await expect(page.locator('tbody tr', { hasText: 'SI' })).toHaveCount(1)
  await expect(page.locator('tbody tr').filter({ hasText: /FC|AJ/ })).toHaveCount(0)
})
