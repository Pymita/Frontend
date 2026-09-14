import { expect, test } from '@playwright/test'
import { ADMIN, API, apiLogin, loginUI } from './helpers'

/**
 * Importación masiva: cargar el catálogo desde un archivo en vez de crear
 * los productos uno por uno. El archivo es todo o nada, y las categorías
 * tienen que existir antes.
 */

const CSV_HEADERS = 'nombre;categoria;unidad;precio_venta;maneja_inventario;publicar_en_menu\n'

test('el archivo se rechaza entero cuando nombra una categoría que no existe', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  await request.post(`${API}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Importadas OK' },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')
  await page.getByRole('button', { name: 'Importar Excel' }).click()

  const dialog = page.getByRole('dialog')

  // La pantalla explica cada columna antes de pedir el archivo.
  await expect(dialog.getByText('Antes de importar, crea las categorías')).toBeVisible()
  await expect(dialog.getByRole('cell', { name: 'precio_venta' })).toBeVisible()

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'productos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      CSV_HEADERS +
        'Café negro;Importadas OK;taza;2500;no;si\n' +
        'Croissant;Panadería Inexistente;unidad;3500;no;si\n',
    ),
  })
  await dialog.getByRole('button', { name: 'Importar productos' }).click()

  // Dice exactamente qué categoría falta, y no crea nada: ni el café.
  await expect(dialog.getByText('Faltan categorías.')).toBeVisible()
  await expect(dialog.getByText('Panadería Inexistente')).toBeVisible()

  const products = await request.get(`${API}/products`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const names = (await products.json()).data.map((product: any) => product.name)
  expect(names).not.toContain('Café negro')
})

test('un archivo correcto crea los productos de una sola vez', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)
  await request.post(`${API}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Cafetería Import' },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/productos-base')
  await page.getByRole('button', { name: 'Importar Excel' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'productos.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      CSV_HEADERS +
        'Capuchino Import;Cafetería Import;taza;5500;no;si\n' +
        'Latte Import;Cafetería Import;taza;6000;no;si\n',
    ),
  })
  await dialog.getByRole('button', { name: 'Importar productos' }).click()

  await expect(page.getByText('Se crearon 2 productos')).toBeVisible()

  // Quedaron creados de verdad, con su precio y publicados en el menú.
  const products = await request.get(`${API}/products`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const created = (await products.json()).data.find((p: any) => p.name === 'Capuchino Import')
  expect(created).toBeTruthy()
  expect(Number(created.sale_price)).toBe(5500)
  expect(created.in_menu).toBe(true)
})
