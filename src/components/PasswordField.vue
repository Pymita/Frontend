<template>
  <!--
    Contraseña con el ojo para verla: solo con puntos no se sabe qué se
    escribió. Cada campo tiene su propio ojo (la confirmación también).
  -->
  <v-text-field v-bind="$attrs" v-model="model" :type="visible ? 'text' : 'password'">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps ?? {}" />
    </template>
    <template #append-inner>
      <v-btn
        :icon="visible ? 'mdi-eye' : 'mdi-eye-off'"
        :aria-label="visible ? 'Ocultar contraseña' : 'Mostrar contraseña'"
        variant="text"
        size="small"
        density="comfortable"
        @click="visible = !visible"
      />
    </template>
  </v-text-field>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const visible = ref(false)
</script>
