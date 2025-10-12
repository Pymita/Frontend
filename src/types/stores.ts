/**
 * Tipos para stores de Pinia
 */

import { User } from './auth'

export interface AuthStore {
  // Estado
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  isAdmin: boolean
  isActive: boolean

  // Actions
  login(credentials: { email: string; password: string }): Promise<void>
  logout(): Promise<void>
  getCurrentUser(): Promise<void>
  setUser(user: User): void
  setToken(token: string): void
  clearAuth(): void
  initializeAuth(): void
}

export interface ProductStore {
  // Estado
  products: Product[]
  categories: Category[]
  isLoading: boolean
  currentProduct: Product | null

  // Actions
  fetchProducts(): Promise<void>
  createProduct(product: Partial<Product>): Promise<Product>
  updateProduct(id: number, product: Partial<Product>): Promise<Product>
  deleteProduct(id: number): Promise<void>
  setCurrentProduct(product: Product | null): void
}

// Tipos base para productos
export interface Product {
  id: number
  name: string
  description?: string
  price: number
  category_id: number
  category?: Category
  image?: string
  active: boolean
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  description?: string
  active: boolean
  products_count?: number
}

export interface OrderStore {
  // Estado
  orders: Order[]
  currentOrder: Order | null
  isLoading: boolean

  // Actions
  fetchOrders(): Promise<void>
  createOrder(order: Partial<Order>): Promise<Order>
  updateOrderStatus(id: number, status: OrderStatus): Promise<void>
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

export interface Order {
  id: number
  customer_name: string
  customer_phone?: string
  items: OrderItem[]
  total: number
  status: OrderStatus
  notes?: string
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: number
  product_id: number
  product?: Product
  quantity: number
  unit_price: number
  subtotal: number
}
