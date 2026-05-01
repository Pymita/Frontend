import api from './api';

export interface RecetaItem {
  id?: number;
  producto_id: number;
  producto?: {
    id: number;
    name: string;
    unidad: string;
    costo_unitario?: number;
  };
  cantidad: number;
  cantidad_con_desperdicio?: number;
  cantidad_por_unidad_producida?: number;
  unidad: string;
  costo_unitario?: number;
  costo_total?: number;
  desperdicio_porcentaje?: number;
}

export interface RecetaItemPayload {
  id?: number;
  producto_id: number;
  cantidad: number;
  unidad: string;
  costo_unitario?: number;
  desperdicio_porcentaje?: number;
}

export interface Receta {
  id: number;
  producto_id: number;
  tipo_id?: number | null;
  producto?: {
    id: number;
    name: string;
    tipo: string;
  };
  tipo?: {
    id: number;
    nombre: string;
  } | null;
  nombre: string;
  descripcion?: string;
  cantidad_producida: number;
  unidad_producida: string;
  tiempo_preparacion?: number;
  instrucciones?: string;
  items: RecetaItem[];
  costo_total?: number;
  costo_unitario?: number;
}

export interface RecetaPayload {
  producto_id: number;
  tipo_id?: number | null;
  nombre: string;
  descripcion?: string;
  cantidad_producida?: number;
  unidad_producida?: string;
  tiempo_preparacion?: number;
  instrucciones?: string;
  items: RecetaItemPayload[];
}

class RecetasService {
  async getAll(): Promise<Receta[]> {
    const response = await api.get('/recetas');
    return response.data.data;
  }

  async getById(id: number): Promise<Receta> {
    const response = await api.get(`/recetas/${id}`);
    return response.data.data;
  }

  async getByProducto(productId: number, tipoId?: number | null): Promise<Receta | null> {
    try {
      const params = tipoId ? { tipo_id: tipoId } : {};
      const response = await api.get(`/recetas/producto/${productId}`, { params });
      return response.data.data;
    } catch {
      return null;
    }
  }

  async create(data: RecetaPayload): Promise<Receta> {
    const response = await api.post('/recetas', data);
    return response.data.data;
  }

  async update(id: number, data: RecetaPayload): Promise<Receta> {
    const response = await api.put(`/recetas/${id}`, data);
    return response.data.data;
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/recetas/${id}`);
  }

  async addItem(recetaId: number, item: RecetaItemPayload): Promise<Receta> {
    const response = await api.post(`/recetas/${recetaId}/items`, item);
    return response.data.data;
  }

  async updateItem(recetaId: number, itemId: number, item: RecetaItemPayload): Promise<Receta> {
    const response = await api.put(`/recetas/${recetaId}/items/${itemId}`, item);
    return response.data.data;
  }

  async deleteItem(recetaId: number, itemId: number): Promise<Receta> {
    const response = await api.delete(`/recetas/${recetaId}/items/${itemId}`);
    return response.data.data;
  }
}

export const recetasService = new RecetasService();
