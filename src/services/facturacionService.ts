import api from './api'

export interface Customer {
  id: number
  document_type: string
  document_number: string
  name: string
  email?: string
  phone?: string
  address?: string
  city_dane_code?: string
  department?: string
  tax_regime?: string
  tax_responsibilities?: string[]
  created_at: string
  updated_at: string
}

export interface CompanySetting {
  id: number
  nit: string
  razon_social: string
  nombre_comercial?: string
  address: string
  city_dane_code: string
  department: string
  phone?: string
  email: string
  tax_regime: string
  tax_responsibilities: string[]
  economic_activity_ciiu?: string
  billing_resolution_number?: string
  billing_resolution_date?: string
  billing_prefix?: string
  billing_start_number?: number
  billing_end_number?: number
  billing_valid_until?: string
  created_at: string
  updated_at: string
}

interface ApiResponse<T> {
  data: T
  message?: string
}

export const facturacionService = {
  // ===== Clientes =====
  async getCustomers(): Promise<Customer[]> {
    const response = await api.get<ApiResponse<Customer[]>>('/customers')
    return response.data.data
  },

  async getCustomer(id: number): Promise<Customer> {
    const response = await api.get<ApiResponse<Customer>>(`/customers/${id}`)
    return response.data.data
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const response = await api.post<ApiResponse<Customer>>('/customers', data)
    return response.data.data
  },

  async updateCustomer(id: number, data: Partial<Customer>): Promise<Customer> {
    const response = await api.put<ApiResponse<Customer>>(`/customers/${id}`, data)
    return response.data.data
  },

  async deleteCustomer(id: number): Promise<void> {
    await api.delete(`/customers/${id}`)
  },

  async findCustomerByDocument(document_number: string): Promise<Customer | null> {
    try {
      const response = await api.get<ApiResponse<Customer>>(`/customers/find/${document_number}`)
      return response.data.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  // ===== Configuración de la Empresa =====
  async getCompanySettings(): Promise<CompanySetting | null> {
    try {
      const response = await api.get<ApiResponse<CompanySetting>>('/company-settings')
      return response.data.data
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  async createCompanySettings(data: Partial<CompanySetting>): Promise<CompanySetting> {
    const response = await api.post<ApiResponse<CompanySetting>>('/company-settings', data)
    return response.data.data
  },

  async updateCompanySettings(id: number, data: Partial<CompanySetting>): Promise<CompanySetting> {
    const response = await api.put<ApiResponse<CompanySetting>>(`/company-settings/${id}`, data)
    return response.data.data
  },
}
