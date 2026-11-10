import { expect, test, type Page } from '@playwright/test'
import { ADMIN, API, apiLogin, field, loginUI, pickOption } from './helpers'

/**
 * Menú: la vista previa de lo que ve el mesero en la app. Solo categorías
 * visibles, con productos activos y disponibles, y el precio en pesos.
 */
test('el menú muestra lo publicado y disponible, y deja de mostrar una categoría oculta', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  const auth = { Authorization: `Bearer ${token}` }
  const stamp = Date.now()
  const categoryName = `Postres E2E ${stamp}`
  const category = await request.post(`${API}/categories`, { headers: auth, data: { name: categoryName } })
  const categoryId = (await category.json()).data.id

  const publish = async (name: string, price: number): Promise<number> => {
    const product = await request.post(`${API}/products`, {
      headers: auth,
      data: { name, type: 'final', unit: 'unidad', sale_price: price, tracks_stock: false, category_id: categoryId },
    })
    const menuItem = await request.post(`${API}/menu-items`, {
      headers: auth,
      data: { name, final_product_id: (await product.json()).data.id, category_id: categoryId, base_price: price },
    })
    expect(menuItem.ok()).toBeTruthy()
    return (await menuItem.json()).data.id
  }
  await publish(`Brownie ${stamp}`, 8500)
  const flan = await publish(`Flan ${stamp}`, 6000)
  // Agotado: sigue en el catálogo pero el mesero no lo puede ofrecer.
  await request.post(`${API}/menu-items/${flan}/toggle-availability`, { headers: auth })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/menu')
  await expect(page.getByRole('heading', { name: 'Menú' })).toBeVisible()

  const panel = page.locator('.v-expansion-panel', { hasText: categoryName })
  await expect(panel).toContainText('1 producto')
  await expect(panel.locator('.v-list-item', { hasText: `Brownie ${stamp}` })).toContainText('$8.500')
  await expect(panel).not.toContainText(`Flan ${stamp}`)

  // Ocultar la categoría en la app la saca del menú.
  const hidden = await request.put(`${API}/categories/${categoryId}`, {
    headers: auth,
    data: { visible_in_app: false },
  })
  expect(hidden.ok()).toBeTruthy()
  await page.getByRole('button', { name: 'Actualizar' }).click()
  await expect(page.locator('.v-expansion-panel', { hasText: categoryName })).toHaveCount(0)
})

/**
 * Eliminar una categoría nunca se lleva lo que tiene: en producción se llevó
 * sus productos, sus ventas y dejó su kardex huérfano. El diálogo dice qué
 * tiene y pide moverlo a otra categoría o dejarlo sin categoría.
 */
test.describe('eliminar una categoría con productos', () => {
  const setUp = async (request: any, names: { category: string; product: string }, product: Record<string, unknown>) => {
    const token = await apiLogin(request, ADMIN.email, ADMIN.password)
    const auth = { Authorization: `Bearer ${token}` }
    const category = await request.post(`${API}/categories`, { headers: auth, data: { name: names.category } })
    expect(category.status()).toBe(201)
    const created = await request.post(`${API}/products`, {
      headers: auth,
      data: { name: names.product, type: 'final', category_id: (await category.json()).data.id, menu: {}, ...product },
    })
    expect(created.status()).toBe(201)
    return { auth, productId: (await created.json()).data.id as number }
  }

  // The table pages by 10 and every spec adds categories: show them all.
  const openCategories = async (page: Page) => {
    await page.goto('/categorias')
    await page.locator('.v-data-table-footer__items-per-page .v-select').click()
    await page.getByRole('option', { name: '100' }).click()
  }

  test('moverlos a otra categoría la elimina y el producto conserva su venta y su kardex', async ({ page, request }) => {
    const stamp = Date.now()
    const juices = `Jugos E2E ${stamp}`
    const drinks = `Bebidas frías E2E ${stamp}`
    const juice = `Jugo de mora E2E ${stamp}`
    const { auth, productId } = await setUp(request, { category: juices, product: juice }, {
      unit: 'vaso', sale_price: 4000, unit_cost: 1500, tracks_stock: true, current_stock: 10,
    })
    expect((await request.post(`${API}/categories`, { headers: auth, data: { name: drinks } })).status()).toBe(201)
    const order = await request.post(`${API}/orders`, {
      headers: auth,
      data: { customer_name: `Mesa E2E ${stamp}`, items: [{ product_id: productId, quantity: 1 }] },
    })
    expect(order.status()).toBe(201)
    const paid = await request.post(`${API}/orders/${(await order.json()).data.id}/pay`, { headers: auth, data: { payment_method: 'cash' } })
    expect(paid.ok()).toBeTruthy()

    await loginUI(page, ADMIN.email, ADMIN.password)
    await openCategories(page)
    await page.getByRole('button', { name: `Eliminar la categoría ${juices}` }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: `Eliminar la categoría ${juices}` })
    await expect(dialog).toContainText('Tiene 1 producto.')
    // Until the owner says where it goes, nothing can be deleted.
    await expect(dialog.getByRole('button', { name: 'Eliminar', exact: true })).toBeDisabled()
    await dialog.getByLabel('Moverlo a otra categoría').check()
    await dialog.locator('.v-select', { hasText: 'Mover a' }).click()
    await pickOption(page, drinks)
    await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click()

    await expect(page.getByText(`Categoría eliminada. Su producto pasó a ${drinks}.`)).toBeVisible()
    await expect(page.getByRole('button', { name: `Eliminar la categoría ${juices}` })).toHaveCount(0)
    await expect(page.locator('tr', { hasText: drinks })).toContainText('1 producto')

    await page.goto('/productos-base')
    await page.getByRole('textbox', { name: 'Buscar' }).fill(juice)
    await expect(page.locator('tr', { hasText: juice })).toContainText(drinks)

    // Its opening balance and its sale are still in the kardex, under its name.
    await page.goto('/kardex')
    await page.getByRole('combobox', { name: 'Producto' }).fill(juice)
    await page.getByRole('option', { name: juice }).click()
    await expect(page.getByText('Existencia actual')).toBeVisible()
    await expect(page.getByText('9 vaso')).toBeVisible()
    const documents = page.locator('tbody tr .v-chip')
    await expect(documents.filter({ hasText: /^\s*FV\s*$/ })).toHaveCount(1)
    await expect(documents.filter({ hasText: /^\s*SI\s*$/ })).toHaveCount(1)
  })

  test('dejarlos sin categoría los marca en Productos y los saca del menú', async ({ page, request }) => {
    const stamp = Date.now()
    const season = `Temporada E2E ${stamp}`
    const custard = `Natilla E2E ${stamp}`
    await setUp(request, { category: season, product: custard }, { unit: 'porción', sale_price: 5000, tracks_stock: false })

    await loginUI(page, ADMIN.email, ADMIN.password)
    await page.goto('/menu')
    await expect(page.locator('.v-expansion-panel', { hasText: season })).toContainText(custard)

    await openCategories(page)
    await page.getByRole('button', { name: `Eliminar la categoría ${season}` }).click()
    const dialog = page.getByRole('dialog').filter({ hasText: `Eliminar la categoría ${season}` })
    await expect(dialog).toContainText('Tiene 1 producto.')
    await dialog.getByLabel('Dejarlo sin categoría').check()
    await expect(dialog).toContainText('Sin categoría no salen en el menú de la app hasta que les asignes una en Productos.')
    await dialog.getByRole('button', { name: 'Eliminar', exact: true }).click()
    await expect(page.getByText('Categoría eliminada. Su producto quedó sin categoría: no sale en el menú de la app hasta que le asignes una.')).toBeVisible()

    await page.goto('/productos-base')
    await field(page, 'Categoría').click()
    await pickOption(page, 'Sin categoría')
    await page.getByRole('textbox', { name: 'Buscar' }).fill(custard)
    const row = page.locator('tr', { hasText: custard })
    await expect(row).toContainText('Sin categoría')
    await expect(row).toContainText('Fuera del menú')

    // The form says it too, where the category is chosen.
    await row.getByRole('button', { name: `Editar ${custard}` }).click()
    await expect(field(page, 'Categoría *')).toContainText('Sin categoría')
    await expect(page.getByRole('dialog').getByText('Sin categoría no sale en el menú de la app hasta que le asignes una.')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click()

    await page.goto('/menu')
    await expect(page.getByRole('heading', { name: 'Menú' })).toBeVisible()
    await expect(page.locator('.v-expansion-panel').first()).toBeVisible()
    await expect(page.getByText(custard)).toHaveCount(0)
    await expect(page.locator('.v-expansion-panel', { hasText: season })).toHaveCount(0)
  })
})

/**
 * Ordenar: la dueña decide en qué orden ve el mesero las categorías y los
 * productos de cada una. Lo nuevo llega al final, no por su nombre; se mueve
 * con las flechas (pantallas táctiles, teclado) o arrastrando, y se guarda al
 * instante en el orden que la app recibe de /menu/categories.
 */
test.describe('Ordenar el menú', () => {
  test('lo nuevo llega al final y la dueña lo reordena con flechas y arrastrando', async ({ page, request }) => {
    const token = await apiLogin(request, ADMIN.email, ADMIN.password)
    const auth = { Authorization: `Bearer ${token}` }
    const stamp = Date.now()
    const soups = `Orden Sopas ${stamp}`
    const arepas = `Orden Arepas ${stamp}`
    const [sancocho, ajiaco, mondongo] = ['Sancocho', 'Ajiaco', 'Mondongo'].map((name) => `${name} ${stamp}`)

    const createCategory = async (name: string): Promise<number> => {
      const created = await request.post(`${API}/categories`, { headers: auth, data: { name } })
      expect(created.status()).toBe(201)
      return (await created.json()).data.id
    }
    const publish = async (name: string, categoryId: number) => {
      const product = await request.post(`${API}/products`, {
        headers: auth,
        data: { name, type: 'final', unit: 'unidad', sale_price: 12000, tracks_stock: false, category_id: categoryId, menu: {} },
      })
      expect(product.status()).toBe(201)
    }
    const soupsId = await createCategory(soups)
    const arepasId = await createCategory(arepas)
    for (const name of [sancocho, ajiaco, mondongo]) await publish(name, soupsId)
    await publish(`Arepa de queso ${stamp}`, arepasId)

    // What the waiter app reads, kept to what this test created.
    const appMenu = async () => (await (await request.get(`${API}/menu/categories`, { headers: auth })).json()).data
    const appCategories = async () =>
      (await appMenu()).map((category: { name: string }) => category.name).filter((name: string) => [soups, arepas].includes(name))
    const appItems = async () =>
      (await appMenu()).find((category: { name: string }) => category.name === soups).items.map((item: { name: string }) => item.name)

    const panelNames = async () =>
      (await page.locator('.v-expansion-panel-title .font-weight-medium').allTextContents())
        .map((name) => name.trim())
        .filter((name) => [soups, arepas].includes(name))
    const itemNames = () => page.locator('.v-expansion-panel', { hasText: soups }).locator('.v-list-item-title')

    await loginUI(page, ADMIN.email, ADMIN.password)
    await page.goto('/menu')

    // Created last, they come last and in the order they were created, not alphabetically.
    await expect.poll(panelNames).toEqual([soups, arepas])
    await expect(itemNames()).toHaveText([sancocho, ajiaco, mondongo])

    await page.getByRole('button', { name: 'Ordenar' }).click()
    await expect(page.getByText('Arrastra las categorías y los productos, o usa las flechas.')).toBeVisible()
    await expect(page.getByRole('button', { name: `Subir la categoría ${soups}` })).toBeEnabled()
    await expect(page.getByRole('button', { name: `Mover al final la categoría ${arepas}` })).toBeDisabled()
    await expect(page.getByRole('button', { name: `Mover al inicio el producto ${sancocho}` })).toBeDisabled()

    // Flechas.
    await page.getByRole('button', { name: `Subir la categoría ${arepas}` }).click()
    await expect.poll(panelNames).toEqual([arepas, soups])
    await page.getByRole('button', { name: `Mover al inicio el producto ${mondongo}` }).click()
    await expect(itemNames()).toHaveText([mondongo, sancocho, ajiaco])
    await page.getByRole('button', { name: `Mover al final el producto ${sancocho}` }).click()
    await expect(itemNames()).toHaveText([mondongo, ajiaco, sancocho])
    await expect(page.getByText('Orden guardado.')).toBeVisible()
    await expect.poll(appCategories).toEqual([arepas, soups])
    await expect.poll(appItems).toEqual([mondongo, ajiaco, sancocho])

    // Arrastrando: the handle onto the row whose place it takes.
    await page.getByTitle(`Arrastrar el producto ${sancocho}`).dragTo(itemNames().filter({ hasText: mondongo }))
    await expect(itemNames()).toHaveText([sancocho, mondongo, ajiaco])
    await page
      .getByTitle(`Arrastrar la categoría ${soups}`)
      .dragTo(page.locator('.v-expansion-panel-title', { hasText: arepas }))
    await expect.poll(panelNames).toEqual([soups, arepas])
    await expect.poll(appCategories).toEqual([soups, arepas])
    await expect.poll(appItems).toEqual([sancocho, mondongo, ajiaco])

    // Done ordering, and after a reload, Menú reads the saved order.
    await page.getByRole('button', { name: 'Listo' }).click()
    await expect(page.getByRole('button', { name: `Subir la categoría ${soups}` })).toHaveCount(0)
    await page.reload()
    await expect.poll(panelNames).toEqual([soups, arepas])
    await expect(itemNames()).toHaveText([sancocho, mondongo, ajiaco])

    // Categorías lists the same order, the newest one included (it went last).
    await page.goto('/categorias')
    await expect(page.locator('tr', { hasText: arepas })).toBeVisible()
    const rows = await page.locator('tbody tr').allTextContents()
    const row = (name: string) => rows.findIndex((text) => text.includes(name))
    expect(row(soups)).toBeGreaterThanOrEqual(0)
    expect(row(soups)).toBeLessThan(row(arepas))
  })
})
