<template>
  <v-expansion-panel>
    <v-expansion-panel-title>
      <div class="d-flex align-center ga-3">
        <v-avatar v-if="category.image_url" size="32" rounded="lg">
          <v-img :src="category.image_url" :alt="category.name" />
        </v-avatar>
        <span v-else-if="category.icon" class="text-h6">{{ category.icon }}</span>
        <v-icon v-else color="grey">mdi-folder-outline</v-icon>

        <div>
          <div class="font-weight-medium">{{ category.name }}</div>
          <div class="text-caption text-grey">{{ summary }}</div>
        </div>
      </div>
    </v-expansion-panel-title>

    <v-expansion-panel-text>
      <!-- Productos de esta categoría -->
      <v-list v-if="category.items.length" density="comfortable" class="py-0">
        <v-list-item v-for="item in category.items" :key="item.id" class="px-2">
          <template #prepend>
            <v-avatar v-if="item.image_url" size="40" rounded="lg" class="mr-3">
              <v-img :src="item.image_url" :alt="item.name" />
            </v-avatar>
          </template>
          <v-list-item-title>{{ item.name }}</v-list-item-title>
          <v-list-item-subtitle v-if="item.description || item.variant_group_name">
            {{ item.description }}
            <v-chip v-if="item.variant_group_name" size="x-small" class="ml-1" variant="tonal">
              {{ item.variant_group_name }}
            </v-chip>
          </v-list-item-subtitle>
          <template #append>
            <span class="font-weight-bold">${{ Number(item.price ?? 0).toLocaleString('es-CO') }}</span>
          </template>
        </v-list-item>
      </v-list>

      <!-- Subcategorías: mismo acordeón, un nivel más adentro -->
      <v-expansion-panels v-if="category.children.length" multiple variant="accordion" class="mt-2">
        <MenuCategoryPanel
          v-for="child in category.children"
          :key="child.id"
          :category="child"
        />
      </v-expansion-panels>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MenuCategoryNode } from '@/services/menuService'

// Componente recursivo: se referencia a sí mismo por nombre de archivo.
defineOptions({ name: 'MenuCategoryPanel' })

const props = defineProps<{ category: MenuCategoryNode }>()

const summary = computed(() => {
  const parts: string[] = []
  if (props.category.items.length) {
    parts.push(`${props.category.items.length} producto${props.category.items.length === 1 ? '' : 's'}`)
  }
  if (props.category.children.length) {
    parts.push(`${props.category.children.length} subcategoría${props.category.children.length === 1 ? '' : 's'}`)
  }
  return parts.join(' · ')
})
</script>
