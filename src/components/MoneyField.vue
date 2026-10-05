<template>
  <!--
    Pesos como se escriben en Colombia: "100.000" es cien mil. Un input
    type="number" lo guardaba como 100 y ponía flechas para sumar de a un
    peso; este campo es texto con teclado numérico, lee los separadores y
    entrega el número.
  -->
  <v-text-field
    v-bind="$attrs"
    :model-value="text"
    :rules="[validAmount, ...rules.map(rule => () => rule(model))]"
    inputmode="decimal"
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

withDefaults(
  defineProps<{
    /** Reglas sobre el valor en pesos ya leído (null si está vacío) */
    rules?: ((amount: number | null) => true | string)[]
  }>(),
  { rules: () => [] },
)

const model = defineModel<number | null>({ default: null })

const text = ref(moneyInput(model.value))

// Lo que llega de afuera (abrir otro cliente, el saldo sugerido) se muestra
// con sus puntos; lo que el usuario va escribiendo no se toca.
watch(model, value => {
  if (parseMoney(text.value) !== value) text.value = moneyInput(value)
})

const onInput = (value: string | null) => {
  text.value = value ?? ''
  model.value = parseMoney(text.value)
}

const onFocused = (focused: boolean) => {
  if (!focused && model.value !== null) text.value = moneyInput(model.value)
}

const validAmount = (value: string) =>
  !value?.trim() || parseMoney(value) !== null || 'Escribe solo el valor en pesos, por ejemplo 250000 o 250.000'
</script>
