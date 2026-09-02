import api from './api'

export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'transfer' | 'other'

export interface Sale {
  id: number
  invoice_number: string | null
  invoicing_resolution: string | null
  paid_at: string | null
  dining_table: string | null
  customer_name: string | null
  waiter: string | null
  user_id: number | null
  payment_methods: PaymentMethod[]
  subtotal: number
  tip: number
  total: number
}

export interface SalesSummary {
  sales_count: number
  total: number
  tips: number
  by_payment_method: Partial<Record<PaymentMethod, number>>
}

export interface SalesFilters {
  from?: string
  to?: string
  payment_method?: PaymentMethod | ''
  user_id?: number | null
  q?: string
}

export interface SalesReport {
  sales: Sale[]
  summary: SalesSummary
  truncated: boolean
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  credit_card: 'T. crédito',
  debit_card: 'T. débito',
  transfer: 'Transferencia',
  other: 'Otro',
}

const cleanFilters = (filters: SalesFilters): Record<string, string | number> => {
  const params: Record<string, string | number> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.payment_method) params.payment_method = filters.payment_method
  if (filters.user_id) params.user_id = filters.user_id
  if (filters.q?.trim()) params.q = filters.q.trim()
  return params
}

class SalesService {
  async report(filters: SalesFilters): Promise<SalesReport> {
    const response = await api.get('/sales', { params: cleanFilters(filters) })
    return response.data.data
  }

  /** Descarga el Excel con los mismos filtros de la pantalla. */
  async export(filters: SalesFilters): Promise<void> {
    const response = await api.get('/sales/export', {
      params: cleanFilters(filters),
      responseType: 'blob',
    })

    const disposition: string = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'ventas.xlsx'

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
}

export default new SalesService()
