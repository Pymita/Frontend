<template>
  <v-dialog :model-value="modelValue" max-width="1000" scrollable @update:model-value="close">
    <v-card>
      <v-card-title class="bg-primary">
        <v-icon start>mdi-content-duplicate</v-icon>
        Copiar catálogo base a {{ company?.name }}
      </v-card-title>

      <v-card-text class="pt-4">
        <p class="text-body-2 text-grey-darken-1 mb-4">
          Elige una plantilla y marca lo que quieras llevarte. Los productos llegan
          <strong>sin inventario</strong>: cada negocio registra el suyo.
        </p>

        <v-select
          v-model="templateId"
          :items="templates"
          :item-title="templateTitle"
          item-value="id"
          label="Catálogo base"
          :loading="loadingTemplates"
          density="comfortable"
          class="mb-2"
        />

        <div v-if="loadingCatalog" class="text-center py-8">
          <v-progress-circular indeterminate color="primary" />
        </div>

        <template v-else-if="catalog">
          <div class="d-flex align-center flex-wrap ga-2 mb-3">
            <v-btn size="small" variant="tonal" @click="selectAll">Seleccionar todo</v-btn>
            <v-btn size="small" variant="text" @click="clearSelection">Quitar todo</v-btn>
            <v-spacer />
            <span class="text-body-2">
              {{ selectedProducts.length }} productos y
              {{ selectedCategories.length }} categorías elegidas
            </span>
          </div>

          <v-expansion-panels multiple variant="accordion">
            <v-expansion-panel v-for="group in grouped" :key="group.category.id">
              <v-expansion-panel-title>
                <div class="d-flex align-center" style="width: 100%">
                  <v-checkbox
                    :model-value="selectedCategories.includes(group.category.id)"
                    hide-details
                    density="compact"
                    class="mr-2 flex-grow-0"
                    @click.stop
                    @update:model-value="toggleCategory(group.category.id, $event)"
                  />
                  <span class="font-weight-bold">{{ group.path }}</span>
                  <v-chip size="x-small" class="ml-2" variant="tonal">
                    {{ group.products.length }}
                  </v-chip>
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <p v-if="group.products.length === 0" class="text-grey text-body-2">
                  Esta categoría no tiene productos.
                </p>
                <v-checkbox
                  v-for="product in group.products"
                  :key="product.id"
                  :model-value="selectedProducts.includes(product.id)"
                  :label="`${product.name} — $${Number(product.sale_price ?? 0).toLocaleString('es-CO')}`"
                  hide-details
                  density="compact"
                  @update:model-value="toggleProduct(product.id, $event)"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </template>

        <v-alert v-if="error" type="error" class="mt-3" density="compact">
          {{ error }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="copying" @click="close(false)">Cancelar</v-btn>
        <v-btn
          color="primary"
          :loading="copying"
          :disabled="selectedProducts.length === 0 && selectedCategories.length === 0"
          @click="copy"
        >
          <v-icon start>mdi-content-copy</v-icon>
          Copiar
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  catalogTemplatesService,
  type CatalogTemplate,
  type TemplateCatalog,
} from '@/services/catalogTemplatesService'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{
  modelValue: boolean
  company: { id: number; name: string } | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  copied: [summary: { categories: number; products: number }]
}>()

const templates = ref<CatalogTemplate[]>([])
const templateId = ref<number | null>(null)
const catalog = ref<TemplateCatalog | null>(null)
const selectedCategories = ref<number[]>([])
const selectedProducts = ref<number[]>([])
const loadingTemplates = ref(false)
const loadingCatalog = ref(false)
const copying = ref(false)
const error = ref('')

const templateTitle = (template: CatalogTemplate) =>
  `${template.name} (${template.products_count} productos)`

watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    error.value = ''
    resetSelection()
    loadingTemplates.value = true

    try {
      templates.value = await catalogTemplatesService.list()
      templateId.value = templates.value[0]?.id ?? null
    } catch (err) {
      error.value = errorMessage(err, 'No se pudieron cargar las plantillas: ')
    } finally {
      loadingTemplates.value = false
    }
  },
)

watch(templateId, async (id) => {
  catalog.value = null
  resetSelection()

  if (!id) return

  loadingCatalog.value = true
  try {
    catalog.value = await catalogTemplatesService.catalog(id)
  } catch (err) {
    error.value = errorMessage(err, 'No se pudo cargar el catálogo: ')
  } finally {
    loadingCatalog.value = false
  }
})

/** Productos agrupados por categoría, con la ruta completa como título. */
const grouped = computed(() => {
  if (!catalog.value) return []

  const byId = new Map(catalog.value.categories.map((category) => [category.id, category]))

  const pathOf = (id: number): string => {
    const names: string[] = []
    let current = byId.get(id)

    while (current) {
      names.unshift(current.name)
      current = current.parent_id ? byId.get(current.parent_id) : undefined
    }

    return names.join(' › ')
  }

  return catalog.value.categories.map((category) => ({
    category,
    path: pathOf(category.id),
    products: catalog.value!.products.filter((product) => product.category_id === category.id),
  }))
})

const resetSelection = () => {
  selectedCategories.value = []
  selectedProducts.value = []
}

const toggleCategory = (id: number, checked: unknown) => {
  if (checked) {
    if (!selectedCategories.value.includes(id)) selectedCategories.value.push(id)
    // Marcar la categoría se lleva sus productos: es lo que uno espera.
    const group = grouped.value.find((entry) => entry.category.id === id)
    group?.products.forEach((product) => {
      if (!selectedProducts.value.includes(product.id)) selectedProducts.value.push(product.id)
    })
    return
  }

  selectedCategories.value = selectedCategories.value.filter((value) => value !== id)
  const group = grouped.value.find((entry) => entry.category.id === id)
  const ids = group?.products.map((product) => product.id) ?? []
  selectedProducts.value = selectedProducts.value.filter((value) => !ids.includes(value))
}

const toggleProduct = (id: number, checked: unknown) => {
  if (checked) {
    if (!selectedProducts.value.includes(id)) selectedProducts.value.push(id)
    return
  }

  selectedProducts.value = selectedProducts.value.filter((value) => value !== id)
}

const selectAll = () => {
  selectedCategories.value = grouped.value.map((group) => group.category.id)
  selectedProducts.value = (catalog.value?.products ?? []).map((product) => product.id)
}

const clearSelection = () => resetSelection()

const close = (value: boolean) => {
  if (!value) {
    catalog.value = null
    resetSelection()
  }
  emit('update:modelValue', value)
}

const copy = async () => {
  if (!props.company || !templateId.value) return

  copying.value = true
  error.value = ''

  try {
    const result = await catalogTemplatesService.copy(props.company.id, {
      source_company_id: templateId.value,
      category_ids: selectedCategories.value,
      product_ids: selectedProducts.value,
    })

    emit('copied', { categories: result.categories, products: result.products })
    close(false)
  } catch (err) {
    error.value = errorMessage(err, 'No se pudo copiar: ')
  } finally {
    copying.value = false
  }
}
</script>
