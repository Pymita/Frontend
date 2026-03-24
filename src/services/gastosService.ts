import api from './api'

export interface ExpenseCategory {
  id: number
  nombre: string
  descripcion?: string
  tipo: 'compra_inventario' | 'gasto_variable' | 'gasto_fijo' | 'gasto_administrativo' | 'nomina' | 'impuestos'
  afecta_costo_producto: boolean
  activa: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  expense_category_id: number
  category?: ExpenseCategory
  user_id?: number
  concepto: string
  monto: number
  fecha_gasto: string
  numero_factura?: string
  proveedor?: string
  product_id?: number
  cantidad_comprada?: number
  metodo_pago?: 'efectivo' | 'transferencia' | 'tarjeta' | 'cheque' | 'credito'
  estado_pago?: 'pendiente' | 'pagado' | 'parcial'
  monto_pagado?: number
  notas?: string
  created_at: string
  updated_at: string
}

interface ApiResponse<T> {
  data: T
  message?: string
}

export const gastosService = {
  // ===== Categorías de Gastos =====
  async getCategories(): Promise<ExpenseCategory[]> {
    const response = await api.get<ApiResponse<ExpenseCategory[]>>('/expense-categories')
    return response.data.data
  },

  async createCategory(data: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const response = await api.post<ApiResponse<ExpenseCategory>>('/expense-categories', data)
    return response.data.data
  },

  async updateCategory(id: number, data: Partial<ExpenseCategory>): Promise<ExpenseCategory> {
    const response = await api.put<ApiResponse<ExpenseCategory>>(`/expense-categories/${id}`, data)
    return response.data.data
  },

  async deleteCategory(id: number): Promise<void> {
    await api.delete(`/expense-categories/${id}`)
  },

  // ===== Gastos =====
  async getExpenses(params?: {
    fecha_inicio?: string
    fecha_fin?: string
    categoria_id?: number
  }): Promise<Expense[]> {
    const response = await api.get<ApiResponse<Expense[]>>('/expenses', { params })
    return response.data.data
  },

  async getExpense(id: number): Promise<Expense> {
    const response = await api.get<ApiResponse<Expense>>(`/expenses/${id}`)
    return response.data.data
  },

  async createExpense(data: Partial<Expense>): Promise<Expense> {
    const response = await api.post<ApiResponse<Expense>>('/expenses', data)
    return response.data.data
  },

  async updateExpense(id: number, data: Partial<Expense>): Promise<Expense> {
    const response = await api.put<ApiResponse<Expense>>(`/expenses/${id}`, data)
    return response.data.data
  },

  async deleteExpense(id: number): Promise<void> {
    await api.delete(`/expenses/${id}`)
  },

  // ===== Reportes =====
  async getResumenGastos(params?: {
    fecha_inicio?: string
    fecha_fin?: string
  }): Promise<{
    total_gastos: number
    por_categoria: Array<{
      categoria: string
      tipo: string
      total: number
      cantidad: number
    }>
  }> {
    const response = await api.get<ApiResponse<any>>('/expenses/resumen', { params })
    return response.data.data
  },
}
