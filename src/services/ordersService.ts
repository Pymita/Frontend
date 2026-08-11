import api from './api';

export type PaymentStatus = 'pending' | 'paid' | 'partial';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

export type OrderPaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'transfer' | 'other';

export interface OrderPayment {
  id: number;
  amount: number;
  payment_method: OrderPaymentMethod;
  items: { order_item_id: number; quantity: number }[] | null;
  created_at: string;
}

export interface PartialPaymentPayload {
  amount?: number;
  items?: { order_item_id: number; quantity: number }[];
  payment_method?: OrderPaymentMethod;
}

export interface OrderItem {
  id: number;
  menu_item_id?: number | null;
  variant_id?: number | null;
  product_name: string;
  quantity: number;
  paid_quantity: number;
  unpaid_quantity: number;
  unit_price: number;
  original_price?: number;
  discount: number;
  total_price: number;
  special_instructions?: string;
  applied_modifiers?: any[] | null;
  item_status: OrderItemStatus;
  variant?: string | null;
}

export interface OrderTime {
  started_at: string;
  ended_at: string | null;
  running: boolean;
  /** Minutos acordados; null = el reloj cuenta hacia adelante */
  planned_minutes: number | null;
  /** Minutos restantes (negativo si se pasaron del acordado) */
  remaining_minutes: number | null;
  rate: number;
  increment_minutes: number;
  minutes_billed: number | null;
  amount: number;
  current_amount: number;
}

export interface Order {
  id: number;
  dining_table: {
    id: number;
    number: number;
    display_name: string;
  } | null;
  dining_table_id?: number | null;
  customer_name: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  payment_status: PaymentStatus;
  subtotal: number;
  discount_percentage: number;
  discount_amount: number;
  discount_reason?: string;
  total: number;
  amount_paid: number;
  pending_balance: number;
  notes?: string;
  time?: OrderTime | null;
  items: OrderItem[];
  payments?: OrderPayment[] | null;
  created_at: string;
  paid_at?: string;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

interface OrderFilters {
  active?: boolean;
  pending_payment?: boolean;
  today?: boolean;
  status?: string;
  payment_status?: string;
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

  async applyDiscount(id: number, type: 'percentage' | 'amount', value: number, reason?: string): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/discount`, {
      type,
      value,
      reason,
    });
    return response.data.data;
  },

  async markPaid(id: number, paymentMethod?: OrderPaymentMethod): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/pay`, {
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
    });
    return response.data.data;
  },

  async recordPartialPayment(id: number, payload: PartialPaymentPayload): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/partial-payment`, payload);
    return response.data.data;
  },

  async cancel(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/cancel`);
    return response.data.data;
  },

  /** Revertir un cobro (solo admin): exige motivo y queda en las notas */
  async revertPayment(id: number, reason: string): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/revert-payment`, { reason });
    return response.data.data;
  },

  /** Billar: detener el tiempo sin cerrar el pedido */
  async stopTime(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/stop-time`);
    return response.data.data;
  },

  /** Billar: corregir las horas (solo admin) */
  async updateTime(id: number, payload: { time_started_at: string; time_ended_at?: string | null }): Promise<Order> {
    const response = await api.put<ApiResponse<Order>>(`/orders/${id}/time`, payload);
    return response.data.data;
  },

  async updateItem(orderId: number, itemId: number, data: {
    quantity?: number;
    unit_price?: number;
    discount?: number;
  }): Promise<Order> {
    const response = await api.put<ApiResponse<Order>>(`/orders/${orderId}/items/${itemId}`, data);
    return response.data.data;
  },

  async removeItem(orderId: number, itemId: number): Promise<Order> {
    const response = await api.delete<ApiResponse<Order>>(`/orders/${orderId}/items/${itemId}`);
    return response.data.data;
  },
};
