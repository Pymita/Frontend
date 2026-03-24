import api from './api';

export interface OrderItem {
  id: number;
  nombre: string;
  quantity: number;
  unit_price: number;
  precio_original?: number;
  descuento: number;
  total_price: number;
  special_instructions?: string;
  estado_item: 'pendiente' | 'preparando' | 'listo' | 'entregado';
  tipo?: string;
}

export interface Order {
  id: number;
  mesa: {
    id: number;
    numero: number;
    nombre: string;
  } | null;
  customer_name: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  estado_pago: 'pendiente' | 'pagado' | 'parcial';
  subtotal: number;
  descuento_porcentaje: number;
  descuento_monto: number;
  motivo_descuento?: string;
  total: number;
  monto_pagado: number;
  saldo_pendiente: number;
  notes?: string;
  items: OrderItem[];
  created_at: string;
  paid_at?: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

interface OrderFilters {
  activos?: boolean;
  pendientes_pago?: boolean;
  hoy?: boolean;
  status?: string;
  estado_pago?: string;
}

export const ordersService = {
  async getAll(filters?: OrderFilters): Promise<Order[]> {
    const response = await api.get<ApiResponse<Order[]>>('/orders', { params: filters });
    return response.data.data;
  },

  async getById(id: number): Promise<Order> {
    const response = await api.get<ApiResponse<Order>>(`/orders/${id}`);
    return response.data.data;
  },

  async create(data: any): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>('/orders', data);
    return response.data.data;
  },

  async update(id: number, data: Partial<Order>): Promise<Order> {
    const response = await api.put<ApiResponse<Order>>(`/orders/${id}`, data);
    return response.data.data;
  },

  async aplicarDescuento(id: number, tipo: 'porcentaje' | 'monto', valor: number, motivo?: string): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/descuento`, {
      tipo,
      valor,
      motivo,
    });
    return response.data.data;
  },

  async marcarPagado(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/pagar`);
    return response.data.data;
  },

  async pagoParcial(id: number, monto: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/pago-parcial`, { monto });
    return response.data.data;
  },

  async cancelar(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/cancelar`);
    return response.data.data;
  },

  async updateItem(orderId: number, itemId: number, data: {
    quantity?: number;
    unit_price?: number;
    descuento?: number;
  }): Promise<Order> {
    const response = await api.put<ApiResponse<Order>>(`/orders/${orderId}/items/${itemId}`, data);
    return response.data.data;
  },

  async removeItem(orderId: number, itemId: number): Promise<Order> {
    const response = await api.delete<ApiResponse<Order>>(`/orders/${orderId}/items/${itemId}`);
    return response.data.data;
  },
};


