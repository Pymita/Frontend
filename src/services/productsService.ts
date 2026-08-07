import api from './api';

export type ProductType = 'raw_material' | 'intermediate' | 'final';

export interface Product {
  id: number;
  name: string;
  description?: string;
  sku: string;
  barcode?: string | null;
  type: ProductType;
  unit: string;
  tracks_stock?: boolean;
  unit_cost?: number | null;
  sale_price?: number | null;
  category_id?: number | null;
  category?: {
    id: number;
    name: string;
  };
  current_stock?: number | null;
  minimum_stock?: number | null;
  estimated_cost?: number | null;
  active?: boolean;
  notes?: string | null;
  in_menu?: boolean;
  menu_item?: ProductMenuItem | null;
}

export interface ProductMenuItem {
  id: number;
  base_price: number;
  variant_group_id: number | null;
  preparation_time: number | null;
  available: boolean;
  active: boolean;
}

export interface ProductMenuPayload {
  base_price?: number | null;
  variant_group_id?: number | null;
  preparation_time?: number | null;
  available?: boolean;
}

export interface ProductPayload extends Partial<Product> {
  menu?: ProductMenuPayload | null;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

class ProductsService {
  async getAll(type?: string, inMenu?: boolean): Promise<Product[]> {
    const params: Record<string, string | number> = {};
    if (type) params.type = type;
    if (inMenu !== undefined) params.in_menu = inMenu ? 1 : 0;
    const response = await api.get('/products', { params });
    return response.data.data;
  }

  async getById(id: number): Promise<Product> {
    const response = await api.get(`/products/${id}`);
    return response.data.data;
  }

  async create(data: ProductPayload): Promise<Product> {
    const response = await api.post('/products', data);
    return response.data.data;
  }

  async update(id: number, data: ProductPayload): Promise<Product> {
    const response = await api.put(`/products/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  }
}

class ProductCategoriesService {
  async getAll(): Promise<Category[]> {
    const response = await api.get('/categories');
    return response.data.data;
  }

  async create(data: Partial<Category>): Promise<Category> {
    const response = await api.post('/categories', data);
    return response.data.data;
  }

  async update(id: number, data: Partial<Category>): Promise<Category> {
    const response = await api.put(`/categories/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/categories/${id}`);
  }
}

export const productsService = new ProductsService();
export const productCategoriesService = new ProductCategoriesService();
