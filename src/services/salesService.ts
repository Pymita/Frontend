import api from './api'

import { orderPaymentMethodLabels } from '../utils/labels'

export type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'transfer' | 'nequi' | 'daviplata' | 'other'

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

export const PAYMENT_METHOD_LABELS = orderPaymentMethodLabels as Record<PaymentMethod, string>

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

export interface CashShiftTotals {
  sales_total: number | null
  total_collected: number | null
  expected_cash: number | null
}

/** An admin moved one of the shift's cuts; `user_name` is a snapshot. */
export interface CashAdjustment {
  at: string
  user_id: number | null
  user_name: string
  field: 'opened_at' | 'closed_at'
  from: string
  to: string
  reason: string
  before: CashShiftTotals
  after: CashShiftTotals
}

/**
 * A cash shift. Shifts open by themselves; `opening_amount` is the base of
 * the shifts opened by hand before 2026-10 (0 since). Closes frozen back then
 * have no detailed summary: those keys come as null.
 */
export interface CashSession {
  id: number
  number: number
  opened_at: string
  opened_by: string | null
  opening_amount: number
  opening_notes: string | null
  closed_at: string | null
  closed_by: string | null
  closing_notes: string | null
  expected_cash: number
  counted_cash: number | null
  difference: number | null
  has_previous_day_movements: boolean
  adjustments: CashAdjustment[]
  summary: {
    by_method: Record<PaymentMethod, { count: number; amount: number; tips: number }>
    recurring_by_method: Partial<Record<PaymentMethod, number>>
    cash_sales: number
    cash_recurring: number
    cash_expenses: number
    expected_cash: number
    total_collected: number
    sales_total: number | null
    sales_count: number | null
    orders_count: number | null
    tips_total: number | null
    order_abonos: number | null
    products: { name: string; quantity: number }[] | null
    products_others: { count: number; quantity: number } | null
    first_invoice: string | null
    last_invoice: string | null
    first_movement_at: string | null
    last_movement_at: string | null
  }
}

export interface CloseCashPayload {
  counted_cash?: number | null
  notes?: string
  /** "YYYY-MM-DD HH:MM", Bogotá wall clock. Admin only. */
  closed_at?: string
}

class SalesService {
  async currentCashSession(): Promise<CashSession> {
    const response = await api.get('/cash-register/current')
    return response.data.data
  }

  async closeCashSession(id: number, payload: CloseCashPayload): Promise<{ session: CashSession; next: CashSession; message: string }> {
    const response = await api.post(`/cash-register/${id}/close`, {
      counted_cash: payload.counted_cash ?? null,
      notes: payload.notes || undefined,
      closed_at: payload.closed_at || undefined,
    })
    return { session: response.data.data, next: response.data.next, message: response.data.message }
  }

  /** Admin only. `previous` is set only when the previous shift's close moved too. */
  async updateCashSessionOpening(
    id: number,
    openedAt: string,
    reason: string,
  ): Promise<{ session: CashSession; previous: CashSession | null; message: string }> {
    const response = await api.put(`/cash-register/${id}`, { opened_at: openedAt, reason })
    return { session: response.data.data, previous: response.data.previous, message: response.data.message }
  }

  async cashSessions(filters: { from?: string; to?: string } = {}): Promise<CashSession[]> {
    const response = await api.get('/cash-register/sessions', { params: filters })
    return response.data.data
  }

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
