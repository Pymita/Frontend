import api from './api';
import type { VariantGroup, Variant } from './variantsService';

export interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id: number | null;
  /** Emoji corto que acompaña al nombre */
  icon?: string | null;
  image_url?: string | null;
  sort_order?: number;
  active: boolean;
  visible_in_app: boolean;
  /** Visibilidad real: false si alguna categoría padre está oculta */
  visible_effective?: boolean;
  /** 1 = raíz, 2 = subcategoría, 3 = sub-subcategoría */
  depth?: number;
  /** Ruta completa, ej. "Bebidas › Cervezas › Nacionales" */
  path?: string;
  root_id?: number;
}

/** Categoría con su subárbol (endpoint ?tree=1) */
export interface CategoryNode extends Category {
  children: CategoryNode[];
}

/** Menú público agrupado en árbol (lo que ven meseros en app/tablet) */
export interface MenuCategoryNode {
  id: number;
  name: string;
  description?: string | null;
  icon?: string | null;
  image_url?: string | null;
  items: {
    id: number;
    name: string;
    description?: string | null;
    price: number;
    image_url?: string | null;
    variant?: string | null;
    variant_group_id?: number | null;
    variant_group_name?: string | null;
  }[];
  children: MenuCategoryNode[];
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

  /** Árbol anidado de categorías */
  async getTree(): Promise<CategoryNode[]> {
    const response = await api.get<ApiResponse<CategoryNode[]>>('/categories', { params: { tree: 1 } });
    return response.data.data;
  },

  /** Menú tal como lo ven los meseros (app móvil / tablet) */
  async getMenuPreview(): Promise<MenuCategoryNode[]> {
    const response = await api.get<ApiResponse<MenuCategoryNode[]>>('/menu/categories');
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
