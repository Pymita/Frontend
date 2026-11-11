import api from './api'

import { orderPaymentMethodLabels, saleMethodLabels } from '../utils/labels'

/**
 * The key of one of the company's payment methods. The seven built-ins keep
 * their legacy keys (`cash`, `transfer`…); a method the company creates gets
 * a slug of its name (`bancolombia`), and payments store the key.
 */
export type PaymentMethod = string

/** How a sale was charged: a way money comes in, or on credit (`credit`: it goes to Cartera). */
export type SaleMethod = PaymentMethod

/** Where a method can be used (`documents`); Gastos is not one: it offers every active method. */
export type PaymentDocument = 'sale' | 'receipt' | 'order_abono' | 'financial_movement'

/** A payment method of the company, as `GET /payment-methods` lists it. */
export interface PaymentMethodRow {
  id: number
  key: PaymentMethod
  name: string
  /** Goes into the cash drawer like Efectivo: the close adds it to the cash to deliver. */
  is_cash: boolean
  /** The cuenta contable (PUC) the accounting movement posts it to; also edited in Configurar contabilidad. */
  account: string | null
  /** "Bancolombia ahorros 123-456": where the customer pays. */
  bank_account: string | null
  /** The bank account prints as an observation on the documents (never without a number). */
  show_bank_account: boolean
  documents: PaymentDocument[]
  active: boolean
  position: number
  /** Only with `all=1`: some record uses it, so it can be deactivated but not deleted. */
  in_use?: boolean
}

export interface PaymentMethodPayload {
  name: string
  is_cash: boolean
  account: string | null
  bank_account: string | null
  show_bank_account: boolean
  documents: PaymentDocument[]
  active: boolean
  position?: number
}

/**
 * A method of a printed document (`payment_methods_detail`): its current name, and its bank
 * account only when the method shows it, which the document prints as an observation.
 */
export interface PaymentMethodDetail {
  key: PaymentMethod
  name: string
  bank_account: string | null
}

/** What one method paid of a sale or brought to a document ("Efectivo $50.000 + Nequi $30.000"). */
export interface PaymentLine {
  payment_method: PaymentMethod
  amount: number
}

/** An order charged at the POS, or an automatic-billing document issued. */
export type SaleOrigin = 'order' | 'recurring'

export interface Sale {
  /** Id interno del pedido, null para un documento: nunca se muestra. */
  id: number | null
  /** Número del pedido en la empresa (la venta de un pedido siempre lo tiene; un documento no). */
  number: number | null
  /** #<número del pedido>-<n>: la venta dentro de su pedido; el número DIAN o CC-n de un documento. */
  reference: string | null
  origin: SaleOrigin
  /** Documents only. */
  recurring_invoice_id?: number
  document_kind?: 'invoice' | 'collection'
  document_status?: 'pending' | 'partial' | 'paid'
  /** The DIAN number, or CC-n for a cuenta de cobro. */
  invoice_number: string | null
  invoicing_resolution: string | null
  /** When the sale counts: the charge of an order, the issue of a document. */
  paid_at: string | null
  dining_table: string | null
  customer_name: string | null
  waiter: string | null
  user_id: number | null
  payment_methods: SaleMethod[]
  /** What each method paid of the sale, without tip, its own method first: two or more when it was paid with several. */
  payment_lines?: PaymentLine[]
  subtotal: number
  tip: number
  total: number
  /** The sale payment of the order this row is (its letter factura prints from it). */
  payment_id?: number | null
}

export interface SalesSummary {
  sales_count: number
  total: number
  tips: number
  /** POS sales only: documents have no payment method. */
  by_payment_method: Partial<Record<SaleMethod, number>>
  by_origin: Record<SaleOrigin, { count: number; total: number }>
}

export interface SalesFilters {
  from?: string
  to?: string
  payment_method?: SaleMethod | ''
  user_id?: number | null
  q?: string
  origin?: SaleOrigin | ''
}

export interface SalesReport {
  sales: Sale[]
  summary: SalesSummary
  truncated: boolean
}

/**
 * Qué se vendió, producto por producto (neto = después de descuentos
 * generales). Each concept of the documents is a row too, in the category
 * "Servicios", with no cost.
 */
export interface ProductSalesRow {
  name: string
  origin: SaleOrigin
  category: string | null
  quantity: number
  gross: number
  net: number
  /** What its sales took from the kardex, line by line */
  cost: number
  /** Part of the cost is today's estimate: sales whose exits do not name their line, or products without inventory */
  cost_estimated: boolean
  profit: number
  /** Profit over net, %; null for a service (no cost to weigh) */
  margin: number | null
  /** Orders, or documents for a concept. */
  orders_count: number
  /** % of what the view sold (products, services or both). */
  share: number
}

export interface ProductSalesReport {
  products: ProductSalesRow[]
  summary: { quantity: number; net: number; cost: number; profit: number; cost_estimated: boolean }
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

export type SalesView = 'sales' | 'products' | 'tables' | 'cash'

/** The legacy names, for a key the company no longer has: `paymentMethodLabel()` reads the company's first. */
export const PAYMENT_METHOD_LABELS = orderPaymentMethodLabels as Record<PaymentMethod, string>
export const SALE_METHOD_LABELS = saleMethodLabels as Record<SaleMethod, string>

const cleanFilters = (filters: SalesFilters): Record<string, string | number> => {
  const params: Record<string, string | number> = {}
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.payment_method) params.payment_method = filters.payment_method
  if (filters.user_id) params.user_id = filters.user_id
  if (filters.q?.trim()) params.q = filters.q.trim()
  if (filters.origin) params.origin = filters.origin
  return params
}

const EXPORT_PATHS: Record<SalesView, { path: string; params?: Record<string, string>; fallback: string }> = {
  sales: { path: '/sales/export', fallback: 'ventas.xlsx' },
  products: { path: '/sales/by-product', params: { format: 'xlsx' }, fallback: 'ventas_por_producto.xlsx' },
  tables: { path: '/sales/by-table', params: { format: 'xlsx' }, fallback: 'ventas_por_mesa.xlsx' },
  cash: { path: '/cash-register/sessions', params: { format: 'xlsx' }, fallback: 'cierres-de-caja.xlsx' },
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

/** Cash taken out of the drawer ("Retiro de caja No. N"); `at` and `user_name` are the server's. */
export interface CashWithdrawal {
  number: number
  amount: number
  at: string
  user_name: string
  notes: string | null
}

/**
 * A cash shift. Shifts open by themselves; `opening_amount` is the base of
 * the shifts opened by hand before 2026-10 (0 since). Closes frozen back then
 * have no detailed summary: those keys come as null. `expected_cash` is what
 * must be in the drawer: the cash that came in minus expenses and withdrawals.
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
    /** The name of each method as the close froze it (the open shift: as it reads now). */
    method_labels?: Record<PaymentMethod, string>
    /** The methods that go into the drawer (`is_cash`): what `cash_sales`, `cash_recurring` and `cash_expenses` add. */
    cash_methods?: PaymentMethod[]
    cash_sales: number
    cash_recurring: number
    cash_expenses: number
    /** Closes frozen before withdrawals existed read as none. */
    cash_withdrawals: { count: number; total: number; list: CashWithdrawal[] }
    expected_cash: number
    total_collected: number
    sales_total: number | null
    sales_count: number | null
    /** Part of the sales charged on credit: owed in Cartera, never in the drawer. Null on older closes. */
    credit_sales: { count: number; total: number } | null
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

/**
 * What the closes of a period add up to: the figures each one froze, summed.
 * A sales figure is null only when no close has it (all frozen before
 * 2026-10); the count and the difference sum the `counted_closes` only.
 */
export interface CashPeriodTotals {
  closes: number
  sales_total: number | null
  sales_count: number | null
  /** Sales on credit of the period's closes (in sales_total, never received); null when no close has the figure. */
  credit_sales: number | null
  tips_total: number | null
  order_abonos: number | null
  by_method: Record<string, { count: number; amount: number; tips: number }>
  recurring_by_method: Partial<Record<PaymentMethod, number>>
  /** Each method named as the newest close of the period froze it. */
  method_labels?: Record<PaymentMethod, string>
  cash_methods?: PaymentMethod[]
  cash_sales: number
  cash_recurring: number
  cash_expenses: number
  cash_withdrawals: number
  opening_amount: number
  expected_cash: number
  counted_closes: number
  counted_cash: number | null
  difference: number | null
  total_collected: number
}

export interface CloseCashPayload {
  counted_cash?: number | null
  notes?: string
  /** "YYYY-MM-DD HH:MM", Bogotá wall clock. Admin only. */
  closed_at?: string
}

class SalesService {
  /**
   * The company's payment methods in their order: the active ones allowed
   * for `document`, every active one without it, and with `all` (admin)
   * the inactive ones too, with `in_use`.
   */
  async paymentMethods(
    params: { document?: PaymentDocument; all?: boolean } = {},
  ): Promise<{ methods: PaymentMethodRow[]; labels: Record<PaymentMethod, string> }> {
    const response = await api.get('/payment-methods', {
      params: { ...(params.document ? { document: params.document } : {}), ...(params.all ? { all: 1 } : {}) },
    })
    return { methods: response.data.data, labels: response.data.labels ?? {} }
  }

  async createPaymentMethod(payload: PaymentMethodPayload): Promise<{ method: PaymentMethodRow; message: string }> {
    const response = await api.post('/payment-methods', payload)
    return { method: response.data.data, message: response.data.message }
  }

  /** Only what is sent changes (a reorder sends `position` alone). */
  async updatePaymentMethod(id: number, payload: Partial<PaymentMethodPayload>): Promise<{ method: PaymentMethodRow; message: string }> {
    const response = await api.put(`/payment-methods/${id}`, payload)
    return { method: response.data.data, message: response.data.message }
  }

  /** A method some record uses answers 422 with what to do instead (deactivate it). */
  async deletePaymentMethod(id: number): Promise<string> {
    const response = await api.delete(`/payment-methods/${id}`)
    return response.data.message
  }

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

  /**
   * Takes cash out of the open shift. `key` (Idempotency-Key) stays the same
   * for a retry of the same withdrawal, so it is never registered twice.
   */
  async withdrawCash(
    id: number,
    payload: { amount: number; notes?: string },
    key: string,
  ): Promise<{ withdrawal: CashWithdrawal; session: CashSession; message: string }> {
    const response = await api.post(
      `/cash-register/${id}/withdrawals`,
      { amount: payload.amount, notes: payload.notes || undefined },
      { headers: { 'Idempotency-Key': key } },
    )
    return { withdrawal: response.data.data, session: response.data.session, message: response.data.message }
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

  /**
   * Newest first. `closed`: only the closes, every one of the period instead
   * of the screen's 200, the same ones the Excel lists.
   */
  async cashSessions(
    filters: { from?: string; to?: string; closed?: boolean } = {},
  ): Promise<{ sessions: CashSession[]; totals: CashPeriodTotals }> {
    const { closed, ...dates } = filters
    const response = await api.get('/cash-register/sessions', { params: { ...dates, ...(closed ? { closed: 1 } : {}) } })
    return { sessions: response.data.data, totals: response.data.totals }
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
