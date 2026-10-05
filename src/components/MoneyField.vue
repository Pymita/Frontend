<template>
  <!--
    Pesos como se escriben en Colombia: "100.000" es cien mil. Un input
    type="number" lo guardaba como 100 y ponía flechas para sumar de a un
    peso; este campo es texto con teclado numérico, lee los separadores y
    entrega el número.
  -->
  <v-text-field
    inputmode="decimal"
    v-bind="$attrs"
    :model-value="text"
    :rules="[validAmount, ...rules.map(rule => () => rule(model))]"
    prefix="$"
    @update:model-value="onInput"
    @update:focused="onFocused">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { moneyInput, parseMoney } from '@/utils/money'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    /** Reglas sobre el valor en pesos ya leído (null si está vacío) */
    rules?: ((amount: number | null) => true | string)[]
    /**
     * Amounts where nothing typed means 0 (a tip, a discount, a payment): the
     * model gets 0 instead of null, and 0 shows as an empty field. A "0" left
     * in the field is typed around, and "0100.000" or "100.0000" read as 100.
     */
    emptyAsZero?: boolean
  }>(),
  { rules: () => [], emptyAsZero: false },
)

const model = defineModel<number | null>({ default: null })

const read = (input: string): number | null => {
  const amount = parseMoney(input)
  return props.emptyAsZero ? (amount ?? 0) : amount
}

const shown = (value: number | null): string =>
  props.emptyAsZero && Number(value) === 0 ? '' : moneyInput(value)

const text = ref(shown(model.value))

// Lo que llega de afuera (abrir otro cliente, el saldo sugerido) se muestra
// con sus puntos; lo que el usuario va escribiendo no se toca.
watch(model, value => {
  if (read(text.value) !== value) text.value = shown(value)
})

const onInput = (value: string | null) => {
  text.value = value ?? ''
  model.value = read(text.value)
}

const onFocused = (focused: boolean) => {
  if (!focused && model.value !== null) text.value = shown(model.value)
}

const validAmount = (value: string) =>
  !value?.trim() || parseMoney(value) !== null || 'Escribe solo el valor en pesos, por ejemplo 250000 o 250.000'
</script>
