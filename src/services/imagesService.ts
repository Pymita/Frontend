import api from './api'

export type ImageFolder = 'products' | 'categories' | 'menu-items' | 'companies'

interface UploadResponse {
  data: { url: string }
  message: string
}

export const imagesService = {
  /**
   * Sube una imagen y devuelve la ruta a guardar en el campo image_url.
   * `replaces` borra la imagen anterior para no dejar archivos huérfanos.
   */
  async upload(file: File, folder: ImageFolder, replaces?: string | null): Promise<string> {
    const form = new FormData()
    form.append('image', file)
    form.append('folder', folder)
    if (replaces) form.append('replaces', replaces)

    const response = await api.post<UploadResponse>('/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return response.data.data.url
  },

  async remove(url: string): Promise<void> {
    await api.delete('/images', { data: { url } })
  },
}
