import api from './api'
import type { PageQuery, PaginatedResponse } from '@/types/api'

export type ExpenseCategoryType =
  | 'inventory_purchase'
  | 'variable_expense'
  | 'fixed_expense'
  | 'administrative_expense'
  | 'payroll'
  | 'taxes'

/** A key of the company's payment methods; expenses before them may carry `card`, `check` or `credit`. */
export type ExpensePaymentMethod = string
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
  /** Solo en gastos anteriores a que las compras entraran por el kardex. */
  product_id?: number
  quantity_purchased?: number
  payment_method?: ExpensePaymentMethod
  payment_status?: ExpensePaymentStatus
  amount_paid?: number
  attachments?: string[]
  notes?: string
  /** A payment of a recurring expense, and the due date it settled */
  recurring_expense_id?: number | null
  recurring_due_on?: string | null
  created_at: string
  updated_at: string
}

/** overdue, due within 30 days, further ahead, or finished / paused. */
export type RecurringExpenseStatus = 'overdue' | 'due_soon' | 'scheduled' | 'finished'

/** Months or years: monthly is 1 month, the domain every 3 years is 3 years. */
export type RecurringIntervalUnit = 'month' | 'year'

/**
 * The schedule of something paid again and again. A projection, never an
 * expense: only "Registrar pago" writes one.
 */
export interface RecurringExpense {
  id: number
  expense_category_id: number
  category: Pick<ExpenseCategory, 'id' | 'name' | 'type'> | null
  concept: string
  supplier_name: string | null
  payment_method: string | null
  estimated_amount: number
  interval_unit: RecurringIntervalUnit
  interval_count: number
  /** "Mensual", "Cada 3 meses", "Anual", "Cada 3 años" */
  frequency_label: string
  months: number
  starts_on: string
  next_due_on: string
  ends_on: string | null
  active: boolean
  notes: string | null
  /** The estimate spread over its months (0 once finished) */
  monthly_cost: number
  annual_cost: number
  status: RecurringExpenseStatus
  /** Negative when late */
  days_until_due: number
  overdue_count: number
  overdue_amount: number
  /** Due dates (overdue included) up to 30 and 90 days from today */
  due: Record<'30' | '90', { count: number; amount: number }>
  last_payment: { expense_id: number; expense_date: string; amount: number } | null
  payments_count: number
}

export interface RecurringExpensesOverview {
  items: RecurringExpense[]
  summary: {
    monthly_cost: number
    annual_cost: number
    active: number
    overdue: { count: number; amount: number }
    due_30: { count: number; amount: number }
    due_90: { count: number; amount: number }
  }
}

export type RecurringExpensePayload = Partial<Pick<RecurringExpense,
  'expense_category_id' | 'concept' | 'supplier_name' | 'payment_method' | 'estimated_amount' | 'interval_unit'
  | 'interval_count' | 'starts_on' | 'next_due_on' | 'ends_on' | 'active' | 'notes'>>

export interface RecurringPaymentPayload {
  amount: number
  expense_date: string
  payment_method?: string
  invoice_number?: string
  notes?: string
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
  // ===== Categorías de gastos =====
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

  /** Una página de gastos (búsqueda por concepto, proveedor o factura en `q`). */
  async getExpensesPage(
    query: PageQuery & { start_date?: string; end_date?: string; category_id?: number },
  ): Promise<PaginatedResponse<Expense>> {
    const response = await api.get<PaginatedResponse<Expense>>('/expenses', { params: query })
    return response.data
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

  // ===== Gastos recurrentes =====
  async getRecurring(): Promise<RecurringExpensesOverview> {
    const response = await api.get<ApiResponse<RecurringExpensesOverview>>('/recurring-expenses')
    return response.data.data
  },

  async createRecurring(data: RecurringExpensePayload): Promise<{ data: RecurringExpense; message: string }> {
    const response = await api.post<ApiResponse<RecurringExpense>>('/recurring-expenses', data)
    return { data: response.data.data, message: response.data.message ?? '' }
  },

  async updateRecurring(id: number, data: RecurringExpensePayload): Promise<RecurringExpense> {
    const response = await api.put<ApiResponse<RecurringExpense>>(`/recurring-expenses/${id}`, data)
    return response.data.data
  },

  async deleteRecurring(id: number): Promise<string> {
    const response = await api.delete<{ message: string }>(`/recurring-expenses/${id}`)
    return response.data.message
  },

  /** Writes the real expense and moves the schedule one interval; the message names the next due date. */
  async payRecurring(id: number, data: RecurringPaymentPayload): Promise<{ data: { expense: Expense; recurring_expense: RecurringExpense }; message: string }> {
    const response = await api.post<ApiResponse<{ expense: Expense; recurring_expense: RecurringExpense }>>(`/recurring-expenses/${id}/payments`, data)
    return { data: response.data.data, message: response.data.message ?? '' }
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
