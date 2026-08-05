import api from './api';
import type { VariantGroup, Variant } from './variantsService';

export interface Category {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  visible_in_app: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  description?: string;
  final_product_id: number | null;
  final_product?: {
    id: number;
    name: string;
    type: string;
  };
  base_price: number;
  custom_price?: number | null;
  use_automatic_price: boolean;
  final_price?: number;
  estimated_cost?: number | null;
  image_url?: string | null;
  preparation_time?: number | null;
  available: boolean;
  active: boolean;
  sort_order?: number;
  category_id: number | null;
  variant_id?: number | null;
  variant_group_id?: number | null;
  category?: Category;
  variant?: Variant;
  variant_group?: VariantGroup;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const categoriesService = {
  async getAll(): Promise<Category[]> {
    const response = await api.get<ApiResponse<Category[]>>('/categories');
    return response.data.data;
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

export const menuItemsService = {
  async getAll(categoryId?: number): Promise<MenuItem[]> {
    const params = categoryId ? { category_id: categoryId } : {};
    const response = await api.get<ApiResponse<MenuItem[]>>('/menu-items', { params });
    return response.data.data;
  },

  async getById(id: number): Promise<MenuItem> {
    const response = await api.get<ApiResponse<MenuItem>>(`/menu-items/${id}`);
    return response.data.data;
  },

  async create(data: Partial<MenuItem>): Promise<MenuItem> {
    const response = await api.post<ApiResponse<MenuItem>>('/menu-items', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<MenuItem>): Promise<MenuItem> {
    const response = await api.put<ApiResponse<MenuItem>>(`/menu-items/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/menu-items/${id}`);
  },

  async toggleAvailability(id: number): Promise<MenuItem> {
    const response = await api.post<ApiResponse<MenuItem>>(`/menu-items/${id}/toggle-availability`);
    return response.data.data;
  },
};
