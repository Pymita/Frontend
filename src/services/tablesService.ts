import api from './api';

export type DiningTableStatus = 'available' | 'occupied' | 'reserved';
export type DiningTableShape = 'square' | 'round' | 'rect';

export interface DiningTable {
  id: number;
  number: number;
  nickname?: string;
  capacity: number;
  status: DiningTableStatus;
  active: boolean;
  table_type?: 'dining' | 'billiard';
  hourly_rate?: number | null;
  billing_increment_minutes?: number;
  pos_x: number | null;
  pos_y: number | null;
  shape: DiningTableShape;
  zone: string | null;
  /** Only while reserved, both optional: who it is for and when they arrive (ISO instant). */
  reserved_for?: string | null;
  reserved_at?: string | null;
  latest_active_order?: {
    id: number;
    total: string | number;
    payment_status: string;
    customer_name?: string;
    time_started_at?: string | null;
    time_ended_at?: string | null;
    time_rate?: number | null;
  } | null;
}

export interface TableLayoutEntry {
  id: number;
  pos_x: number | null;
  pos_y: number | null;
  shape?: DiningTableShape;
  zone?: string | null;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const tablesService = {
  async getAll(): Promise<DiningTable[]> {
    const response = await api.get<ApiResponse<DiningTable[]>>('/tables');
    return response.data.data;
  },

  async getAvailable(): Promise<DiningTable[]> {
    const response = await api.get<ApiResponse<DiningTable[]>>('/tables/available');
    return response.data.data;
  },

  async getById(id: number): Promise<DiningTable> {
    const response = await api.get<ApiResponse<DiningTable>>(`/tables/${id}`);
    return response.data.data;
  },

  async create(data: Partial<DiningTable>): Promise<DiningTable> {
    const response = await api.post<ApiResponse<DiningTable>>('/tables', data);
    return response.data.data;
  },

  /** Crea varias mesas numeradas de forma consecutiva */
  async createBulk(data: {
    quantity: number;
    capacity?: number;
    table_type?: 'dining' | 'billiard';
    hourly_rate?: number | null;
    billing_increment_minutes?: number;
    zone?: string | null;
  }): Promise<DiningTable[]> {
    const response = await api.post<ApiResponse<DiningTable[]>>('/tables/bulk', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<DiningTable>): Promise<DiningTable> {
    const response = await api.put<ApiResponse<DiningTable>>(`/tables/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/tables/${id}`);
  },

  async saveLayout(tables: TableLayoutEntry[]): Promise<DiningTable[]> {
    const response = await api.put<ApiResponse<DiningTable[]>>('/tables/layout', { tables });
    return response.data.data;
  },

  async occupy(id: number): Promise<DiningTable> {
    const response = await api.post<ApiResponse<DiningTable>>(`/tables/${id}/occupy`);
    return response.data.data;
  },

  async release(id: number): Promise<DiningTable> {
    const response = await api.post<ApiResponse<DiningTable>>(`/tables/${id}/release`);
    return response.data.data;
  },

  /** Reserva una mesa libre; `reserved_time` es "HH:MM" y el API lo vuelve la próxima vez que llega esa hora. */
  async reserve(id: number, data: { reserved_for?: string | null; reserved_time?: string | null }): Promise<ApiResponse<DiningTable>> {
    const response = await api.post<ApiResponse<DiningTable>>(`/tables/${id}/reserve`, data);
    return response.data;
  },

  async unreserve(id: number): Promise<ApiResponse<DiningTable>> {
    const response = await api.post<ApiResponse<DiningTable>>(`/tables/${id}/unreserve`);
    return response.data;
  },
};
