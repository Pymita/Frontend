/**
 * Tipos del panel de plataforma (solo super admins)
 */

import type { BusinessType, Feature, SubscriptionStatus } from './auth'

export interface PlatformSubscription {
  id: number
  plan: string
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
  email?: string
  phone?: string
  admin: {
    name: string
    email: string
    password: string
  }
  plan?: string
  trial_days?: number
}

export interface SaveSubscriptionPayload {
  plan?: string
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
  paid_at?: string
  notes?: string
}
