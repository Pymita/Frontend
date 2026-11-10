<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-3">
          <div>
            <h1 class="text-h4">Menú</h1>
            <p class="text-body-1 text-medium-emphasis">
              Así ven el menú los meseros en la app móvil y la tablet
            </p>
          </div>
          <div class="d-flex align-center flex-wrap ga-2">
            <v-btn variant="tonal" :loading="loading" @click="load">
              <v-icon start>mdi-refresh</v-icon>
              Actualizar
            </v-btn>
            <LockableButton
              :variant="ordering ? 'flat' : 'tonal'"
              :color="ordering ? 'secondary' : undefined"
              :icon="ordering ? 'mdi-check' : 'mdi-swap-vertical'"
              :disabled="!menu.length"
              @click="ordering = !ordering"
            >
              {{ ordering ? 'Listo' : 'Ordenar' }}
            </LockableButton>
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
        <v-alert
          v-if="orderingActive"
          type="info"
          variant="tonal"
          density="compact"
          icon="mdi-gesture-tap-hold"
          class="mb-2"
        >
          Arrastra las categorías y los productos, o usa las flechas. Los meseros
          ven el menú en este orden.
        </v-alert>
        <!-- Outside the alert: an alert re-reads all of its text on every change. -->
        <p v-if="orderingActive" class="text-body-2 text-medium-emphasis mb-3" role="status">
          {{ saveLabel }}
        </p>

        <!-- Vista tipo tablet: acordeón por categorías anidadas -->
        <v-card class="pa-2">
          <v-expansion-panels v-model="openPanels" multiple variant="accordion">
            <MenuCategoryPanel
              v-for="category in menu"
              :key="category.id"
              :category="category"
              :siblings="menu"
              :parent-id="null"
            />
          </v-expansion-panels>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <h2 class="text-subtitle-1 font-weight-bold mb-3">Resumen</h2>
          <div class="d-flex justify-space-between mb-2">
            <span class="text-medium-emphasis">Categorías visibles</span>
            <strong>{{ stats.categories }}</strong>
          </div>
          <div class="d-flex justify-space-between mb-2">
            <span class="text-medium-emphasis">Productos en el menú</span>
            <strong>{{ stats.items }}</strong>
          </div>
          <div class="d-flex justify-space-between">
            <span class="text-medium-emphasis">Niveles usados</span>
            <strong>{{ stats.depth }}</strong>
          </div>
          <v-divider class="my-3" />
          <p class="text-caption text-medium-emphasis">
            Solo aparecen las categorías visibles en la app que tienen productos
            (propios o en sus subcategorías). Si ocultas una categoría, sus
            subcategorías también se ocultan. El orden es el de la app: cámbialo
            con «Ordenar».
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
import { errorMessage } from '@/utils/errors'
import { computed, onMounted, provide, ref } from 'vue'
import { categoriesService, menuItemsService, type MenuCategoryNode } from '@/services/menuService'
import MenuCategoryPanel, { menuOrderingKey, type MenuDragPosition } from '@/components/MenuCategoryPanel.vue'
import LockableButton from '@/components/LockableButton.vue'
import { useReadOnly } from '@/composables/useReadOnly'

const loading = ref(false)
const menu = ref<MenuCategoryNode[]>([])
// By category id, so an open panel stays open when it changes place.
const openPanels = ref<number[]>([])

const snackbar = ref({ show: false, text: '' })

// Suscripción vencida: "Ordenar" queda en gris, como el resto de lo que escribe.
const isReadOnly = useReadOnly()
const ordering = ref(false)
const orderingActive = computed(() => ordering.value && !isReadOnly.value)
const saveState = ref<'saving' | 'saved' | null>(null)
// Never empty, so the line keeps its height and the rows do not jump on the first move.
const saveLabel = computed(() =>
  saveState.value ? { saving: 'Guardando…', saved: 'Orden guardado.' }[saveState.value] : 'Cada cambio se guarda al instante.',
)
let pendingSaves = 0
let saveFailed = false
let saveQueue: Promise<void> = Promise.resolve()

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
    openPanels.value = menu.value.map((category) => category.id)
  } catch (error: any) {
    snackbar.value = {
      show: true,
      text: errorMessage(error, 'No fue posible cargar el menú. Inténtalo de nuevo.'),
    }
  } finally {
    loading.value = false
  }
}

const findCategory = (nodes: MenuCategoryNode[], id: number): MenuCategoryNode | undefined => {
  for (const node of nodes) {
    const found = node.id === id ? node : findCategory(node.children, id)
    if (found) return found
  }
  return undefined
}

/** Moves one entry in place; the ids in their new order, or null when nothing moves. */
const moveEntry = (list: { id: number }[], from: number, to: number): number[] | null => {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return null
  list.splice(to, 0, ...list.splice(from, 1))
  return list.map((entry) => entry.id)
}

/**
 * The row moves at once and its group is saved behind it. Saves go one
 * after another, each with its group's whole order, so quick clicks end in
 * the last order and the arrows never wait (or lose the keyboard focus).
 */
const saveOrder = (save: () => Promise<void>) => {
  pendingSaves++
  saveState.value = 'saving'
  saveQueue = saveQueue
    .then(save)
    .catch(async (error) => {
      saveFailed = true
      snackbar.value = {
        show: true,
        text: errorMessage(error, 'No fue posible guardar el orden. Inténtalo de nuevo.'),
      }
      // Back to the order the waiters really have.
      await load()
    })
    .finally(() => {
      pendingSaves--
      if (pendingSaves === 0) {
        saveState.value = saveFailed ? null : 'saved'
        saveFailed = false
      }
    })
}

const moveCategory = (parentId: number | null, from: number, to: number) => {
  const siblings = parentId === null ? menu.value : findCategory(menu.value, parentId)?.children
  const ids = siblings ? moveEntry(siblings, from, to) : null
  if (ids) saveOrder(() => categoriesService.reorder(parentId, ids))
}

const moveItem = (categoryId: number, from: number, to: number) => {
  const items = findCategory(menu.value, categoryId)?.items
  const ids = items ? moveEntry(items, from, to) : null
  if (ids) saveOrder(() => menuItemsService.reorder(categoryId, ids))
}

provide(menuOrderingKey, {
  active: orderingActive,
  dragging: ref<MenuDragPosition | null>(null),
  dropTarget: ref<MenuDragPosition | null>(null),
  moveCategory,
  moveItem,
})

onMounted(load)
</script>
