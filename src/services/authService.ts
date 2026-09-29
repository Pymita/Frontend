import api from './api'
import type {
  User,
  LoginCredentials,
  LoginResponse,
  ChangePasswordData,
  UpdateProfileData
} from '../types'
import type { TwoFactorChallenge, TwoFactorSetup } from '../types/auth'

class AuthService {
  /**
   * Realizar login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse | TwoFactorChallenge> {
    const response = await api.post<LoginResponse | TwoFactorChallenge>('/auth/login', {
      ...credentials,
      device: 'web',
    })

    // Con verificación en dos pasos todavía no hay sesión: falta el código.
    if ('two_factor_required' in response.data) {
      return response.data
    }

    this.storeSession(response.data)
    return response.data
  }

  /** Segundo paso del login: el ticket del primero más el código (o uno de respaldo). */
  async verifyTwoFactor(challenge: string, code: { code?: string; recovery_code?: string }): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/two-factor/challenge', { challenge, ...code })
    this.storeSession(response.data)
    return response.data
  }

  /**
   * El token vive en localStorage: la API está en otro dominio que la web,
   * así que una cookie httpOnly exigiría cookies de terceros. Lo compensan
   * la sesión que muere cada madrugada, que no se inserta HTML de usuarios
   * (sin v-html) y que cambiar la contraseña cierra las demás sesiones.
   */
  private storeSession(data: LoginResponse): void {
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('user_data', JSON.stringify(data.user))
  }

  async forgotPassword(email: string): Promise<string> {
    const response = await api.post<{ message: string }>('/auth/forgot-password', { email })
    return response.data.message
  }

  async resetPassword(payload: { token: string; email: string; password: string; password_confirmation: string }): Promise<string> {
    const response = await api.post<{ message: string }>('/auth/reset-password', payload)
    return response.data.message
  }

  async twoFactorSetup(): Promise<TwoFactorSetup> {
    const response = await api.post<{ data: TwoFactorSetup }>('/auth/two-factor/setup')
    return response.data.data
  }

  async twoFactorConfirm(code: string): Promise<string[]> {
    const response = await api.post<{ data: { recovery_codes: string[] } }>('/auth/two-factor/confirm', { code })
    return response.data.data.recovery_codes
  }

  async twoFactorDisable(password: string, code: string): Promise<void> {
    await api.post('/auth/two-factor/disable', { password, code })
  }

  /**
   * Realizar logout
   */
  async logout(): Promise<void> {
    try {
      // Timeout corto: si el servidor no responde, igual se limpia la
      // sesión local en vez de dejar al usuario mirando un spinner.
      await api.post('/auth/logout', null, { timeout: 3000 })
    } catch (error) {
      console.error('Error durante logout:', error)
    } finally {
      // Limpiar datos locales independientemente del resultado
      this.clearAuthData()
    }
  }

  /**
   * Obtener información del usuario autenticado
   */
  async me(): Promise<User> {
    const response = await api.get<{ user: User }>('/auth/me')
    
    const user = response.data.user
    
    // Actualizar datos del usuario en localStorage
    localStorage.setItem('user_data', JSON.stringify(user))
    
    return user
  }

  /**
   * Cambiar contraseña del usuario actual
   */
  async changePassword(passwordData: ChangePasswordData): Promise<void> {
    await api.post('/auth/change-password', passwordData)
  }

  /**
   * Actualizar perfil del usuario actual
   */
  async updateProfile(profileData: UpdateProfileData): Promise<User> {
    const response = await api.put<User>('/auth/profile', profileData)
    const user = response.data
    
    // Actualizar usuario en localStorage
    localStorage.setItem('user_data', JSON.stringify(user))
    
    return user
  }

  /**
   * Verificar si el usuario está autenticado
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token')
    return !!token
  }

  /**
   * Obtener token de autenticación
   */
  getToken(): string | null {
    return localStorage.getItem('auth_token')
  }

  /**
   * Obtener datos del usuario desde localStorage
   */
  getUser(): User | null {
    const userData = localStorage.getItem('user_data')
    return userData ? JSON.parse(userData) : null
  }

  /**
   * Verificar si el usuario es admin
   */
  isAdmin(): boolean {
    const user = this.getUser()
    return user?.role === 'admin'
  }

  /**
   * Limpiar datos de autenticación
   */
  clearAuthData(): void {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    // También limpiar el header de Axios
    delete api.defaults.headers.common['Authorization']
  }
}

export default new AuthService()
