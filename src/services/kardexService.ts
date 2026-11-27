import api from './api'
import type { PaymentMethod, SaleOrigin } from './salesService'

export interface DocumentType {
  id: number
  code: string
  name: string
  direction: 'in' | 'out' | 'both'
  active: boolean
}

export type TaxKind = 'iva' | 'inc' | 'ibua' | 'icui' | 'licores' | 'other'
export type TaxCalculation = 'percentage' | 'per_unit'

/**
 * A tax of the company's catalog: a percentage of the value before taxes
 * (`rate`) or a fixed amount in pesos per unit (`amount`). `in_cost`: what is
 * paid for it when buying is inventory cost, not a deductible tax.
 */
export interface Tax {
  id: number
  name: string
  kind: TaxKind
  calculation: TaxCalculation
  rate: number
  amount: number
  in_cost: boolean
  active: boolean
}

export type TaxPayload = Partial<Pick<Tax, 'name' | 'kind' | 'calculation' | 'rate' | 'amount' | 'in_cost' | 'active'>>

/** One tax of a purchase line as the kardex kept it (`in_cost`: it went into the unit cost). */
export interface MovementTax {
  tax_id: number | null
  name: string | null
  kind: TaxKind
  calculation: TaxCalculation
  rate: number
  unit_amount: number
  in_cost: boolean
  amount: number
  /** "19%" or "$68 c/u" */
  rate_label: string
}

/** A withholding concept of the company (Configuración › Retenciones). Rates are percentages: ReteICA's 3,5 por mil is 0,35. */
export interface WithholdingConcept {
  id: number
  name: string
  type: 'renta' | 'iva' | 'ica'
  rate_declarant: number
  rate_non_declarant: number
  /** Below this base, in UVT, nothing is withheld */
  min_base_uvt: number
  active: boolean
}

export interface WithholdingSettings {
  uvt_value: number
  /** Whether the company declares renta: the rate its customers withhold from it */
  income_tax_declarant: boolean
}

/** A withholding typed with a document (the suggestion, edited or not). */
export interface WithholdingLine {
  id?: number
  withholding_concept_id?: number | null
  name: string
  type: 'renta' | 'iva' | 'ica'
  rate: number
  base: number
  amount: number
}

export interface KardexMovement {
  id: number
  moved_at: string
  document_code: string
  document_name: string
  reference: string | null
  counterparty?: string | null
  product: { id: number; name: string; unit: string }
  movement_type: 'in' | 'out'
  quantity: number
  /** Before tax */
  unit_cost: number
  /** Valor bruto: quantity × unit cost */
  total_cost: number
  tax_id: number | null
  /** Percentage, 0 without tax */
  tax_rate: number
  tax_amount: number
  /** Valor neto: total_cost + tax_amount */
  net_total: number
  /** Every tax of the line, the ones that went into the cost included */
  tax_ids?: number[]
  taxes?: MovementTax[]
  /** The cost typed: unit_cost without the taxes that are cost */
  unit_cost_before_taxes?: number
  balance_quantity: number
  balance_unit_cost: number
  balance_total_cost: number
  user: string | null
  notes: string | null
  /** A purchase (FC) or adjustment (AJ) registered by hand */
  editable: boolean
  edited_at: string | null
  edited_by: string | null
  /** Shared by the rows registered together as one document; null for a document of one row */
  batch: string | null
}

/**
 * One product of a manual document. Without a cost the line enters at the
 * product's current average cost; the cost is before tax and `tax_id` only
 * goes on entries.
 */
export interface KardexLine {
  product_id: number
  quantity: number
  unit_cost?: number | null
  tax_id?: number | null
  /** Every tax of the line; wins over `tax_id` */
  tax_ids?: number[]
}

export interface KardexDocumentUpdate {
  /** YYYY-MM-DD, never future */
  moved_at?: string
  /** Required for a purchase (FC) */
  counterparty?: string | null
  reference?: string | null
  notes?: string | null
  /** Only an adjustment (AJ) may change direction */
  movement_type?: 'in' | 'out'
  /**
   * Every line after editing: one with `id` is updated, one without is added
   * and a line of the document left out is deleted from the kardex.
   */
  items: (KardexLine & { id?: number })[]
  /** Sent, the document keeps exactly these; absent, the ones it had */
  withholdings?: WithholdingLine[]
}

export interface KardexFilters {
  product_id?: number
  document_type_id?: number
  movement_type?: 'in' | 'out'
  from?: string
  to?: string
  /** Every row of one document, whatever the date */
  batch?: string
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
  /** A document's withholdings, when it is read by `batch` */
  withholdings?: WithholdingLine[]
  totals: {
    in_quantity: number
    in_cost: number
    in_tax: number
    in_net: number
    out_quantity: number
    out_cost: number
  }
  truncated: boolean
}

export interface BalanceReport {
  as_of: string
  assets: {
    /** What orders and automatic-billing abonos collected, minus what was paid. */
    cash: number
    /** The part of cash that came in as abonos of automatic billing, by payment method. */
    billing_abonos: { total: number; by_method: Partial<Record<PaymentMethod, number>> }
    /** What customers still owe on issued documents: the cartera. */
    accounts_receivable: number
    inventory: number
    /** Productos con unidades en el kardex pero sin costo: suman $0 al inventario */
    uncosted_stock?: { id: number; name: string; unit: string | null; quantity: number }[]
    total: number
  }
  liabilities: { accounts_payable: number; loans: number; total: number }
  equity: number
}

export type MovementKind =
  | 'income'
  | 'expense'
  | 'owner_contribution'
  | 'owner_withdrawal'
  | 'loan_received'
  | 'loan_payment'

export interface FinancialMovement {
  id: number
  kind: MovementKind
  kind_label: string
  concept: string
  amount: number
  occurred_at: string
  payment_method: string
  notes: string | null
  /** Cómo pega en cada reporte (+/-) */
  cash_effect: number
  profit_effect: number
  debt_effect: number
  user: string | null
}

export interface MovementKindOption {
  value: MovementKind
  label: string
  affects_profit: boolean
  affects_debt: boolean
}

export interface MovementPayload {
  kind: MovementKind
  concept: string
  amount: number
  occurred_at: string
  payment_method?: string
  notes?: string | null
}

export interface IncomeStatement {
  from: string
  to: string
  /** Orders charged plus automatic-billing documents issued (abonos never). */
  sales: number
  sales_by_origin: Record<SaleOrigin, number>
  cost_of_sales: number
  gross_profit: number
  gross_margin: number
  operating_expenses: number
  expenses_by_category: { category: string; total: number }[]
  other_income: number
  other_expenses: number
  /** Movió caja pero no es resultado: aportes, retiros, préstamos */
  non_operating: { concept: string; kind_label: string; cash_effect: number; occurred_at: string }[]
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

  /**
   * Movimiento manual del kardex (devolución de ventas, compra de varios
   * productos...): un encabezado y una fila del kardex por producto, todas
   * o ninguna. Los documentos automáticos (SI, FV, NC) no se aceptan.
   */
  async createKardexMovement(payload: {
    document_type_id: number
    movement_type: 'in' | 'out'
    items: KardexLine[]
    /** Fecha real del documento (retro-fechable, nunca futura) */
    moved_at?: string
    /** Proveedor (FC) o cliente (DV) del movimiento */
    counterparty?: string | null
    reference?: string | null
    /** Observaciones opcionales del movimiento */
    notes?: string
    /** Retenciones de una compra (sugeridas por el proveedor y editables) */
    withholdings?: WithholdingLine[]
  }): Promise<{ movements: KardexMovement[]; message: string }> {
    const response = await api.post<ApiEnvelope<KardexMovement[]>>('/kardex/movements', payload)
    return { movements: response.data.data, message: response.data.message ?? '' }
  }

  /**
   * Corrects a whole manual purchase (FC) or adjustment (AJ), `id` being any
   * of its rows. The API replays the kardex of every product it touches by
   * date, so the balances of later rows change too.
   */
  async updateKardexDocument(id: number, payload: KardexDocumentUpdate): Promise<{ movements: KardexMovement[]; message: string }> {
    const response = await api.put<ApiEnvelope<KardexMovement[]>>(`/kardex/movements/${id}`, payload)
    return { movements: response.data.data, message: response.data.message ?? '' }
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

  /** Withholding concepts of the company, its UVT and whether it declares renta (docs/RETENCIONES.md). */
  async withholdingConcepts(): Promise<{ concepts: WithholdingConcept[]; settings: WithholdingSettings }> {
    const response = await api.get<ApiEnvelope<WithholdingConcept[]> & { settings: WithholdingSettings }>('/withholding-concepts')
    return { concepts: response.data.data, settings: response.data.settings }
  }

  async createWithholdingConcept(payload: Omit<WithholdingConcept, 'id' | 'active'>): Promise<WithholdingConcept> {
    const response = await api.post<ApiEnvelope<WithholdingConcept>>('/withholding-concepts', payload)
    return response.data.data
  }

  async updateWithholdingConcept(id: number, payload: Partial<Omit<WithholdingConcept, 'id'>>): Promise<WithholdingConcept> {
    const response = await api.put<ApiEnvelope<WithholdingConcept>>(`/withholding-concepts/${id}`, payload)
    return response.data.data
  }

  async deleteWithholdingConcept(id: number): Promise<void> {
    await api.delete(`/withholding-concepts/${id}`)
  }

  async updateWithholdingSettings(payload: Partial<WithholdingSettings>): Promise<WithholdingSettings> {
    const response = await api.put<ApiEnvelope<WithholdingSettings>>('/withholding-concepts/settings', payload)
    return response.data.data
  }

  /**
   * What to withhold on a document of `base` (before taxes) with `iva`: a
   * purchase from the supplier named `counterparty`, or a Cartera document of
   * `customer_id`. Only a suggestion: the document saves what is typed.
   */
  async suggestWithholdings(params: { base: number; iva?: number; counterparty?: string; customer_id?: number }): Promise<WithholdingLine[]> {
    const response = await api.get<ApiEnvelope<WithholdingLine[]>>('/withholdings/suggest', { params })
    return response.data.data
  }

  async taxes(): Promise<Tax[]> {
    const response = await api.get<ApiEnvelope<Tax[]>>('/taxes')
    return response.data.data
  }

  async createTax(payload: TaxPayload): Promise<Tax> {
    const response = await api.post<ApiEnvelope<Tax>>('/taxes', payload)
    return response.data.data
  }

  async updateTax(id: number, payload: TaxPayload): Promise<Tax> {
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

  async movements(from?: string, to?: string): Promise<{ movements: FinancialMovement[]; kinds: MovementKindOption[] }> {
    const response = await api.get<ApiEnvelope<{ movements: FinancialMovement[]; kinds: MovementKindOption[] }>>(
      '/financial-movements',
      { params: cleanFilters({ from, to } as any) },
    )
    return response.data.data
  }

  async createMovement(payload: MovementPayload): Promise<FinancialMovement> {
    const response = await api.post<ApiEnvelope<FinancialMovement>>('/financial-movements', payload)
    return response.data.data
  }

  async updateMovement(id: number, payload: Partial<MovementPayload>): Promise<FinancialMovement> {
    const response = await api.put<ApiEnvelope<FinancialMovement>>(`/financial-movements/${id}`, payload)
    return response.data.data
  }

  async deleteMovement(id: number): Promise<void> {
    await api.delete(`/financial-movements/${id}`)
  }

  async incomeStatement(from: string, to: string): Promise<IncomeStatement> {
    const response = await api.get<ApiEnvelope<IncomeStatement>>('/reports/income-statement', {
      params: { from, to },
    })
    return response.data.data
  }
}

export default new KardexService()
