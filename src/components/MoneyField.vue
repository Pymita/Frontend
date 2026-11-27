<template>
  <!--
    Pesos como se escriben en Colombia: "100.000" es cien mil. Un input
    type="number" lo guardaba como 100 y ponía flechas para sumar de a un
    peso; este campo es texto con teclado numérico, lee los separadores y
    entrega el número. Con `quantity` es una cantidad que se vende por
    fracción (1,375 kg), con las mismas razones.
  -->
  <v-text-field
    :inputmode="count ? 'numeric' : 'decimal'"
    v-bind="$attrs"
    :model-value="text"
    :rules="[validAmount, ...rules.map(rule => () => rule(model))]"
    :prefix="count || quantity ? undefined : '$'"
    @update:model-value="onInput"
    @update:focused="onFocused">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { moneyInput, parseMoney, parseQuantity, quantityInput } from '@/utils/money'

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
    /**
     * A big count read the same way, not pesos (a DIAN range: "5.000" is five
     * thousand, not 5): no "$" and whole numbers only.
     */
    count?: boolean
    /**
     * A quantity that can be split (kilos, litros): no "$", a comma or a dot
     * as the decimal point ("1,5" and "1.5") and up to three decimals. A
     * `type="number"` input read "20,5" as nothing in a browser in English.
     */
    quantity?: boolean
  }>(),
  { rules: () => [], emptyAsZero: false, count: false, quantity: false },
)

const model = defineModel<number | null>({ default: null })

const parse = (input: string): number | null => (props.quantity ? parseQuantity(input) : parseMoney(input))

const read = (input: string): number | null => {
  const amount = parse(input)
  return props.emptyAsZero ? (amount ?? 0) : amount
}

const shown = (value: number | null): string =>
  props.emptyAsZero && Number(value) === 0 ? '' : props.quantity ? quantityInput(value) : moneyInput(value)

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

const validAmount = (value: string) => {
  if (!value?.trim()) return true
  const amount = parse(value)
  if (props.quantity) return amount !== null || 'Escribe la cantidad con máximo 3 decimales, por ejemplo 1,375'
  return props.count
    ? (amount !== null && Number.isInteger(amount)) || 'Escribe solo números enteros, por ejemplo 5000 o 5.000'
    : amount !== null || 'Escribe solo el valor en pesos, por ejemplo 250000 o 250.000'
}
</script>
