import api from './api';

export interface RecipeIngredient {
  id?: number;
  product_id: number;
  product?: {
    id: number;
    name: string;
    unit: string;
    unit_cost?: number;
  };
  quantity: number;
  quantity_with_waste?: number;
  quantity_per_yield_unit?: number;
  unit: string;
  unit_cost?: number;
  total_cost?: number;
  waste_percentage?: number;
  notes?: string;
}

export interface RecipeIngredientPayload {
  id?: number;
  product_id: number;
  quantity: number;
  unit: string;
  unit_cost?: number;
  waste_percentage?: number;
  notes?: string;
}

export interface Recipe {
  id: number;
  product_id: number;
  variant_id?: number | null;
  product?: {
    id: number;
    name: string;
    type: string;
  };
  variant?: {
    id: number;
    name: string;
  } | null;
  name: string;
  description?: string;
  yield_quantity: number;
  yield_unit: string;
  preparation_time?: number;
  instructions?: string;
  ingredients: RecipeIngredient[];
  total_cost?: number;
  unit_cost?: number;
  active?: boolean;
}

export interface RecipePayload {
  product_id: number;
  variant_id?: number | null;
  name: string;
  description?: string;
  yield_quantity?: number;
  yield_unit?: string;
  preparation_time?: number;
  instructions?: string;
  ingredients: RecipeIngredientPayload[];
}

class RecipesService {
  async getAll(): Promise<Recipe[]> {
    const response = await api.get('/recipes');
    return response.data.data;
  }

  async getById(id: number): Promise<Recipe> {
    const response = await api.get(`/recipes/${id}`);
    return response.data.data;
  }

  async getByProduct(productId: number, variantId?: number | null): Promise<Recipe | null> {
    try {
      const params = variantId ? { variant_id: variantId } : {};
      const response = await api.get(`/recipes/product/${productId}`, { params });
      return response.data.data;
    } catch {
      return null;
    }
  }

  async create(data: RecipePayload): Promise<Recipe> {
    const response = await api.post('/recipes', data);
    return response.data.data;
  }

  async update(id: number, data: RecipePayload): Promise<Recipe> {
    const response = await api.put(`/recipes/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/recipes/${id}`);
  }
}

export const recipesService = new RecipesService();
