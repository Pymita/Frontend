import api from './api'

export interface User {
  id: number
  name: string
  email: string
  role: 'admin' | 'employee'
  phone?: string
  last_login_at?: string
  active: boolean
}

export interface LoginData {
  email: string
  password: string
}

export interface LoginResponse {
  message: string
  user: User
  token: string
}

class AuthService {
  /**
   * Realizar login
   */
  async login(credentials: LoginData): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    
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
      await api.post('/auth/logout')
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
    
    // Actualizar datos del usuario en localStorage
    localStorage.setItem('user_data', JSON.stringify(response.data.user))
    
    return response.data.user
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
  }
}

export default new AuthService()
