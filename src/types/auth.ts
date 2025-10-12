/**
 * Tipos relacionados con autenticación y usuarios
 */

export type UserRole = 'admin' | 'employee'

export interface User {
  id: number
  name: string
  email: string
  role: UserRole
  active: boolean
  phone?: string
  last_login_at?: string
  email_verified_at?: string
  created_at?: string
  updated_at?: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface LoginResponse {
  message: string
  user: User
  token: string
}

export interface AuthApiResponse<T = any> {
  data: T
  message?: string
}

export interface ChangePasswordData {
  current_password: string
  password: string
  password_confirmation: string
}

export interface UpdateProfileData {
  name?: string
  email?: string
  phone?: string
}

export interface ValidationErrors {
  [field: string]: string[]
}

export interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
