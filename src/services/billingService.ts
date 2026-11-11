import api from './api'
import type { PageQuery, PaginatedResponse } from '@/types/api'
import type { ImportFormat, ImportRowError } from './productImportService'
import type { PaymentMethod } from './salesService'
import type { DocumentBusiness, DocumentResolution, PayToAccount, PrintableReceipt } from '../utils/printDocuments'

export type PersonType = 'natural' | 'legal'

export interface Customer {
  id: number
  document_type: string
  /** As stored: a NIT without its verification digit; "-A", "-B"… tell apart customers with the same document. */
  document_number: string
  /** DIAN verification digit, computed by the API for NIT and CC; never typed. */
  verification_digit?: string | null
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
  /** Entra en la facturación automática del mes */
  recurring_active?: boolean
  /** Cuota mensual (impuesto incluido) */
  monthly_fee?: number | null
  /** Día del mes en que vence la cuota (fecha de corte) */
  billing_day?: number | null
  /** Concepto propio; si falta se usa el general al facturar */
  billing_concept?: string | null
  billing_tax_id?: number | null
  /** "Fecha de ingreso" (AAAA-MM-DD): today when it was created, editable. */
  joined_at?: string | null
  /** Its segments, in reading order. */
  segments?: CustomerSegmentRef[]
  created_at: string
  updated_at: string
}

/** A tag that groups customers ("Chinchiná", "Grado 5"). */
export interface CustomerSegmentRef {
  id: number
  name: string
}

export interface CustomerSegment extends CustomerSegmentRef {
  customers_count: number
}

/** What the customer forms send: `segment_ids` leaves the customer with exactly those segments. */
export type CustomerPayload = Partial<Omit<Customer, 'segments'>> & { segment_ids?: number[] }

/** A customer as `GET /customers/lookup` answers it: whoever takes orders never reads their contact data. */
export type CustomerLookup = Pick<Customer, 'id' | 'name' | 'document_type' | 'document_number' | 'verification_digit'>

// ===== Facturación automática =====
export type RecurringInvoiceStatus = 'pending' | 'partial' | 'paid' | 'cancelled'
/**
 * 'credit_sale': an order charged "A crédito" in Pedidos, owed in Cartera (its factura is the order's sale).
 * 'opening_balance': what a customer already owed before Servify, with the old document's number; never a sale.
 */
export type DocumentKind = 'invoice' | 'collection' | 'credit_sale' | 'opening_balance'

/** Fila lista para facturar en un período: se puede editar antes de generar. */
export interface RecurringPreviewRow {
  customer_id: number
  customer_name: string
  customer_document_type: string | null
  customer_document: string | null
  customer_address: string | null
  customer_city: string | null
  customer_phone: string | null
  customer_email: string | null
  concept: string | null
  unit_price: number | null
  billing_day: number | null
  /** Día de corte del mes facturado: decide a quién le toca el día elegido. */
  cutoff_date?: string | null
  due_date: string | null
  tax_id: number | null
  tax_name: string | null
  tax_rate: number
  /** The document of the month as it was issued: the row shows this, never a recalculation. */
  billed: RecurringPreviewBilled | null
}

export interface RecurringPreviewBilled {
  id: number
  document_number: string
  status: RecurringInvoiceStatus
  total: number
  customer_name?: string
  customer_document?: string | null
  concept?: string
  due_date?: string | null
  tax_name?: string | null
}

export interface RecurringPreview {
  period: string
  /** The general concept the company last billed with (the default until then). */
  default_concept: string
  rows: RecurringPreviewRow[]
  summary: { customers: number; billed: number; pending: number; pending_total: number }
}

export interface GenerateItem {
  customer_id: number
  customer_name?: string
  customer_document?: string
  customer_address?: string
  customer_city?: string
  customer_phone?: string
  customer_email?: string
  concept?: string
  quantity?: number
  unit_price?: number | null
  discount?: number
  tax_id?: number | null
  due_date?: string | null
}

export interface GeneratePayload {
  period: string
  issue_date?: string
  concept?: string
  items: GenerateItem[]
}

export interface RecurringPayment {
  id: number
  /** Recibo de caja (RC-n) al que pertenece este abono */
  receipt_number: number | null
  amount: number
  payment_method: PaymentMethod
  paid_at: string
  notes: string | null
}

export interface RecurringInvoice {
  id: number
  customer_id: number | null
  /** The order and sale payment of a credit sale; null for a monthly document. */
  order_id: number | null
  order_payment_id: number | null
  /** The CC-n consecutive; a credit sale has none. */
  sequence: number | null
  document_kind: DocumentKind
  document_number: string
  invoice_number: string | null
  invoicing_resolution: string | null
  /** Billed month; a credit sale bills none. */
  period: string | null
  issued_at: string
  due_date: string | null
  customer_name: string
  customer_document_type: string | null
  customer_document: string | null
  customer_address: string | null
  customer_city: string | null
  customer_phone: string | null
  customer_email: string | null
  concept: string
  quantity: number
  unit_price: number
  subtotal: number
  /** What the document prints as SUBTOTAL, in whole pesos: − discount_before_tax + tax_amount = total. */
  subtotal_before_tax: number
  discount: number
  /** What the document prints as DESCUENTO: the discount before tax, since the tax is computed after it. */
  discount_before_tax: number
  tax_name: string | null
  tax_rate: number
  tax_amount: number
  total: number
  amount_paid: number
  balance: number
  status: RecurringInvoiceStatus
  seller: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  notes: string | null
  payments: RecurringPayment[]
}

export interface RecurringInvoiceList {
  invoices: RecurringInvoice[]
  summary: { count: number; billed: number; collected: number; balance: number }
}

export interface GenerateResult {
  created: RecurringInvoice[]
  skipped: { customer_id: number; customer_name: string; reason: string }[]
}

export interface ReceivableDocument {
  id: number
  issued_at: string
  document_kind: DocumentKind
  /** A credit sale prints the factura of this sale of its order. */
  order_id: number | null
  order_payment_id: number | null
  document_number: string
  /** Billed month; null for a credit sale. */
  period: string | null
  concept: string
  due_date: string | null
  overdue: boolean
  total: number
  paid: number
  balance: number
  status: RecurringInvoiceStatus
}

export interface ReceivableCustomer {
  customer_id: number | null
  customer_document: string | null
  customer_name: string
  documents: ReceivableDocument[]
  total: number
  paid: number
  balance: number
  overdue_balance: number
}

export interface Receivables {
  customers: ReceivableCustomer[]
  summary: { customers: number; total: number; paid: number; balance: number; overdue_balance: number }
}

export interface InvoiceFilters {
  period?: string
  status?: RecurringInvoiceStatus | ''
  q?: string
}

export interface ReceivableFilters {
  all?: boolean
  q?: string
  /** Only the customers carrying every one of these segments. */
  segment_ids?: number[]
}

export interface CashReceipt extends PrintableReceipt {
  number: number
  registered_at?: string | null
  customer_id?: number | null
  balance_after?: number
}

export interface PaymentHistoryFilters {
  customer_id?: number | null
  from?: string
  to?: string
}

export interface PaymentHistoryPage {
  data: CashReceipt[]
  meta: { current_page: number; per_page: number; total: number; last_page: number }
  summary: { count: number; total: number }
}

/** Datos del negocio editables (encabezado de facturas y recibos) */
export type BusinessForm = Omit<DocumentBusiness, 'complete'>

/** A monthly document as it prints. */
export interface InvoiceDocument {
  business: DocumentBusiness
  resolution: DocumentResolution | null
  invoice: RecurringInvoice
  /** The active methods allowed for recibos de caja that have a bank account. */
  pay_to?: PayToAccount[]
}

/** Una fila del Excel de clientes: se crea, se creó, se salta (ya existe) o tiene un error. */
export interface CustomerImportRow {
  fila: number
  status: 'valid' | 'created' | 'skipped' | 'error'
  name: string
  document_number: string
  monthly_fee: number | null
  message: string | null
}

export interface CustomerImportResult {
  /** true: solo se revisó, no se creó nada */
  dry_run: boolean
  summary: { rows: number; valid: number; created: number; with_fee: number; skipped: number; errors: number }
  rows: CustomerImportRow[]
  /** Encabezados que no corresponden a ninguna columna (se ignoraron) */
  ignored_columns: string[]
  /** Also in ignored_columns: fee columns of a file for a company without automatic billing. */
  ignored_fee_columns?: string[]
  /** Problemas del archivo entero (fila 0 o 1) */
  errors: ImportRowError[]
}

/** The customers import's columns: the fee ones only when the company has automatic billing (`with_fee`). */
export interface CustomerImportFormat extends ImportFormat {
  with_fee?: boolean
}

/** One pending document of an opening balance; without `due_date` it is due on `issued_at`. */
export interface OpeningBalanceLine {
  document_number: string
  issued_at: string
  due_date?: string
  total: number
  concept?: string
}

/** A row of the opening balances Excel: registered, to register, skipped (already there) or with an error. */
export interface OpeningBalanceImportRow {
  fila: number
  status: 'valid' | 'created' | 'skipped' | 'error'
  customer_name: string
  customer_document: string
  document_number: string
  issued_at: string | null
  due_date: string | null
  total: number | null
  new_customer: boolean
  message: string | null
}

export interface OpeningBalanceImportResult {
  dry_run: boolean
  summary: { rows: number; valid: number; created: number; new_customers: number; total: number; skipped: number; errors: number }
  rows: OpeningBalanceImportRow[]
  ignored_columns: string[]
  errors: ImportRowError[]
}

export interface CustomerPaymentPayload {
  amount: number
  payment_method: PaymentMethod
  paid_at?: string
  notes?: string
}

export interface Supplier {
  id: number
  name: string
  document_number?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  notes?: string | null
  /** Proveedor por defecto (nombre de la empresa), precargado en el kardex */
  is_default: boolean
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

/** The cartera's filters as the API reads them; the screen and its Excel send the same. */
const receivableParams = (filters: ReceivableFilters): Record<string, string | number | number[]> => {
  const params: Record<string, string | number | number[]> = {}
  if (filters.all) params.all = 1
  if (filters.q?.trim()) params.q = filters.q.trim()
  if (filters.segment_ids?.length) params.segment_ids = filters.segment_ids
  return params
}

const downloadFile = async (url: string, filename: string): Promise<void> => {
  const response = await api.get(url, { responseType: 'blob' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(response.data as Blob)
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

export const billingService = {
  // ===== Clientes =====
  async getCustomers(): Promise<Customer[]> {
    const response = await api.get<ApiResponse<Customer[]>>('/customers')
    return response.data.data
  },

  /**
   * Una página de clientes (búsqueda por nombre, documento, correo o teléfono en `q`);
   * `segment_ids`: solo los que tienen todos esos segmentos.
   */
  async getCustomersPage(query: PageQuery & { segment_ids?: number[] }): Promise<PaginatedResponse<Customer>> {
    const response = await api.get<PaginatedResponse<Customer>>('/customers', { params: query })
    return response.data
  },

  async getCustomer(id: number): Promise<Customer> {
    const response = await api.get<ApiResponse<Customer>>(`/customers/${id}`)
    return response.data.data
  },

  /** Customers to pick for an order or a sale, by name or document; the first 50 when `q` is empty. */
  async lookupCustomers(q = ''): Promise<CustomerLookup[]> {
    const response = await api.get<ApiResponse<CustomerLookup[]>>('/customers/lookup', { params: q ? { q } : {} })
    return response.data.data
  },

  async createCustomer(data: CustomerPayload): Promise<Customer> {
    const response = await api.post<ApiResponse<Customer>>('/customers', data)
    return response.data.data
  },

  async updateCustomer(id: number, data: CustomerPayload): Promise<Customer> {
    const response = await api.put<ApiResponse<Customer>>(`/customers/${id}`, data)
    return response.data.data
  },

  async deleteCustomer(id: number): Promise<void> {
    await api.delete(`/customers/${id}`)
  },

  // --- Segmentos: etiquetas para agrupar y filtrar clientes ---
  async getSegments(): Promise<CustomerSegment[]> {
    const response = await api.get<ApiResponse<CustomerSegment[]>>('/customer-segments')
    return response.data.data
  },

  async createSegment(name: string): Promise<{ data: CustomerSegment; message: string }> {
    const response = await api.post<ApiResponse<CustomerSegment>>('/customer-segments', { name })
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async renameSegment(id: number, name: string): Promise<{ data: CustomerSegment; message: string }> {
    const response = await api.put<ApiResponse<CustomerSegment>>(`/customer-segments/${id}`, { name })
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  /** Only the tag goes: its customers stay. */
  async deleteSegment(id: number): Promise<string> {
    const response = await api.delete<{ message?: string }>(`/customer-segments/${id}`)
    return response.data.message ?? ''
  },

  async addCustomersToSegment(id: number, customerIds: number[]): Promise<{ data: CustomerSegment; message: string }> {
    const response = await api.post<ApiResponse<CustomerSegment>>(`/customer-segments/${id}/customers`, { customer_ids: customerIds })
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async removeCustomersFromSegment(id: number, customerIds: number[]): Promise<{ data: CustomerSegment; message: string }> {
    const response = await api.delete<ApiResponse<CustomerSegment>>(`/customer-segments/${id}/customers`, {
      data: { customer_ids: customerIds },
    })
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  // --- Importar clientes (y su cuota) desde Excel ---
  /** Las columnas y las notas del tutorial, tal como las lee el backend. */
  async getCustomerImportFormat(): Promise<CustomerImportFormat> {
    const response = await api.get<ApiResponse<CustomerImportFormat>>('/recurring-billing/customers/import/columns')
    return response.data.data
  },

  async downloadCustomerImportTemplate(): Promise<void> {
    await downloadFile('/recurring-billing/customers/import/template', 'plantilla_clientes.xlsx')
  },

  /** `dryRun`: solo revisa y dice qué pasará con cada fila, sin crear nada. */
  async importCustomers(file: File, dryRun: boolean): Promise<{ data: CustomerImportResult; message: string }> {
    const form = new FormData()
    form.append('file', file)
    form.append('dry_run', dryRun ? '1' : '0')
    const response = await api.post<ApiResponse<CustomerImportResult>>('/recurring-billing/customers/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return { data: response.data.data, message: response.data.message ?? '' }
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

  // ===== Proveedores =====
  // El primero de la lista es el proveedor por defecto (nombre de la empresa),
  // que el backend autocrea y precarga en el kardex.
  async getSuppliers(): Promise<Supplier[]> {
    const response = await api.get<ApiResponse<Supplier[]>>('/suppliers')
    return response.data.data
  },

  async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
    const response = await api.post<ApiResponse<Supplier>>('/suppliers', data)
    return response.data.data
  },

  async updateSupplier(id: number, data: Partial<Supplier>): Promise<Supplier> {
    const response = await api.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data)
    return response.data.data
  },

  async deleteSupplier(id: number): Promise<void> {
    await api.delete(`/suppliers/${id}`)
  },

  // ===== Facturación automática =====
  /**
   * Con la fecha de emisión, el vencimiento de cada fila nunca queda antes de ella.
   * `segmentIds`: solo los clientes que tienen todos esos segmentos.
   */
  async getRecurringPreview(period: string, issueDate?: string, segmentIds: number[] = []): Promise<RecurringPreview> {
    const response = await api.get<ApiResponse<RecurringPreview>>('/recurring-billing/preview', {
      params: { period, issue_date: issueDate || undefined, segment_ids: segmentIds.length ? segmentIds : undefined },
    })
    return response.data.data
  },

  async generateRecurringInvoices(payload: GeneratePayload): Promise<{ data: GenerateResult; message: string }> {
    const response = await api.post<ApiResponse<GenerateResult>>('/recurring-billing/invoices/generate', payload)
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async getRecurringInvoices(filters: InvoiceFilters = {}): Promise<RecurringInvoiceList> {
    const params: Record<string, string> = {}
    if (filters.period) params.period = filters.period
    if (filters.status) params.status = filters.status
    if (filters.q?.trim()) params.q = filters.q.trim()
    const response = await api.get<ApiResponse<RecurringInvoiceList>>('/recurring-billing/invoices', { params })
    return response.data.data
  },

  async getRecurringInvoice(invoiceId: number): Promise<RecurringInvoice> {
    const response = await api.get<ApiResponse<RecurringInvoice>>(`/recurring-billing/invoices/${invoiceId}`)
    return response.data.data
  },

  async addRecurringPayment(
    invoiceId: number,
    data: { amount: number; payment_method: PaymentMethod; paid_at?: string; notes?: string },
  ): Promise<{ data: RecurringInvoice & { receipt_number: number }; message: string }> {
    const response = await api.post<ApiResponse<RecurringInvoice & { receipt_number: number }>>(`/recurring-billing/invoices/${invoiceId}/payments`, data)
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  /** Abono al cliente: paga sus documentos del más viejo al más nuevo, en un recibo. */
  async payCustomer(customerId: number, data: CustomerPaymentPayload): Promise<{ data: CashReceipt; message: string }> {
    const response = await api.post<ApiResponse<CashReceipt>>(`/recurring-billing/customers/${customerId}/payments`, data)
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async getReceipt(receiptNumber: number): Promise<{ business: DocumentBusiness; receipt: CashReceipt }> {
    const response = await api.get<ApiResponse<{ business: DocumentBusiness; receipt: CashReceipt }>>(`/recurring-billing/receipts/${receiptNumber}`)
    return response.data.data
  },

  /** `pay_to`: where the customer can pay (the "PUEDES PAGAR EN" box); empty without bank accounts. */
  async getInvoiceDocument(invoiceId: number): Promise<InvoiceDocument> {
    const response = await api.get<ApiResponse<InvoiceDocument>>(`/recurring-billing/invoices/${invoiceId}/document`)
    return response.data.data
  },

  async getBusiness(): Promise<DocumentBusiness> {
    const response = await api.get<ApiResponse<DocumentBusiness>>('/invoicing/business')
    return response.data.data
  },

  async updateBusiness(data: BusinessForm): Promise<DocumentBusiness> {
    const response = await api.put<ApiResponse<DocumentBusiness>>('/invoicing/business', data)
    return response.data.data
  },

  async deleteRecurringPayment(paymentId: number): Promise<RecurringInvoice> {
    const response = await api.delete<ApiResponse<RecurringInvoice>>(`/recurring-billing/payments/${paymentId}`)
    return response.data.data
  },

  async cancelRecurringInvoice(invoiceId: number, reason?: string): Promise<RecurringInvoice> {
    const response = await api.post<ApiResponse<RecurringInvoice>>(`/recurring-billing/invoices/${invoiceId}/cancel`, { reason })
    return response.data.data
  },

  // --- Saldos iniciales: lo que los clientes ya debían antes de Servify ---
  async registerOpeningBalances(
    customerId: number,
    lines: OpeningBalanceLine[],
  ): Promise<{ data: RecurringInvoice[]; message: string }> {
    const response = await api.post<ApiResponse<RecurringInvoice[]>>('/recurring-billing/opening-balances', {
      customer_id: customerId,
      lines,
    })
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async getOpeningBalanceImportFormat(): Promise<ImportFormat> {
    const response = await api.get<ApiResponse<ImportFormat>>('/recurring-billing/opening-balances/import/columns')
    return response.data.data
  },

  async downloadOpeningBalanceImportTemplate(): Promise<void> {
    await downloadFile('/recurring-billing/opening-balances/import/template', 'plantilla_saldos_iniciales.xlsx')
  },

  /** `dryRun`: only reviews and says what will happen to each row. */
  async importOpeningBalances(file: File, dryRun: boolean): Promise<{ data: OpeningBalanceImportResult; message: string }> {
    const form = new FormData()
    form.append('file', file)
    form.append('dry_run', dryRun ? '1' : '0')
    const response = await api.post<ApiResponse<OpeningBalanceImportResult>>('/recurring-billing/opening-balances/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async getReceivables(filters: ReceivableFilters = {}): Promise<Receivables> {
    const response = await api.get<ApiResponse<Receivables>>('/recurring-billing/receivables', { params: receivableParams(filters) })
    return response.data.data
  },

  /** Histórico de abonos (recibos de caja), paginado en el servidor. */
  async getPaymentHistory(
    filters: PaymentHistoryFilters,
    query: PageQuery,
  ): Promise<PaymentHistoryPage> {
    const params: Record<string, string | number> = {
      page: query.page,
      per_page: query.per_page,
    }
    if (filters.customer_id) params.customer_id = filters.customer_id
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    const response = await api.get<PaymentHistoryPage & { message?: string }>('/recurring-billing/payments', { params })
    return {
      data: response.data.data,
      meta: response.data.meta,
      summary: response.data.summary,
    }
  },

  /** Todos los abonos que coinciden con los filtros (para el PDF). */
  async listPaymentHistory(filters: PaymentHistoryFilters = {}): Promise<{ data: CashReceipt[]; summary: { count: number; total: number } }> {
    const params: Record<string, string | number> = {}
    if (filters.customer_id) params.customer_id = filters.customer_id
    if (filters.from) params.from = filters.from
    if (filters.to) params.to = filters.to
    const response = await api.get<ApiResponse<CashReceipt[]> & { summary: { count: number; total: number } }>(
      '/recurring-billing/payments',
      { params },
    )
    return { data: response.data.data, summary: response.data.summary }
  },

  /** Descarga la cartera en Excel con los mismos filtros de la pantalla. */
  async exportReceivables(filters: ReceivableFilters = {}): Promise<void> {
    const params = { ...receivableParams(filters), format: 'xlsx' }
    const response = await api.get('/recurring-billing/receivables', { params, responseType: 'blob' })

    const disposition: string = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || 'cartera.xlsx'

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
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
