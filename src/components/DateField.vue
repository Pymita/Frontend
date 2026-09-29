<template>
  <v-text-field
    v-bind="$attrs"
    :model-value="text"
    :placeholder="month ? 'mes de aaaa' : 'dd/mm/aaaa'"
    :error-messages="invalidMessage ?? $attrs['error-messages'] as string | undefined"
    @update:model-value="onType"
    @blur="onBlur"
    @keydown.enter="onBlur"
  >
    <template v-for="(_, name) in forwardedSlots" #[name]="scope">
      <slot :name="name" v-bind="scope ?? {}" />
    </template>

    <template #append-inner>
      <v-btn
        :aria-label="month ? 'Elegir mes' : 'Abrir calendario'"
        variant="text"
        size="x-small"
        density="comfortable"
        icon
      >
        <v-icon icon="mdi-calendar" />
        <v-menu
          v-model="open"
          activator="parent"
          :close-on-content-click="false"
          location="bottom end"
        >
          <v-date-picker
            :model-value="pickerValue"
            :view-mode="pickerView"
            :month="pickerMonth"
            :year="pickerYear"
            :min="bound(min)"
            :max="bound(max)"
            show-adjacent-months
            hide-header
            @update:model-value="onPick"
            @update:view-mode="onViewMode"
            @update:month="onPickMonth"
            @update:year="onPickYear"
          />
        </v-menu>
      </v-btn>
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { computed, ref, useSlots, watch } from 'vue'
import { formatIsoDate, formatIsoMonth, parseDateText, parseMonthText, toIsoDate } from '@/utils/dates'

// Los inputs nativos de fecha siguen el idioma del navegador ("09/29/2026",
// "January 2025"): este campo muestra siempre la fecha en español y guarda
// el mismo texto ISO (AAAA-MM-DD, o AAAA-MM con `month`) que ya usan las
// páginas y el API.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  modelValue?: string | null
  month?: boolean
  min?: string
  max?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const slots = useSlots()
const forwardedSlots = computed(() => {
  const { 'append-inner': _ignored, ...rest } = slots
  return rest
})

const open = ref(false)
const text = ref('')
const invalid = ref(false)
const pickerView = ref<'month' | 'months' | 'year'>(props.month ? 'months' : 'month')

const display = (value?: string | null): string =>
  !value ? '' : props.month ? formatIsoMonth(value) : formatIsoDate(value)

const parse = (value: string): string | null =>
  props.month ? parseMonthText(value) : parseDateText(value)

// Mientras se escribe, el texto no se reformatea si ya dice la misma fecha:
// hacerlo movería el cursor a mitad de la escritura.
watch(
  () => props.modelValue,
  value => {
    if ((parse(text.value) ?? '') !== (value ?? '')) text.value = display(value)
    invalid.value = false
  },
  { immediate: true },
)

const outOfRange = (iso: string): boolean => {
  const key = props.month ? iso.slice(0, 7) : iso
  const min = props.min ? (props.month ? props.min.slice(0, 7) : props.min) : null
  const max = props.max ? (props.month ? props.max.slice(0, 7) : props.max) : null
  return (!!min && key < min) || (!!max && key > max)
}

const invalidMessage = computed(() => {
  if (!invalid.value) return null
  if (props.month) return 'Escribe el mes como "enero de 2026" o 01/2026'
  return 'Escribe la fecha como dd/mm/aaaa'
})

const commit = (iso: string) => {
  invalid.value = false
  if (iso !== (props.modelValue ?? '')) emit('update:modelValue', iso)
}

const onType = (value: string | null) => {
  text.value = value ?? ''
  const trimmed = text.value.trim()
  if (!trimmed) {
    commit('')
    return
  }
  const iso = parse(trimmed)
  if (iso && !outOfRange(iso)) commit(iso)
}

const onBlur = () => {
  const trimmed = text.value.trim()
  if (!trimmed) return
  const iso = parse(trimmed)
  if (!iso || outOfRange(iso)) {
    invalid.value = true
    return
  }
  commit(iso)
  text.value = display(iso)
}

// El calendario trabaja con Date locales; `new Date('2026-09-29')` sería
// medianoche UTC, que en Bogotá cae el día anterior.
const localDate = (iso: string): Date => {
  const [y = 1970, m = 1, d = 1] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const bound = (iso?: string) => (iso ? localDate(props.month ? `${iso.slice(0, 7)}-01` : iso) : undefined)

const current = computed(() => (props.modelValue ? localDate(props.modelValue) : new Date()))
const pickerValue = computed(() => (props.modelValue && !props.month ? localDate(props.modelValue) : undefined))
const pickerMonth = ref(current.value.getMonth())
const pickerYear = ref(current.value.getFullYear())

watch(open, isOpen => {
  if (!isOpen) return
  pickerMonth.value = current.value.getMonth()
  pickerYear.value = current.value.getFullYear()
  pickerView.value = props.month ? 'months' : 'month'
})

const onPick = (value: unknown) => {
  if (!(value instanceof Date) || props.month) return
  commit(toIsoDate(value))
  text.value = display(toIsoDate(value))
  open.value = false
}

const onViewMode = (mode: 'month' | 'months' | 'year') => {
  // En modo mes no hay cuadrícula de días: tras elegir el año vuelve a los meses.
  pickerView.value = props.month && mode === 'month' ? 'months' : mode
}

const onPickMonth = (value: number) => {
  pickerMonth.value = value
  if (!props.month) return
  const iso = `${pickerYear.value}-${String(value + 1).padStart(2, '0')}`
  commit(iso)
  text.value = display(iso)
  open.value = false
}

const onPickYear = (value: number) => {
  pickerYear.value = value
}
</script>
