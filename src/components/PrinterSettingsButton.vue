<template>
  <!-- In the app bar: every page prints (orders, cartera, sales, cash closes),
       and the cashier who prints there may not reach Configuración. -->
  <v-btn
    icon="mdi-printer-settings"
    variant="text"
    aria-label="Impresora de este equipo"
    title="Impresora de este equipo"
    @click="open = true"
  />
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card class="pa-4">
      <div class="d-flex align-center mb-2">
        <h2 class="text-h6">Impresora de este equipo</h2>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Cerrar" @click="open = false" />
      </div>
      <TicketPrinterSettings />
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import TicketPrinterSettings from './TicketPrinterSettings.vue'

const open = ref(false)
</script>
