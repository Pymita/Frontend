import { expect, test } from '@playwright/test'
import { ADMIN, apiLogin, loginUI, API } from './helpers'

/**
 * Subida de imágenes y selector de emojis en categorías.
 */

/** PNG de 1x1 en memoria: no necesitamos un archivo real en disco. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

test('se puede crear una categoría subiendo una imagen y eligiendo un emoji', async ({ page }) => {
  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/categorias')

  await page.getByRole('button', { name: /Nueva Categoría/i }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Nombre de la categoría').fill('Bebidas E2E')

  // Emoji desde el selector: nadie tiene que escribirlo a mano.
  await dialog.getByRole('button', { name: /Elegir emoji/i }).click()
  await page.getByPlaceholder('Buscar (ej: cerveza, pizza)').fill('cerveza')
  await page.getByRole('button', { name: '🍺' }).first().click()

  // Y una imagen desde el equipo.
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'bebidas.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  })

  // La vista previa aparece cuando la subida termina.
  await expect(dialog.locator('img').first()).toBeVisible({ timeout: 15_000 })

  await dialog.getByRole('button', { name: 'Guardar' }).click()

  // La categoría queda listada con su miniatura.
  const row = page.locator('tr', { hasText: 'Bebidas E2E' })
  await expect(row).toBeVisible()
  await expect(row.locator('img')).toBeVisible()
})

test('la imagen subida se guarda en la carpeta de la empresa', async ({ page, request }) => {
  const token = await apiLogin(request, ADMIN.email, ADMIN.password)

  const response = await request.post(`${API}/images`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: {
      image: { name: 'foto.png', mimeType: 'image/png', buffer: TINY_PNG },
      folder: 'products',
    },
  })

  expect(response.status()).toBe(201)
  const url = (await response.json()).data.url
  expect(url).toMatch(/^\/storage\/companies\/\d+\/products\//)

  // El archivo queda accesible por HTTP (storage:link).
  const image = await request.get(url.replace('/storage', 'http://127.0.0.1:8010/storage'))
  expect(image.ok()).toBeTruthy()

  // Y una categoría puede guardarlo y mostrarlo.
  await request.post(`${API}/categories`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'Con foto E2E', image_url: url },
  })

  await loginUI(page, ADMIN.email, ADMIN.password)
  await page.goto('/categorias')
  await expect(page.locator('tr', { hasText: 'Con foto E2E' }).locator('img')).toBeVisible()
})
