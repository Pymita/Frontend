import api from './api'
import type { 
  User, 
  LoginCredentials, 
  LoginResponse, 
  ChangePasswordData,
  UpdateProfileData 
} from '../types'

class AuthService {
  /**
   * Realizar login
   */
  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', {
      ...credentials,
      device: 'web',
    })
    
    // Guardar token y datos del usuario en localStorage
    localStorage.setItem('auth_token', response.data.token)
    localStorage.setItem('user_data', JSON.stringify(response.data.user))
    
    return response.data
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
