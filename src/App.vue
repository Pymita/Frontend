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
          {{ companyName }}
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
        <v-chip-text v-else-if="isSuperAdmin" class="ml-2" color="error" size="x-small">
          Plataforma
        </v-chip-text>
      </v-chip>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <!-- Aviso de suscripción: prueba por vencer, pago vencido o cuenta bloqueada -->
      <v-alert
        v-if="subscriptionNotice"
        :type="subscriptionAlertType"
        variant="tonal"
        density="compact"
        class="ma-3 mb-0"
      >
        {{ subscriptionNotice }}
      </v-alert>

      <!-- Alerta de la resolución de facturación: rango por agotarse o
           vencer. El umbral lo calcula el backend según el ritmo del local. -->
      <v-alert
        v-if="resolutionNotice"
        :type="resolutionBlocking ? 'error' : 'warning'"
        variant="tonal"
        density="compact"
        class="ma-3 mb-0"
        closable
      >
        {{ resolutionNotice }}
      </v-alert>

      <router-view :key="route.fullPath" />
    </v-main>

    <!-- Loading overlay -->
    <v-overlay v-model="loading" persistent class="align-center justify-center">
      <div class="text-center">
        <v-progress-circular color="primary" indeterminate size="64" />
        <p class="text-body-2 text-white mt-3">Cerrando sesión...</p>
      </div>
    </v-overlay>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import invoicingService from './services/invoicingService'
import { useAuthStore } from './stores/auth'
import { effectiveFeatures } from './types/auth'
import { APP_NAME } from './utils/branding'
import { SUBSCRIPTION_BLOCKED_EVENT } from './services/api'
import type { MenuItem } from './types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref<boolean>(false)

// Usar computed del store directamente
const isAuthenticated = computed(() => authStore.isAuthenticated)
const currentUser = computed(() => authStore.user)
const isAdmin = computed(() => authStore.isAdmin)
const isSuperAdmin = computed(() => currentUser.value?.role === 'super_admin')
// Company of the logged-in session (multi-tenant backend).
const companyName = computed(() =>
  isSuperAdmin.value ? 'Plataforma' : (currentUser.value?.company?.name || APP_NAME)
)

// --- Aviso de suscripción ---
const subscriptionStatus = computed(() => currentUser.value?.company?.subscription?.status)

const subscriptionNotice = computed(() => {
  if (isSuperAdmin.value) return null
  if (authStore.readOnlyMessage) return authStore.readOnlyMessage

  const subscription = currentUser.value?.company?.subscription
  if (!subscription || subscription.status === 'active') return null

  return subscription.notice
})

const subscriptionAlertType = computed(() => {
  if (authStore.isReadOnly) return 'error'
  if (subscriptionStatus.value === 'grace') return 'warning'
  return 'info'
})

// El backend responde 402 cuando la cuenta quedó en solo lectura: se marca
// en el store para que además desaparezcan las acciones que escriben.
const onSubscriptionBlocked = (event: Event) => {
  authStore.markBlocked((event as CustomEvent).detail)
}

const allMenuItems: MenuItem[] = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', route: '/dashboard', feature: 'reports' },
  { title: 'Pedidos', icon: 'mdi-receipt', route: '/pedidos', feature: 'orders' },
  { title: 'Mesas', icon: 'mdi-table-chair', route: '/mesas', feature: 'orders' },
  { title: 'Plano del Salón', icon: 'mdi-floor-plan', route: '/plano', feature: 'orders' },
  { title: 'Menú', icon: 'mdi-book-open-variant', route: '/menu', feature: 'menu' },
  { title: 'Categorías', icon: 'mdi-shape', route: '/categorias', feature: 'menu' },
  { title: 'Productos', icon: 'mdi-package-variant', route: '/productos-base', feature: 'inventory' },
  { title: 'Recetas', icon: 'mdi-food-variant', route: '/recetas', feature: 'recipes' },
  { title: 'Kardex', icon: 'mdi-clipboard-text-clock', route: '/kardex', feature: 'inventory' },
  { title: 'Tipos de Producto', icon: 'mdi-tag-multiple', route: '/tipos-producto', requiresAdmin: true },
  { title: 'Clientes', icon: 'mdi-account-multiple', route: '/clientes', feature: 'customers' },
  { title: 'Gastos', icon: 'mdi-cash-multiple', route: '/gastos', feature: 'expenses' },
  { title: 'Finanzas', icon: 'mdi-finance', route: '/finanzas', requiresAdmin: true },
  { title: 'Empleados', icon: 'mdi-account-cog', route: '/empleados', requiresAdmin: true },
  { title: 'Configuración', icon: 'mdi-cog', route: '/configuracion', requiresAdmin: true },
  { title: 'Plataforma', icon: 'mdi-domain', route: '/plataforma', superAdminOnly: true },
]

const availableMenuItems = computed((): MenuItem[] => {
  // Platform staff only sees the platform panel.
  if (isSuperAdmin.value) {
    return allMenuItems.filter((item: MenuItem) => item.superAdminOnly)
  }

  const features = effectiveFeatures(currentUser.value)

  return allMenuItems.filter((item: MenuItem) => {
    if (item.superAdminOnly) {
      return false
    }
    if (item.requiresAdmin && !isAdmin.value) {
      return false
    }
    // La verificación aplica también al admin: sus funciones ya vienen
    // limitadas a los módulos que su empresa tiene contratados.
    if (item.feature) {
      return features.includes(item.feature as any)
    }
    return true
  })
})

const pageTitle = computed((): string => {
  const item = allMenuItems.find((item: MenuItem) => item.route === route.path)
  return item?.title || APP_NAME
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

// Alerta del rango de la resolución de facturación (calculada en el backend).
const resolutionNotice = ref<string | null>(null)
const resolutionBlocking = ref(false)
let resolutionCheckedAt = 0
const RESOLUTION_CHECK_INTERVAL_MS = 10 * 60 * 1000

const checkResolutionStatus = async (force = false) => {
  if (!authStore.isAuthenticated || authStore.user?.role === 'super_admin') return
  if (!force && Date.now() - resolutionCheckedAt < RESOLUTION_CHECK_INTERVAL_MS) return
  resolutionCheckedAt = Date.now()
  try {
    const status = await invoicingService.status()
    resolutionNotice.value = status.warning ? status.message ?? null : null
    resolutionBlocking.value = !!status.blocking
  } catch {
    // Sin permisos o sin red: la alerta simplemente no se muestra.
  }
}

// Al navegar se re-verifica como máximo cada 10 minutos: quien pasa el día
// en la web se entera el mismo día en que el rango entra en zona de alerta.
watch(() => route.fullPath, () => checkResolutionStatus())

onMounted(() => {
  // Inicializar el store con datos del localStorage
  authStore.initializeAuth()
  window.addEventListener(SUBSCRIPTION_BLOCKED_EVENT, onSubscriptionBlocked)
  checkResolutionStatus()
})

onUnmounted(() => {
  window.removeEventListener(SUBSCRIPTION_BLOCKED_EVENT, onSubscriptionBlocked)
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