<template>
  <v-app>
    <v-navigation-drawer
      v-if="$route.name !== 'Login' && isAuthenticated"
      app
      permanent
      width="280"
      color="primary"
      theme="dark"
    >
      <v-list-item class="px-2">
        <v-list-item-avatar>
          <v-icon color="white" size="40">mdi-bread-slice</v-icon>
        </v-list-item-avatar>
        <v-list-item-title class="text-h6 text-white">
          Sabores del Trigo
        </v-list-item-title>
      </v-list-item>

      <v-divider></v-divider>

      <v-list nav density="compact" color="white">
        <v-list-item
          v-for="item in availableMenuItems"
          :key="item.title"
          :to="item.route"
          :prepend-icon="item.icon"
          :title="item.title"
          class="mb-1"
        />
      </v-list>

      <template v-slot:append>
        <v-divider></v-divider>
        <v-list density="compact" color="white">
          <v-list-item
            :prepend-icon="loading ? 'mdi-loading' : 'mdi-logout'"
            :title="loading ? 'Cerrando sesión...' : 'Cerrar Sesión'"
            @click="logout"
            :disabled="loading"
          >
            <template v-slot:prepend>
              <v-icon 
                :class="{ 'rotating': loading }"
                :icon="loading ? 'mdi-loading' : 'mdi-logout'"
              />
            </template>
          </v-list-item>
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar v-if="$route.name !== 'Login' && isAuthenticated" app color="white" elevation="1">
      <v-app-bar-title>{{ pageTitle }}</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-chip color="primary" variant="outlined" class="mr-2">
        <v-icon start>mdi-account</v-icon>
        {{ currentUser?.name || 'Usuario' }}
        <v-chip-text v-if="currentUser?.role === 'admin'" class="ml-2" color="warning" size="x-small">
          Admin
        </v-chip-text>
      </v-chip>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <router-view :key="route.fullPath" />
    </v-main>

    <!-- Loading overlay -->
    <v-overlay v-model="loading" class="align-center justify-center">
      <v-progress-circular color="primary" indeterminate size="64"></v-progress-circular>
    </v-overlay>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import type { MenuItem } from './types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref<boolean>(false)

// Usar computed del store directamente
const isAuthenticated = computed(() => authStore.isAuthenticated)
const currentUser = computed(() => authStore.user)
const isAdmin = computed(() => authStore.isAdmin)

const allMenuItems: MenuItem[] = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', route: '/dashboard' },
  { title: 'Pedidos', icon: 'mdi-receipt', route: '/pedidos' },
  { title: 'Mesas', icon: 'mdi-table-chair', route: '/mesas' },
  { title: 'Menú (Venta)', icon: 'mdi-silverware-fork-knife', route: '/productos' },
  { title: 'Categorías', icon: 'mdi-shape', route: '/categorias' },
  { title: 'Productos Base', icon: 'mdi-package-variant', route: '/productos-base' },
  { title: 'Recetas', icon: 'mdi-food-variant', route: '/recetas' },
  { title: 'Tipos de Producto', icon: 'mdi-tag-multiple', route: '/tipos-producto', requiresAdmin: true },
  { title: 'Clientes', icon: 'mdi-account-multiple', route: '/clientes' },
  { title: 'Gastos', icon: 'mdi-cash-multiple', route: '/gastos', requiresAdmin: true },
]

const availableMenuItems = computed((): MenuItem[] => {
  return allMenuItems.filter((item: MenuItem) => {
    if (item.requiresAdmin) {
      return isAdmin.value
    }
    return true
  })
})

const pageTitle = computed((): string => {
  const item = allMenuItems.find((item: MenuItem) => item.route === route.path)
  return item?.title || 'Sabores del Trigo'
})

const logout = async (): Promise<void> => {
  loading.value = true
  try {
    await authStore.logout()
    
    // Redirigir
    await router.push('/login')
    
  } catch (error) {
    console.error('Error during logout:', error)
    // El store ya maneja la limpieza en caso de error
    await router.push('/login')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // Inicializar el store con datos del localStorage
  authStore.initializeAuth()
})
</script>

<style scoped>
.v-navigation-drawer {
  border-right: none !important;
}

.rotating {
  animation: rotate 1s linear infinite;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>