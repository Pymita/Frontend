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

export interface PaginatedResponse<T = any> {
  data: T[]
  meta: {
    current_page: number
    from: number
    last_page: number
    per_page: number
    to: number
    total: number
  }
  links: {
    first: string
    last: string
    prev: string | null
    next: string | null
  }
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
