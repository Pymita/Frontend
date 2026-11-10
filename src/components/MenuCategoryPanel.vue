<template>
  <!--
    Ordenar: the handle and the arrows sit next to the title, not inside it
    (the title is a button). The panel turns into a wrapping row so the
    title keeps being its direct child, which is what Vuetify's styles of
    an open panel expect.
  -->
  <v-expansion-panel
    :value="category.id"
    :class="{
      'd-flex flex-wrap align-center': ordering,
      'bg-primary-container': isDropTarget(categoryGroup, index),
      'opacity-50': isDragged(categoryGroup, index),
    }"
    @dragover="dragOver($event, categoryGroup, index)"
    @drop="drop($event, categoryGroup, index, (from, to) => menuOrdering?.moveCategory(parentId, from, to))"
  >
    <div
      v-if="movesCategory"
      class="d-flex align-center align-self-stretch ps-2 cursor-move text-medium-emphasis"
      draggable="true"
      :title="`Arrastrar la categoría ${category.name}`"
      aria-hidden="true"
      @dragstart="dragStart($event, categoryGroup, index)"
      @dragend="dragEnd"
    >
      <v-icon>mdi-drag</v-icon>
    </div>

    <v-expansion-panel-title :class="{ 'w-auto flex-1-1-0': ordering, 'ps-2': movesCategory }">
      <div class="d-flex align-center ga-3">
        <v-avatar v-if="category.image_url" size="32" rounded="lg">
          <v-img :src="resolveImageUrl(category.image_url)" :alt="category.name" />
        </v-avatar>
        <span v-else-if="category.icon" class="text-h6">{{ category.icon }}</span>
        <v-icon v-else class="text-medium-emphasis">mdi-folder-outline</v-icon>

        <div>
          <div class="font-weight-medium">{{ category.name }}</div>
          <div class="text-caption text-medium-emphasis">{{ summary }}</div>
        </div>
      </div>
    </v-expansion-panel-title>

    <div v-if="movesCategory" class="d-flex align-center align-self-stretch pe-1">
      <v-divider vertical class="my-3 me-1" />
      <v-btn
        v-for="move in MOVES"
        :key="move.verb"
        :icon="move.icon"
        size="x-small"
        variant="text"
        :disabled="blocked(move.to(index, siblings.length), index, siblings.length)"
        :aria-label="`${move.verb} la categoría ${category.name}`"
        @click="keepFocus($event, () => menuOrdering?.moveCategory(parentId, index, move.to(index, siblings.length)))"
      />
    </div>

    <v-expansion-panel-text :class="{ 'w-100': ordering }">
      <!-- Productos de esta categoría -->
      <v-list v-if="category.items.length" density="comfortable" class="py-0">
        <v-list-item
          v-for="(item, itemIndex) in category.items"
          :key="item.id"
          class="px-2"
          :class="{
            'bg-primary-container': isDropTarget(itemGroup, itemIndex),
            'opacity-50': isDragged(itemGroup, itemIndex),
          }"
          @dragover="dragOver($event, itemGroup, itemIndex)"
          @drop="drop($event, itemGroup, itemIndex, (from, to) => menuOrdering?.moveItem(category.id, from, to))"
        >
          <template #prepend>
            <div
              v-if="movesItems"
              class="d-flex align-center me-2 cursor-move text-medium-emphasis"
              draggable="true"
              :title="`Arrastrar el producto ${item.name}`"
              aria-hidden="true"
              @dragstart="dragStart($event, itemGroup, itemIndex)"
              @dragend="dragEnd"
            >
              <v-icon>mdi-drag</v-icon>
            </div>
            <v-avatar v-if="item.image_url" size="40" rounded="lg" class="mr-3">
              <v-img :src="resolveImageUrl(item.image_url)" :alt="item.name" />
            </v-avatar>
          </template>
          <v-list-item-title :class="{ 'text-wrap': movesItems }">{{ item.name }}</v-list-item-title>
          <v-list-item-subtitle v-if="item.description || item.variant_group_name">
            {{ item.description }}
            <v-chip v-if="item.variant_group_name" size="x-small" class="ml-1" variant="tonal">
              {{ item.variant_group_name }}
            </v-chip>
          </v-list-item-subtitle>
          <template #append>
            <!-- On a phone the arrows go under the price, so the name keeps its room. -->
            <div class="d-flex flex-column flex-sm-row align-end align-sm-center">
              <span class="font-weight-bold">{{ money(item.price) }}</span>
              <div v-if="movesItems" class="d-flex ms-sm-2">
                <v-btn
                  v-for="move in MOVES"
                  :key="move.verb"
                  :icon="move.icon"
                  size="x-small"
                  variant="text"
                  :disabled="blocked(move.to(itemIndex, category.items.length), itemIndex, category.items.length)"
                  :aria-label="`${move.verb} el producto ${item.name}`"
                  @click="keepFocus($event, () => menuOrdering?.moveItem(category.id, itemIndex, move.to(itemIndex, category.items.length)))"
                />
              </div>
            </div>
          </template>
        </v-list-item>
      </v-list>

      <!-- Subcategorías: mismo acordeón, un nivel más adentro -->
      <v-expansion-panels v-if="category.children.length" multiple variant="accordion" class="mt-2">
        <MenuCategoryPanel
          v-for="child in category.children"
          :key="child.id"
          :category="child"
          :siblings="category.children"
          :parent-id="category.id"
        />
      </v-expansion-panels>
    </v-expansion-panel-text>
  </v-expansion-panel>
</template>

<script lang="ts">
import type { ComputedRef, InjectionKey, Ref } from 'vue'

/** Where a dragged row comes from or would land: its group of siblings and its index there. */
export interface MenuDragPosition {
  group: string
  index: number
}

/** Menú › Ordenar, shared by every level of this recursive panel (provided by Menu.vue). */
export interface MenuOrdering {
  active: ComputedRef<boolean>
  dragging: Ref<MenuDragPosition | null>
  dropTarget: Ref<MenuDragPosition | null>
  moveCategory: (parentId: number | null, from: number, to: number) => void
  moveItem: (categoryId: number, from: number, to: number) => void
}

export const menuOrderingKey: InjectionKey<MenuOrdering> = Symbol('menuOrdering')
</script>

<script setup lang="ts">
import { money } from '@/utils/money'
import { computed, inject, nextTick } from 'vue'
import type { MenuCategoryNode } from '@/services/menuService'
import { resolveImageUrl } from '@/utils/images'

// Componente recursivo: se referencia a sí mismo por nombre de archivo.
defineOptions({ name: 'MenuCategoryPanel' })

const props = defineProps<{
  category: MenuCategoryNode
  /** The category and its sisters, in the menu's order */
  siblings: MenuCategoryNode[]
  /** null for the main categories */
  parentId: number | null
}>()

const MOVES = [
  { verb: 'Subir', icon: 'mdi-arrow-up', to: (index: number) => index - 1 },
  { verb: 'Bajar', icon: 'mdi-arrow-down', to: (index: number) => index + 1 },
  { verb: 'Mover al inicio', icon: 'mdi-format-vertical-align-top', to: () => 0 },
  { verb: 'Mover al final', icon: 'mdi-format-vertical-align-bottom', to: (_: number, total: number) => total - 1 },
]

const menuOrdering = inject(menuOrderingKey, null)
const ordering = computed(() => menuOrdering?.active.value ?? false)
// A row alone in its group has nowhere to go: no handle, no arrows.
const movesCategory = computed(() => ordering.value && props.siblings.length > 1)
const movesItems = computed(() => ordering.value && props.category.items.length > 1)

const index = computed(() => props.siblings.findIndex((sibling) => sibling.id === props.category.id))
const categoryGroup = computed(() => `category:${props.parentId ?? 'root'}`)
const itemGroup = computed(() => `item:${props.category.id}`)

const blocked = (to: number, from: number, total: number) => to === from || to < 0 || to >= total

/**
 * Vue moves the row the button lives in: focus goes back to it, or to the
 * next arrow that still works (at the top "Subir" is off), so a keyboard
 * user can keep moving the same row.
 */
const keepFocus = async (event: MouseEvent, move: () => void) => {
  const button = event.currentTarget as HTMLButtonElement
  move()
  await nextTick()
  const target = button.disabled ? button.parentElement?.querySelector<HTMLButtonElement>('button:not(:disabled)') : button
  target?.focus()
}

const isDragged = (group: string, at: number) =>
  menuOrdering?.dragging.value?.group === group && menuOrdering.dragging.value.index === at

const isDropTarget = (group: string, at: number) =>
  menuOrdering?.dropTarget.value?.group === group &&
  menuOrdering.dropTarget.value.index === at &&
  !isDragged(group, at)

const dragStart = (event: DragEvent, group: string, at: number) => {
  if (!menuOrdering || !event.dataTransfer) return
  menuOrdering.dragging.value = { group, index: at }
  event.dataTransfer.effectAllowed = 'move'
  // Firefox only starts a drag that carries data.
  event.dataTransfer.setData('text/plain', group)
  // The whole row follows the pointer, not just the handle.
  const handle = event.currentTarget as HTMLElement
  const row = handle.closest('.v-list-item') ?? handle.nextElementSibling
  if (row) event.dataTransfer.setDragImage(row, 16, 16)
}

/** Only rows of the same group take the drop; anything else bubbles to the category around it. */
const dragOver = (event: DragEvent, group: string, at: number) => {
  if (menuOrdering?.dragging.value?.group !== group) return
  event.preventDefault()
  event.stopPropagation()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  menuOrdering.dropTarget.value = { group, index: at }
}

const drop = (event: DragEvent, group: string, at: number, move: (from: number, to: number) => void) => {
  const source = menuOrdering?.dragging.value
  if (!source || source.group !== group) return
  event.preventDefault()
  event.stopPropagation()
  dragEnd()
  move(source.index, at)
}

const dragEnd = () => {
  if (!menuOrdering) return
  menuOrdering.dragging.value = null
  menuOrdering.dropTarget.value = null
}

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
