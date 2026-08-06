import api from './api'
import type { Feature, UserRole } from '../types/auth'

export interface CompanyUser {
  id: number
  name: string
  email: string
  role: UserRole
  phone: string | null
  active: boolean
  permissions: Feature[] | null
  features: Feature[]
  last_login_at: string | null
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: 'admin' | 'employee'
  phone?: string
  permissions?: Feature[]
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  password?: string
  role?: 'admin' | 'employee'
  phone?: string
  active?: boolean
  permissions?: Feature[] | null
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
