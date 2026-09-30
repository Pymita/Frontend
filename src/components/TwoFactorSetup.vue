<template>
  <v-card>
    <v-card-title class="d-flex align-center ga-2">
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
            Agrega una cuenta con esta clave (o ábrela desde el celular con el enlace):
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
import { computed, ref } from 'vue'
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
