import api from './api';

export interface VariantGroup {
  id: number;
  name: string;
  description?: string;
  active: boolean;
  variants?: Variant[];
}

export interface Variant {
  id: number;
  name: string;
  description?: string;
  price_difference: number;
  price_multiplier: number;
  quantity_multiplier?: number;
  sort_order: number;
  variant_group_id: number;
  active: boolean;
  variant_group?: VariantGroup;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const variantGroupsService = {
  async getAll(): Promise<VariantGroup[]> {
    const response = await api.get<ApiResponse<VariantGroup[]>>('/variant-groups');
    return response.data.data;
  },

  async getById(id: number): Promise<VariantGroup> {
    const response = await api.get<ApiResponse<VariantGroup>>(`/variant-groups/${id}`);
    return response.data.data;
  },

  async create(data: Partial<VariantGroup>): Promise<VariantGroup> {
    const response = await api.post<ApiResponse<VariantGroup>>('/variant-groups', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<VariantGroup>): Promise<VariantGroup> {
    const response = await api.put<ApiResponse<VariantGroup>>(`/variant-groups/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/variant-groups/${id}`);
  },
};

export const variantsService = {
  async getAll(variantGroupId?: number): Promise<Variant[]> {
    const params = variantGroupId ? { variant_group_id: variantGroupId } : {};
    const response = await api.get<ApiResponse<Variant[]>>('/variants', { params });
    return response.data.data;
  },

  async getById(id: number): Promise<Variant> {
    const response = await api.get<ApiResponse<Variant>>(`/variants/${id}`);
    return response.data.data;
  },

  async create(data: Partial<Variant>): Promise<Variant> {
    const response = await api.post<ApiResponse<Variant>>('/variants', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<Variant>): Promise<Variant> {
    const response = await api.put<ApiResponse<Variant>>(`/variants/${id}`, data);
    return response.data.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/variants/${id}`);
  },
};
