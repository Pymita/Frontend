/**
 * Tipos del panel de plataforma (solo super admins)
 */

import type { BusinessType, Feature, OrderMode, SubscriptionStatus } from './auth'

export interface PlatformSubscription {
  id: number
  plan: string
  /** Valor mensual acordado; los pagos deben coincidir o traer motivo */
  monthly_price: number | null
  seller_id: number | null
  seller?: string | null
  status: SubscriptionStatus
  current_period_end: string | null
  grace_days: number
  max_tables: number
  max_users: number
  notes?: string | null
}

export interface PlatformCompany {
  id: number
  name: string
  slug: string
  business_type: BusinessType
  /** Catálogo base que se copia a clientes nuevos, no un cliente real */
  is_template: boolean
  /** A demo or a copy to try things: out of Novedades, Ventas and the commissions */
  is_test: boolean
  /** Lista efectiva (preset del tipo o personalizada) */
  modules: Feature[]
  modules_customized: boolean
  /** Tables, customers or both: the type seeds it, the admin changes it in Configuración */
  order_mode: OrderMode
  email: string | null
  phone: string | null
  /** The same city the admin edits in Configuración › Datos del negocio */
  city: string | null
  active: boolean
  users_count: number
  created_at: string
  /** Sus datos se eliminaron: solo quedan la empresa desactivada, su suscripción y sus ventas */
  data_deleted_at: string | null
  subscription: PlatformSubscription | null
}

/** Lo que borraría "Eliminar empresa" y qué lo impide. */
export interface CompanyDeletionPlan {
  /** Filas por tabla, también las que se conservan (`kept`) */
  tables: Record<string, number>
  kept: string[]
  /** Imágenes que se borran */
  files: number
  /** Imágenes que se conservan porque otra empresa copió su catálogo */
  shared_files: number
  nothing_to_delete: boolean
  /** Por qué no se puede eliminar aunque se marque todo (activa, plantilla) */
  refusal: string | null
  /** Aún no pasan los 90 días desde el fin de la suscripción */
  needs_wait: boolean
  /** Desde cuándo se puede sin la solicitud del negocio; null sin fecha de fin */
  needs_wait_until: string | null
  /** Última copia descargada desde Plataforma */
  last_exported_at: string | null
  /** Hay una copia de los últimos 7 días */
  recent_export: boolean
}

export interface DeleteCompanyPayload {
  /** El código (slug) de la empresa, escrito para confirmar */
  confirm: string
  /** El negocio pidió la eliminación: no esperar 90 días */
  now?: boolean
  without_export?: boolean
}

export interface CompanyDeletionSummary {
  tables: Record<string, number>
  files: number
  shared_files: number
  /** Los datos se borraron pero el disco no dejó borrar las imágenes */
  files_failed: boolean
  nothing_to_delete: boolean
}

export interface PlatformCompanyUser {
  id: number
  name: string
  email: string
  role: string
  active: boolean
  last_login_at: string | null
  /** Still on the temporary password the platform dictated */
  must_change_password: boolean
}

export interface TemporaryPasswordPayload {
  password: string
  password_confirmation: string
}

export interface PlatformPayment {
  id: number
  amount: number
  currency: string
  method: string
  reference: string | null
  paid_at: string
  period_start: string | null
  period_end: string | null
  notes?: string | null
  /** How its money was shared, frozen when it was registered */
  split: SplitLine[]
}

/**
 * One share of the money paid: the seller (`seller`, in the customer's first
 * year), Valentina, Mauricio, maintenance, the company (`company`). Added up
 * over several payments, each seller is `seller:<id>`.
 */
export interface SplitLine {
  key: string
  label: string
  amount: number
}

export interface PlatformCompanyDetail extends PlatformCompany {
  users: PlatformCompanyUser[]
  payments: PlatformPayment[]
}

export interface CreateCompanyPayload {
  name: string
  slug?: string
  business_type?: BusinessType
  modules?: Feature[]
  /** Without it, the type's preset (a store takes orders by customer) */
  order_mode?: OrderMode
  email?: string
  phone?: string
  city?: string
  is_test?: boolean
  admin: {
    name: string
    email: string
    password: string
  }
  plan?: string
  trial_days?: number
  monthly_price?: number | null
  max_tables?: number | null
  max_users?: number | null
  seller_id?: number | null
}

export interface SaveSubscriptionPayload {
  plan?: string
  monthly_price?: number | null
  seller_id?: number | null
  status?: SubscriptionStatus
  current_period_end?: string | null
  grace_days?: number
  max_tables?: number
  max_users?: number
  notes?: string | null
}

export interface RegisterPaymentPayload {
  amount: number
  months?: number
  method?: 'transfer' | 'cash' | 'gateway' | 'other'
  reference?: string
  /** Obligatorio cuando el monto difiere del valor acordado */
  discrepancy_reason?: string
  paid_at?: string
  notes?: string
}

/** Vendedor del SaaS (nivel plataforma). */
export interface PlatformSeller {
  id: number
  name: string
  email: string | null
  phone: string | null
  active: boolean
}

/** Fila de "Por vendedor" en Ventas. */
export interface SellerStats {
  id: number
  name: string
  active: boolean
  companies_count: number
  active_companies: number
  upgrades_count: number
  monthly_recurring: number
  total_collected: number
  /** What the split of every payment gave this seller */
  commission_total: number
  /** The same within the period asked; null without one */
  commission_period: number | null
  last_sale_at: string | null
}

export type SaleKind = 'new' | 'upgrade'

/** A sale of the SaaS as it was that day: who made it and what it included. */
export interface PlatformSale {
  id: number
  company: {
    id: number
    name: string
    city: string | null
    active: boolean
    status: SubscriptionStatus | null
    data_deleted: boolean
  }
  kind: SaleKind
  sold_at: string
  seller_id: number | null
  seller: string | null
  plan: string
  modules: Feature[]
  monthly_price: number | null
  /** What the company paid before an upgrade */
  previous_monthly_price: number | null
  max_tables: number | null
  max_users: number | null
  notes: string | null
}

export interface SalesOverview {
  sales: PlatformSale[]
  summary: {
    new_count: number
    upgrade_count: number
    /** A new company's fee plus an upgrade's raise */
    added_monthly: number
    collected: number
    commissions: number
  }
  /** Money paid in the period, shared out */
  split: SplitLine[]
}

export interface RegisterUpgradePayload {
  sold_at: string
  seller_id: number | null
  plan: string
  modules: Feature[]
  monthly_price: number
  max_tables: number
  max_users: number
  notes?: string | null
}

export interface UpdateSalePayload {
  sold_at?: string
  seller_id?: number | null
  notes?: string | null
}

interface ActivityCompany {
  id: number
  name: string
  city: string | null
}

/** Novedades: the period's news and how the platform stands today (platform:report). */
export interface PlatformActivity {
  period: { from: string; to: string; days: number }
  totals: {
    companies: number
    trial: number
    active: number
    grace: number
    suspended: number
    monthly_recurring: number
    trial_monthly: number
    /** Active test accounts, left out of every figure */
    test_accounts: number
  }
  new_companies: (ActivityCompany & {
    business_type: BusinessType
    modules: Feature[]
    plan: string | null
    monthly_price: number | null
    seller: string | null
    status: SubscriptionStatus | null
    period_end: string | null
    admin: { name: string; email: string } | null
    created_at: string
  })[]
  new_users: {
    id: number
    name: string
    login: string
    role: string
    company: ActivityCompany
    created_at: string
  }[]
  sales: {
    id: number
    company: ActivityCompany
    kind: SaleKind
    sold_at: string
    seller: string | null
    monthly_price: number | null
    previous_monthly_price: number | null
    modules: Feature[]
  }[]
  payments: {
    id: number
    company: ActivityCompany
    amount: number
    method: string
    paid_at: string
    seller_amount: number
  }[]
  collected: number
  split: SplitLine[]
  trials_ending: (ActivityCompany & { ends_on: string; days_left: number; monthly_price: number | null; seller: string | null })[]
  overdue: (ActivityCompany & { status: SubscriptionStatus; period_end: string | null; monthly_price: number | null })[]
  signed_in: number
  idle: (ActivityCompany & { last_login_at: string | null; status: SubscriptionStatus | null })[]
}
