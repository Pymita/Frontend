<template>
  <v-dialog :model-value="modelValue" max-width="520" @update:model-value="emit('update:modelValue', $event)">
    <v-card>
      <v-card-title class="text-wrap">{{ list ? 'Editar lista de precios' : 'Nueva lista de precios' }}</v-card-title>
      <v-card-text>
        <v-text-field
          v-model="form.name"
          label="Nombre"
          maxlength="60"
          counter
          autofocus
          :hint="nameHint"
          persistent-hint
        />
        <v-textarea
          v-model="form.description"
          label="Para quién es (opcional)"
          rows="2"
          maxlength="255"
          hint="Ej: Restaurantes del centro que compran por bulto"
          persistent-hint
          class="mt-2"
        />
        <v-switch
          v-if="list"
          v-model="form.active"
          color="primary"
          inset
          label="Activa"
          hint="Apagada, sus clientes compran al precio de su segmento o al precio base"
          persistent-hint
          class="mt-2"
        />

        <!-- Who it applies to: the same list the customer form and Segmentos set. -->
        <template v-if="canAssign">
          <h4 class="mt-4 mb-1">A quién aplica</h4>
          <p class="text-body-2 text-medium-emphasis mb-3">
            Sin clientes ni segmentos, la lista solo se usa si el vendedor la elige en el pedido.
          </p>
          <CustomerSegmentPicker
            v-model="form.segment_ids"
            :segments="segments"
            label="Segmentos"
            hint="Los clientes de estos segmentos compran con esta lista si no tienen una propia"
            persistent-hint
            class="mb-2"
          />
          <v-autocomplete
            v-model="form.customer_ids"
            v-model:search="customerSearch"
            :items="customerItems"
            item-title="name"
            item-value="id"
            label="Clientes"
            multiple
            chips
            closable-chips
            no-filter
            :loading="searching"
            prepend-inner-icon="mdi-account-multiple-outline"
            hint="Un cliente tiene una sola lista: si tenía otra, pasa a esta"
            persistent-hint
            no-data-text="Escribe para buscar un cliente"
          />
        </template>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="emit('update:modelValue', false)">Cancelar</v-btn>
        <v-btn color="primary" :loading="saving" :disabled="!form.name.trim()" @click="save">Guardar</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { priceListsService, type PriceList, type PriceListPayload } from '@/services/productsService'
import { billingService, type CustomerSegmentRef } from '@/services/billingService'
import { useAuthStore } from '@/stores/auth'
import { effectiveFeatures } from '@/types/auth'
import { errorMessage } from '@/utils/errors'
import CustomerSegmentPicker from './CustomerSegmentPicker.vue'

/**
 * A price list's name, description and who it applies to (segments and
 * customers), from Productos › Listas de precios and from the product form,
 * where a list can be made for a single product ("solo los tomates").
 */
const props = defineProps<{
  modelValue: boolean
  /** The list being edited; null creates one. */
  list: PriceList | null
  nameHint?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [open: boolean]
  saved: [list: PriceList, message: string]
  error: [message: string]
}>()

// Assigning writes the customers' list: the API asks for access to Clientes too.
const authStore = useAuthStore()
const canAssign = computed(() => {
  const features = effectiveFeatures(authStore.user)
  return features.includes('customers') || features.includes('recurring_billing')
})

const form = ref({ name: '', description: '', active: true, segment_ids: [] as number[], customer_ids: [] as number[] })
const segments = ref<CustomerSegmentRef[]>([])
const found = ref<{ id: number; name: string }[]>([])
const customerSearch = ref('')
const searching = ref(false)
const saving = ref(false)

// The chosen ones stay listed (their chips need a title) next to what the search finds.
const customerItems = computed(() => {
  const chosen = (props.list?.customers ?? []).filter(customer => form.value.customer_ids.includes(customer.id))
  const picked = found.value.filter(customer => form.value.customer_ids.includes(customer.id))
  const byId = new Map([...chosen, ...picked, ...found.value].map(customer => [customer.id, customer]))
  return [...byId.values()]
})

let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(customerSearch, term => {
  clearTimeout(searchTimer)
  if (!canAssign.value || !term?.trim()) return
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const results = await billingService.lookupCustomers(term.trim())
      // Keep the ones already chosen so their chips keep a name.
      const kept = found.value.filter(customer => form.value.customer_ids.includes(customer.id))
      found.value = [...kept, ...results.map(customer => ({ id: customer.id, name: customer.name }))]
    } catch {
      // Searching is optional: the chosen ones stay.
    } finally {
      searching.value = false
    }
  }, 250)
})

watch(() => props.modelValue, async open => {
  if (!open) return
  const list = props.list
  form.value = {
    name: list?.name ?? '',
    description: list?.description ?? '',
    active: list?.active ?? true,
    segment_ids: (list?.segments ?? []).map(segment => segment.id),
    customer_ids: (list?.customers ?? []).map(customer => customer.id),
  }
  found.value = [...(list?.customers ?? [])]
  customerSearch.value = ''
  if (canAssign.value) {
    try {
      segments.value = await billingService.getSegments()
    } catch {
      segments.value = []
    }
  }
}, { immediate: true })

const save = async () => {
  saving.value = true
  const payload: PriceListPayload = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || null,
    active: form.value.active,
    ...(canAssign.value ? { segment_ids: form.value.segment_ids, customer_ids: form.value.customer_ids } : {}),
  }
  try {
    const { data, message } = props.list
      ? await priceListsService.update(props.list.id, payload)
      : await priceListsService.create(payload)
    emit('saved', data, message)
    emit('update:modelValue', false)
  } catch (error) {
    emit('error', errorMessage(error, 'No fue posible guardar la lista. Inténtalo de nuevo.'))
  } finally {
    saving.value = false
  }
}
</script>
