<template>
  <v-card>
    <v-card-title class="d-flex align-center ga-2 text-wrap">
      <v-icon icon="mdi-shield-key" />
      Verificación en dos pasos
      <v-spacer />
      <v-chip v-if="enabled" color="success" size="small" variant="tonal">Activa</v-chip>
      <v-chip v-else color="warning" size="small" variant="tonal">Sin activar</v-chip>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="setupRequired && !enabled" type="warning" variant="tonal" density="compact" class="mb-4">
        La cuenta de plataforma puede crear y suspender empresas: actívala para usar el panel.
      </v-alert>

      <!-- Recién activada: los códigos de respaldo se ven una sola vez -->
      <template v-if="recoveryCodes.length">
        <p class="text-body-2 mb-3">
          Guarda estos códigos en un lugar seguro. Si pierdes el celular, cada uno te deja entrar una vez.
        </p>
        <v-sheet class="bg-surface-light rounded pa-3 mb-3">
          <div class="d-flex flex-wrap ga-2">
            <code v-for="code in recoveryCodes" :key="code" class="text-body-1">{{ code }}</code>
          </div>
        </v-sheet>
        <div class="d-flex ga-2">
          <v-btn variant="tonal" prepend-icon="mdi-content-copy" @click="copyCodes">Copiar códigos</v-btn>
          <v-btn color="primary" @click="finish">Ya los guardé</v-btn>
        </div>
      </template>

      <!-- Activa: se puede desactivar con contraseña y un código actual -->
      <v-form v-else-if="enabled" @submit.prevent="disable">
        <p class="text-body-2 mb-4">
          Al entrar te pedimos la contraseña y el código de tu app de autenticación. Para cambiar de celular,
          desactívala y vuelve a activarla con el nuevo.
        </p>
        <v-text-field v-model="disablePassword" label="Tu contraseña" type="password" autocomplete="current-password" />
        <v-text-field
          v-model="disableCode"
          label="Código de 6 dígitos"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="6"
        />
        <v-btn type="submit" color="error" variant="tonal" :loading="saving" :disabled="!disablePassword || disableCode.length !== 6">
          Desactivar
        </v-btn>
      </v-form>

      <!-- Configuración: clave → código → códigos de respaldo -->
      <template v-else-if="setup">
        <ol class="text-body-2 mb-4 pl-4">
          <li class="mb-2">Instala Google Authenticator, Microsoft Authenticator o Authy en tu celular.</li>
          <li class="mb-2">
            Agrega la cuenta en la app:
            <div class="my-3">
              <img
                v-if="qr"
                :src="qr.src"
                :width="qr.size"
                :height="qr.size"
                alt="Código QR para agregar Servify POS a tu app de autenticación"
                class="d-block"
              />
              <span v-else-if="qrFailed" class="text-medium-emphasis">No pudimos mostrar el código QR.</span>
              <v-progress-circular v-else indeterminate color="primary" />
            </div>
            Escanéalo con Google Authenticator o Authy. Si no puedes escanearlo, escribe esta clave:
            <div class="d-flex align-center flex-wrap ga-2 mt-2">
              <code class="text-body-1" data-testid="two-factor-secret">{{ groupedSecret }}</code>
              <v-btn size="small" variant="text" prepend-icon="mdi-content-copy" @click="copySecret">Copiar</v-btn>
              <v-btn size="small" variant="text" prepend-icon="mdi-open-in-new" :href="setup.uri">Abrir en la app</v-btn>
            </div>
          </li>
          <li>Escribe el código de 6 dígitos que aparece en la app.</li>
        </ol>
        <v-form @submit.prevent="confirm">
          <v-text-field
            v-model="code"
            label="Código de 6 dígitos"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            autofocus
          />
          <v-btn type="submit" color="primary" :loading="saving" :disabled="code.trim().length !== 6">Activar</v-btn>
        </v-form>
      </template>

      <template v-else>
        <p class="text-body-2 mb-4">
          Además de la contraseña, al entrar te pediremos un código que cambia cada 30 segundos en tu celular.
          Si alguien conoce tu contraseña, sin tu celular no puede entrar.
        </p>
        <v-btn color="primary" :loading="saving" @click="start">Activar verificación en dos pasos</v-btn>
      </template>

      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mt-4" :text="error" />
      <v-alert v-if="notice" type="success" variant="tonal" density="compact" class="mt-4" :text="notice" />
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useTheme } from 'vuetify'
import authService from '../services/authService'
import { useAuthStore } from '../stores/auth'
import { errorMessage } from '../utils/errors'
import type { TwoFactorSetup } from '../types/auth'

const authStore = useAuthStore()

const enabled = computed(() => !!authStore.user?.two_factor?.enabled)
const setupRequired = computed(() => !!authStore.user?.two_factor?.setup_required)

const setup = ref<TwoFactorSetup | null>(null)
const code = ref('')
const recoveryCodes = ref<string[]>([])
const disablePassword = ref('')
const disableCode = ref('')
const saving = ref(false)
const error = ref('')
const notice = ref('')

const groupedSecret = computed(() => setup.value?.secret.replace(/(.{4})(?=.)/g, '$1 ') ?? '')

const theme = useTheme()
const qr = ref<{ src: string; size: number } | null>(null)
const qrFailed = ref(false)
// 4 CSS px per module: about 230 px, easy to scan from a laptop screen.
const QR_MODULE_PX = 4

watch(() => setup.value?.uri, async (uri) => {
  qr.value = null
  qrFailed.value = false
  if (!uri) return
  try {
    // Drawn here, never by a QR service: the link carries the secret.
    const { encode } = await import('uqr')
    // A 4-module light border is the quiet zone scanners need to find the code.
    const { size, data } = encode(uri, { ecc: 'M', border: 4 })
    // Twice the pixels it is shown at: modules stay sharp on high-density screens.
    const scale = QR_MODULE_PX * 2
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size * scale
    const context = canvas.getContext('2d')!
    // Scanners expect dark modules on a light background.
    const { surface, 'on-surface': ink } = theme.current.value.colors
    context.fillStyle = surface
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = ink
    data.forEach((row, y) => row.forEach((dark, x) => {
      if (dark) context.fillRect(x * scale, y * scale, scale, scale)
    }))
    qr.value = { src: canvas.toDataURL('image/png'), size: size * QR_MODULE_PX }
  } catch {
    qrFailed.value = true
  }
})

const run = async (action: () => Promise<void>, fallback: string) => {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (err) {
    error.value = errorMessage(err, fallback)
  } finally {
    saving.value = false
  }
}

const start = () => run(async () => {
  setup.value = await authService.twoFactorSetup()
}, 'No pudimos iniciar la configuración. Inténtalo de nuevo.')

const confirm = () => run(async () => {
  recoveryCodes.value = await authService.twoFactorConfirm(code.value.trim())
  setup.value = null
  code.value = ''
}, 'No pudimos activar la verificación. Revisa el código.')

const finish = () => run(async () => {
  recoveryCodes.value = []
  // Refresca la sesión: el panel se abre en cuanto el backend la ve activa.
  await authStore.getCurrentUser()
  notice.value = 'Verificación en dos pasos activa.'
}, 'No pudimos actualizar tu sesión. Recarga la página.')

const disable = () => run(async () => {
  await authService.twoFactorDisable(disablePassword.value, disableCode.value.trim())
  disablePassword.value = ''
  disableCode.value = ''
  await authStore.getCurrentUser()
  notice.value = 'Verificación en dos pasos desactivada.'
}, 'No pudimos desactivarla. Revisa la contraseña y el código.')

const copySecret = () => navigator.clipboard?.writeText(setup.value?.secret ?? '')
const copyCodes = () => navigator.clipboard?.writeText(recoveryCodes.value.join('\n'))
</script>
