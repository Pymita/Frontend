import api from './api';
import type { GrupoTipo, Tipo } from './tiposService';

export interface Category {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  visible_en_app: boolean;
}

export interface ItemMenu {
  id: number;
  nombre: string;
  descripcion?: string;
  producto_final_id: number;
  producto_final?: {
    id: number;
    name: string;
    tipo: string;
  };
  precio: number;
  precio_base: number;
  precio_especifico?: number;
  usar_precio_automatico: boolean;
  imagen_url?: string;
  tiempo_preparacion?: number;
  disponible: boolean;
  activo: boolean;
  category_id: number;
  tipo_id?: number;
  grupo_tipo_id?: number;
  category?: Category;
  tipo?: Tipo;
  grupoTipo?: GrupoTipo;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    console.log('[categoriesService] Obteniendo categorías...');
    try {
      const response = await api.get<ApiResponse<Category[]>>('/categories');
      console.log('[categoriesService] Respuesta:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('[categoriesService] Error:', error);
      console.error('[categoriesService] Response:', error.response);
      throw error;
    }
  },

  async getById(id: number): Promise<Category> {
    const response = await api.get<ApiResponse<Category>>(`/categories/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Category>): Promise<Category> {
    const response = await api.post<ApiResponse<Category>>('/categories', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<Category>): Promise<Category> {
    const response = await api.put<ApiResponse<Category>>(`/categories/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/categories/${id}`);
  },
};

export const itemsMenuService = {
  async getAll(categoryId?: number): Promise<ItemMenu[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const response = await api.get<ApiResponse<ItemMenu[]>>('/items-menu', { params });
    return response.data.data;
  },

  async getById(id: number): Promise<ItemMenu> {
    const response = await api.get<ApiResponse<ItemMenu>>(`/items-menu/${id}`);
    return response.data.data;
  },

  async create(data: Partial<ItemMenu>): Promise<ItemMenu> {
    const response = await api.post<ApiResponse<ItemMenu>>('/items-menu', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<ItemMenu>): Promise<ItemMenu> {
    const response = await api.put<ApiResponse<ItemMenu>>(`/items-menu/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/items-menu/${id}`);
  },

  async toggleDisponibilidad(id: number): Promise<ItemMenu> {
    const response = await api.post<ApiResponse<ItemMenu>>(`/items-menu/${id}/toggle-disponibilidad`);
    return response.data.data;
  },
};


