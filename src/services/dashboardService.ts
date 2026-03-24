import api from './api';

export interface DashboardStats {
  pedidos_hoy: number;
  ventas_hoy: number;
  pedidos_mes: number;
  ventas_mes: number;
  productos_activos: number;
  stock_bajo: number;
}

export interface TopProduct {
  name: string;
  sold: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  stock: number;
  stock_minimo: number;
  unidad: string;
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
