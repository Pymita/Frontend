import api from './api'

/**
 * Carga masiva de productos desde un Excel o CSV, para quien no quiere crear
 * cien productos uno por uno.
 */

export interface ImportColumn {
  key: string
  label: string
  required: boolean
  help: string
  example: string
}

export interface ImportFormat {
  columns: ImportColumn[]
  notes: string[]
}

export interface ImportRowError {
  fila: number
  error: string
}

export interface ImportResult {
  created: number
  errors: ImportRowError[]
  total_errors?: number
  missing_categories: string[]
}

export const productImportService = {
  /** Las columnas del archivo, tal como las define el backend. */
  async format(): Promise<ImportFormat> {
    const response = await api.get<{ data: ImportFormat }>('/products/import/columns')
    return response.data.data
  },

  /** Descarga el Excel de ejemplo con los encabezados ya puestos. */
  async downloadTemplate(): Promise<void> {
    const response = await api.get('/products/import/template', { responseType: 'blob' })

    const url = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla_productos.xlsx'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  },

  /**
   * Sube el archivo. Si algo está mal el backend responde 422 con el detalle,
   * que se devuelve tal cual para pintarlo en pantalla.
   */
  async upload(file: File): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file)

    const response = await api.post<{ data: ImportResult; message: string }>(
      '/products/import',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )

    return response.data.data
  },
}
