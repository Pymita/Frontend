import api from './api';

export interface Mesa {
  id: number;
  numero: number;
  pseudonimo?: string;
  capacidad: number;
  estado: 'disponible' | 'ocupada' | 'reservada';
  activa: boolean;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const mesasService = {
  async getAll(): Promise<Mesa[]> {
    const response = await api.get<ApiResponse<Mesa[]>>('/mesas');
    return response.data.data;
  },

  async getById(id: number): Promise<Mesa> {
    const response = await api.get<ApiResponse<Mesa>>(`/mesas/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Mesa>): Promise<Mesa> {
    const response = await api.post<ApiResponse<Mesa>>('/mesas', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<Mesa>): Promise<Mesa> {
    const response = await api.put<ApiResponse<Mesa>>(`/mesas/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/mesas/${id}`);
  },

  async ocupar(id: number): Promise<Mesa> {
    const response = await api.post<ApiResponse<Mesa>>(`/mesas/${id}/ocupar`);
    return response.data.data;
  },

  async liberar(id: number): Promise<Mesa> {
    const response = await api.post<ApiResponse<Mesa>>(`/mesas/${id}/liberar`);
    return response.data.data;
  },
};

