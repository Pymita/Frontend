<template>
  <v-app>
    <v-navigation-drawer
      v-if="$route.name !== 'Login' && isAuthenticated"
      v-model="drawer"
      app
      :permanent="!smAndDown"
      :temporary="smAndDown"
      width="264"
      color="chrome"
      border="0"
    >
      <div class="d-flex align-center ga-3 px-4 pt-4 pb-1">
        <img :src="APP_ICON" :alt="APP_NAME" width="36" height="36" class="flex-shrink-0" />
        <div class="text-truncate">
          <div class="text-h6 font-weight-bold text-truncate">{{ companyName }}</div>
          <div class="text-overline text-chrome-overline">{{ APP_NAME }}</div>
        </div>
      </div>

      <!-- "multiple": the default strategy closes every section when a page
           outside it becomes active, so Administración would fold by itself. -->
      <v-list
        v-model:opened="openedGroups"
        open-strategy="multiple"
        nav
        density="compact"
        base-color="chrome-text"
        color="on-chrome-active"
      >
        <template v-for="group in menuGroups" :key="group.title">
          <v-list-group v-if="isCollapsible(group.title)" :value="group.title" fluid>
            <template #activator="{ props: activator, isOpen }">
              <v-list-item v-bind="activator" :aria-expanded="isOpen" min-height="32">
                <v-list-item-title class="text-overline text-chrome-overline">{{ group.title }}</v-list-item-title>
              </v-list-item>
            </template>
            <v-list-item
              v-for="item in group.items"
              :key="item.title"
              :to="item.route"
              :exact="item.route === '/plataforma'"
              :prepend-icon="item.icon"
              :title="item.title"
              active-class="bg-chrome-active"
              min-height="34"
            />
          </v-list-group>

          <template v-else>
            <v-list-subheader v-if="menuGroups.length > 1" class="text-overline text-chrome-overline">
              {{ group.title }}
            </v-list-subheader>
            <v-list-item
              v-for="item in group.items"
              :key="item.title"
              :to="item.route"
              :exact="item.route === '/plataforma'"
              :prepend-icon="item.icon"
              :title="item.title"
              active-class="bg-chrome-active"
              min-height="34"
            />
          </template>
        </template>
      </v-list>

      <template v-slot:append>
        <v-divider></v-divider>
        <v-list nav density="compact" base-color="chrome-text">
          <v-list-item
            :prepend-icon="loading ? 'mdi-loading' : 'mdi-logout'"
            :title="loading ? 'Cerrando sesión...' : 'Cerrar sesión'"
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
    <v-app-bar v-if="$route.name !== 'Login' && isAuthenticated" app color="surface" flat border="b">
      <v-app-bar-nav-icon v-if="smAndDown" aria-label="Abrir menú" @click="drawer = !drawer" />
      <v-app-bar-title>{{ pageTitle }}</v-app-bar-title>
      <div class="d-flex align-center ga-2 mr-4">
        <v-avatar color="primary-container" size="32">
          <span class="text-caption font-weight-bold">{{ userInitials }}</span>
        </v-avatar>
        <span v-if="!smAndDown" class="text-body-2 font-weight-medium">{{ currentUser?.name || 'Usuario' }}</span>
        <v-chip v-if="roleLabel" size="small" color="secondary" variant="tonal">{{ roleLabel }}</v-chip>
      </div>
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
import { useDisplay } from 'vuetify'
import invoicingService from './services/invoicingService'
import { useAuthStore } from './stores/auth'
import { effectiveFeatures } from './types/auth'
import { APP_ICON, APP_NAME } from './utils/branding'
import { SUBSCRIPTION_BLOCKED_EVENT, TWO_FACTOR_REQUIRED_EVENT } from './services/api'
import type { MenuItem } from './types'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const loading = ref<boolean>(false)

// On phones and small tablets a fixed 280px menu leaves no room for the
// page: it becomes a drawer opened from the app bar.
const { smAndDown } = useDisplay()
const drawer = ref(!smAndDown.value)
watch(smAndDown, small => { drawer.value = !small })
watch(() => route.fullPath, () => {
  if (smAndDown.value) drawer.value = false
})

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

// El backend cerró el panel porque la cuenta de plataforma no tiene su
// segundo factor (p. ej. se activó la exigencia con la sesión abierta).
const onTwoFactorRequired = async () => {
  await authStore.getCurrentUser()
  router.push('/plataforma/seguridad')
}

const MENU_GROUPS = ['Operación', 'Catálogo', 'Administración', 'Plataforma']

const allMenuItems: MenuItem[] = [
  { title: 'Inicio', icon: 'mdi-view-dashboard', route: '/dashboard', feature: 'reports', group: 'Operación' },
  { title: 'Pedidos', icon: 'mdi-receipt-text', route: '/pedidos', feature: 'orders', group: 'Operación' },
  { title: 'Ventas', icon: 'mdi-cash-register', route: '/ventas', feature: 'reports', group: 'Operación' },
  { title: 'Mesas', icon: 'mdi-table-chair', route: '/mesas', feature: 'orders', group: 'Operación' },
  { title: 'Plano del salón', icon: 'mdi-floor-plan', route: '/plano', feature: 'orders', group: 'Operación' },
  { title: 'Menú', icon: 'mdi-book-open-variant', route: '/menu', feature: 'menu', group: 'Catálogo' },
  { title: 'Categorías', icon: 'mdi-shape', route: '/categorias', feature: 'menu', group: 'Catálogo' },
  { title: 'Productos', icon: 'mdi-package-variant', route: '/productos-base', feature: 'inventory', group: 'Catálogo' },
  { title: 'Recetas', icon: 'mdi-food-variant', route: '/recetas', feature: 'recipes', group: 'Catálogo' },
  { title: 'Kardex', icon: 'mdi-clipboard-text-clock', route: '/kardex', feature: 'inventory', group: 'Catálogo' },
  { title: 'Variantes', icon: 'mdi-tag-multiple', route: '/tipos-producto', requiresAdmin: true, feature: 'menu', group: 'Catálogo' },
  { title: 'Facturación automática', icon: 'mdi-calendar-sync', route: '/facturacion-automatica', feature: 'recurring_billing', group: 'Operación' },
  { title: 'Clientes', icon: 'mdi-account-multiple', route: '/clientes', feature: 'customers', group: 'Administración' },
  { title: 'Gastos', icon: 'mdi-cash-multiple', route: '/gastos', feature: 'expenses', group: 'Administración' },
  { title: 'Finanzas', icon: 'mdi-finance', route: '/finanzas', requiresAdmin: true, group: 'Administración' },
  { title: 'Empleados', icon: 'mdi-account-cog', route: '/empleados', requiresAdmin: true, group: 'Administración' },
  { title: 'Configuración', icon: 'mdi-cog', route: '/configuracion', requiresAdmin: true, group: 'Administración' },
  { title: 'Empresas', icon: 'mdi-domain', route: '/plataforma', superAdminOnly: true, group: 'Plataforma' },
  { title: 'Vendedores', icon: 'mdi-account-tie', route: '/plataforma/vendedores', superAdminOnly: true, group: 'Plataforma' },
  { title: 'Ventas por vendedor', icon: 'mdi-chart-line', route: '/plataforma/ventas', superAdminOnly: true, group: 'Plataforma' },
  { title: 'Seguridad', icon: 'mdi-shield-key', route: '/plataforma/seguridad', superAdminOnly: true, group: 'Plataforma' },
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

// A single visible section needs no heading (employees with one area, platform staff).
const menuGroups = computed(() =>
  MENU_GROUPS
    .map(title => ({ title, items: availableMenuItems.value.filter(item => item.group === title) }))
    .filter(group => group.items.length > 0)
)

// Operación and Catálogo (orders, kardex) are the daily work and never hide.
// Only the management section folds, so the fixed ones fit at 700px of height.
const COLLAPSIBLE_GROUP = 'Administración'
const isCollapsible = (group: string): boolean =>
  menuGroups.value.length > 1 && group === COLLAPSIBLE_GROUP

const openedGroups = ref<string[]>([])

// La sección de la página actual se abre sola (al entrar por URL o al
// navegar), así el ítem activo nunca queda escondido.
watch(
  [() => route.path, menuGroups],
  () => {
    const current = availableMenuItems.value.find(item => item.route === route.path)
    if (current?.group && isCollapsible(current.group)) {
      openedGroups.value = [current.group]
    }
  },
  { immediate: true },
)

const userInitials = computed((): string => {
  const words = (currentUser.value?.name || 'Usuario').trim().split(/\s+/)
  return words.slice(0, 2).map(word => word.charAt(0).toUpperCase()).join('')
})

const roleLabel = computed((): string | null => {
  if (isSuperAdmin.value) return 'Plataforma'
  if (currentUser.value?.role === 'admin') return 'Admin'
  return null
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
  window.addEventListener(TWO_FACTOR_REQUIRED_EVENT, onTwoFactorRequired)
  checkResolutionStatus()
})

onUnmounted(() => {
  window.removeEventListener(SUBSCRIPTION_BLOCKED_EVENT, onSubscriptionBlocked)
  window.removeEventListener(TWO_FACTOR_REQUIRED_EVENT, onTwoFactorRequired)
})
</script>

<style scoped>
.v-list-item--active::before {
  content: '';
  position: absolute;
  inset-block: 8px;
  inset-inline-start: 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: rgb(var(--v-theme-chrome-indicator));
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