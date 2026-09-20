<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-2">
          <div>
            <h1 class="text-h4">Ventas</h1>
            <p class="text-body-1 text-grey-darken-1">
              Pedidos pagados: cuánto se ha vendido, con qué método y por quién
            </p>
          </div>
          <v-btn
            color="success"
            prepend-icon="mdi-file-excel"
            :loading="exporting"
            :disabled="!canExport"
            @click="exportExcel"
          >
            Descargar Excel
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Totales del conjunto filtrado completo (la tabla puede estar recortada) -->
    <v-row dense>
      <v-col cols="12" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Total vendido</div>
          <div class="text-h5 text-success font-weight-bold">
            ${{ (report?.summary.total ?? 0).toLocaleString('es-CO') }}
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Ventas</div>
          <div class="text-h5 font-weight-bold">{{ report?.summary.sales_count ?? 0 }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Propinas</div>
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
        <v-text-field v-model="filters.from" label="Desde" type="date" density="compact" hide-details />
      </v-col>
      <v-col cols="6" md="2">
        <v-text-field v-model="filters.to" label="Hasta" type="date" density="compact" hide-details />
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
        </v-btn-toggle>
      </v-col>
    </v-row>

    <v-row v-if="view === 'products'">
      <v-col cols="12">
        <v-card>
          <v-card-text class="d-flex flex-wrap ga-4 pb-0">
            <div>
              <div class="text-caption text-grey">Unidades vendidas</div>
              <div class="text-h6">{{ productReport?.summary.quantity ?? 0 }}</div>
            </div>
            <div>
              <div class="text-caption text-grey">Neto vendido</div>
              <div class="text-h6 text-success">{{ money(productReport?.summary.net) }}</div>
            </div>
            <div>
              <div class="text-caption text-grey">Ganancia (neto - costo)</div>
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
              <span class="font-weight-bold text-success">{{ money(item.net) }}</span>
            </template>
            <template #item.cost="{ item }">{{ money(item.cost) }}</template>
            <template #item.profit="{ item }">
              <span :class="item.profit >= 0 ? 'text-success' : 'text-error'">{{ money(item.profit) }}</span>
            </template>
            <template #no-data>
              <p class="text-grey py-6">No hay ventas en el rango seleccionado</p>
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
              <div class="text-caption text-grey">Ventas</div>
              <div class="text-h6">{{ tableReport?.summary.sales_count ?? 0 }}</div>
            </div>
            <div>
              <div class="text-caption text-grey">Tiempo de billar</div>
              <div class="text-h6">{{ money(tableReport?.summary.time_total) }}</div>
            </div>
            <div>
              <div class="text-caption text-grey">Total</div>
              <div class="text-h6 text-success">{{ money(tableReport?.summary.total) }}</div>
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
                <span class="text-caption text-grey">({{ formatMinutes(item.time_minutes) }})</span>
              </template>
              <span v-else class="text-grey">—</span>
            </template>
            <template #item.tips="{ item }">{{ item.tips ? money(item.tips) : '—' }}</template>
            <template #item.total="{ item }">
              <span class="font-weight-bold text-success">{{ money(item.total) }}</span>
            </template>
            <template #no-data>
              <p class="text-grey py-6">No hay ventas en el rango seleccionado</p>
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
              <v-chip size="small" variant="tonal" :color="item.invoice_number ? 'primary' : 'grey'">
                {{ item.invoice_number || `Pedido #${item.id}` }}
              </v-chip>
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
              <span class="font-weight-bold text-success">${{ item.total.toLocaleString('es-CO') }}</span>
            </template>
            <template #no-data>
              <p class="text-grey py-6">No hay ventas en el rango seleccionado</p>
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
import salesService, {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type ProductSalesReport,
  type SalesFilters,
  type SalesReport,
  type SalesView,
  type TableSalesReport,
} from '../services/salesService'

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
const view = ref<SalesView>('sales')
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

const tableHeaders = [
  { title: 'Mesa', key: 'name' },
  { title: 'Ventas', key: 'sales_count', align: 'end' as const },
  { title: 'Productos', key: 'products_total', align: 'end' as const },
  { title: 'Tiempo', key: 'time_total', align: 'end' as const },
  { title: 'Propinas', key: 'tips', align: 'end' as const },
  { title: 'Total', key: 'total', align: 'end' as const },
]

const canExport = computed(() => {
  if (view.value === 'products') return (productReport.value?.products.length ?? 0) > 0
  if (view.value === 'tables') return (tableReport.value?.tables.length ?? 0) > 0
  return (report.value?.sales.length ?? 0) > 0
})
const exporting = ref(false)
const snackbar = ref({ show: false, text: '' })

const headers = [
  { title: 'Factura', key: 'invoice_number', sortable: false },
  { title: 'Fecha de pago', key: 'paid_at' },
  { title: 'Mesa', key: 'dining_table' },
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Mesero', key: 'waiter' },
  { title: 'Método', key: 'payment_methods', sortable: false },
  { title: 'Propina', key: 'tip' },
  { title: 'Total', key: 'total' },
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
    }
    if (view.value === 'sales' || !report.value) {
      report.value = await salesService.report(filters.value)
    }
  } catch {
    snackbar.value = { show: true, text: 'Error al cargar las ventas' }
  } finally {
    loading.value = false
  }
}

watch(view, load)

const exportExcel = async () => {
  exporting.value = true
  try {
    await salesService.export(filters.value, view.value)
  } catch {
    snackbar.value = { show: true, text: 'Error al exportar las ventas' }
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
