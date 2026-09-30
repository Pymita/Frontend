<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-2">
          <div>
            <h1 class="text-h4">Ventas</h1>
            <p class="text-body-1 text-medium-emphasis">
              Pedidos pagados: cuánto se ha vendido, con qué método y por quién
            </p>
          </div>
          <!-- El tooltip va sobre un span: un botón deshabilitado no emite
               eventos de mouse y el usuario no sabría por qué está apagado. -->
          <v-tooltip location="bottom" max-width="300" :text="exportHint">
            <template #activator="{ props: tooltip }">
              <span v-bind="tooltip" class="d-inline-flex">
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-microsoft-excel"
                  :loading="exporting"
                  :disabled="!canExport"
                  @click="exportExcel"
                >
                  Descargar Excel
                </v-btn>
              </span>
            </template>
          </v-tooltip>
        </div>
      </v-col>
    </v-row>

    <!-- Totales del conjunto filtrado completo (la tabla puede estar recortada) -->
    <v-row dense>
      <v-col cols="12" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Total vendido</div>
          <div class="text-h5 font-weight-bold tabular-nums">
            ${{ (report?.summary.total ?? 0).toLocaleString('es-CO') }}
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Ventas</div>
          <div class="text-h5 font-weight-bold">{{ report?.summary.sales_count ?? 0 }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Propinas</div>
          <div class="text-h5 font-weight-bold">
            ${{ (report?.summary.tips ?? 0).toLocaleString('es-CO') }}
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="methodBreakdown.length" dense class="mb-1">
      <v-col cols="12">
        <v-chip
          v-for="entry in methodBreakdown"
          :key="entry.method"
          class="mr-2 mb-1"
          size="small"
          variant="tonal"
          color="primary"
        >
          {{ entry.label }}: ${{ entry.amount.toLocaleString('es-CO') }}
        </v-chip>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-row dense>
      <v-col cols="6" md="2">
        <DateField v-model="filters.from" label="Desde" density="compact" hide-details />
      </v-col>
      <v-col cols="6" md="2">
        <DateField v-model="filters.to" label="Hasta" density="compact" hide-details />
      </v-col>
      <v-col cols="6" md="2">
        <v-select
          v-model="filters.payment_method"
          :items="methodOptions"
          label="Método de pago"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="6" md="3">
        <v-select
          v-model="filters.user_id"
          :items="waiterOptions"
          label="Mesero"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field
          v-model="filters.q"
          label="Buscar factura o cliente"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
        />
      </v-col>
    </v-row>

    <!-- Tres lecturas del mismo rango: venta por venta, qué se vendió y qué dejó cada mesa. -->
    <v-row dense class="mt-1">
      <v-col cols="12">
        <v-btn-toggle v-model="view" mandatory color="primary" density="comfortable">
          <v-btn value="sales" prepend-icon="mdi-receipt-text">Ventas</v-btn>
          <v-btn value="products" prepend-icon="mdi-food">Por producto</v-btn>
          <v-btn value="tables" prepend-icon="mdi-table-furniture">Por mesa</v-btn>
          <v-btn value="cash" prepend-icon="mdi-cash-register">Cierres de caja</v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>

    <v-row v-if="view === 'cash'">
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="cashHeaders"
            :items="cashSessions"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
            :items-per-page="25"
          >
            <template #item.opened_at="{ item }">
              {{ formatDate(item.opened_at) }}
              <div class="text-caption text-medium-emphasis">{{ item.opened_by || '—' }}</div>
            </template>
            <template #item.closed_at="{ item }">
              <template v-if="item.closed_at">
                {{ formatDate(item.closed_at) }}
                <div class="text-caption text-medium-emphasis">{{ item.closed_by || '—' }}</div>
              </template>
              <v-chip v-else size="small" color="info" variant="tonal">Abierta</v-chip>
            </template>
            <template #item.opening_amount="{ item }">{{ money(item.opening_amount) }}</template>
            <template #item.methods="{ item }">
              <span v-for="entry in collectedByMethod(item)" :key="entry.method" class="d-block text-caption">
                {{ entry.label }}: {{ money(entry.amount) }}
              </span>
            </template>
            <template #item.expected_cash="{ item }">{{ money(item.expected_cash) }}</template>
            <template #item.counted_cash="{ item }">{{ item.counted_cash === null ? '—' : money(item.counted_cash) }}</template>
            <template #item.difference="{ item }">
              <span v-if="item.difference === null" class="text-medium-emphasis">—</span>
              <span v-else :class="differenceClass(item.difference)" class="font-weight-bold">
                {{ differenceLabel(item.difference) }}
              </span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay cierres de caja en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="view === 'products'">
      <v-col cols="12">
        <v-card>
          <v-card-text class="d-flex flex-wrap ga-4 pb-0">
            <div>
              <div class="text-caption text-medium-emphasis">Unidades vendidas</div>
              <div class="text-h6">{{ productReport?.summary.quantity ?? 0 }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Neto vendido</div>
              <div class="text-h6 tabular-nums">{{ money(productReport?.summary.net) }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Ganancia (neto - costo)</div>
              <div class="text-h6" :class="(productReport?.summary.profit ?? 0) >= 0 ? 'text-success' : 'text-error'">
                {{ money(productReport?.summary.profit) }}
              </div>
            </div>
          </v-card-text>
          <v-data-table
            :headers="productHeaders"
            :items="productReport?.products ?? []"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
            :items-per-page="25"
          >
            <template #item.category="{ item }">{{ item.category || '—' }}</template>
            <template #item.gross="{ item }">{{ money(item.gross) }}</template>
            <template #item.net="{ item }">
              <span class="font-weight-bold">{{ money(item.net) }}</span>
            </template>
            <template #item.cost="{ item }">{{ money(item.cost) }}</template>
            <template #item.profit="{ item }">
              <span :class="item.profit >= 0 ? 'text-success' : 'text-error'">{{ money(item.profit) }}</span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay ventas en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="view === 'tables'">
      <v-col cols="12">
        <v-card>
          <v-card-text class="d-flex flex-wrap ga-4 pb-0">
            <div>
              <div class="text-caption text-medium-emphasis">Ventas</div>
              <div class="text-h6">{{ tableReport?.summary.sales_count ?? 0 }}</div>
            </div>
            <div v-if="hasTimeBilling">
              <div class="text-caption text-medium-emphasis">Tiempo de billar</div>
              <div class="text-h6">{{ money(tableReport?.summary.time_total) }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Total</div>
              <div class="text-h6 tabular-nums">{{ money(tableReport?.summary.total) }}</div>
            </div>
          </v-card-text>
          <v-data-table
            :headers="tableHeaders"
            :items="tableReport?.tables ?? []"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
            :items-per-page="25"
          >
            <template #item.name="{ item }">
              <v-icon v-if="item.table_type === 'billiard'" size="small" class="mr-1">mdi-billiards</v-icon>
              {{ item.name }}
            </template>
            <template #item.products_total="{ item }">{{ money(item.products_total) }}</template>
            <template #item.time_total="{ item }">
              <template v-if="item.time_minutes > 0">
                {{ money(item.time_total) }}
                <span class="text-caption text-medium-emphasis">({{ formatMinutes(item.time_minutes) }})</span>
              </template>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.tips="{ item }">{{ item.tips ? money(item.tips) : '—' }}</template>
            <template #item.total="{ item }">
              <span class="font-weight-bold">{{ money(item.total) }}</span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay ventas en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-alert v-if="report?.truncated" type="info" variant="tonal" density="compact" class="ma-2 mb-0">
            Se muestran las primeras {{ report.sales.length }} ventas; los totales sí cubren todo el filtro.
            Acota las fechas o descarga el Excel para ver el detalle completo.
          </v-alert>
          <v-data-table
            :headers="headers"
            :items="report?.sales ?? []"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
          >
            <template #item.invoice_number="{ item }">
              <v-chip
                size="small"
                variant="tonal"
                :color="item.invoice_number ? 'primary' : 'secondary'"
                :title="item.invoice_number ? 'Factura con consecutivo DIAN' : 'Sin resolución DIAN: se identifica con el número del pedido'"
              >
                {{ item.invoice_number || `Pedido #${item.id}` }}
              </v-chip>
            </template>
            <template #item.customer_name="{ item }">
              {{ customerLabel(item.customer_name) }}
            </template>
            <template #item.paid_at="{ item }">
              {{ formatDate(item.paid_at) }}
            </template>
            <template #item.payment_methods="{ item }">
              {{ methodsLabel(item.payment_methods) }}
            </template>
            <template #item.tip="{ item }">
              {{ item.tip ? '$' + item.tip.toLocaleString('es-CO') : '—' }}
            </template>
            <template #item.total="{ item }">
              <span class="font-weight-bold">${{ item.total.toLocaleString('es-CO') }}</span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay ventas en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" color="error" :timeout="6000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DateField from '../components/DateField.vue'
import salesService, {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type ProductSalesReport,
  type SalesFilters,
  type SalesReport,
  type SalesView,
  type TableSalesReport,
  type CashSession,
} from '../services/salesService'
import { errorMessage } from '@/utils/errors'
import { useAuthStore } from '@/stores/auth'
import { effectiveFeatures } from '@/types/auth'
import { customerLabel } from '@/utils/labels'

// Hoy en local (los inputs date usan YYYY-MM-DD): el día de trabajo actual
// es lo primero que quiere ver quien abre la pestaña.
const today = new Date().toLocaleDateString('sv-SE')

const filters = ref<SalesFilters>({
  from: today,
  to: today,
  payment_method: '',
  user_id: null,
  q: '',
})

const report = ref<SalesReport | null>(null)
const productReport = ref<ProductSalesReport | null>(null)
const tableReport = ref<TableSalesReport | null>(null)
// "Cierres de caja" es otra lectura del mismo rango, sin Excel propio.
type VentasView = SalesView | 'cash'
const view = ref<VentasView>('sales')
const cashSessions = ref<CashSession[]>([])
const loading = ref(false)

const money = (value: number | null | undefined): string =>
  '$' + Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

const productHeaders = [
  { title: 'Producto', key: 'name' },
  { title: 'Categoría', key: 'category' },
  { title: 'Cantidad', key: 'quantity', align: 'end' as const },
  { title: 'Bruto', key: 'gross', align: 'end' as const },
  { title: 'Neto', key: 'net', align: 'end' as const },
  { title: 'Costo', key: 'cost', align: 'end' as const },
  { title: 'Ganancia', key: 'profit', align: 'end' as const },
  { title: 'Ventas', key: 'orders_count', align: 'end' as const },
]

// El cobro por tiempo es un módulo: un restaurante no cobra por tiempo, así que
// no debe ver la columna ni el resumen de "Tiempo de billar".
const authStore = useAuthStore()
const hasTimeBilling = computed(() => effectiveFeatures(authStore.user).includes('time_billing'))

const tableHeaders = computed(() => [
  { title: 'Mesa', key: 'name' },
  { title: 'Ventas', key: 'sales_count', align: 'end' as const },
  { title: 'Productos', key: 'products_total', align: 'end' as const },
  ...(hasTimeBilling.value ? [{ title: 'Tiempo', key: 'time_total', align: 'end' as const }] : []),
  { title: 'Propinas', key: 'tips', align: 'end' as const },
  { title: 'Total', key: 'total', align: 'end' as const },
])

const cashHeaders = [
  { title: 'Apertura', key: 'opened_at', sortable: false },
  { title: 'Cierre', key: 'closed_at', sortable: false },
  { title: 'Base', key: 'opening_amount', align: 'end' as const, sortable: false },
  { title: 'Recaudado por medio', key: 'methods', sortable: false },
  { title: 'Efectivo esperado', key: 'expected_cash', align: 'end' as const, sortable: false },
  { title: 'Contado', key: 'counted_cash', align: 'end' as const, sortable: false },
  { title: 'Diferencia', key: 'difference', align: 'end' as const, sortable: false },
]

const collectedByMethod = (session: CashSession) =>
  Object.entries(session.summary.by_method)
    .filter(([, totals]) => totals.amount > 0)
    .map(([method, totals]) => ({ method, label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method, amount: totals.amount }))

// La diferencia es una cifra con signo: sobrante o faltante.
const differenceLabel = (difference: number): string =>
  Math.abs(difference) < 0.01 ? 'Cuadra' : difference > 0 ? `Sobran ${money(difference)}` : `Faltan ${money(Math.abs(difference))}`
const differenceClass = (difference: number): string =>
  Math.abs(difference) < 0.01 ? '' : difference > 0 ? 'text-success' : 'text-error'

const canExport = computed(() => {
  if (view.value === 'cash') return false
  if (view.value === 'products') return (productReport.value?.products.length ?? 0) > 0
  if (view.value === 'tables') return (tableReport.value?.tables.length ?? 0) > 0
  return (report.value?.sales.length ?? 0) > 0
})
const EXPORT_HINTS: Record<SalesView, string> = {
  sales: 'Descarga el listado de ventas con los filtros de arriba',
  products: 'Descarga el resumen por producto con los filtros de arriba',
  tables: 'Descarga el resumen por mesa con los filtros de arriba',
}
const exportHint = computed(() => {
  if (view.value === 'cash') return 'Los cierres de caja se consultan aquí; el Excel es de las ventas'
  return canExport.value ? EXPORT_HINTS[view.value] : 'No hay ventas con estos filtros para descargar'
})
const exporting = ref(false)
const snackbar = ref({ show: false, text: '' })

const headers = [
  { title: 'Comprobante', key: 'invoice_number', sortable: false },
  { title: 'Cliente', key: 'customer_name', sortable: false },
  { title: 'Fecha de pago', key: 'paid_at' },
  { title: 'Mesero', key: 'waiter' },
  { title: 'Método', key: 'payment_methods', sortable: false },
  { title: 'Propina', key: 'tip', align: 'end' as const },
  { title: 'Total', key: 'total', align: 'end' as const },
]

const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, title]) => ({ value, title }))

// Los meseros del filtro salen de las ventas cargadas: sin llamados extra
// y sin exigir permisos de administración de empleados.
const waiterOptions = computed(() => {
  const seen = new Map<number, string>()
  for (const sale of report.value?.sales ?? []) {
    if (sale.user_id && sale.waiter) seen.set(sale.user_id, sale.waiter)
  }
  return [...seen].map(([value, title]) => ({ value, title }))
})

const methodBreakdown = computed(() =>
  Object.entries(report.value?.summary.by_payment_method ?? {})
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([method, amount]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method,
      amount: amount ?? 0,
    })),
)

const methodsLabel = (methods: PaymentMethod[]): string =>
  methods.map(m => PAYMENT_METHOD_LABELS[m] ?? m).join(' + ') || '—'

const formatDate = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : '—'

// Cada vista consulta lo suyo; los totales de arriba siempre son del listado.
const load = async () => {
  loading.value = true
  try {
    if (view.value === 'products') {
      productReport.value = await salesService.byProduct(filters.value)
    } else if (view.value === 'tables') {
      tableReport.value = await salesService.byTable(filters.value)
    } else if (view.value === 'cash') {
      cashSessions.value = await salesService.cashSessions({ from: filters.value.from || undefined, to: filters.value.to || undefined })
    }
    if (view.value === 'sales' || !report.value) {
      report.value = await salesService.report(filters.value)
    }
  } catch (error) {
    snackbar.value = { show: true, text: errorMessage(error, 'No se pudieron cargar las ventas. Intenta de nuevo.') }
  } finally {
    loading.value = false
  }
}

watch(view, load)

const exportExcel = async () => {
  exporting.value = true
  try {
    if (view.value !== 'cash') await salesService.export(filters.value, view.value)
  } catch (error) {
    snackbar.value = { show: true, text: errorMessage(error, 'No se pudo descargar el Excel. Intenta de nuevo.') }
  } finally {
    exporting.value = false
  }
}

// Cambiar un filtro consulta solo, con una pequeña espera para no disparar
// una consulta por tecla mientras se escribe.
let reloadTimer: ReturnType<typeof setTimeout> | undefined
watch(
  filters,
  () => {
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(load, 300)
  },
  { deep: true },
)

onMounted(load)
</script>
