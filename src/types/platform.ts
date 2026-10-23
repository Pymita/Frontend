/**
 * Tipos del panel de plataforma (solo super admins)
 */

import type { BusinessType, Feature, SubscriptionStatus } from './auth'

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
  /** Lista efectiva (preset del tipo o personalizada) */
  modules: Feature[]
  modules_customized: boolean
  email: string | null
  phone: string | null
  active: boolean
  users_count: number
  created_at: string
  /** Sus datos se eliminaron: solo quedan la empresa desactivada y su suscripción */
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
  email?: string
  phone?: string
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

/** Fila de "Ventas por vendedor". */
export interface SellerStats {
  id: number
  name: string
  active: boolean
  companies_count: number
  active_companies: number
  monthly_recurring: number
  total_collected: number
  last_sale_at: string | null
}
