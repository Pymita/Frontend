import api from './api'

export interface DocumentType {
  id: number
  code: string
  name: string
  direction: 'in' | 'out' | 'both'
  active: boolean
}

export interface Tax {
  id: number
  name: string
  rate: number
  active: boolean
}

export interface KardexMovement {
  id: number
  moved_at: string
  document_code: string
  document_name: string
  reference: string | null
  product: { id: number; name: string; unit: string }
  movement_type: 'in' | 'out'
  quantity: number
  unit_cost: number
  total_cost: number
  balance_quantity: number
  balance_unit_cost: number
  balance_total_cost: number
  user: string | null
  notes: string | null
}

export interface KardexFilters {
  product_id?: number
  document_type_id?: number
  movement_type?: 'in' | 'out'
  from?: string
  to?: string
}

export interface KardexReport {
  product: {
    id: number
    name: string
    sku: string
    unit: string
    current_stock: number
    unit_cost: number
  } | null
  opening_balance: { quantity: number; unit_cost: number; total_cost: number } | null
  movements: KardexMovement[]
  totals: { in_quantity: number; in_cost: number; out_quantity: number; out_cost: number }
  truncated: boolean
}

export interface BalanceReport {
  as_of: string
  assets: { cash: number; accounts_receivable: number; inventory: number; total: number }
  liabilities: { accounts_payable: number; total: number }
  equity: number
}

export interface IncomeStatement {
  from: string
  to: string
  sales: number
  cost_of_sales: number
  gross_profit: number
  gross_margin: number
  operating_expenses: number
  expenses_by_category: { category: string; total: number }[]
  net_profit: number
  net_margin: number
}

interface ApiEnvelope<T> {
  data: T
  message?: string
}

const cleanFilters = (filters: KardexFilters) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== ''))

class KardexService {
  async report(filters: KardexFilters): Promise<KardexReport> {
    const response = await api.get<ApiEnvelope<KardexReport>>('/kardex', { params: cleanFilters(filters) })
    return response.data.data
  }

  /** Descarga el kardex filtrado como archivo Excel (.xlsx) */
  async export(filters: KardexFilters): Promise<void> {
    const response = await api.get('/kardex/export', {
      params: cleanFilters(filters),
      responseType: 'blob',
    })

    const disposition: string = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'kardex.xlsx'

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async documentTypes(): Promise<DocumentType[]> {
    const response = await api.get<ApiEnvelope<DocumentType[]>>('/document-types')
    return response.data.data
  }

  async createDocumentType(payload: Pick<DocumentType, 'code' | 'name' | 'direction'>): Promise<DocumentType> {
    const response = await api.post<ApiEnvelope<DocumentType>>('/document-types', payload)
    return response.data.data
  }

  async updateDocumentType(id: number, payload: Partial<Pick<DocumentType, 'name' | 'direction' | 'active'>>): Promise<DocumentType> {
    const response = await api.put<ApiEnvelope<DocumentType>>(`/document-types/${id}`, payload)
    return response.data.data
  }

  async deleteDocumentType(id: number): Promise<void> {
    await api.delete(`/document-types/${id}`)
  }

  async taxes(): Promise<Tax[]> {
    const response = await api.get<ApiEnvelope<Tax[]>>('/taxes')
    return response.data.data
  }

  async createTax(payload: Pick<Tax, 'name' | 'rate'>): Promise<Tax> {
    const response = await api.post<ApiEnvelope<Tax>>('/taxes', payload)
    return response.data.data
  }

  async updateTax(id: number, payload: Partial<Pick<Tax, 'name' | 'rate' | 'active'>>): Promise<Tax> {
    const response = await api.put<ApiEnvelope<Tax>>(`/taxes/${id}`, payload)
    return response.data.data
  }

  async deleteTax(id: number): Promise<void> {
    await api.delete(`/taxes/${id}`)
  }

  async balance(): Promise<BalanceReport> {
    const response = await api.get<ApiEnvelope<BalanceReport>>('/reports/balance')
    return response.data.data
  }

  async incomeStatement(from: string, to: string): Promise<IncomeStatement> {
    const response = await api.get<ApiEnvelope<IncomeStatement>>('/reports/income-statement', {
      params: { from, to },
    })
    return response.data.data
  }
}

export default new KardexService()
