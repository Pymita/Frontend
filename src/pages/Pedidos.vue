<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Pedidos</h1>
            <p class="text-body-1 text-grey-darken-1">
              Gestiona los pedidos del día
            </p>
          </div>
          <div class="d-flex gap-3 align-center">
            <v-btn color="success" size="large" @click="openPedidoRapidoDialog">
              <v-icon start>mdi-cash-fast</v-icon>
              Pedido Rápido
            </v-btn>
            <v-btn-toggle v-model="filterPago" color="primary" mandatory>
              <v-btn value="all">Todos</v-btn>
              <v-btn value="pending">Pendientes</v-btn>
              <v-btn value="paid">Pagados</v-btn>
            </v-btn-toggle>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-row align="center">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="search"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar por mesa o cliente"
                  single-line
                  hide-details
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="soloHoy"
                  label="Solo hoy"
                  color="primary"
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4" class="text-right">
                <v-btn variant="text" @click="loadOrders">
                  <v-icon start>mdi-refresh</v-icon>
                  Actualizar
                </v-btn>
              </v-col>
            </v-row>
          </v-card-title>
          
          <v-data-table
            :headers="headers"
            :items="filteredOrders"
            :loading="loading"
            :search="search"
            class="elevation-0"
            item-value="id"
            show-expand
          >
            <template #item.dining_table="{ item }">
              <div class="d-flex align-center">
                <v-avatar color="primary" size="32" class="mr-2">
                  <span class="text-white text-caption">{{ item.dining_table?.number || '?' }}</span>
                </v-avatar>
                <span>{{ item.dining_table?.display_name || 'Sin mesa' }}</span>
              </div>
            </template>
            
            <template #item.status="{ item }">
              <v-chip :color="getStatusColor(item.status)" size="small">
                {{ getStatusText(item.status) }}
              </v-chip>
            </template>
            
            <template #item.payment_status="{ item }">
              <v-chip :color="getPagoColor(item.payment_status)" size="small">
                {{ getPagoText(item.payment_status).toUpperCase() }}
              </v-chip>
            </template>
            
            <template #item.total="{ item }">
              <span class="font-weight-bold text-success">
                ${{ Number(item.total || 0).toFixed(2) }}
              </span>
              <div v-if="Number(item.pending_balance) > 0" class="text-error text-caption">
                Debe: ${{ Number(item.pending_balance || 0).toFixed(2) }}
              </div>
            </template>
            
            <template #item.created_at="{ item }">
              {{ formatDate(item.created_at) }}
            </template>
            
            <template #item.actions="{ item }">
              <v-menu v-if="item.payment_status !== 'paid'">
                <template #activator="{ props }">
                  <v-btn icon size="small" variant="text" v-bind="props">
                    <v-icon>mdi-dots-vertical</v-icon>
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item @click="marcarPagado(item)">
                    <template #prepend>
                      <v-icon color="success">mdi-cash-check</v-icon>
                    </template>
                    <v-list-item-title>Marcar como pagado</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="openDiscountDialog(item)">
                    <template #prepend>
                      <v-icon color="warning">mdi-percent</v-icon>
                    </template>
                    <v-list-item-title>Aplicar descuento</v-list-item-title>
                  </v-list-item>
                  <v-list-item @click="openPagoDialog(item)">
                    <template #prepend>
                      <v-icon color="info">mdi-cash-plus</v-icon>
                    </template>
                    <v-list-item-title>Registrar pago parcial</v-list-item-title>
                  </v-list-item>
                  <v-divider />
                  <v-list-item @click="cancelarPedido(item)">
                    <template #prepend>
                      <v-icon color="error">mdi-cancel</v-icon>
                    </template>
                    <v-list-item-title>Cancelar pedido</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
              <v-chip v-else color="success" size="small" variant="flat">
                <v-icon start size="small">mdi-check</v-icon>
                Pagado
              </v-chip>
            </template>
            
            <template #expanded-row="{ columns, item }">
              <tr>
                <td :colspan="columns.length" class="pa-4 bg-grey-lighten-5">
                  <v-row>
                    <v-col cols="12" md="8">
                      <h4 class="mb-2">Productos del pedido</h4>
                      <v-table density="compact">
                        <thead>
                          <tr>
                            <th>Cantidad</th>
                            <th>Producto</th>
                            <th>Precio Unit.</th>
                            <th>Total</th>
                            <th>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr v-for="orderItem in item.items" :key="orderItem.id">
                            <td>{{ orderItem.quantity }}</td>
                            <td>
                              {{ orderItem.product_name }}
                              <span v-if="orderItem.variant" class="text-grey"> ({{ orderItem.variant }})</span>
                            </td>
                            <td>${{ Number(orderItem.unit_price || 0).toFixed(2) }}</td>
                            <td class="font-weight-bold">${{ Number(orderItem.total_price || 0).toFixed(2) }}</td>
                            <td>
                              <v-btn
                                v-if="item.payment_status !== 'paid'"
                                icon
                                size="x-small"
                                variant="text"
                                @click="openEditItemDialog(item, orderItem)"
                              >
                                <v-icon size="small">mdi-pencil</v-icon>
                              </v-btn>
                            </td>
                          </tr>
                        </tbody>
                      </v-table>
                    </v-col>
                    <v-col cols="12" md="4">
                      <v-card variant="tonal">
                        <v-card-text>
                          <div class="d-flex justify-space-between mb-2">
                            <span>Subtotal:</span>
                            <span>${{ Number(item.subtotal || 0).toFixed(2) }}</span>
                          </div>
                          <div v-if="item.discount_percentage > 0 || item.discount_amount > 0" class="d-flex justify-space-between mb-2 text-warning">
                            <span>Descuento:</span>
                            <span>-${{ (Number(item.subtotal || 0) * Number(item.discount_percentage || 0) / 100 + Number(item.discount_amount || 0)).toFixed(2) }}</span>
                          </div>
                          <v-divider class="my-2" />
                          <div class="d-flex justify-space-between font-weight-bold">
                            <span>Total:</span>
                            <span class="text-success">${{ Number(item.total || 0).toFixed(2) }}</span>
                          </div>
                          <div v-if="Number(item.amount_paid) > 0 && item.payment_status !== 'paid'" class="d-flex justify-space-between mt-2">
                            <span>Pagado:</span>
                            <span>${{ Number(item.amount_paid || 0).toFixed(2) }}</span>
                          </div>
                          <div v-if="Number(item.pending_balance) > 0" class="d-flex justify-space-between text-error font-weight-bold">
                            <span>Pendiente:</span>
                            <span>${{ Number(item.pending_balance || 0).toFixed(2) }}</span>
                          </div>
                        </v-card-text>
                      </v-card>
                      <div v-if="item.notes" class="mt-3">
                        <strong>Notas:</strong>
                        <p class="text-grey-darken-1">{{ item.notes }}</p>
                      </div>
                    </v-col>
                  </v-row>
                </td>
              </tr>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Descuento -->
    <v-dialog v-model="discountDialog" max-width="400">
      <v-card>
        <v-card-title>Aplicar Descuento</v-card-title>
        <v-card-text>
          <v-radio-group v-model="discountType" inline>
            <v-radio label="Porcentaje" value="percentage" />
            <v-radio label="Monto fijo" value="amount" />
          </v-radio-group>
          <v-text-field
            v-model.number="discountValue"
            :label="discountType === 'percentage' ? 'Porcentaje (%)' : 'Monto ($)'"
            type="number"
            min="0"
            :max="discountType === 'percentage' ? 100 : undefined"
          />
          <v-text-field
            v-model="discountReason"
            label="Motivo (opcional)"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="discountDialog = false">Cancelar</v-btn>
          <v-btn color="warning" :loading="saving" @click="applyDiscount">Aplicar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Pago Parcial -->
    <v-dialog v-model="pagoDialog" max-width="400">
      <v-card>
        <v-card-title>Registrar Pago Parcial</v-card-title>
        <v-card-text>
          <p class="mb-4">
            Saldo pendiente: <strong class="text-error">${{ Number(selectedOrder?.pending_balance || 0).toFixed(2) }}</strong>
          </p>
          <v-text-field
            v-model.number="paymentAmount"
            label="Monto a pagar"
            type="number"
            min="0"
            :max="selectedOrder?.pending_balance"
            prefix="$"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="pagoDialog = false">Cancelar</v-btn>
          <v-btn color="success" :loading="saving" @click="registrarPago">Registrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Editar Item -->
    <v-dialog v-model="editItemDialog" max-width="400">
      <v-card>
        <v-card-title>Editar Item</v-card-title>
        <v-card-text>
          <p class="mb-4 font-weight-bold">{{ selectedItem?.product_name }}</p>
          <v-text-field
            v-model.number="editItemData.quantity"
            label="Cantidad"
            type="number"
            min="1"
          />
          <v-text-field
            v-model.number="editItemData.unit_price"
            label="Precio unitario"
            type="number"
            min="0"
            step="0.01"
            prefix="$"
          />
          <v-text-field
            v-model.number="editItemData.discount"
            label="Descuento"
            type="number"
            min="0"
            step="0.01"
            prefix="$"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn color="error" variant="text" @click="eliminarItem">Eliminar</v-btn>
          <v-spacer />
          <v-btn @click="editItemDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="guardarItem">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Pedido Rápido -->
    <v-dialog v-model="pedidoRapidoDialog" max-width="500" persistent>
      <v-card>
        <v-card-title class="bg-success">
          <v-icon start>mdi-cash-fast</v-icon>
          Pedido Rápido
        </v-card-title>
        <v-card-text class="pt-4">
          <v-alert type="info" density="compact" class="mb-4">
            Registra solo el monto total. Podrás editar los detalles después.
          </v-alert>

          <v-text-field
            v-model.number="pedidoRapidoData.total"
            label="Monto Total"
            type="number"
            min="0"
            step="0.01"
            prefix="$"
            :rules="[v => v > 0 || 'Monto requerido']"
            autofocus
            required
          />

          <v-text-field
            v-model="pedidoRapidoData.customer_name"
            label="Cliente / Mesa (opcional)"
            placeholder="Ej: Mesa 5, Juan Pérez"
          />

          <v-textarea
            v-model="pedidoRapidoData.notas"
            label="Notas (opcional)"
            rows="2"
            placeholder="Detalles adicionales..."
          />

          <v-switch
            v-model="pedidoRapidoData.marcar_pagado"
            label="Marcar como pagado"
            color="success"
            hint="Si está pagado, se marcará automáticamente"
            persistent-hint
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closePedidoRapidoDialog">Cancelar</v-btn>
          <v-btn color="success" :loading="saving" @click="crearPedidoRapido">
            <v-icon start>mdi-check</v-icon>
            Crear Pedido
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ordersService, type Order, type OrderItem } from '@/services/ordersService';
import { orderStatusLabels, paymentStatusLabels, paymentStatusColors, label } from '@/utils/labels';

const orders = ref<Order[]>([]);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const filterPago = ref('all');
const soloHoy = ref(true);

const selectedOrder = ref<Order | null>(null);
const selectedItem = ref<OrderItem | null>(null);

const discountDialog = ref(false);
const discountType = ref<'percentage' | 'amount'>('percentage');
const discountValue = ref(0);
const discountReason = ref('');

const pagoDialog = ref(false);
const paymentAmount = ref(0);

const editItemDialog = ref(false);
const editItemData = ref({ quantity: 1, unit_price: 0, discount: 0 });

const pedidoRapidoDialog = ref(false);
const pedidoRapidoData = ref({
  total: 0,
  customer_name: '',
  notas: '',
  marcar_pagado: false,
});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Mesa', key: 'dining_table' },
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Estado', key: 'status' },
  { title: 'Pago', key: 'payment_status' },
  { title: 'Total', key: 'total' },
  { title: 'Fecha', key: 'created_at' },
  { title: '', key: 'actions', sortable: false },
];

const filteredOrders = computed(() => {
  if (filterPago.value === 'all') return orders.value;
  if (filterPago.value === 'pending') {
    return orders.value.filter(o => o.payment_status !== 'paid');
  }
  return orders.value.filter(o => o.payment_status === 'paid');
});

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const loadOrders = async () => {
  loading.value = true;
  try {
    orders.value = await ordersService.getAll({
      today: soloHoy.value,
    });
  } catch (error) {
    showMessage('Error al cargar pedidos', 'error');
  } finally {
    loading.value = false;
  }
};

watch(soloHoy, () => loadOrders());

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    pending: 'warning',
    preparing: 'info',
    ready: 'success',
    delivered: 'grey',
    cancelled: 'error',
  };
  return colors[status] || 'grey';
};

const getStatusText = (status: string) => label(orderStatusLabels, status) || status;

const getPagoColor = (estado: string) => paymentStatusColors[estado] || 'grey';

const getPagoText = (estado: string) => label(paymentStatusLabels, estado) || estado;

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const marcarPagado = async (order: Order) => {
  if (!confirm('¿Marcar este pedido como pagado?')) return;
  try {
    await ordersService.markPaid(order.id);
    showMessage('Pedido marcado como pagado');
    loadOrders();
  } catch (error) {
    showMessage('Error al marcar como pagado', 'error');
  }
};

const openDiscountDialog = (order: Order) => {
  selectedOrder.value = order;
  discountType.value = 'percentage';
  discountValue.value = 0;
  discountReason.value = '';
  discountDialog.value = true;
};

const applyDiscount = async () => {
  if (!selectedOrder.value || discountValue.value <= 0) return;
  saving.value = true;
  try {
    await ordersService.applyDiscount(
      selectedOrder.value.id,
      discountType.value,
      discountValue.value,
      discountReason.value || undefined,
    );
    showMessage('Descuento aplicado');
    discountDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage('Error al aplicar descuento', 'error');
  } finally {
    saving.value = false;
  }
};

const openPagoDialog = (order: Order) => {
  selectedOrder.value = order;
  paymentAmount.value = order.pending_balance;
  pagoDialog.value = true;
};

const registrarPago = async () => {
  if (!selectedOrder.value || paymentAmount.value <= 0) return;
  saving.value = true;
  try {
    await ordersService.recordPartialPayment(selectedOrder.value.id, paymentAmount.value);
    showMessage('Pago registrado');
    pagoDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage('Error al registrar pago', 'error');
  } finally {
    saving.value = false;
  }
};

const cancelarPedido = async (order: Order) => {
  if (!confirm('¿Cancelar este pedido?')) return;
  try {
    await ordersService.cancel(order.id);
    showMessage('Pedido cancelado');
    loadOrders();
  } catch (error) {
    showMessage('Error al cancelar', 'error');
  }
};

const openEditItemDialog = (order: Order, item: OrderItem) => {
  selectedOrder.value = order;
  selectedItem.value = item;
  editItemData.value = {
    quantity: item.quantity,
    unit_price: item.unit_price,
    discount: item.discount,
  };
  editItemDialog.value = true;
};

const guardarItem = async () => {
  if (!selectedOrder.value || !selectedItem.value) return;
  saving.value = true;
  try {
    await ordersService.updateItem(
      selectedOrder.value.id,
      selectedItem.value.id,
      editItemData.value,
    );
    showMessage('Item actualizado');
    editItemDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage('Error al actualizar', 'error');
  } finally {
    saving.value = false;
  }
};

const eliminarItem = async () => {
  if (!selectedOrder.value || !selectedItem.value) return;
  if (!confirm('¿Eliminar este producto del pedido?')) return;
  saving.value = true;
  try {
    await ordersService.removeItem(selectedOrder.value.id, selectedItem.value.id);
    showMessage('Item eliminado');
    editItemDialog.value = false;
    loadOrders();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  } finally {
    saving.value = false;
  }
};

// Funciones para Pedido Rápido
const openPedidoRapidoDialog = () => {
  pedidoRapidoData.value = {
    total: 0,
    customer_name: '',
    notas: '',
    marcar_pagado: false,
  };
  pedidoRapidoDialog.value = true;
};

const closePedidoRapidoDialog = () => {
  pedidoRapidoDialog.value = false;
  pedidoRapidoData.value = {
    total: 0,
    customer_name: '',
    notas: '',
    marcar_pagado: false,
  };
};

const crearPedidoRapido = async () => {
  if (!pedidoRapidoData.value.total || pedidoRapidoData.value.total <= 0) {
    showMessage('Ingresa un monto válido', 'error');
    return;
  }
  
  saving.value = true;
  try {
    const pedidoData = {
      customer_name: pedidoRapidoData.value.customer_name || 'Pedido Rápido',
      notes: pedidoRapidoData.value.notas || 'Pedido rápido - Detalles pendientes',
      items: [], // Sin items específicos
      manual_total: pedidoRapidoData.value.total,
      is_quick_order: true,
      payment_status: pedidoRapidoData.value.marcar_pagado ? 'paid' : 'pending',
    };

    await ordersService.create(pedidoData);
    showMessage('Pedido rápido creado');
    closePedidoRapidoDialog();
    loadOrders();
  } catch (error: any) {
    console.error('[Pedidos] Error al crear pedido rápido:', error);
    showMessage('Error al crear pedido: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    saving.value = false;
  }
};

onMounted(() => {
  loadOrders();
});
</script>


