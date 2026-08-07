<template>
  <v-container fluid class="pa-4">
    <v-row>
      <!-- Estadísticas principales -->
      <v-col cols="12" md="3" v-for="stat in stats" :key="stat.title">
        <v-card elevation="2" class="text-center pa-4">
          <div class="text-h4 mb-1" :class="stat.color">
            {{ stat.value }}
          </div>
          <div class="text-body-1 font-weight-bold text-grey-darken-1 mb-1">
            {{ stat.title }}
          </div>
          <div class="text-caption text-grey mb-2">
            {{ stat.subtitle }}
          </div>
          <v-chip 
            :color="stat.trend.color" 
            size="small" 
            variant="outlined"
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
        <v-card elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-chart-line</v-icon>
            Ventas de la Semana
          </v-card-title>
          <v-card-text>
            <div v-if="loading" class="text-center pa-8">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else-if="salesWeekData.length > 0" style="height: 300px; position: relative;">
              <Line :data="chartData" :options="chartOptions" />
            </div>
            <div v-else class="text-center pa-8 text-grey">
              No hay datos de ventas disponibles
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Pedidos recientes -->
      <v-col cols="12" md="4">
        <v-card elevation="2">
          <v-card-title>
            <v-icon class="mr-2">mdi-clock-outline</v-icon>
            Pedidos Recientes
          </v-card-title>
          <v-card-text>
            <v-list v-if="!loading && recentOrders.length > 0" density="compact">
              <v-list-item
                v-for="order in recentOrders"
                :key="order.id"
                class="mb-2"
              >
                <template v-slot:prepend>
                  <v-avatar :color="getStatusInfo(order.status).color" size="32">
                    <v-icon color="white" size="16">{{ getStatusInfo(order.status).icon }}</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title>Pedido #{{ order.id }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ order.customer_name }} - ${{ Number(order.total || 0).toFixed(2) }}
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-chip :color="getStatusInfo(order.status).color" size="small" variant="outlined">
                    {{ getStatusInfo(order.status).text }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="loading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else class="text-center pa-4 text-grey">
              No hay pedidos recientes
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-4">
      <!-- Productos con stock bajo -->
      <v-col cols="12" md="6">
        <v-card elevation="2">
          <v-card-title>
            <v-icon class="mr-2" color="warning">mdi-alert-circle</v-icon>
            Stock Bajo
          </v-card-title>
          <v-card-text>
            <v-list v-if="!loading && lowStockProducts.length > 0" density="compact">
              <v-list-item
                v-for="product in lowStockProducts"
                :key="product.id"
              >
                <v-list-item-title>{{ product.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  Actual: <strong>{{ Number(product.current_stock || 0).toFixed(2) }} {{ product.unit }}</strong>
                  / Mínimo: {{ Number(product.minimum_stock || 0).toFixed(2) }} {{ product.unit }}
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-chip color="warning" size="small" variant="outlined">
                    Bajo
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
            <div v-else-if="loading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else class="text-center pa-4 text-success">
              ✓ Todo el stock está bien
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Productos más vendidos -->
      <v-col cols="12" md="6">
        <v-card elevation="2">
          <v-card-title>
            <v-icon class="mr-2" color="success">mdi-trophy</v-icon>
            Más Vendidos
          </v-card-title>
          <v-card-text>
            <v-list v-if="!loading && topProducts.length > 0" density="compact">
              <v-list-item
                v-for="(product, index) in topProducts"
                :key="index"
              >
                <template v-slot:prepend>
                  <v-avatar :color="getRankColor(index)" size="32">
                    <span class="text-white font-weight-bold">{{ index + 1 }}</span>
                  </v-avatar>
                </template>
                <v-list-item-title>{{ product.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ product.sold }} vendidos
                </v-list-item-subtitle>
              </v-list-item>
            </v-list>
            <div v-else-if="loading" class="text-center pa-4">
              <v-progress-circular indeterminate color="primary" />
            </div>
            <div v-else class="text-center pa-4 text-grey">
              No hay ventas registradas aún
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { dashboardService, type DashboardStats, type TopProduct, type LowStockProduct, type SalesWeekDay } from '@/services/dashboardService'
import { ordersService, type Order } from '@/services/ordersService'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js'

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

const dashStats = ref<DashboardStats>({
  orders_today: 0,
  sales_today: 0,
  orders_month: 0,
  sales_month: 0,
  active_products: 0,
  low_stock: 0,
})

const recentOrders = ref<Order[]>([])
const lowStockProducts = ref<LowStockProduct[]>([])
const topProducts = ref<TopProduct[]>([])
const salesWeekData = ref<SalesWeekDay[]>([])
const loading = ref(true)

const stats = computed(() => [
  {
    title: 'Pedidos Hoy',
    value: dashStats.value.orders_today.toString(),
    subtitle: `${dashStats.value.orders_month} este mes`,
    color: 'text-primary',
    trend: { icon: 'mdi-receipt', text: 'Pedidos del día', color: 'primary' }
  },
  {
    title: 'Ventas Hoy',
    value: `$${Number(dashStats.value.sales_today || 0).toFixed(0)}`,
    subtitle: `$${Number(dashStats.value.sales_month || 0).toFixed(0)} este mes`,
    color: 'text-success',
    trend: { icon: 'mdi-cash', text: 'Ventas pagadas', color: 'success' }
  },
  {
    title: 'Productos Activos',
    value: dashStats.value.active_products.toString(),
    subtitle: 'En el menú',
    color: 'text-info',
    trend: { icon: 'mdi-silverware-fork-knife', text: 'Disponibles', color: 'info' }
  },
  {
    title: 'Stock Bajo',
    value: dashStats.value.low_stock.toString(),
    subtitle: dashStats.value.low_stock > 0 ? 'Requiere atención' : 'Todo bien',
    color: dashStats.value.low_stock > 0 ? 'text-warning' : 'text-success',
    trend: {
      icon: dashStats.value.low_stock > 0 ? 'mdi-alert' : 'mdi-check-circle',
      text: 'Inventario',
      color: dashStats.value.low_stock > 0 ? 'warning' : 'success'
    }
  }
])

const getStatusInfo = (status: string): { text: string; color: string; icon: string } => {
  const statusMap: Record<string, { text: string; color: string; icon: string }> = {
    pending: { text: 'Pendiente', color: 'grey', icon: 'mdi-clock' },
    preparing: { text: 'Preparando', color: 'warning', icon: 'mdi-chef-hat' },
    ready: { text: 'Listo', color: 'success', icon: 'mdi-check' },
    delivered: { text: 'Entregado', color: 'info', icon: 'mdi-truck' },
    cancelled: { text: 'Cancelado', color: 'error', icon: 'mdi-close' },
  }
  return statusMap[status] || { text: 'Pendiente', color: 'grey', icon: 'mdi-clock' }
}

const chartData = computed(() => ({
  labels: salesWeekData.value.map(d => d.day),
  datasets: [
    {
      label: 'Ventas ($)',
      data: salesWeekData.value.map(d => d.total),
      backgroundColor: 'rgba(255, 138, 0, 0.2)',
      borderColor: 'rgba(255, 138, 0, 1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
    }
  ]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          // Pesos colombianos: sin decimales y con separador de miles.
          return `Ventas: $${Number(context.parsed.y).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`
        }
      }
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        callback: function(value: any) {
          return '$' + Number(value).toLocaleString('es-CO', { maximumFractionDigits: 0 })
        }
      }
    }
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const [stats, orders, stock, products, salesWeek] = await Promise.all([
      dashboardService.getStats(),
      ordersService.getAll({ today: true }),
      dashboardService.getLowStock(),
      dashboardService.getTopProducts(),
      dashboardService.getSalesWeek(),
    ])

    dashStats.value = stats
    recentOrders.value = orders.slice(0, 4) // Últimos 4 pedidos
    lowStockProducts.value = stock
    topProducts.value = products
    salesWeekData.value = salesWeek
  } catch (error) {
    console.error('[Dashboard] Error al cargar datos:', error)
  } finally {
    loading.value = false
  }
}

const getRankColor = (index: number) => {
  const colors = ['warning', 'grey-darken-1', 'brown', 'grey']
  return colors[index] || 'grey'
}

onMounted(() => {
  loadData()
})
</script>
