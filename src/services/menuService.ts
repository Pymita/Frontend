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

  /**
   * Menú tal como lo ven los meseros (app móvil / tablet). `withHidden` suma
   * las categorías ocultas en la app: el Nuevo pedido de la web las vende.
   */
  async getMenuPreview({ withHidden = false }: { withHidden?: boolean } = {}): Promise<MenuCategoryNode[]> {
    const response = await api.get<ApiResponse<MenuCategoryNode[]>>('/menu/categories', {
      params: withHidden ? { with_hidden: 1 } : {},
    });
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

  /**
   * Deletes a category. While it holds products or menu items the API asks
   * where they go (422 with CategoryDeleteRefusal): another category's id, or
   * 'none' to leave them without category. Returns the API's message.
   */
  async delete(id: number, moveTo?: number | 'none'): Promise<string> {
    const response = await api.delete<{ message: string }>(`/categories/${id}`, {
      params: moveTo === undefined ? {} : { move_to: moveTo },
    });
    return response.data.message;
  },

  /**
   * Menú › Ordenar: las hermanas de un padre (null = las principales) en su
   * nuevo orden. Las que el menú no muestra (ocultas, vacías) conservan su lugar.
   */
  async reorder(parentId: number | null, ids: number[]): Promise<void> {
    await api.put('/categories/reorder', { parent_id: parentId, ids });
  },
};

/** 422 of deleting a category that still holds something. */
export interface CategoryDeleteRefusal {
  message: string;
  products_count: number;
  /** Menu items offered in it that are not one of those products */
  menu_items_count: number;
}

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

  /** Menú › Ordenar: los productos de una categoría en su nuevo orden (los agotados conservan su lugar). */
  async reorder(categoryId: number, ids: number[]): Promise<void> {
    await api.put('/menu-items/reorder', { category_id: categoryId, ids });
  },
};
