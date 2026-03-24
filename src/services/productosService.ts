import api from './api';

export interface Product {
  id: number;
  name: string;
  description?: string;
  sku: string;
  tipo: 'materia_prima' | 'intermedio' | 'final';
  unidad: string;
  maneja_stock?: boolean;
  costo_unitario?: number;
  precio_venta?: number;
  category_id?: number;
  category?: {
    id: number;
    name: string;
  };
  stock_actual?: number;
  stock_minimo?: number;
  costo_estimado?: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
}

class ProductosService {
  async getAll(tipo?: string): Promise<Product[]> {
    const params = tipo ? { tipo } : {};
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

class CategoriesProductosService {
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

export const productosService = new ProductosService();
export const categoriesProductosService = new CategoriesProductosService();
