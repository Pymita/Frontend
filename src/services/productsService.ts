import api from './api';

export type ProductType = 'raw_material' | 'intermediate' | 'final';

export interface Product {
  id: number;
  name: string;
  description?: string;
  sku: string;
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
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

class ProductsService {
  async getAll(type?: string): Promise<Product[]> {
    const params = type ? { type } : {};
    const response = await api.get('/products', { params });
    return response.data.data;
  }

  async getById(id: number): Promise<Product> {
    const response = await api.get(`/products/${id}`);
    return response.data.data;
  }

  async create(data: Partial<Product>): Promise<Product> {
    const response = await api.post('/products', data);
    return response.data.data;
  }

  async update(id: number, data: Partial<Product>): Promise<Product> {
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
