/**
 * Tipos para stores de Pinia
 */

import type { User } from './auth'

export interface AuthStore {
  // Estado
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  isAdmin: boolean
  isActive: boolean
  canUseAccounting: boolean

  // Actions
  login(credentials: { email: string; password: string }): Promise<void>
  logout(): Promise<void>
  getCurrentUser(): Promise<void>
  refreshUser(): Promise<void>
  setUser(user: User): void
  setToken(token: string): void
  clearAuth(): void
  initializeAuth(): void
}
