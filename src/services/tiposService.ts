import api from './api';

export interface GrupoTipo {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
  tipos?: Tipo[];
}

export interface Tipo {
  id: number;
  nombre: string;
  descripcion?: string;
  diferencia_precio: number;
  multiplicador_precio: number;
  orden: number;
  grupo_tipo_id: number;
  activo: boolean;
  grupoTipo?: GrupoTipo;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const grupoTiposService = {
  async getAll(): Promise<GrupoTipo[]> {
    const response = await api.get<ApiResponse<GrupoTipo[]>>('/grupo-tipos');
    return response.data.data;
  },

  async getById(id: number): Promise<GrupoTipo> {
    const response = await api.get<ApiResponse<GrupoTipo>>(`/grupo-tipos/${id}`);
    return response.data.data;
  },

  async create(data: Partial<GrupoTipo>): Promise<GrupoTipo> {
    const response = await api.post<ApiResponse<GrupoTipo>>('/grupo-tipos', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<GrupoTipo>): Promise<GrupoTipo> {
    const response = await api.put<ApiResponse<GrupoTipo>>(`/grupo-tipos/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/grupo-tipos/${id}`);
  },
};

export const tiposService = {
  async getAll(grupoTipoId?: number): Promise<Tipo[]> {
    const params = grupoTipoId ? { grupo_tipo_id: grupoTipoId } : {};
    const response = await api.get<ApiResponse<Tipo[]>>('/tipos', { params });
    return response.data.data;
  },

  async getById(id: number): Promise<Tipo> {
    const response = await api.get<ApiResponse<Tipo>>(`/tipos/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Tipo>): Promise<Tipo> {
    const response = await api.post<ApiResponse<Tipo>>('/tipos', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<Tipo>): Promise<Tipo> {
    const response = await api.put<ApiResponse<Tipo>>(`/tipos/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/tipos/${id}`);
  },
};


