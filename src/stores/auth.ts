import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import authService from '../services/authService'
import type { User, LoginCredentials } from '../types'

export const useAuthStore = defineStore('auth', () => {
  // Estado
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref<boolean>(false)

  // Getters
  const isAuthenticated = computed((): boolean => {
    return !!(token.value && user.value)
  })

  const isAdmin = computed((): boolean => {
    return user.value?.role === 'admin'
  })

  const isActive = computed((): boolean => {
    return user.value?.active === true
  })

  // Suscripción suspendida: la cuenta puede consultar pero no escribir.
  // El backend responde 402 a cualquier escritura; la interfaz esconde
  // las acciones para no ofrecer algo que va a fallar.
  const blockedMessage = ref<string | null>(null)

  const isReadOnly = computed((): boolean => {
    if (user.value?.role === 'super_admin') return false
    return blockedMessage.value !== null
      || user.value?.company?.subscription?.status === 'suspended'
  })

  const readOnlyMessage = computed((): string | null => {
    if (blockedMessage.value) return blockedMessage.value
    const subscription = user.value?.company?.subscription
    return subscription?.status === 'suspended' ? subscription.notice : null
  })

  /** El backend contestó 402: la cuenta acaba de quedar en solo lectura. */
  const markBlocked = (message?: string | null): void => {
    blockedMessage.value = message || 'Tu cuenta está en modo solo lectura por falta de pago'
  }

  // Actions
  const login = async (credentials: LoginCredentials): Promise<void> => {
    isLoading.value = true
    try {
      const response = await authService.login(credentials)
      
      // Actualizar estado del store
      user.value = response.user
      token.value = response.token
    } catch (error) {
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    isLoading.value = true
    try {
      await authService.logout()
    } catch (error) {
      // Error silencioso en logout
    } finally {
      clearAuth()
      isLoading.value = false
    }
  }

  const getCurrentUser = async (): Promise<void> => {
    if (!token.value) return
    
    isLoading.value = true
    try {
      const userData = await authService.me()
      user.value = userData
    } catch (error) {
      clearAuth()
    } finally {
      isLoading.value = false
    }
  }

  const setUser = (userData: User): void => {
    user.value = userData
  }

  const setToken = (tokenValue: string): void => {
    token.value = tokenValue
  }

  const clearAuth = (): void => {
    user.value = null
    token.value = null
    blockedMessage.value = null
  }

  const initializeAuth = (): void => {
    // Verificar si hay datos en localStorage
    const storedToken = authService.getToken()
    const storedUser = authService.getUser()

    if (storedToken && storedUser) {
      token.value = storedToken
      user.value = storedUser
    }
  }

  return {
    // Estado
    user,
    token,
    isLoading,
    
    // Getters
    isAuthenticated,
    isAdmin,
    isActive,
    isReadOnly,
    readOnlyMessage,
    
    // Actions
    login,
    logout,
    getCurrentUser,
    setUser,
    setToken,
    markBlocked,
    clearAuth,
    initializeAuth
  }
})
