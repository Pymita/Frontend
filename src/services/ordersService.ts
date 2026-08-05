import api from './api';

export type PaymentStatus = 'pending' | 'paid' | 'partial';
export type OrderItemStatus = 'pending' | 'preparing' | 'ready' | 'delivered';

export interface OrderItem {
  id: number;
  menu_item_id?: number | null;
  variant_id?: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  original_price?: number;
  discount: number;
  total_price: number;
  special_instructions?: string;
  applied_modifiers?: any[] | null;
  item_status: OrderItemStatus;
  variant?: string | null;
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
  items: OrderItem[];
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

  async markPaid(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/pay`);
    return response.data.data;
  },

  async recordPartialPayment(id: number, amount: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/partial-payment`, { amount });
    return response.data.data;
  },

  async cancel(id: number): Promise<Order> {
    const response = await api.post<ApiResponse<Order>>(`/orders/${id}/cancel`);
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
