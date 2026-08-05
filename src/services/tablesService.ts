import api from './api';

export type DiningTableStatus = 'available' | 'occupied' | 'reserved';

export interface DiningTable {
  id: number;
  number: number;
  nickname?: string;
  capacity: number;
  status: DiningTableStatus;
  active: boolean;
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

  async update(id: number, data: Partial<DiningTable>): Promise<DiningTable> {
    const response = await api.put<ApiResponse<DiningTable>>(`/tables/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/tables/${id}`);
  },

  async occupy(id: number): Promise<DiningTable> {
    const response = await api.post<ApiResponse<DiningTable>>(`/tables/${id}/occupy`);
    return response.data.data;
  },

  async release(id: number): Promise<DiningTable> {
    const response = await api.post<ApiResponse<DiningTable>>(`/tables/${id}/release`);
    return response.data.data;
  },
};
