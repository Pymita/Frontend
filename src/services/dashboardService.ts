import api from './api';
import type { SaleOrigin } from './salesService';

/** The cartera as Facturación automática › Cartera adds it up. */
export interface Receivables {
  balance: number;
  overdue_balance: number;
  /** Customers who still owe something. */
  customers: number;
  overdue_documents: number;
}

export interface DashboardStats {
  orders_today: number;
  /** Orders charged plus automatic-billing documents issued. */
  sales_today: number;
  orders_month: number;
  sales_month: number;
  /** The documents' part of sales_today / sales_month. */
  recurring_today: number;
  recurring_month: number;
  active_products: number;
  low_stock: number;
  /** Pendientes de cobro creados antes de hoy. */
  overdue_pending: { count: number; balance: number };
  /** Only for whoever may open automatic billing. */
  receivables: Receivables | null;
}

/** What a company that sells both ways chooses to see: everything, or one origin. */
export type SalesSelection = 'all' | SaleOrigin;

/** A product of the orders, or a billed concept (without orders, or when chosen). */
export interface TopProduct {
  name: string;
  origin: SaleOrigin;
  menu_item_id: number | null;
  product_id: number | null;
  /** Units sold. */
  sold: number;
  /** Line prices before the order's general discount. */
  gross: number;
  /** Net after the order discount, same figure as Ventas "Por producto". */
  total: number;
  orders_count: number;
  /** Concepts only. */
  documents_count?: number;
  /** % of everything the selection sold in the period, not only of the top rows. */
  share: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  current_stock: number;
  /** @deprecated alias of current_stock kept by the API for older clients. */
  stock: number;
  minimum_stock: number;
  unit: string;
}

/** One point of the sales chart: a day, a week or a month depending on the range. */
export interface SalesWeekDay {
  /** First day of the bucket (YYYY-MM-DD). */
  date: string;
  /** Last day of the bucket, clipped to the range. */
  end: string;
  /** Label for the axis ("lun.", "5 abr.", "ene. 2026"). */
  day: string;
  /** Orders and documents together: orders_total + recurring_total. */
  total: number;
  orders_total: number;
  /** POS sales. */
  orders_count: number;
  recurring_total: number;
  recurring_count: number;
}

export type SalesBucket = 'day' | 'week' | 'month';

/** Inclusive range in local dates (YYYY-MM-DD). */
export interface DateRange {
  from: string;
  to: string;
}

export interface SalesPeriod {
  points: SalesWeekDay[];
  meta: DateRange & {
    bucket: SalesBucket;
    total: number;
    orders_total: number;
    orders_count: number;
    recurring_total: number;
    recurring_count: number;
  };
}

export interface TopProductsPeriod {
  products: TopProduct[];
  meta: DateRange & { total: number; origin: SalesSelection };
}

interface ApiResponse<T, M = undefined> {
  data: T;
  meta: M;
  message: string;
}

/** Un paso de "Primeros pasos": se marca solo cuando el dato existe. */
export interface SetupStep {
  key: string
  title: string
  description: string
  link: string
  done: boolean
  optional: boolean
  pending: number
}

export interface SetupChecklist {
  steps: SetupStep[]
  completed: number
  total: number
}

export const dashboardService = {
  async getSetup(): Promise<SetupChecklist> {
    const response = await api.get<ApiResponse<SetupChecklist>>('/dashboard/setup');
    return response.data.data;
  },

  async getStats(): Promise<DashboardStats> {
    const response = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return response.data.data;
  },

  /**
   * Without a range the API returns today's sales; without an origin, the
   * products (the concepts for a company without orders).
   */
  async getTopProducts(range?: DateRange, origin?: SalesSelection): Promise<TopProductsPeriod> {
    const response = await api.get<ApiResponse<TopProduct[], TopProductsPeriod['meta']>>('/dashboard/top-products', {
      params: { ...range, ...(origin ? { origin } : {}) },
    });
    return { products: response.data.data, meta: response.data.meta };
  },

  async getLowStock(): Promise<LowStockProduct[]> {
    const response = await api.get<ApiResponse<LowStockProduct[]>>('/dashboard/low-stock');
    return response.data.data;
  },

  /** Without a range the API returns the last 7 days. */
  async getSalesWeek(range?: DateRange): Promise<SalesPeriod> {
    const response = await api.get<ApiResponse<SalesWeekDay[], SalesPeriod['meta']>>('/dashboard/sales-week', { params: range });
    return { points: response.data.data, meta: response.data.meta };
  },
};
