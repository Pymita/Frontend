import api from './api'
import type {
  CreateCompanyPayload,
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformSeller,
  PlatformSubscription,
  RegisterPaymentPayload,
  SaveSubscriptionPayload,
  SellerStats,
} from '../types/platform'

interface ApiEnvelope<T> {
  data: T
  message?: string
}

class PlatformService {
  async listCompanies(): Promise<PlatformCompany[]> {
    const response = await api.get<ApiEnvelope<PlatformCompany[]>>('/platform/companies')
    return response.data.data
  }

  async createCompany(payload: CreateCompanyPayload): Promise<PlatformCompany> {
    const response = await api.post<ApiEnvelope<PlatformCompany>>('/platform/companies', payload)
    return response.data.data
  }

  async getCompany(id: number): Promise<PlatformCompanyDetail> {
    const response = await api.get<ApiEnvelope<PlatformCompanyDetail>>(`/platform/companies/${id}`)
    return response.data.data
  }

  async updateCompany(
    id: number,
    payload: Partial<Pick<PlatformCompany, 'name' | 'slug' | 'email' | 'phone' | 'business_type' | 'modules'>>,
  ): Promise<PlatformCompany> {
    const response = await api.put<ApiEnvelope<PlatformCompany>>(`/platform/companies/${id}`, payload)
    return response.data.data
  }

  async toggleActive(id: number): Promise<PlatformCompany> {
    const response = await api.post<ApiEnvelope<PlatformCompany>>(`/platform/companies/${id}/toggle-active`)
    return response.data.data
  }

  async saveSubscription(companyId: number, payload: SaveSubscriptionPayload): Promise<PlatformSubscription> {
    const response = await api.put<ApiEnvelope<PlatformSubscription>>(
      `/platform/companies/${companyId}/subscription`,
      payload
    )
    return response.data.data
  }

  async registerPayment(companyId: number, payload: RegisterPaymentPayload): Promise<{ subscription: PlatformSubscription }> {
    const response = await api.post<ApiEnvelope<{ subscription: PlatformSubscription }>>(
      `/platform/companies/${companyId}/subscription/payments`,
      payload
    )
    return response.data.data
  }

  // --- Vendedores del SaaS ---
  async listSellers(): Promise<PlatformSeller[]> {
    const response = await api.get<ApiEnvelope<PlatformSeller[]>>('/platform/sellers')
    return response.data.data
  }

  async createSeller(payload: Pick<PlatformSeller, 'name'> & Partial<PlatformSeller>): Promise<PlatformSeller> {
    const response = await api.post<ApiEnvelope<PlatformSeller>>('/platform/sellers', payload)
    return response.data.data
  }

  async updateSeller(id: number, payload: Partial<PlatformSeller>): Promise<PlatformSeller> {
    const response = await api.put<ApiEnvelope<PlatformSeller>>(`/platform/sellers/${id}`, payload)
    return response.data.data
  }

  async sellerStats(): Promise<SellerStats[]> {
    const response = await api.get<ApiEnvelope<SellerStats[]>>('/platform/sellers/stats')
    return response.data.data
  }
}

export default new PlatformService()
