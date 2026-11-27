<template>
  <v-row>
    <!-- The lists: who each one is for, and how many use it -->
    <v-col cols="12" md="4">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between flex-wrap ga-2">
          <span>Listas de precios</span>
          <LockableButton icon="mdi-plus" color="primary" size="small" @click="openListDialog()">
            Nueva lista
          </LockableButton>
        </v-card-title>
        <v-card-text class="pt-0">
          <p class="text-body-2 text-medium-emphasis mb-2">
            El cliente compra con su lista; si no tiene, con la de su segmento; si tampoco, al precio base.
          </p>
          <div v-if="loading" class="text-center py-6">
            <v-progress-circular indeterminate color="primary" />
          </div>
          <p v-else-if="lists.length === 0" class="text-body-2 text-medium-emphasis py-4">
            Todavía no tienes listas. Crea una, por ejemplo «Mayoristas», y ponle los precios que cambian.
          </p>
          <v-list v-else density="compact" class="py-0">
            <v-list-item
              v-for="list in lists"
              :key="list.id"
              :active="selected?.id === list.id"
              color="primary"
              rounded
              :title="list.name"
              :subtitle="list.description || undefined"
              @click="select(list)"
            >
              <div class="d-flex flex-wrap ga-1 mt-1">
                <v-chip v-if="!list.active" size="x-small" variant="tonal">Inactiva</v-chip>
                <v-chip size="x-small" variant="outlined">{{ countLabel(list.items_count, 'precio', 'precios') }}</v-chip>
                <v-chip size="x-small" variant="outlined">{{ countLabel(list.customers_count, 'cliente', 'clientes') }}</v-chip>
                <v-chip v-if="list.segments_count" size="x-small" variant="outlined">
                  {{ countLabel(list.segments_count, 'segmento', 'segmentos') }}
                </v-chip>
              </div>
              <template #append>
                <v-btn
                  icon="mdi-pencil"
                  size="x-small"
                  variant="text"
                  :disabled="isReadOnly"
                  :aria-label="`Editar la lista ${list.name}`"
                  @click.stop="openListDialog(list)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  color="error"
                  :disabled="isReadOnly"
                  :aria-label="`Eliminar la lista ${list.name}`"
                  @click.stop="deleteTarget = list"
                />
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- The prices of the chosen list -->
    <v-col cols="12" md="8">
      <v-card v-if="selected">
        <v-card-title class="d-flex align-center flex-wrap ga-2">
          <span class="text-wrap">Precios de «{{ selected.name }}»</span>
          <v-spacer />
          <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-download" @click="exportExcel">
            Descargar Excel
          </v-btn>
          <LockableButton size="small" variant="tonal" color="primary" icon="mdi-upload" :loading="importing" @click="fileInput?.click()">
            Subir Excel
          </LockableButton>
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.csv"
            class="d-none"
            aria-label="Archivo de Excel con los precios de la lista"
            @change="importExcel"
          >
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Deja vacío el precio de la lista para vender ese producto a su precio base. En el Excel, llena la columna «precio_lista» y súbelo.
          </p>
          <v-text-field
            v-model="search"
            prepend-inner-icon="mdi-magnify"
            label="Buscar producto"
            density="compact"
            hide-details
            clearable
            class="mb-3"
          />
          <v-data-table
            :headers="headers"
            :items="rows"
            :search="search ?? ''"
            :loading="loadingRows"
            :items-per-page="25"
            density="compact"
            item-value="product_id"
          >
            <template #item.name="{ item }">
              <div>{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ [item.sku, item.unit].filter(Boolean).join(' · ') }}</div>
              <div v-if="smAndDown" class="text-caption">Base {{ money(item.base_price) }}</div>
            </template>
            <template #item.base_price="{ item }">
              <span class="tabular-nums">{{ money(item.base_price) }}</span>
            </template>
            <template #item.price="{ item }">
              <MoneyField
                v-model="edits[item.product_id]"
                :aria-label="`Precio de ${item.name} en la lista ${selected.name}`"
                :placeholder="money(item.base_price)"
                density="compact"
                hide-details
                max-width="170"
                :disabled="isReadOnly"
              />
            </template>
          </v-data-table>
        </v-card-text>
        <v-card-actions>
          <span v-if="changed.length" class="text-body-2 ml-2">{{ countLabel(changed.length, 'precio sin guardar', 'precios sin guardar') }}</span>
          <v-spacer />
          <v-btn :disabled="!changed.length" @click="resetEdits">Descartar</v-btn>
          <LockableButton color="primary" :disabled="!changed.length" :loading="saving" @click="savePrices">
            Guardar precios
          </LockableButton>
        </v-card-actions>
      </v-card>
      <v-card v-else-if="lists.length" variant="tonal" class="pa-6 text-center text-medium-emphasis">
        Elige una lista para ver y cambiar sus precios.
      </v-card>
    </v-col>
  </v-row>

  <!-- Nueva / editar lista, and who it applies to -->
  <PriceListDialog
    v-model="listDialog"
    :list="editingList"
    name-hint="Ej: Mayoristas, Zona norte"
    @saved="onListSaved"
    @error="text => emit('message', text, 'error')"
  />

  <!-- Eliminar lista -->
  <v-dialog :model-value="!!deleteTarget" max-width="480" @update:model-value="deleteTarget = null">
    <v-card v-if="deleteTarget">
      <v-card-title class="text-wrap">Eliminar la lista {{ deleteTarget.name }}</v-card-title>
      <v-card-text>
        Se borran sus precios. {{ deleteUsers }}Los pedidos ya hechos conservan sus precios.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="deleteTarget = null">Cancelar</v-btn>
        <v-btn color="error" :loading="saving" @click="deleteList">Eliminar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { priceListsService, type PriceList, type PriceListRow } from '@/services/productsService'
import { errorMessage } from '@/utils/errors'
import { money } from '@/utils/money'
import LockableButton from './LockableButton.vue'
import MoneyField from './MoneyField.vue'
import PriceListDialog from './PriceListDialog.vue'
import { useReadOnly } from '../composables/useReadOnly'

/**
 * Productos › Listas de precios: the lists, and the price of each final
 * product in one. The backend decides which list a sale takes (the
 * customer's, else its segment's) and charges it; here they are only set.
 */
const emit = defineEmits<{ message: [text: string, color?: string] }>()

const isReadOnly = useReadOnly()

const lists = ref<PriceList[]>([])
const loading = ref(false)
const selected = ref<PriceList | null>(null)
const rows = ref<PriceListRow[]>([])
const loadingRows = ref(false)
const search = ref<string | null>('')
const saving = ref(false)
const importing = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
/** product_id → the price typed in this list (null: its base price). */
const edits = ref<Record<number, number | null>>({})

// On a phone the base price goes under the name: the typed price needs the width.
const { smAndDown } = useDisplay()
const headers = computed(() => [
  { title: 'Producto', key: 'name' },
  ...(smAndDown.value ? [] : [{ title: 'Precio base', key: 'base_price', align: 'end' as const }]),
  { title: smAndDown.value ? 'Precio lista' : 'Precio en la lista', key: 'price', sortable: false, minWidth: '140px' },
])

const countLabel = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const changed = computed(() =>
  rows.value
    .filter(row => (edits.value[row.product_id] ?? null) !== row.price)
    .map(row => ({ product_id: row.product_id, price: edits.value[row.product_id] ?? null })),
)

const resetEdits = () => {
  edits.value = Object.fromEntries(rows.value.map(row => [row.product_id, row.price]))
}

const load = async () => {
  loading.value = true
  try {
    lists.value = await priceListsService.getAll()
    if (selected.value) selected.value = lists.value.find(list => list.id === selected.value?.id) ?? null
  } catch (error) {
    emit('message', errorMessage(error, 'No fue posible cargar las listas de precios. Inténtalo de nuevo.'), 'error')
  } finally {
    loading.value = false
  }
}

const loadRows = async () => {
  if (!selected.value) return
  loadingRows.value = true
  try {
    rows.value = await priceListsService.getItems(selected.value.id)
    resetEdits()
  } catch (error) {
    emit('message', errorMessage(error, 'No fue posible cargar los precios de la lista. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingRows.value = false
  }
}

const select = (list: PriceList) => {
  if (changed.value.length && !confirm('Tienes precios sin guardar en esta lista. ¿Descartarlos?')) return
  selected.value = list
  search.value = ''
  loadRows()
}

const listDialog = ref(false)
const editingList = ref<PriceList | null>(null)
const openListDialog = (list?: PriceList) => {
  editingList.value = list ?? null
  listDialog.value = true
}

const onListSaved = async (data: PriceList, message: string) => {
  const created = !editingList.value
  emit('message', message)
  await load()
  if (created) select(lists.value.find(list => list.id === data.id) ?? data)
}

const deleteTarget = ref<PriceList | null>(null)
const deleteUsers = computed(() => {
  const target = deleteTarget.value
  if (!target || (!target.customers_count && !target.segments_count)) return ''
  const who = [
    target.customers_count ? countLabel(target.customers_count, 'cliente', 'clientes') : '',
    target.segments_count ? countLabel(target.segments_count, 'segmento', 'segmentos') : '',
  ].filter(Boolean).join(' y ')
  return `${who} que la usan quedan con el precio base. `
})

const deleteList = async () => {
  if (!deleteTarget.value) return
  saving.value = true
  try {
    const message = await priceListsService.delete(deleteTarget.value.id)
    if (selected.value?.id === deleteTarget.value.id) {
      selected.value = null
      rows.value = []
      edits.value = {}
    }
    deleteTarget.value = null
    emit('message', message)
    await load()
  } catch (error) {
    emit('message', errorMessage(error, 'No fue posible eliminar la lista. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const savePrices = async () => {
  if (!selected.value || !changed.value.length) return
  saving.value = true
  try {
    const { message } = await priceListsService.saveItems(selected.value.id, changed.value)
    emit('message', message)
    await Promise.all([loadRows(), load()])
  } catch (error) {
    emit('message', errorMessage(error, 'No fue posible guardar los precios. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const exportExcel = async () => {
  if (!selected.value) return
  try {
    await priceListsService.exportExcel(selected.value)
  } catch (error) {
    emit('message', errorMessage(error, 'No fue posible descargar la lista. Inténtalo de nuevo.'), 'error')
  }
}

const importExcel = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !selected.value) return
  importing.value = true
  try {
    const { message } = await priceListsService.importExcel(selected.value.id, file)
    emit('message', message)
    await Promise.all([loadRows(), load()])
  } catch (error: any) {
    const rowErrors: string[] = error?.response?.data?.data?.errors ?? []
    const base = errorMessage(error, 'No fue posible leer el archivo. Inténtalo de nuevo.')
    emit('message', rowErrors.length ? `${base} ${rowErrors.slice(0, 3).join(' ')}` : base, 'error')
  } finally {
    importing.value = false
  }
}

onMounted(load)
</script>
