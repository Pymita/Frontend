import api from './api'
import type {
  CompanyDeletionPlan,
  CompanyDeletionSummary,
  CreateCompanyPayload,
  DeleteCompanyPayload,
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

  /** Descarga la copia completa de la empresa (el mismo archivo de tenant:export). */
  async downloadCompanyExport(company: Pick<PlatformCompany, 'id' | 'slug'>): Promise<void> {
    const response = await api.get(`/platform/companies/${company.id}/export`, { responseType: 'blob' })

    const disposition: string = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || `${company.slug}.json`

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async getDeletionPlan(id: number): Promise<CompanyDeletionPlan> {
    const response = await api.get<ApiEnvelope<CompanyDeletionPlan>>(`/platform/companies/${id}/deletion-plan`)
    return response.data.data
  }

  async deleteCompany(id: number, payload: DeleteCompanyPayload): Promise<{ summary: CompanyDeletionSummary; message: string }> {
    const response = await api.delete<ApiEnvelope<CompanyDeletionSummary>>(`/platform/companies/${id}`, { data: payload })
    return { summary: response.data.data, message: response.data.message ?? '' }
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
