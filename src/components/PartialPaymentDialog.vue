<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    @update:model-value="value => emit('update:modelValue', value)"
  >
    <v-card>
      <v-card-title>Registrar pago</v-card-title>
      <v-card-text>
        <!-- Total a pagar, lo que ya entró y el saldo, para no perder la cuenta. -->
        <v-card flat color="surface-light" class="pa-3 mb-3 tabular-nums">
          <div class="d-flex justify-space-between text-body-2">
            <span>Total a pagar:</span>
            <strong>{{ money(order?.total) }}</strong>
          </div>
          <div class="d-flex justify-space-between text-body-2 text-medium-emphasis">
            <span>Ya pagado:</span>
            <span>{{ money(order?.amount_paid) }}</span>
          </div>
          <v-divider class="my-2" />
          <div class="d-flex justify-space-between">
            <span>Saldo:</span>
            <strong class="text-error">{{ money(order?.pending_balance) }}</strong>
          </div>
        </v-card>

        <!-- Historial: cada venta lleva su factura #pedido-n; los abonos son anticipos. -->
        <v-list
          v-if="(order?.payments?.length ?? 0) > 0"
          density="compact"
          class="border rounded mb-3 py-0"
        >
          <v-list-subheader class="text-caption">Pagos registrados</v-list-subheader>
          <v-list-item v-for="pay in order!.payments!" :key="pay.id" class="px-3">
            <template #prepend>
              <v-chip
                :color="pay.kind === 'sale' ? 'success' : 'secondary'"
                size="x-small"
                label
                class="mr-2"
              >
                {{ pay.kind === 'sale' ? 'Factura' : 'Abono' }}
              </v-chip>
            </template>
            <v-list-item-title class="text-body-2">
              {{ pay.invoice_number || pay.reference || ('#' + order!.id) }}
              <span class="text-caption text-medium-emphasis"> · {{ paymentMethodLabel(pay.payment_method) }}</span>
            </v-list-item-title>
            <template #append>
              <div class="text-right">
                <strong>{{ money(pay.amount) }}</strong>
                <div v-if="Number(pay.tip) > 0" class="text-caption text-medium-emphasis">
                  propina {{ money(pay.tip) }}
                </div>
              </div>
            </template>
          </v-list-item>
        </v-list>

        <v-btn-toggle v-model="paymentMode" mandatory density="compact" color="primary" class="mb-4">
          <v-btn value="items">Por productos</v-btn>
          <v-btn value="amount">Por monto</v-btn>
        </v-btn-toggle>

        <!-- Modo por productos: dividir la cuenta -->
        <template v-if="paymentMode === 'items'">
          <p class="text-body-2 text-medium-emphasis mb-2">
            Marca lo que va a pagar este grupo. Cada cobro por productos es una
            <strong>factura de venta parcial</strong> (#{{ order?.id }}-n) y
            descuenta su inventario. Los descuentos del pedido se reparten proporcionalmente.
          </p>
          <v-table density="compact" class="mb-3">
            <tbody>
              <tr v-for="orderItem in payableItems" :key="orderItem.id">
                <td style="width: 40px">
                  <v-checkbox-btn
                    :model-value="selectedQty(orderItem) > 0"
                    @update:model-value="(checked: boolean) => togglePaymentItem(orderItem, checked)"
                  />
                </td>
                <td>
                  {{ orderItem.product_name }}
                  <span v-if="orderItem.variant" class="text-medium-emphasis"> ({{ orderItem.variant }})</span>
                  <div v-if="orderItem.paid_quantity > 0" class="text-caption text-success">
                    {{ orderItem.paid_quantity }} de {{ orderItem.quantity }} ya pagadas
                  </div>
                </td>
                <td style="width: 150px">
                  <div v-if="selectedQty(orderItem) > 0" class="d-flex align-center ga-1">
                    <v-btn
                      icon="mdi-minus"
                      size="x-small"
                      variant="tonal"
                      :disabled="selectedQty(orderItem) <= 1"
                      aria-label="Quitar una unidad del cobro" @click="adjustSelection(orderItem, -1)"
                    />
                    <span class="mx-1 font-weight-bold">{{ selectedQty(orderItem) }}</span>
                    <v-btn
                      icon="mdi-plus"
                      size="x-small"
                      variant="tonal"
                      aria-label="Sumar una unidad al cobro"
                      :disabled="selectedQty(orderItem) >= orderItem.unpaid_quantity"
                      @click="adjustSelection(orderItem, 1)"
                    />
                    <span class="text-caption text-medium-emphasis">/ {{ orderItem.unpaid_quantity }}</span>
                  </div>
                </td>
                <td class="text-right" style="width: 90px">
                  {{ money(unitPriceOf(orderItem)) }} c/u
                </td>
              </tr>
            </tbody>
          </v-table>
          <v-alert v-if="selectionCount > 0" type="info" variant="tonal" density="compact" class="mb-2">
            A cobrar por esta selección: <strong>{{ money(selectionEstimate) }}</strong>
          </v-alert>
        </template>

        <!-- Modo por monto libre -->
        <template v-else>
          <MoneyField v-model="paymentAmount" label="Monto a pagar" empty-as-zero />
          <v-alert type="info" variant="tonal" density="compact" class="mb-2">
            <template v-if="paymentAmount >= Number(order?.pending_balance ?? 0) && Number(order?.pending_balance ?? 0) > 0">
              Cierra la cuenta: factura los productos que falten y aplica los abonos.
            </template>
            <template v-else>
              Es un <strong>recibo de abono</strong> (anticipo): no genera factura ni
              descuenta inventario. Se factura al cerrar la cuenta.
            </template>
          </v-alert>
        </template>

        <v-select
          v-model="paymentMethod"
          :items="paymentMethodOptions"
          label="Medio de pago"
          density="compact"
          class="mt-2"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="emit('update:modelValue', false)">Cancelar</v-btn>
        <v-btn
          color="primary"
          :loading="saving"
          :disabled="paymentMode === 'items' ? selectionCount === 0 : !paymentAmount"
          @click="registrarPago"
        >
          Cobrar{{ paymentMode === 'items' && selectionCount > 0 ? ` ${money(selectionEstimate)}` : '' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ordersService,
  type Order,
  type OrderItem,
  type OrderPaymentMethod,
  type PartialPaymentPayload,
} from '@/services/ordersService'
import { orderPaymentMethodLabels, options } from '@/utils/labels'
import { money } from '@/utils/money'
import { errorMessage } from '@/utils/errors'
import MoneyField from './MoneyField.vue'

/**
 * Cobrar una parte de la cuenta: por productos (factura parcial que descuenta
 * inventario) o por monto (abono, sin factura). La página muestra el mensaje
 * de `paid` o `failed` y recarga su lista.
 */
const props = defineProps<{ modelValue: boolean; order: Order | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  paid: [message: string]
  failed: [message: string]
}>()

const saving = ref(false)
const paymentAmount = ref(0)
const paymentMode = ref<'items' | 'amount'>('items')
const paymentMethod = ref<OrderPaymentMethod>('cash')
// order_item_id → unidades seleccionadas para cobrar
const paymentSelection = ref<Record<number, number>>({})

const paymentMethodOptions = options(orderPaymentMethodLabels)

const paymentMethodLabel = (method?: string | null) =>
  (method ? orderPaymentMethodLabels[method as OrderPaymentMethod] : undefined) ?? method ?? ''

// Cada vez que se abre arranca limpio, con todo el saldo sugerido.
watch(
  () => props.modelValue,
  (open) => {
    if (!open || !props.order) return
    paymentAmount.value = props.order.pending_balance
    paymentMode.value = props.order.items.length > 0 ? 'items' : 'amount'
    paymentMethod.value = 'cash'
    paymentSelection.value = {}
  },
)

const payableItems = computed(() =>
  (props.order?.items ?? []).filter(i => i.unpaid_quantity > 0),
)

const selectionCount = computed(() =>
  Object.values(paymentSelection.value).reduce((sum, qty) => sum + qty, 0),
)

const unitPriceOf = (item: OrderItem) =>
  Number(item.total_price || 0) / Math.max(1, Number(item.quantity || 1))

// Estimación con el mismo prorrateo del backend (factor total/subtotal);
// el servidor calcula el valor definitivo.
const selectionEstimate = computed(() => {
  const order = props.order
  if (!order) return 0

  const itemsBase = order.items.reduce((sum, i) => sum + Number(i.total_price || 0), 0)
  if (itemsBase <= 0) return 0
  const factor = Number(order.total || 0) / itemsBase

  const base = order.items.reduce(
    (sum, i) => sum + unitPriceOf(i) * (paymentSelection.value[i.id] || 0),
    0,
  )

  const completesAll = order.items.every(
    i => i.unpaid_quantity - (paymentSelection.value[i.id] || 0) <= 0,
  )

  return completesAll
    ? Number(order.pending_balance || 0)
    : Math.min(Math.round(base * factor * 100) / 100, Number(order.pending_balance || 0))
})

const selectedQty = (item: OrderItem) => paymentSelection.value[item.id] ?? 0

const adjustSelection = (item: OrderItem, delta: number) => {
  const next = selectedQty(item) + delta
  paymentSelection.value[item.id] = Math.min(Math.max(next, 1), item.unpaid_quantity)
}

const togglePaymentItem = (item: OrderItem, checked: boolean) => {
  if (checked) {
    paymentSelection.value[item.id] = item.unpaid_quantity
  } else {
    delete paymentSelection.value[item.id]
  }
}

const registrarPago = async () => {
  if (!props.order) return

  const payload: PartialPaymentPayload = { payment_method: paymentMethod.value }

  if (paymentMode.value === 'items') {
    if (selectionCount.value === 0) return
    payload.items = Object.entries(paymentSelection.value)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ order_item_id: Number(id), quantity: qty }))
  } else {
    if (!paymentAmount.value || paymentAmount.value <= 0) return
    payload.amount = paymentAmount.value
  }

  saving.value = true
  try {
    const updated = await ordersService.recordPartialPayment(props.order.id, payload)
    emit('update:modelValue', false)
    emit(
      'paid',
      updated.payment_status === 'paid'
        ? 'Cuenta saldada: pedido pagado por completo'
        : (payload.items ? 'Factura parcial registrada' : 'Abono registrado'),
    )
  } catch (error) {
    emit('failed', errorMessage(error, 'No fue posible registrar el pago. Inténtalo de nuevo.'))
  } finally {
    saving.value = false
  }
}
</script>
