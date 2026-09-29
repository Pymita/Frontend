import api from './api'
import type { PaymentMethod } from './salesService'
import type { DocumentBusiness, DocumentResolution, PrintableReceipt } from '../utils/printDocuments'

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
  /** Entra en la facturación automática del mes */
  recurring_active?: boolean
  /** Cuota mensual (impuesto incluido) */
  monthly_fee?: number | null
  /** Día del mes en que vence la cuota (fecha de corte) */
  billing_day?: number | null
  /** Concepto propio; si falta se usa el general al facturar */
  billing_concept?: string | null
  billing_tax_id?: number | null
  created_at: string
  updated_at: string
}

// ===== Facturación automática =====
export type RecurringInvoiceStatus = 'pending' | 'partial' | 'paid' | 'cancelled'
export type DocumentKind = 'invoice' | 'collection'

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
  due_date: string | null
  tax_id: number | null
  tax_name: string | null
  tax_rate: number
  billed: { id: number; document_number: string; status: RecurringInvoiceStatus; total: number } | null
}

export interface RecurringPreview {
  period: string
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
  sequence: number
  document_kind: DocumentKind
  document_number: string
  invoice_number: string | null
  invoicing_resolution: string | null
  period: string
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
  discount: number
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
  document_number: string
  period: string
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
}

export interface CashReceipt extends PrintableReceipt {
  number: number
}

/** Datos del negocio editables (encabezado de facturas y recibos) */
export type BusinessForm = Omit<DocumentBusiness, 'complete'>

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
  async getRecurringPreview(period: string): Promise<RecurringPreview> {
    const response = await api.get<ApiResponse<RecurringPreview>>('/recurring-billing/preview', { params: { period } })
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

  async getInvoiceDocument(invoiceId: number): Promise<{ business: DocumentBusiness; resolution: DocumentResolution | null; invoice: RecurringInvoice }> {
    const response = await api.get<ApiResponse<{ business: DocumentBusiness; resolution: DocumentResolution | null; invoice: RecurringInvoice }>>(
      `/recurring-billing/invoices/${invoiceId}/document`,
    )
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

  async getReceivables(filters: ReceivableFilters = {}): Promise<Receivables> {
    const params: Record<string, string | number> = {}
    if (filters.all) params.all = 1
    if (filters.q?.trim()) params.q = filters.q.trim()
    const response = await api.get<ApiResponse<Receivables>>('/recurring-billing/receivables', { params })
    return response.data.data
  },

  /** Descarga la cartera en Excel con los mismos filtros de la pantalla. */
  async exportReceivables(filters: ReceivableFilters = {}): Promise<void> {
    const params: Record<string, string | number> = { format: 'xlsx' }
    if (filters.all) params.all = 1
    if (filters.q?.trim()) params.q = filters.q.trim()
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
