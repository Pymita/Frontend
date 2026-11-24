<template>
  <!-- Android hands a ticket to RawBT only within a recent tap: when the
       server took longer, this button's tap sends it. -->
  <v-snackbar :model-value="!!pendingTicketSend" color="success" location="bottom" :timeout="-1">
    La tirilla está lista
    <template #actions>
      <v-btn @click="send">Enviar a la impresora</v-btn>
      <v-btn icon="mdi-close" aria-label="Descartar la tirilla" @click="pendingTicketSend = null" />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import { pendingTicketSend } from '../utils/ticketPrinter'

const send = () => {
  pendingTicketSend.value?.()
  pendingTicketSend.value = null
}
</script>
