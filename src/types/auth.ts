/**
 * Tipos relacionados con autenticación y usuarios
 */

export type UserRole = 'super_admin' | 'admin' | 'employee'

/** Funciones que se pueden habilitar por empleado (espejo de User::FEATURES del backend) */
export type Feature = 'orders' | 'menu' | 'inventory' | 'customers' | 'expenses' | 'reports'

export const ALL_FEATURES: Feature[] = ['orders', 'menu', 'inventory', 'customers', 'expenses', 'reports']

/** Acceso por defecto de un empleado sin permisos explícitos (espejo del backend) */
export const DEFAULT_EMPLOYEE_FEATURES: Feature[] = ['orders', 'menu', 'inventory', 'customers', 'reports']

export interface CompanySubscriptionInfo {
  status: SubscriptionStatus
  /** Días que faltan para el próximo corte (0 = hoy o ya bloqueada) */
  days_until_block: number
  /** Mensaje listo para mostrar en el banner */
  notice: string | null
}

export interface CompanySummary {
  id: number
  name: string
  slug: string
  subscription?: CompanySubscriptionInfo | null
  subscription_status?: SubscriptionStatus | null
}

export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'suspended'

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
  company?: CompanySummary | null
  features?: Feature[]
}

/** Acceso efectivo: usa features del backend o cae al comportamiento por rol */
export function effectiveFeatures(user: Pick<User, 'role' | 'features'> | null): Feature[] {
  if (!user) return []
  if (user.features) return user.features
  return user.role === 'employee' ? DEFAULT_EMPLOYEE_FEATURES : ALL_FEATURES
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
