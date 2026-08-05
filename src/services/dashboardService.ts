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
  sold: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  current_stock: number;
  minimum_stock: number;
  unit: string;
}

export interface SalesWeekDay {
  date: string;
  day: string;
  total: number;
  orders_count: number;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const response = await api.get<ApiResponse<DashboardStats>>('/dashboard/stats');
    return response.data.data;
  },

  async getTopProducts(): Promise<TopProduct[]> {
    const response = await api.get<ApiResponse<TopProduct[]>>('/dashboard/top-products');
    return response.data.data;
  },

  async getLowStock(): Promise<LowStockProduct[]> {
    const response = await api.get<ApiResponse<LowStockProduct[]>>('/dashboard/low-stock');
    return response.data.data;
  },

  async getSalesWeek(): Promise<SalesWeekDay[]> {
    const response = await api.get<ApiResponse<SalesWeekDay[]>>('/dashboard/sales-week');
    return response.data.data;
  },
};
