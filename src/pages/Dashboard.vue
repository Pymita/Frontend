<template>
  <v-container fluid class="pa-4">
    <!-- Pedidos sin cobrar de días anteriores: es plata que se pierde si
         nadie la ve. Va arriba de todo, antes de cualquier estadística. -->
    <v-alert
      v-if="!loading && overdueCount > 0"
      type="warning"
      variant="tonal"
      icon="mdi-alert-circle"
      class="mb-4"
    >
      <div class="d-flex align-center flex-wrap ga-3">
        <div>
          <div class="font-weight-bold">
            {{ overdueCount === 1
              ? 'Hay 1 pedido pendiente de cobro de un día anterior'
              : `Hay ${overdueCount} pedidos pendientes de cobro de días anteriores` }}
          </div>
          <div class="text-body-2">
            Suman {{ money(overduePendingTotal) }} por cobrar. Revísalos y ciérralos para que la caja cuadre.
          </div>
        </div>
        <v-spacer />
        <v-btn color="warning" variant="flat" to="/pedidos">
          <v-icon start>mdi-receipt</v-icon>
          Ver pedidos pendientes
        </v-btn>
      </div>
    </v-alert>

    <v-alert v-if="loadError" type="error" variant="tonal" class="mb-4">
      <div class="d-flex align-center flex-wrap ga-3">
        <span>{{ loadError }}</span>
        <v-spacer />
        <v-btn variant="text" @click="loadData">Reintentar</v-btn>
      </div>
    </v-alert>

    <v-row>
      <!-- Estadísticas principales -->
      <!-- The figure stays in text color; only the chip, which means something, is colored. -->
      <v-col cols="12" md="3" v-for="stat in stats" :key="stat.title">
        <v-card class="pa-4 h-100">
          <div class="text-subtitle-2 text-medium-emphasis">
            {{ stat.title }}
          </div>
          <div class="text-h3 tabular-nums my-1">
            {{ stat.value }}
          </div>
          <div class="text-caption text-medium-emphasis mb-3">
            {{ stat.subtitle }}
          </div>
          <v-chip
            :color="stat.trend.color"
            size="small"
            variant="tonal"
          >
            <v-icon start :icon="stat.trend.icon"></v-icon>
            {{ stat.trend.text }}
          </v-chip>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <!-- Gráfico de ventas -->
      <v-col cols="12" md="8">
        <v-card class="h-100">
          <v-card-title class="d-flex align-center flex-wrap ga-2">
            <v-icon class="mr-2">mdi-chart-line</v-icon>
            {{ periodTitle }}
            <v-spacer />
            <!-- El periodo también rige "Más vendidos": son la misma pregunta
                 (qué se vendió en estas fechas) vista en dinero y en producto. -->
            <v-btn-toggle v-model="period" mandatory color="primary" density="compact" variant="outlined" divided>
              <v-btn value="week" :aria-pressed="period === 'week'">Semana</v-btn>
              <v-btn value="month" :aria-pressed="period === 'month'">Mes</v-btn>
              <v-btn value="range" :aria-pressed="period === 'range'">Rango</v-btn>
            </v-btn-toggle>
          </v-card-title>
          <v-card-text>
            <v-row v-if="period === 'range'" dense class="mb-2">
              <v-col cols="6" sm="4">
                <DateField v-model="range.from" label="Desde" density="compact" hide-details />
              </v-col>
              <v-col cols="6" sm="4">
                <DateField v-model="range.to" label="Hasta" density="compact" hide-details />
              </v-col>
            </v-row>
            <v-alert v-if="periodError" type="error" variant="tonal" density="compact" class="mb-2">
              {{ periodError }}
            </v-alert>
            <div v-if="salesPeriod && !periodError" class="text-body-2 text-medium-emphasis mb-2">
              {{ periodCaption }}: <strong class="text-high-emphasis">{{ money(salesPeriod.meta.total) }}</strong>
              en {{ salesPeriod.meta.orders_count }} {{ salesPeriod.meta.orders_count === 1 ? 'pedido' : 'pedidos' }}
              <span v-if="salesPeriod.meta.bucket !== 'day'">
                · un punto por {{ salesPeriod.meta.bucket === 'week' ? 'semana' : 'mes' }}
              </span>
            </div>
            <div v-if="loading || periodLoading" class="text-center pa-8">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else-if="salesPoints.length > 0" style="height: 300px; position: relative;">
              <Line :data="chartData" :options="chartOptions" />
            </div>
            <div v-else class="text-center pa-8 text-medium-emphasis">
              No hay datos de ventas disponibles
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Productos más vendidos: en el periodo del gráfico -->
      <v-col cols="12" md="4">
        <v-card class="h-100">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-trophy</v-icon>
            Más vendidos
          </v-card-title>
          <v-card-subtitle v-if="topPeriod">{{ periodCaption }}</v-card-subtitle>
          <v-card-text>
            <v-list v-if="!loading && !periodLoading && topProducts.length > 0" density="compact">
              <v-list-item
                v-for="(product, index) in topProducts"
                :key="`${product.menu_item_id}-${product.product_id}-${product.name}`"
                lines="two"
                class="px-0"
              >
                <template v-slot:prepend>
                  <v-avatar :color="index === 0 ? 'accent' : 'primary-container'" size="32">
                    <span class="font-weight-bold">{{ index + 1 }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title class="font-weight-medium text-wrap">{{ product.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ product.sold }} {{ product.sold === 1 ? 'vendido' : 'vendidos' }} · {{ product.orders_count }} {{ product.orders_count === 1 ? 'pedido' : 'pedidos' }}
                </v-list-item-subtitle>
                <v-progress-linear
                  :model-value="product.share"
                  color="primary"
                  height="4"
                  rounded
                  class="mt-1"
                />
                <template v-slot:append>
                  <div class="text-right ml-2">
                    <div class="font-weight-bold tabular-nums">{{ money(product.total) }}</div>
                    <div class="text-caption text-medium-emphasis">{{ percent(product.share) }} de las ventas</div>
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="loading || periodLoading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else class="text-center pa-4 text-medium-emphasis">
              No hay ventas en este periodo
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <!-- Productos con stock bajo -->
      <v-col cols="12" :md="showGuide ? 6 : 12">
        <v-card class="h-100">
          <v-card-title>
            <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
            Stock bajo
          </v-card-title>
          <v-card-text>
            <v-list v-if="!loading && lowStockProducts.length > 0" density="compact">
              <v-list-item
                v-for="product in lowStockProducts"
                :key="product.id"
              >
                <v-list-item-title>{{ product.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  Actual: <strong>{{ quantity(product.current_stock) }} {{ product.unit }}</strong>
                  / Mínimo: {{ quantity(product.minimum_stock) }} {{ product.unit }}
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-chip
                    :color="product.current_stock <= 0 ? 'error' : 'warning'"
                    size="small"
                    variant="outlined"
                  >
                    {{ product.current_stock <= 0 ? 'Agotado' : 'Bajo' }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="loading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else class="text-center pa-4">
              <v-icon icon="mdi-check-circle" color="success" size="small" class="mr-1" />
              Todo el stock está bien
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Primeros pasos sits beside stock, under the metrics, so the KPIs stay first. -->
      <v-col v-if="showGuide" cols="12" md="6">
        <v-card class="h-100 d-flex flex-column" data-testid="setup-guide">
          <template v-if="setup">
            <v-card-title class="d-flex align-center flex-wrap ga-2">
              <v-icon icon="mdi-flag-checkered" />
              {{ hasPending ? 'Primeros pasos' : 'Primeros pasos listos' }}
              <v-spacer />
              <span v-if="hasPending" class="text-body-2 text-medium-emphasis">
                {{ setup.completed }} de {{ setup.total }} listos
              </span>
            </v-card-title>
            <v-card-text>
              <v-progress-linear
                v-if="hasPending"
                :model-value="(100 * setup.completed) / setup.total"
                color="primary"
                height="8"
                rounded
                class="mb-2"
                aria-label="Avance de los primeros pasos"
              />
              <v-list
                v-if="visibleSteps.length"
                ref="stepsList"
                class="overflow-y-auto"
                max-height="280"
                density="compact"
              >
                <v-list-item
                  v-for="step in visibleSteps"
                  :key="step.key"
                  :lines="false"
                  :data-testid="`setup-step-${step.key}`"
                >
                  <template #prepend>
                    <v-icon
                      :icon="stepIcon(step)"
                      :color="stepColor(step)"
                      :aria-label="stepAria(step)"
                    />
                  </template>
                  <v-list-item-title class="text-wrap" :class="{ 'text-medium-emphasis': step.done }">
                    {{ step.title }}
                    <v-chip v-if="step.optional" size="x-small" class="ml-1">Opcional</v-chip>
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-wrap">{{ step.description }}</v-list-item-subtitle>
                  <template v-if="!step.done" #append>
                    <v-btn size="small" variant="text" color="primary" :to="step.link" :aria-label="`Ir a: ${step.title}`">Ir</v-btn>
                  </template>
                </v-list-item>
              </v-list>
              <v-btn
                v-if="detailSteps.length"
                variant="text"
                color="primary"
                class="mt-1 px-1"
                :aria-label="showCompleted ? 'Ocultar los que ya están listos' : 'Ver los que ya están listos'"
                @click="showCompleted = !showCompleted"
              >
                {{ showCompleted ? 'Ocultar los que ya están listos' : 'Ver los que ya están listos' }}
              </v-btn>
            </v-card-text>
          </template>
          <div v-else class="text-center pa-4">
            <v-progress-circular indeterminate color="primary" />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDay } from '@/utils/dates'
import { ref, reactive, onMounted, computed, watch, nextTick, type ComponentPublicInstance } from 'vue'
import DateField from '../components/DateField.vue'
import {
  dashboardService,
  type DashboardStats,
  type DateRange,
  type LowStockProduct,
  type SalesPeriod,
  type TopProductsPeriod,
  type SetupChecklist,
  type SetupStep,
} from '@/services/dashboardService'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'
import { fonts } from '@/theme'
import { useTheme } from 'vuetify'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)
ChartJS.defaults.font.family = fonts.body

const theme = useTheme()

const dashStats = ref<DashboardStats>({
  orders_today: 0,
  sales_today: 0,
  orders_month: 0,
  sales_month: 0,
  active_products: 0,
  low_stock: 0,
  overdue_pending: { count: 0, balance: 0 },
})

const lowStockProducts = ref<LowStockProduct[]>([])


// Stock can be fractional (kg, litros) but 12 units must not read "12.00".
const quantity = (value: number | string | null | undefined): string =>
  Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })

// Pendientes de cobro creados antes de hoy (los cancelados no cuentan).
const overdueCount = computed(() => dashStats.value.overdue_pending?.count ?? 0)
const overduePendingTotal = computed(() => dashStats.value.overdue_pending?.balance ?? 0)
const loading = ref(true)

type Period = 'week' | 'month' | 'range'
// A first visit shows the month. The choice is not stored.
const period = ref<Period>('month')
const range = reactive<{ from: string; to: string }>({ from: '', to: '' })
const salesPeriod = ref<SalesPeriod | null>(null)
const topPeriod = ref<TopProductsPeriod | null>(null)
const periodLoading = ref(false)
const periodError = ref('')

const salesPoints = computed(() => salesPeriod.value?.points ?? [])
const topProducts = computed(() => topPeriod.value?.products ?? [])

// Fechas locales YYYY-MM-DD (lo que usan los inputs date y la API).
const localDate = (date: Date): string => date.toLocaleDateString('sv-SE')

const requestedRange = (): DateRange | null => {
  const today = new Date()
  if (period.value === 'week') {
    const from = new Date(today)
    from.setDate(today.getDate() - 6)
    return { from: localDate(from), to: localDate(today) }
  }
  if (period.value === 'month') {
    return { from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDate(today) }
  }
  return range.from && range.to ? { from: range.from, to: range.to } : null
}


const periodTitle = computed(() => ({
  week: 'Ventas de la Semana',
  month: 'Ventas del mes',
  range: 'Ventas del periodo',
})[period.value])

const periodCaption = computed(() => {
  if (period.value === 'week') return 'Últimos 7 días'
  if (period.value === 'month') return 'Este mes'
  const meta = salesPeriod.value?.meta
  return meta ? `Del ${formatDay(meta.from)} al ${formatDay(meta.to)}` : 'Rango'
})

const percent = (value: number): string =>
  `${Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 })} %`

// Cambiar rápido de periodo no debe dejar pintada una respuesta vieja.
let periodRequest = 0

const loadPeriod = async () => {
  const requested = requestedRange()
  if (!requested) return

  const current = ++periodRequest
  periodLoading.value = true
  periodError.value = ''
  try {
    const [sales, top] = await Promise.all([
      dashboardService.getSalesWeek(requested),
      dashboardService.getTopProducts(requested),
    ])
    if (current !== periodRequest) return
    salesPeriod.value = sales
    topPeriod.value = top
  } catch (error: any) {
    if (current !== periodRequest) return
    salesPeriod.value = null
    topPeriod.value = null
    periodError.value = errorMessage(error, 'No fue posible cargar las ventas del periodo. Inténtalo de nuevo.')
  } finally {
    if (current === periodRequest) periodLoading.value = false
  }
}

watch([period, () => range.from, () => range.to], () => {
  // Al pasar a "Rango" se parte del periodo que ya se estaba viendo.
  if (period.value === 'range' && !range.from && !range.to && salesPeriod.value) {
    range.from = salesPeriod.value.meta.from
    range.to = salesPeriod.value.meta.to
    return
  }
  loadPeriod()
})

const stats = computed(() => [
  {
    title: 'Pedidos hoy',
    value: dashStats.value.orders_today.toString(),
    subtitle: `${dashStats.value.orders_month} este mes`,
    trend: { icon: 'mdi-receipt', text: 'Pedidos del día', color: 'primary' }
  },
  {
    title: 'Ventas hoy',
    value: money(dashStats.value.sales_today),
    subtitle: `${money(dashStats.value.sales_month)} este mes`,
    trend: { icon: 'mdi-cash', text: 'Ventas pagadas', color: 'success' }
  },
  {
    title: 'Productos activos',
    value: dashStats.value.active_products.toString(),
    subtitle: 'En el menú',
    trend: { icon: 'mdi-silverware-fork-knife', text: 'Disponibles', color: 'info' }
  },
  {
    title: 'Stock bajo',
    value: dashStats.value.low_stock.toString(),
    subtitle: dashStats.value.low_stock > 0 ? 'Requiere atención' : 'Todo bien',
    trend: {
      icon: dashStats.value.low_stock > 0 ? 'mdi-alert' : 'mdi-check-circle',
      text: 'Inventario',
      color: dashStats.value.low_stock > 0 ? 'warning' : 'success'
    }
  }
])

const chartData = computed(() => {
  const primary = theme.current.value.colors.primary
  return {
    labels: salesPoints.value.map(d => d.day),
    datasets: [
      {
        label: 'Ventas ($)',
        data: salesPoints.value.map(d => d.total),
        // Canvas cannot read CSS variables: the theme color plus a hex alpha.
        backgroundColor: `${primary}24`,
        borderColor: primary,
        borderWidth: 2,
        fill: true,
        tension: 0.4,
      },
    ],
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
    },
    tooltip: {
      callbacks: {
        // Semanas y meses: el eje muestra solo el inicio, el tooltip el tramo completo.
        title: function(items: any[]) {
          const point = salesPoints.value[items[0]?.dataIndex ?? -1]
          if (!point || salesPeriod.value?.meta.bucket === 'day') return items[0]?.label ?? ''
          return `Del ${formatDay(point.date)} al ${formatDay(point.end)}`
        },
        label: function(context: any) {
          // Pesos colombianos: sin decimales y con separador de miles.
          return `Ventas: ${money(context.parsed.y)}`
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      // Sin ventas el eje iba de $0 a $1 en décimas y el formato en pesos
      // las redondeaba: "$1" repetido. Pesos enteros y una escala mínima.
      suggestedMax: salesPoints.value.some(d => d.total > 0) ? undefined : 100000,
      ticks: {
        precision: 0,
        callback: function(value: any) {
          return money(value)
        }
      }
    }
  }
}))

const authStore = useAuthStore()
const setup = ref<SetupChecklist | null>(null)
const loadError = ref('')
const showCompleted = ref(false)
const stepsList = ref<ComponentPublicInstance | null>(null)

// Required steps still open. Optional ones (recipes, the DIAN resolution)
// never count as pending: a company can finish without them.
const pendingSteps = computed(() =>
  (setup.value?.steps ?? []).filter(step => !step.done && !step.optional),
)
const detailSteps = computed(() =>
  (setup.value?.steps ?? []).filter(step => step.done || step.optional),
)
const hasPending = computed(() => pendingSteps.value.length > 0)
const visibleSteps = computed(() => (showCompleted.value ? (setup.value?.steps ?? []) : pendingSteps.value))
const showGuide = computed(() => authStore.isAdmin && (loading.value || setup.value !== null))

const stepIcon = (step: SetupStep): string =>
  step.done || !step.optional ? 'mdi-check-circle' : 'mdi-circle-outline'

const stepColor = (step: SetupStep): string | undefined => {
  if (step.done) return 'success'
  if (!step.optional) return 'error'
  return undefined
}

const stepAria = (step: SetupStep): string => {
  if (step.done) return 'Listo'
  if (!step.optional) return 'Pendiente'
  return 'Opcional'
}

// The card only shows a few rows. Opening the details scrolls the first
// hidden step into that window; closing it returns to the pending ones.
watch(showCompleted, async (open) => {
  await nextTick()
  const root = stepsList.value?.$el as HTMLElement | undefined
  if (!root) return
  if (!open) {
    root.scrollTop = 0
    return
  }
  const first = detailSteps.value[0]
  const item = first
    ? root.querySelector<HTMLElement>(`[data-testid="setup-step-${first.key}"]`)
    : null
  if (!item) return
  root.scrollTop += item.getBoundingClientRect().top - root.getBoundingClientRect().top
})

// Solo el admin configura el negocio; un fallo aquí no tapa el resto.
const loadSetup = async () => {
  if (!authStore.isAdmin) return
  try {
    setup.value = await dashboardService.getSetup()
  } catch {
    setup.value = null
  }
}

const loadData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const [stats, stock] = await Promise.all([
      dashboardService.getStats(),
      dashboardService.getLowStock(),
      loadPeriod(),
      loadSetup(),
    ])

    dashStats.value = stats
    lowStockProducts.value = stock
  } catch (error) {
    loadError.value = errorMessage(error, 'No pudimos cargar el resumen del negocio. Revisa tu conexión y vuelve a intentar.')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>
