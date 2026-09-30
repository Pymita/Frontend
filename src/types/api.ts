/**
 * Tipos relacionados con APIs y respuestas HTTP
 */

export interface ApiResponse<T = any> {
  data: T
  message?: string
  success?: boolean
}

export interface ApiError {
  message: string
  errors?: Record<string, string[]>
  status: number
}

/** Página de una lista paginada en el servidor (`?per_page=`). */
export interface PageMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

export interface PaginatedResponse<T = any> {
  data: T[]
  meta: PageMeta
}

/** Lo que una tabla paginada pide: página, tamaño, búsqueda y orden. */
export interface PageQuery {
  page: number
  per_page: number
  q?: string
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface ApiRequestConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ApiEndpoint {
  method: HttpMethod
  url: string
  requiresAuth?: boolean
}
