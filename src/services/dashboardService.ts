import api from './api';

export interface DashboardStats {
  orders_today: number;
  sales_today: number;
  orders_month: number;
  sales_month: number;
  active_products: number;
  low_stock: number;
}

export interface TopProduct {
  name: string;
  menu_item_id: number | null;
  product_id: number | null;
  /** Units sold. */
  sold: number;
  /** Line prices before the order's general discount. */
  gross: number;
  /** Net after the order discount, same figure as Ventas "Por producto". */
  total: number;
  orders_count: number;
  /** % of all product sales in the period (not only of the top rows). */
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
  total: number;
  orders_count: number;
}

export type SalesBucket = 'day' | 'week' | 'month';

/** Inclusive range in local dates (YYYY-MM-DD). */
export interface DateRange {
  from: string;
  to: string;
}

export interface SalesPeriod {
  points: SalesWeekDay[];
  meta: DateRange & { bucket: SalesBucket; total: number; orders_count: number };
}

export interface TopProductsPeriod {
  products: TopProduct[];
  meta: DateRange & { total: number };
}

interface ApiResponse<T, M = undefined> {
  data: T;
  meta: M;
  message: string;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return response.data.data;
  },

  /** Without a range the API returns today's sales. */
  async getTopProducts(range?: DateRange): Promise<TopProductsPeriod> {
    const response = await api.get<ApiResponse<TopProduct[], TopProductsPeriod['meta']>>('/dashboard/top-products', { params: range });
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
