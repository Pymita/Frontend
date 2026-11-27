import api from './api';
import type { PageQuery, PaginatedResponse } from '@/types/api';
import { downloadFile } from './billingService';

export type ProductType = 'raw_material' | 'intermediate' | 'final';

export interface Product {
  id: number;
  name: string;
  description?: string;
  sku: string;
  barcode?: string | null;
  image_url?: string | null;
  type: ProductType;
  unit: string;
  /** Sold in fractions of `unit` (1,375 kg): order quantities take up to three decimals. */
  sold_by_fraction?: boolean;
  tracks_stock?: boolean;
  /** "Permite ventas en rojo": may sell past the kardex balance (only with tracks_stock) */
  allows_negative_stock?: boolean;
  unit_cost?: number | null;
  sale_price?: number | null;
  /** Its first tax and the sum of its percentages, as older readers keep reading them */
  tax_id?: number | null;
  tax_rate?: number | null;
  /** Every tax it carries (IVA, impoconsumo, IBUA…); sending it wins over `tax_id` */
  tax_ids?: number[];
  taxes?: { id: number; name: string; kind: string; calculation: 'percentage' | 'per_unit'; rate: number; amount: number }[];
  /** null: without category, so out of the waiter app's menu until it gets one */
  category_id?: number | null;
  category?: {
    id: number;
    name: string;
  } | null;
  current_stock?: number | null;
  minimum_stock?: number | null;
  estimated_cost?: number | null;
  active?: boolean;
  notes?: string | null;
  in_menu?: boolean;
  menu_item?: ProductMenuItem | null;
  /** A final product sold at its own price whose components leave the kardex when it sells */
  is_combo?: boolean;
  /** Only on a combo: what one combo takes, each at what it costs today */
  components?: ProductComponent[];
  /** Its price in the lists that sell it at another price (the rest: the base price) */
  price_list_prices?: ProductListPrice[];
}

export interface ProductListPrice {
  price_list_id: number;
  price: number | null;
}

export interface ProductComponent {
  product_id: number;
  name: string | null;
  type: ProductType | null;
  unit: string;
  quantity: number;
  /** One unit's cost today: its recipe per unit, or its average */
  unit_cost: number;
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

export interface ProductPayload extends Omit<Partial<Product>, 'components'> {
  menu?: ProductMenuPayload | null;
  /** Real date of the initial balance (backdatable, shows in the kardex) */
  initial_stock_date?: string | null;
  /** A combo's components; replaces the ones it had */
  components?: { product_id: number; quantity: number }[];
  /** Its price in each list; null takes it back to the base price */
  price_list_prices?: ProductListPrice[];
}

export interface StockAdjustmentPayload {
  quantity_change: number;
  unit_cost?: number | null;
  /** Reason, recorded in the kardex entry */
  notes: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  parent_id?: number | null;
  /** Ruta completa, ej. "Bebidas › Cervezas › Nacionales" */
  path?: string;
  depth?: number;
}

class ProductsService {
  async getAll(type?: string, inMenu?: boolean): Promise<Product[]> {
    const params: Record<string, string | number> = {};
    if (type) params.type = type;
    if (inMenu !== undefined) params.in_menu = inMenu ? 1 : 0;
    const response = await api.get('/products', { params });
    return response.data.data;
  }

  /** Una página de la tabla de productos (búsqueda por nombre, SKU o código en `q`). */
  async getPage(
    query: PageQuery & { type?: string; category_id?: number | 'none'; in_menu?: 0 | 1 },
  ): Promise<PaginatedResponse<Product>> {
    const response = await api.get<PaginatedResponse<Product>>('/products', { params: query });
    return response.data;
  }

  async getById(id: number): Promise<Product> {
    const response = await api.get(`/products/${id}`);
    return response.data.data;
  }

  async create(data: ProductPayload): Promise<Product> {
    const response = await api.post('/products', data);
    return response.data.data;
  }

  /** Única vía manual de mover stock: queda como ajuste (AJ) en el kardex. */
  async adjustStock(id: number, data: StockAdjustmentPayload): Promise<Product> {
    const response = await api.post(`/products/${id}/stock-adjustment`, data);
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

/** Another price for the same products, for some customers or segments (Productos › Listas de precios). */
export interface PriceList {
  id: number;
  name: string;
  /** Who it is for, in the owner's words */
  description: string | null;
  /** Inactive: ignored, its customers buy at the next level's price */
  active: boolean;
  items_count: number;
  customers_count: number;
  segments_count: number;
}

/** A final product in a list: `price` null sells it at `base_price` (the menu's, else the sale price). */
export interface PriceListRow {
  product_id: number;
  sku: string | null;
  name: string;
  unit: string | null;
  base_price: number;
  price: number | null;
}

export type PriceListPayload = Partial<Pick<PriceList, 'name' | 'description' | 'active'>>;

export const priceListsService = {
  async getAll(): Promise<PriceList[]> {
    const response = await api.get('/price-lists');
    return response.data.data;
  },

  async create(data: PriceListPayload): Promise<{ data: PriceList; message: string }> {
    const response = await api.post('/price-lists', data);
    return { data: response.data.data, message: response.data.message ?? '' };
  },

  async update(id: number, data: PriceListPayload): Promise<{ data: PriceList; message: string }> {
    const response = await api.put(`/price-lists/${id}`, data);
    return { data: response.data.data, message: response.data.message ?? '' };
  },

  async delete(id: number): Promise<string> {
    const response = await api.delete(`/price-lists/${id}`);
    return response.data.message ?? '';
  },

  async getItems(id: number): Promise<PriceListRow[]> {
    const response = await api.get(`/price-lists/${id}/items`);
    return response.data.data;
  },

  /** `price` null takes the product back to its base price. */
  async saveItems(id: number, items: { product_id: number; price: number | null }[]): Promise<{ data: PriceList; message: string }> {
    const response = await api.put(`/price-lists/${id}/items`, { items });
    return { data: response.data.data, message: response.data.message ?? '' };
  },

  async exportExcel(list: PriceList): Promise<void> {
    await downloadFile(`/price-lists/${list.id}/export`, `lista_precios_${list.name}.xlsx`);
  },

  async importExcel(id: number, file: File): Promise<{ data: PriceList; message: string }> {
    const form = new FormData();
    form.append('file', file);
    const response = await api.post(`/price-lists/${id}/import`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { data: response.data.data, message: response.data.message ?? '' };
  },
};

export const productsService = new ProductsService();
export const productCategoriesService = new ProductCategoriesService();
