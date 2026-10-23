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

    const disposition: string = response.headers['content-disposition'] || ''
    const filename = disposition.match(/filename="?([^";]+)"?/)?.[1] || `informe-${request.report}.xlsx`

    const url = URL.createObjectURL(response.data)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  }
}

export default new ReportsService()
