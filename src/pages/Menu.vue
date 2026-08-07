<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-3">
          <div>
            <h1 class="text-h4">Menú</h1>
            <p class="text-body-1 text-grey-darken-1">
              Así ven el menú los meseros en la app móvil y la tablet
            </p>
          </div>
          <div class="d-flex align-center ga-2">
            <v-btn variant="tonal" :loading="loading" @click="load">
              <v-icon start>mdi-refresh</v-icon>
              Actualizar
            </v-btn>
            <v-btn color="primary" to="/categorias">
              <v-icon start>mdi-shape</v-icon>
              Editar categorías
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-alert v-if="!loading && !menu.length" type="info" variant="tonal">
      Todavía no hay nada que mostrar. Publica productos en el menú y marca las
      categorías como visibles en la app.
    </v-alert>

    <v-row v-else>
      <v-col cols="12" md="8">
        <!-- Vista tipo tablet: acordeón por categorías anidadas -->
        <v-card class="pa-2">
          <v-expansion-panels v-model="openPanels" multiple variant="accordion">
            <MenuCategoryPanel
              v-for="category in menu"
              :key="category.id"
              :category="category"
            />
          </v-expansion-panels>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <h2 class="text-subtitle-1 font-weight-bold mb-3">Resumen</h2>
          <div class="d-flex justify-space-between mb-2">
            <span class="text-grey-darken-1">Categorías visibles</span>
            <strong>{{ stats.categories }}</strong>
          </div>
          <div class="d-flex justify-space-between mb-2">
            <span class="text-grey-darken-1">Productos en el menú</span>
            <strong>{{ stats.items }}</strong>
          </div>
          <div class="d-flex justify-space-between">
            <span class="text-grey-darken-1">Niveles usados</span>
            <strong>{{ stats.depth }}</strong>
          </div>
          <v-divider class="my-3" />
          <p class="text-caption text-grey">
            Solo aparecen las categorías visibles en la app que tienen productos
            (propios o en sus subcategorías). Si ocultas una categoría, sus
            subcategorías también se ocultan.
          </p>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" color="error" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { categoriesService, type MenuCategoryNode } from '@/services/menuService'
import MenuCategoryPanel from '@/components/MenuCategoryPanel.vue'

const loading = ref(false)
const menu = ref<MenuCategoryNode[]>([])
const openPanels = ref<number[]>([])

const snackbar = ref({ show: false, text: '' })

const countNodes = (nodes: MenuCategoryNode[]): { categories: number; items: number; depth: number } =>
  nodes.reduce(
    (acc, node) => {
      const child = countNodes(node.children)
      return {
        categories: acc.categories + 1 + child.categories,
        items: acc.items + node.items.length + child.items,
        depth: Math.max(acc.depth, 1 + child.depth),
      }
    },
    { categories: 0, items: 0, depth: 0 },
  )

const stats = computed(() => countNodes(menu.value))

const load = async () => {
  loading.value = true
  try {
    menu.value = await categoriesService.getMenuPreview()
    // Abrir las categorías principales para ver el menú de un vistazo.
    openPanels.value = menu.value.map((_, index) => index)
  } catch (error: any) {
    snackbar.value = {
      show: true,
      text: error.response?.data?.message || 'Error al cargar el menú',
    }
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>
