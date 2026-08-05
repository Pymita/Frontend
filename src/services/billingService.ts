import api from './api'

export type PersonType = 'natural' | 'legal'

export interface Customer {
  id: number
  document_type: string
  document_number: string
  name: string
  trade_name?: string
  email?: string
  phone?: string
  address?: string
  city_dane_code?: string
  city?: string
  department?: string
  postal_code?: string
  person_type?: PersonType
  tax_regime?: string
  tax_responsibilities?: string[]
  frequent_customer?: boolean
  notes?: string
  created_at: string
  updated_at: string
}

export interface CompanySetting {
  id: number
  nit: string
  legal_name: string
  trade_name?: string
  address: string
  city_dane_code: string
  city?: string
  department: string
  postal_code?: string
  phone?: string
  email: string
  tax_regime: string
  tax_responsibilities: string[]
  ciiu_economic_activity?: string
  activity_description?: string
  invoicing_resolution?: string
  resolution_date?: string
  invoice_prefix?: string
  range_from?: number
  range_to?: number
  current_sequence?: number
  valid_from?: string
  valid_until?: string
  einvoice_provider?: string
  einvoicing_enabled?: boolean
  created_at: string
  updated_at: string
}

interface ApiResponse<T> {
  data: T
  message?: string
}

export const billingService = {
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
  // Nota: los endpoints /company-settings aún no existen en el backend (feature futura).
  // Se conservan con manejo de 404 -> null.
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
