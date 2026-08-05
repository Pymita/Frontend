/**
 * Índice central de todos los tipos
 * Facilita las importaciones con un solo punto de entrada
 */

import type { ValidationErrors } from './auth'

// Auth types
export type {
  User,
  UserRole,
  LoginCredentials,
  LoginResponse,
  AuthApiResponse,
  ChangePasswordData,
  UpdateProfileData,
  ValidationErrors,
  AuthState
} from './auth'

// UI types
export type {
  MenuItem,
  NavigationDrawerItem,
  AlertMessage,
  TableHeader,
  SelectOption,
  FormField
} from './ui'

// API types
export type {
  ApiResponse,
  ApiError,
  PaginatedResponse,
  ApiRequestConfig,
  HttpMethod,
  ApiEndpoint
} from './api'

// Store types
export type { AuthStore } from './stores'

// Utility types
export type Nullable<T> = T | null
export type Optional<T> = T | undefined
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Common form types
export interface BaseFormData {
  [key: string]: any
}

export interface FormValidation {
  isValid: boolean
  errors: ValidationErrors
}
