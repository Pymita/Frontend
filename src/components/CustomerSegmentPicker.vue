<template>
  <v-autocomplete
    v-model:search="search"
    :model-value="modelValue"
    :items="segments"
    item-title="name"
    item-value="id"
    :label="label"
    multiple
    chips
    closable-chips
    prepend-inner-icon="mdi-tag-multiple-outline"
    :hint="creatable ? 'Escribe para buscar un segmento o crear uno nuevo' : FILTER_HINT"
    :error-messages="error || undefined"
    v-bind="$attrs"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template #chip="{ props: chip, item }">
      <v-chip v-bind="chip" size="small" color="secondary" variant="tonal" prepend-icon="mdi-tag-outline">
        {{ item.title }}
      </v-chip>
    </template>

    <template v-if="canCreate" #prepend-item>
      <v-list-item prepend-icon="mdi-plus" :disabled="creating" @click="create">
        <v-list-item-title>Crear el segmento «{{ typed }}»</v-list-item-title>
      </v-list-item>
    </template>

    <template #no-data>
      <v-list-item v-if="!canCreate">
        <v-list-item-title class="text-medium-emphasis">
          {{ segments.length ? 'Ningún segmento se llama así' : creatable ? 'Escribe el nombre del primero' : 'Aún no hay segmentos' }}
        </v-list-item-title>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { billingService, type CustomerSegment, type CustomerSegmentRef } from '@/services/billingService'
import { errorMessage } from '@/utils/errors'

/**
 * Segments of a customer, or the segments a list filters by. Several in a
 * filter mean the customers carrying all of them (the API's rule), which
 * the hint says. `creatable` offers to create the name typed when the
 * company has no segment called like that.
 */
defineOptions({ inheritAttrs: false })

const FILTER_HINT = 'Si eliges varios, ves solo a quien los tiene todos: un colegio y un grado muestran ese grado.'

const props = withDefaults(
  defineProps<{
    modelValue: number[]
    segments: CustomerSegmentRef[]
    label?: string
    creatable?: boolean
  }>(),
  { label: 'Segmentos', creatable: false },
)

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
  /** A segment was created from what was typed: the parent adds it to its list. */
  created: [segment: CustomerSegment]
}>()

const search = ref('')
const creating = ref(false)
const error = ref('')

const typed = computed(() => (search.value ?? '').trim().replace(/\s+/g, ' '))
const canCreate = computed(
  () =>
    props.creatable &&
    typed.value !== '' &&
    !props.segments.some(segment => segment.name.toLocaleLowerCase() === typed.value.toLocaleLowerCase()),
)

const create = async () => {
  creating.value = true
  error.value = ''
  try {
    const { data } = await billingService.createSegment(typed.value)
    emit('created', data)
    emit('update:modelValue', [...props.modelValue, data.id])
    search.value = ''
  } catch (failure) {
    error.value = errorMessage(failure, 'No fue posible crear el segmento. Inténtalo de nuevo.')
  } finally {
    creating.value = false
  }
}
</script>
