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

/** Qué se vendió, producto por producto (neto = después de descuentos generales). */
export interface ProductSalesRow {
  name: string
  category: string | null
  quantity: number
  gross: number
  net: number
  cost: number
  profit: number
  orders_count: number
}

export interface ProductSalesReport {
  products: ProductSalesRow[]
  summary: { quantity: number; net: number; profit: number }
}

/** Qué dejó cada mesa: productos, tiempo de billar, propinas y total. */
export interface TableSalesRow {
  dining_table_id: number | null
  name: string
  table_type: 'dining' | 'billiard' | null
  sales_count: number
  products_total: number
  time_minutes: number
  time_total: number
  tips: number
  total: number
}

export interface TableSalesReport {
  tables: TableSalesRow[]
  summary: { sales_count: number; time_total: number; total: number }
}

export type SalesView = 'sales' | 'products' | 'tables'

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

const EXPORT_PATHS: Record<SalesView, { path: string; params?: Record<string, string>; fallback: string }> = {
  sales: { path: '/sales/export', fallback: 'ventas.xlsx' },
  products: { path: '/sales/by-product', params: { format: 'xlsx' }, fallback: 'ventas_por_producto.xlsx' },
  tables: { path: '/sales/by-table', params: { format: 'xlsx' }, fallback: 'ventas_por_mesa.xlsx' },
}

class SalesService {
  async report(filters: SalesFilters): Promise<SalesReport> {
    const response = await api.get('/sales', { params: cleanFilters(filters) })
    return response.data.data
  }

  async byProduct(filters: SalesFilters): Promise<ProductSalesReport> {
    const response = await api.get('/sales/by-product', { params: cleanFilters(filters) })
    return response.data.data
  }

  async byTable(filters: SalesFilters): Promise<TableSalesReport> {
    const response = await api.get('/sales/by-table', { params: cleanFilters(filters) })
    return response.data.data
  }

  /** Descarga el Excel de la vista actual con los mismos filtros de la pantalla. */
  async export(filters: SalesFilters, view: SalesView = 'sales'): Promise<void> {
    const target = EXPORT_PATHS[view]
    const response = await api.get(target.path, {
      params: { ...cleanFilters(filters), ...(target.params ?? {}) },
      responseType: 'blob',
    })

    const disposition: string = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || target.fallback

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
}

export default new SalesService()
