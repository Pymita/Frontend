import api from './api'
import type {
  CompanyDeletionPlan,
  CompanyDeletionSummary,
  CreateCompanyPayload,
  DeleteCompanyPayload,
  PlatformActivity,
  PlatformCompany,
  PlatformCompanyDetail,
  PlatformSale,
  PlatformSeller,
  PlatformSubscription,
  RegisterPaymentPayload,
  RegisterUpgradePayload,
  SalesOverview,
  SaveSubscriptionPayload,
  SellerStats,
  TemporaryPasswordPayload,
  UpdateSalePayload,
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
    payload: Partial<Pick<PlatformCompany, 'name' | 'slug' | 'email' | 'phone' | 'city' | 'business_type' | 'modules' | 'order_mode'>>,
  ): Promise<PlatformCompany> {
    const response = await api.put<ApiEnvelope<PlatformCompany>>(`/platform/companies/${id}`, payload)
    return response.data.data
  }

  async toggleActive(id: number): Promise<PlatformCompany> {
    const response = await api.post<ApiEnvelope<PlatformCompany>>(`/platform/companies/${id}/toggle-active`)
    return response.data.data
  }

  /** Temporary password for an admin of the company; returns the API's message, which names them. */
  async setTemporaryPassword(companyId: number, userId: number, payload: TemporaryPasswordPayload): Promise<string> {
    const response = await api.put<{ message: string }>(`/platform/companies/${companyId}/users/${userId}/password`, payload)
    return response.data.message
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

  /** With a period, each row also carries the commission earned in it. */
  async sellerStats(period?: { from: string; to: string }): Promise<SellerStats[]> {
    const response = await api.get<ApiEnvelope<SellerStats[]>>('/platform/sellers/stats', { params: period })
    return response.data.data
  }

  // --- Novedades y ventas ---
  async activity(days: number): Promise<PlatformActivity> {
    const response = await api.get<ApiEnvelope<PlatformActivity>>('/platform/activity', { params: { days } })
    return response.data.data
  }

  async listSales(period: { from: string; to: string }): Promise<SalesOverview> {
    const response = await api.get<ApiEnvelope<SalesOverview>>('/platform/sales', { params: period })
    return response.data.data
  }

  /** Returns the API's message, which says what changed in the company. */
  async registerUpgrade(companyId: number, payload: RegisterUpgradePayload): Promise<string> {
    const response = await api.post<ApiEnvelope<PlatformSale>>(`/platform/companies/${companyId}/sales`, payload)
    return response.data.message ?? ''
  }

  async updateSale(id: number, payload: UpdateSalePayload): Promise<PlatformSale> {
    const response = await api.put<ApiEnvelope<PlatformSale>>(`/platform/sales/${id}`, payload)
    return response.data.data
  }

  async deleteSale(id: number): Promise<string> {
    const response = await api.delete<{ message: string }>(`/platform/sales/${id}`)
    return response.data.message
  }
}

export default new PlatformService()
