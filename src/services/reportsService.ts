import api from './api'
import type { PageMeta, PageQuery, PaginatedResponse } from '@/types/api'

/** How a cell reads: week is its Monday (AAAA-MM-DD), month AAAA-MM, hour 0–23. */
export type ReportColumnType = 'text' | 'enum' | 'integer' | 'quantity' | 'money' | 'percent' | 'date' | 'week' | 'month' | 'hour'

export interface ReportColumn {
  key: string
  label: string
  type: ReportColumnType
  /** Something to group by; the dimensions of the chosen grouping always come back. */
  dimension?: boolean
  /** Shown before the user picks the columns. */
  default?: boolean
  total?: 'sum' | 'ratio' | 'fixed_100' | null
  /** Name of the label map in `enumLabels` (labels.ts). */
  enum?: string
  /** Describes one of these groupings (the SKU, a product): it has a value only while one of them is grouped. */
  attribute_of?: string[]
  /** Key of the dimension's id in each row (seller_id). */
  id_key?: string
}

export interface ReportOption {
  value: string | number
  title: string
}

export interface ReportFilter {
  key: string
  label: string
  type: 'select' | 'multiselect' | 'text' | 'boolean' | 'date'
  options?: ReportOption[]
  enum?: string
  default?: string | number | boolean | (string | number)[] | null
}

export type ReportPeriodType = 'range' | 'cut' | 'none'

export interface ReportDefinition {
  key: string
  area: string
  title: string
  /** What the report answers, in the owner's words. */
  question: string
  /** `default`: today, or month (from the 1st to today). */
  period: { type: ReportPeriodType; max_days?: number; default?: 'today' | 'month' }
  group_by: { default: string[]; max: number }
  columns: ReportColumn[]
  filters: ReportFilter[]
  default_sort?: { by: string; dir: 'asc' | 'desc' }
  notes: string[]
}

export interface ReportArea {
  key: string
  title: string
}

/** Only what this user and company may use. */
export interface ReportCatalog {
  reports: ReportDefinition[]
  areas: ReportArea[]
}

export type ReportFilterValue = string | number | boolean | (string | number)[] | null | undefined

export interface ReportRequest {
  report: string
  from?: string
  to?: string
  cut?: string
  group_by: string[]
  columns: string[]
  filters: Record<string, ReportFilterValue>
}

export type ReportRow = Record<string, string | number | boolean | null>

export interface ReportPage extends PaginatedResponse<ReportRow> {
  meta: PageMeta
  report: {
    key: string
    columns: Pick<ReportColumn, 'key' | 'label' | 'type'>[]
    group_by: string[]
    period: { from: string; to: string } | { cut: string } | null
    applied_filters: { label: string; value: string }[]
    notes: string[]
  }
  /** Over every row of the filter, not just the page. */
  totals: ReportRow
}

// --- Contabilidad (/accounting/*): accounts, voucher codes, export templates and the accounting movement ---

/** The side a role posts on in the normal entry; null when it depends on the movement (an adjustment's inventory). */
export type AccountingNature = 'debit' | 'credit'

export interface AccountingPaymentMethod {
  method: string
  label: string
  account: string | null
}

export interface AccountingTax {
  id: number
  name: string
  rate: number
  sales_account: string | null
  purchase_account: string | null
}

export interface AccountingRole {
  role: string
  label: string
  nature: AccountingNature | null
  account: string | null
}

export interface AccountingDocument {
  key: string
  code: string
  name: string
  /** The voucher code of the accounting software (F-1); the document number stays Servify's own. */
  voucher_code: string | null
  /** Empty for a reversal: it posts the sale's own accounts, reversed. */
  accounts: AccountingRole[]
}

export interface AccountingColumn {
  key: string
  label: string
}

/** `value` only for `fixed`: the same text on every row. */
export interface AccountingTemplateColumn extends AccountingColumn {
  value?: string | null
}

export type AccountingDateFormat = 'd/m/Y' | 'Y-m-d' | 'm/d/Y'

export interface AccountingTemplate {
  id: string
  name: string
  date_format: AccountingDateFormat
  columns: AccountingTemplateColumn[]
}

export type AccountingTemplatePayload = Omit<AccountingTemplate, 'id'>

export interface AccountingSettings {
  payment_methods: AccountingPaymentMethod[]
  taxes: AccountingTax[]
  documents: AccountingDocument[]
  /** Every column a template can use, with its default header (`fixed` included). */
  columns: AccountingColumn[]
  templates: AccountingTemplate[]
  company_document: string | null
  /** Every blank account, named as the screen shows it and in its order. */
  missing: string[]
}

/** Every key optional: only what is sent changes. */
export interface AccountingSettingsUpdate {
  payment_methods?: { method: string; account: string | null }[]
  taxes?: { id: number; sales_account: string | null; purchase_account: string | null }[]
  documents?: { key: string; voucher_code: string | null; accounts: { role: string; account: string | null }[] }[]
}

export type AccountingCell = string | number | null

export interface AccountingMovement {
  columns: AccountingColumn[]
  /** The first 200 lines at most, in the template's columns; counts and totals cover the whole period. */
  rows: AccountingCell[][]
  rows_count: number
  entries_count: number
  totals: { debit: number; credit: number }
  warnings: string[]
}

export interface AccountingMovementRequest {
  from: string
  to: string
  template: string
}

/** Saves a downloaded file under the name the API gave it. */
const saveFile = (response: { data: Blob; headers: Record<string, unknown> }, fallback: string): void => {
  const disposition = String(response.headers['content-disposition'] ?? '')
  const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || fallback

  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * What the API reads: empty filters are not sent; a switch always is, as 1
 * or 0, since some start on (an unsent one would read as its default).
 */
const params = (request: ReportRequest): Record<string, unknown> => {
  const filters: Record<string, string | number | (string | number)[]> = {}
  for (const [key, value] of Object.entries(request.filters)) {
    if (value === null || value === undefined || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) filters[key] = value
    } else if (typeof value === 'boolean') {
      filters[key] = value ? 1 : 0
    } else {
      filters[key] = typeof value === 'string' ? value.trim() : value
    }
  }
  return {
    report: request.report,
    ...(request.from ? { from: request.from } : {}),
    ...(request.to ? { to: request.to } : {}),
    ...(request.cut ? { cut: request.cut } : {}),
    // Without group_by the API applies the report's default grouping; an empty one asks for none.
    group_by: request.group_by.length ? request.group_by : [''],
    columns: request.columns,
    filters,
  }
}

class ReportsService {
  async definitions(): Promise<ReportCatalog> {
    const response = await api.get('/reports/definitions')
    return { reports: response.data.data, areas: response.data.areas }
  }

  async page(request: ReportRequest, query: PageQuery): Promise<ReportPage> {
    const response = await api.get('/reports/custom', { params: { ...params(request), ...query } })
    return response.data
  }

  /** The same report as an Excel file, every row and the "Total" row. */
  async download(request: ReportRequest): Promise<void> {
    const response = await api.get('/reports/custom', {
      params: { ...params(request), format: 'xlsx' },
      responseType: 'blob',
    })
    saveFile(response, `informe-${request.report}.xlsx`)
  }

  async accountingSettings(): Promise<AccountingSettings> {
    const response = await api.get('/accounting/settings')
    return response.data.data
  }

  async saveAccountingSettings(update: AccountingSettingsUpdate): Promise<{ settings: AccountingSettings; message: string }> {
    const response = await api.put('/accounting/settings', update)
    return { settings: response.data.data, message: response.data.message }
  }

  async createAccountingTemplate(payload: AccountingTemplatePayload): Promise<{ template: AccountingTemplate; message: string }> {
    const response = await api.post('/accounting/templates', payload)
    return { template: response.data.data, message: response.data.message }
  }

  async updateAccountingTemplate(id: string, payload: AccountingTemplatePayload): Promise<{ template: AccountingTemplate; message: string }> {
    const response = await api.put(`/accounting/templates/${id}`, payload)
    return { template: response.data.data, message: response.data.message }
  }

  async deleteAccountingTemplate(id: string): Promise<string> {
    const response = await api.delete(`/accounting/templates/${id}`)
    return response.data.message
  }

  /** The preview: a 422 with `missing` names the blank accounts the period needs. */
  async accountingMovement(request: AccountingMovementRequest): Promise<AccountingMovement> {
    const response = await api.get('/accounting/movements', { params: request })
    return response.data.data
  }

  /** Every line of the period as the template's Excel, ready to import. */
  async downloadAccountingMovement(request: AccountingMovementRequest): Promise<void> {
    const response = await api.get('/accounting/movements', {
      params: { ...request, format: 'xlsx' },
      responseType: 'blob',
    })
    saveFile(response, `movimiento-contable-${request.from}_${request.to}.xlsx`)
  }
}

export default new ReportsService()
