<template>
  <v-app>
    <!-- Navigation Drawer -->
    <v-navigation-drawer
      v-if="$route.name !== 'Login'"
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
          v-for="item in menuItems"
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
            prepend-icon="mdi-logout"
            title="Cerrar Sesión"
            @click="logout"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- App Bar -->
    <v-app-bar v-if="$route.name !== 'Login'" app color="white" elevation="1">
      <v-app-bar-title>{{ pageTitle }}</v-app-bar-title>
      <v-spacer></v-spacer>
      <v-chip color="primary" variant="outlined" class="mr-2">
        <v-icon start>mdi-account</v-icon>
        {{ currentUser?.name || 'Usuario' }}
      </v-chip>
    </v-app-bar>

    <!-- Main Content -->
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

// Mock user data - replace with actual auth store
const currentUser = ref({
  name: 'Administrador',
  role: 'admin'
})

const menuItems = [
  { title: 'Dashboard', icon: 'mdi-view-dashboard', route: '/dashboard' },
  { title: 'Productos', icon: 'mdi-food', route: '/products' },
  { title: 'Pedidos', icon: 'mdi-receipt', route: '/orders' },
  { title: 'Inventario', icon: 'mdi-package-variant', route: '/inventory' },
  { title: 'Reportes', icon: 'mdi-chart-box', route: '/reports' },
  { title: 'Usuarios', icon: 'mdi-account-group', route: '/users' },
]

const pageTitle = computed(() => {
  const item = menuItems.find(item => item.route === route.path)
  return item?.title || 'Sabores del Trigo'
})

const logout = () => {
  // TODO: Implement actual logout logic
  router.push('/login')
}
</script>

<style scoped>
.v-navigation-drawer {
  border-right: none !important;
}
</style>