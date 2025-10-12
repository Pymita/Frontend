<template>
  <v-container fluid class="pa-4">
    <v-row>
      <!-- Estadísticas principales -->
      <v-col cols="12" md="3" v-for="stat in stats" :key="stat.title">
        <v-card elevation="2" class="text-center pa-4">
          <div class="text-h4 mb-2" :class="stat.color">
            {{ stat.value }}
          </div>
          <div class="text-body-1 text-grey-darken-1 mb-2">
            {{ stat.title }}
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
            <div class="text-center pa-8 text-grey-darken-1">
              <v-icon size="64" class="mb-4">mdi-chart-areaspline</v-icon>
              <div>Gráfico de ventas se implementará aquí</div>
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
            <v-list density="compact">
              <v-list-item
                v-for="order in recentOrders"
                :key="order.id"
                class="mb-2"
              >
                <template v-slot:prepend>
                  <v-avatar :color="order.statusColor" size="32">
                    <v-icon color="white" size="16">{{ order.icon }}</v-icon>
                  </v-avatar>
                </template>
                <v-list-item-title>Pedido #{{ order.id }}</v-list-item-title>
                <v-list-item-subtitle>
                  {{ order.customer }} - ${{ order.total }}
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-chip :color="order.statusColor" size="small" variant="outlined">
                    {{ order.status }}
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
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
            <v-list density="compact">
              <v-list-item
                v-for="product in lowStockProducts"
                :key="product.id"
              >
                <v-list-item-title>{{ product.name }}</v-list-item-title>
                <v-list-item-subtitle>
                  Stock: {{ product.stock }} unidades
                </v-list-item-subtitle>
                <template v-slot:append>
                  <v-chip color="warning" size="small" variant="outlined">
                    Bajo
                  </v-chip>
                </template>
              </v-list-item>
            </v-list>
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
            <v-list density="compact">
              <v-list-item
                v-for="(product, index) in topProducts"
                :key="product.id"
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
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Datos simulados - reemplazar con datos reales de la API
const stats = ref([
  {
    title: 'Pedidos Hoy',
    value: '23',
    color: 'text-primary',
    trend: { icon: 'mdi-arrow-up', text: '+12% vs ayer', color: 'success' }
  },
  {
    title: 'Ventas Hoy',
    value: '$1,250',
    color: 'text-success',
    trend: { icon: 'mdi-arrow-up', text: '+8% vs ayer', color: 'success' }
  },
  {
    title: 'Productos Activos',
    value: '42',
    color: 'text-info',
    trend: { icon: 'mdi-plus', text: '3 nuevos', color: 'info' }
  },
  {
    title: 'Stock Bajo',
    value: '5',
    color: 'text-warning',
    trend: { icon: 'mdi-alert', text: 'Revisar', color: 'warning' }
  }
])

const recentOrders = ref([
  { id: '001', customer: 'Juan Pérez', total: 45.50, status: 'Preparando', statusColor: 'warning', icon: 'mdi-chef-hat' },
  { id: '002', customer: 'María García', total: 23.00, status: 'Listo', statusColor: 'success', icon: 'mdi-check' },
  { id: '003', customer: 'Carlos Ruiz', total: 67.30, status: 'Entregado', statusColor: 'info', icon: 'mdi-truck' },
  { id: '004', customer: 'Ana López', total: 34.20, status: 'Pendiente', statusColor: 'grey', icon: 'mdi-clock' }
])

const lowStockProducts = ref([
  { id: 1, name: 'Harina Integral', stock: 5 },
  { id: 2, name: 'Levadura Fresca', stock: 8 },
  { id: 3, name: 'Mozzarella', stock: 12 },
  { id: 4, name: 'Tomate en Conserva', stock: 3 }
])

const topProducts = ref([
  { id: 1, name: 'Pizza Margherita', sold: 45 },
  { id: 2, name: 'Pan Francés', sold: 38 },
  { id: 3, name: 'Empanadas de Carne', sold: 32 },
  { id: 4, name: 'Croissant', sold: 28 }
])

const getRankColor = (index: number) => {
  const colors = ['warning', 'grey-darken-1', 'brown', 'grey']
  return colors[index] || 'grey'
}
</script>