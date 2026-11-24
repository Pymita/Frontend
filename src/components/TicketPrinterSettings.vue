<template>
  <div>
    <p class="text-body-2 text-medium-emphasis mb-3">
      Se guarda en este equipo: cada computador, tablet o pantalla con impresora elige la suya.
    </p>
    <v-radio-group v-model="settings.mode" hide-details aria-label="Cómo imprime este equipo las tirillas">
      <v-radio value="browser" color="primary" class="mb-2">
        <template #label>
          <div>
            <div class="text-body-1 font-weight-medium text-high-emphasis">Con el diálogo de impresión</div>
            <div class="text-body-2 text-medium-emphasis">
              Para computadores con impresora instalada. Se elige la impresora en el diálogo del navegador.
            </div>
          </div>
        </template>
      </v-radio>
      <v-radio value="rawbt" color="primary">
        <template #label>
          <div>
            <div class="text-body-1 font-weight-medium text-high-emphasis">Directo a la impresora térmica (Android)</div>
            <div class="text-body-2 text-medium-emphasis">
              Para pantallas POS con impresora integrada, o impresoras USB, Bluetooth o de red conectadas a un
              Android. Imprime sin diálogo y corta el papel, con la app gratuita RawBT.
            </div>
          </div>
        </template>
      </v-radio>
    </v-radio-group>

    <v-alert
      v-if="settings.mode === 'rawbt'"
      :type="android ? 'info' : 'warning'"
      variant="tonal"
      density="compact"
      class="mt-3"
    >
      <template v-if="android">
        Instala <a :href="RAWBT_PLAY_STORE_URL" target="_blank" rel="noopener">RawBT</a>, ábrela una vez, elige
        la impresora (en las pantallas con impresora integrada suele aparecer como impresora interna, USB o
        serial) y vuelve aquí a imprimir la prueba.
      </template>
      <template v-else>
        Este equipo no es Android: RawBT solo funciona en Android. Aquí usa "Con el diálogo de impresión".
      </template>
    </v-alert>

    <div class="d-flex flex-wrap align-center ga-4 mt-4">
      <v-btn-toggle v-model="settings.paper" mandatory color="primary" density="comfortable" aria-label="Ancho del papel">
        <v-btn :value="80">Papel de 80 mm</v-btn>
        <v-btn :value="58">Papel de 58 mm</v-btn>
      </v-btn-toggle>
      <v-switch
        v-if="settings.mode === 'rawbt'"
        v-model="settings.cut"
        color="primary"
        label="Cortar el papel al terminar"
        hide-details
        density="compact"
      />
    </div>

    <v-switch
      v-model="documentsOnTicket"
      color="primary"
      class="mt-2"
      hide-details
      density="compact"
      label="Facturas, recibos y cierres de caja también en tirilla"
    />
    <p class="text-body-2 text-medium-emphasis ms-1">
      {{ documentsOnTicket
        ? 'Salen por esta impresora, con los mismos datos de la hoja.'
        : 'Salen en hoja carta o media carta, para una impresora de oficina.' }}
    </p>

    <div class="d-flex justify-end mt-4">
      <v-btn variant="tonal" color="primary" prepend-icon="mdi-printer" @click="printTest">
        Imprimir tirilla de prueba
      </v-btn>
    </div>
    <p v-if="message" class="text-body-2 mt-2" :class="messageError ? 'text-error' : 'text-medium-emphasis'" role="status">
      {{ message }}
      <v-btn v-if="pendingSend" size="small" variant="text" color="primary" @click="sendPending">Enviar a la impresora</v-btn>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { APP_NAME } from '../utils/branding'
import {
  RAWBT_PLAY_STORE_URL,
  isAndroid,
  loadTicketPrinter,
  saveTicketPrinter,
  startTicketPrint,
  ticketColumns,
} from '../utils/ticketPrinter'

const android = isAndroid()
const settings = reactive(loadTicketPrinter())
const message = ref('')
const messageError = ref(false)
const pendingSend = ref<(() => void) | null>(null)

watch(settings, value => saveTicketPrinter({ ...value }), { deep: true })

const documentsOnTicket = computed({
  get: () => settings.documents === 'ticket',
  set: value => { settings.documents = value ? 'ticket' : 'sheet' },
})

/** A ruler of the configured width shows at a glance whether the columns fit the paper. */
const testText = (): string => {
  const width = ticketColumns(settings)
  const center = (text: string) => ' '.repeat(Math.max(0, Math.floor((width - text.length) / 2))) + text
  const ruler = Array.from({ length: width }, (_, i) => String((i + 1) % 10)).join('')
  return [
    center('TIRILLA DE PRUEBA'),
    center(APP_NAME),
    '-'.repeat(width),
    ruler,
    `Papel: ${settings.paper} mm · ${width} columnas`,
    'Tildes: á é í ó ú ñ Ñ ¿ ¡',
    '-'.repeat(width),
    center('Si la regla cabe en una línea,'),
    center('la impresora quedó lista.'),
  ].join('\n')
}

const printTest = () => {
  message.value = ''
  messageError.value = false
  pendingSend.value = null
  const job = startTicketPrint({
    onBlocked: () => {
      message.value = 'El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio.'
      messageError.value = true
    },
    onNeedsTap: send => {
      message.value = 'La tirilla está lista.'
      pendingSend.value = send
    },
  })
  job?.fill({ title: 'Tirilla de prueba', text: testText() })
  if (job && settings.mode === 'rawbt') {
    message.value ||= 'Enviada a RawBT. Si no imprime, revisa en RawBT que la impresora esté elegida.'
  }
}

const sendPending = () => {
  pendingSend.value?.()
  pendingSend.value = null
}
</script>
