/**
 * Tipos relacionados con la interfaz de usuario
 */

export interface MenuItem {
  title: string
  icon: string
  route: string
  requiresAdmin?: boolean
  superAdminOnly?: boolean
  /** Función requerida para verla (empleados; los admins tienen todas) */
  feature?: string
  disabled?: boolean
}

export interface NavigationDrawerItem extends MenuItem {
  subtitle?: string
  badge?: string | number
  children?: MenuItem[]
}

export interface AlertMessage {
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  timeout?: number
}

export interface TableHeader {
  title: string
  key: string
  sortable?: boolean
  width?: number | string
  align?: 'start' | 'center' | 'end'
}

export interface SelectOption {
  title: string
  value: any
  disabled?: boolean
  subtitle?: string
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'number' | 'select' | 'textarea'
  required?: boolean
  rules?: Array<(value: any) => boolean | string>
  options?: SelectOption[]
}
