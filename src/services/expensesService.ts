import api from './api'

export type ExpenseCategoryType =
  | 'inventory_purchase'
  | 'variable_expense'
  | 'fixed_expense'
  | 'administrative_expense'
  | 'payroll'
  | 'taxes'

export type ExpensePaymentMethod = 'cash' | 'transfer' | 'card' | 'check' | 'credit'
export type ExpensePaymentStatus = 'pending' | 'paid' | 'partial'

export interface ExpenseCategory {
  id: number
  name: string
  description?: string
  type: ExpenseCategoryType
  affects_product_cost: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface Expense {
  id: number
  expense_category_id: number
  category?: ExpenseCategory
  user_id?: number
  concept: string
  amount: number
  expense_date: string
  invoice_number?: string
  supplier_name?: string
  product_id?: number
  quantity_purchased?: number
  payment_method?: ExpensePaymentMethod
  payment_status?: ExpensePaymentStatus
  amount_paid?: number
  attachments?: string[]
  notes?: string
  created_at: string
  updated_at: string
}

export interface ExpenseSummary {
  total_expenses: number
  by_category: Array<{
    category: string
    type: string
    total: number
    count: number
  }>
}

interface ApiResponse<T> {
  data: T
  message?: string
}

export const expensesService = {
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
    start_date?: string
    end_date?: string
    category_id?: number
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
  async getExpenseSummary(params?: {
    start_date?: string
    end_date?: string
  }): Promise<ExpenseSummary> {
    const response = await api.get<ApiResponse<ExpenseSummary>>('/expenses/summary', { params })
    return response.data.data
  },
}
