<template>
  <v-autocomplete
    v-model="model"
    v-model:search="search"
    :items="options"
    :item-title="titleOf"
    item-value="id"
    :loading="loading"
    :error-messages="error"
    no-filter
  >
    <template v-if="$slots.label" #label>
      <slot name="label" />
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { billingService, type CustomerLookup } from '@/services/billingService'
import { errorMessage } from '@/utils/errors'
import { FINAL_CONSUMER } from '@/utils/labels'

/**
 * The customer of an order or a sale, from `GET /customers/lookup`: it opens
 * to whoever takes orders and never brings contact data. The API searches
 * (name without accents, document with or without dots) and answers 50 at a
 * time, so the list is never filtered here.
 */
type Option = { id: number | null; name: string; document_number?: string | null }

const props = defineProps<{
  /** "Consumidor final" (null) as the first option: a sale nobody identified. */
  finalConsumer?: boolean
  /** Customers the page already holds (one just created, the order's own), so the chosen one reads its name. */
  known?: Option[]
}>()

const model = defineModel<number | null>({ default: null })

const FINAL: Option = { id: null, name: FINAL_CONSUMER.name }
const titleOf = (option: Option) => (option.document_number ? `${option.name} (${option.document_number})` : option.name)

const search = ref<string | undefined>('')
const results = ref<CustomerLookup[]>([])
const loading = ref(false)
const error = ref('')
// Another search drops the chosen customer from the results: it still has to read as its name.
const picked = ref<Option | null>(null)

const chosen = computed(() =>
  model.value === null
    ? null
    : ([...results.value, ...(props.known ?? []), ...(picked.value ? [picked.value] : [])].find(c => c.id === model.value) ?? null),
)

const options = computed<Option[]>(() => [
  ...(props.finalConsumer ? [FINAL] : []),
  ...(chosen.value && !results.value.some(c => c.id === chosen.value?.id) ? [chosen.value] : []),
  ...results.value,
])

watch(model, id => {
  picked.value = results.value.find(c => c.id === id) ?? picked.value
})

let loaded: string | null = null
let latest = 0
const lookup = async (q: string) => {
  const request = ++latest
  loaded = q
  loading.value = true
  try {
    const found = await billingService.lookupCustomers(q)
    if (request === latest) {
      results.value = found
      error.value = ''
    }
  } catch (e) {
    if (request === latest) error.value = errorMessage(e, 'No fue posible buscar los clientes. Inténtalo de nuevo.')
  } finally {
    if (request === latest) loading.value = false
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
watch(search, text => {
  const q = (text ?? '').trim()
  // Focusing or choosing writes the chosen option's title in the field: that is not a search.
  const shown = chosen.value ? titleOf(chosen.value) : props.finalConsumer ? FINAL.name : ''
  clearTimeout(timer)
  if (q === loaded || (q !== '' && q === shown)) return
  timer = setTimeout(() => lookup(q), 250)
})

onMounted(() => lookup(''))
onBeforeUnmount(() => clearTimeout(timer))
</script>
