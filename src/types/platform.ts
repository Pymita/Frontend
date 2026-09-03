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
  /** Lista efectiva (preset del tipo o personalizada) */
  modules: Feature[]
  modules_customized: boolean
  email: string | null
  phone: string | null
  active: boolean
  users_count: number
  created_at: string
  subscription: PlatformSubscription | null
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
