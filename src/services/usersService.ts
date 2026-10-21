import api from './api'
import type { Feature, UserRole } from '../types/auth'

export interface CompanyUser {
  id: number
  name: string
  /** Null for staff accounts that sign in with a username */
  email: string | null
  /** Business-owned username, unique per company (employees) */
  username: string | null
  role: UserRole
  phone: string | null
  active: boolean
  permissions: Feature[] | null
  features: Feature[]
  /** "Cobrar pedidos": a permission inside Pedidos, granted apart from the features */
  can_charge_orders: boolean
  /** "Editar movimientos del kardex": a permission inside Inventario, granted like can_charge_orders */
  can_edit_kardex: boolean
  last_login_at: string | null
}

export interface CreateUserPayload {
  name: string
  email?: string
  username?: string
  password: string
  role: 'admin' | 'employee'
  phone?: string
  permissions?: Feature[]
  can_charge_orders?: boolean
  can_edit_kardex?: boolean
}

export interface UpdateUserPayload {
  name?: string
  email?: string | null
  username?: string | null
  password?: string
  role?: 'admin' | 'employee'
  phone?: string
  active?: boolean
  permissions?: Feature[] | null
  can_charge_orders?: boolean
  can_edit_kardex?: boolean
}

interface ApiEnvelope<T> {
  data: T
  message?: string
}

class UsersService {
  async list(): Promise<CompanyUser[]> {
    const response = await api.get<ApiEnvelope<CompanyUser[]>>('/users')
    return response.data.data
  }

  async create(payload: CreateUserPayload): Promise<CompanyUser> {
    const response = await api.post<ApiEnvelope<CompanyUser>>('/users', payload)
    return response.data.data
  }

  async update(id: number, payload: UpdateUserPayload): Promise<CompanyUser> {
    const response = await api.put<ApiEnvelope<CompanyUser>>(`/users/${id}`, payload)
    return response.data.data
  }
}

export default new UsersService()
