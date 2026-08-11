<template>
  <!--
    Cuenta en solo lectura: el botón sigue ahí, en gris, y al pasar el mouse
    explica por qué no funciona. Esconderlo dejaba al cliente sin saber qué
    perdió; verlo apagado es lo que empuja a renovar.
    El tooltip va sobre un span porque un botón deshabilitado no emite
    eventos de mouse.
  -->
  <v-tooltip v-if="isReadOnly" location="bottom" max-width="320">
    <template #activator="{ props: activator }">
      <span v-bind="activator" class="d-inline-flex">
        <v-btn v-bind="buttonProps" disabled>
          <v-icon v-if="icon" start>{{ icon }}</v-icon>
          <slot />
        </v-btn>
      </span>
    </template>

    <div class="font-weight-medium">{{ lockedTitle }}</div>
    <div class="text-caption">{{ lockedReason }}</div>
  </v-tooltip>

  <v-btn v-else v-bind="buttonProps" @click="emit('click')">
    <v-icon v-if="icon" start>{{ icon }}</v-icon>
    <slot />
  </v-btn>
</template>

<script setup lang="ts">
import { computed, useAttrs } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useReadOnly } from '../composables/useReadOnly'

defineOptions({ inheritAttrs: false })

defineProps<{
  /** Icono opcional al inicio del botón */
  icon?: string
}>()

const emit = defineEmits<{ click: [] }>()

const attrs = useAttrs()
const authStore = useAuthStore()

const isReadOnly = useReadOnly()

// El resto de props (color, size, variant, disabled…) pasan tal cual.
const buttonProps = computed(() => attrs)

const lockedTitle = 'Tu suscripción está vencida'

const lockedReason = computed(
  () =>
    authStore.readOnlyMessage
      ? `${authStore.readOnlyMessage}. Renueva el pago para volver a usar esta acción.`
      : 'Renueva el pago para volver a usar esta acción.',
)
</script>
