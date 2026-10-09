<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <v-col tag="aside" md="4" xl="3" class="d-none d-md-flex flex-column bg-chrome pa-10">
        <div class="d-flex align-center ga-3">
          <img :src="APP_ICON" :alt="APP_NAME" width="36" height="36" />
          <span class="text-h6">{{ APP_NAME }}</span>
        </div>

        <!-- El mensaje va centrado en el alto del panel, a la altura del
             formulario, en vez de quedar pegado abajo con un vacío encima. -->
        <div class="flex-grow-1 d-flex flex-column justify-center py-8">
          <h2 class="text-h5 mb-6">{{ APP_TAGLINE }}</h2>

          <div v-for="feature in FEATURES" :key="feature.title" class="d-flex align-start ga-3 mb-4">
            <v-icon :icon="feature.icon" color="chrome-text" size="20" />
            <div>
              <div class="text-subtitle-2">{{ feature.title }}</div>
              <div class="text-caption text-chrome-text">{{ feature.text }}</div>
            </div>
          </div>
        </div>

        <p class="text-caption text-chrome-overline">© {{ year }} {{ APP_NAME }}</p>
      </v-col>

      <v-col cols="12" md="8" xl="9" class="d-flex align-center justify-center bg-background pa-6">
        <v-card width="100%" max-width="480" class="pa-6 pa-sm-10">
          <div class="mb-6">
            <img :src="APP_ICON" :alt="APP_NAME" width="44" height="44" class="d-block d-md-none mb-4" />
            <h1 class="text-h4 mb-1">{{ APP_NAME }}</h1>
            <p class="text-body-1 text-medium-emphasis">{{ STEP_SUBTITLES[step] }}</p>
          </div>

          <!-- 1. Correo o usuario + contraseña -->
          <v-form v-if="step === 'login'" @submit.prevent="login">
            <v-text-field
              v-model="loginId"
              v-bind="loginIdAttrs"
              label="Correo o usuario"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              class="mb-3"
              autocomplete="username"
              :error-messages="errors.login"
            />

            <!-- Un usuario interno solo existe dentro de su negocio: el
                 backend necesita el slug para saber en cuál buscar. -->
            <v-text-field
              v-if="needsCompany"
              v-model="company"
              v-bind="companyAttrs"
              label="Código del negocio"
              hint="Pídeselo a tu administrador (ej: mi-negocio)"
              persistent-hint
              prepend-inner-icon="mdi-storefront"
              variant="outlined"
              class="mb-3"
              :error-messages="errors.company"
            />

            <v-text-field
              v-model="password"
              v-bind="passwordAttrs"
              label="Contraseña"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock"
              autocomplete="current-password"
              variant="outlined"
              class="mb-3"
              :error-messages="errors.password"
            >
              <template #append-inner>
                <v-btn
                  :icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                  :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  variant="text"
                  size="small"
                  density="comfortable"
                  @click="showPassword = !showPassword"
                />
              </template>
            </v-text-field>

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              :disabled="!isFormValid"
              class="mb-3"
            >
              Iniciar sesión
            </v-btn>

            <div class="text-center">
              <v-btn variant="text" size="small" @click="goTo('forgot')">¿Olvidaste tu contraseña?</v-btn>
            </div>
          </v-form>

          <!-- 2. Verificación en dos pasos -->
          <v-form v-else-if="step === 'two_factor'" @submit.prevent="verifyCode">
            <v-text-field
              v-if="!useRecovery"
              v-model="twoFactorCode"
              label="Código de 6 dígitos"
              prepend-inner-icon="mdi-shield-key"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              variant="outlined"
              class="mb-3"
              autofocus
            />
            <v-text-field
              v-else
              v-model="recoveryCode"
              label="Código de respaldo"
              hint="Uno de los códigos que guardaste al activar la verificación"
              persistent-hint
              prepend-inner-icon="mdi-lifebuoy"
              variant="outlined"
              class="mb-3"
              autofocus
            />
            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              :disabled="useRecovery ? !recoveryCode.trim() : twoFactorCode.trim().length !== 6"
              class="mb-3"
            >
              Verificar
            </v-btn>
            <div class="d-flex justify-space-between">
              <v-btn variant="text" size="small" @click="goTo('login')">Volver</v-btn>
              <v-btn variant="text" size="small" @click="useRecovery = !useRecovery">
                {{ useRecovery ? 'Usar el código de la app' : 'Usar un código de respaldo' }}
              </v-btn>
            </div>
          </v-form>

          <!-- 3. Olvidé mi contraseña -->
          <v-form v-else-if="step === 'forgot'" @submit.prevent="sendResetLink">
            <v-text-field
              v-model="resetEmail"
              label="Correo con el que entras"
              type="email"
              prepend-inner-icon="mdi-email"
              variant="outlined"
              class="mb-3"
              autocomplete="email"
            />
            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              :disabled="!resetEmail.includes('@')"
              class="mb-3"
            >
              Enviar enlace
            </v-btn>
            <p class="text-caption text-medium-emphasis mb-3">
              Si entras con un nombre de usuario (no con correo), pídele a tu administrador que te asigne una contraseña nueva.
            </p>
            <div class="text-center">
              <v-btn variant="text" size="small" @click="goTo('login')">Volver a iniciar sesión</v-btn>
            </div>
          </v-form>

          <!-- 4. Nueva contraseña (llega desde el enlace del correo) -->
          <v-form v-else ref="resetForm" @submit.prevent="saveNewPassword">
            <v-text-field
              v-model="newPassword"
              label="Contraseña nueva"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock"
              :rules="passwordRules"
              :hint="PASSWORD_HINT"
              persistent-hint
              autocomplete="new-password"
              variant="outlined"
              class="mb-3"
            >
              <template #append-inner>
                <v-btn
                  :icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                  :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                  variant="text"
                  size="small"
                  density="comfortable"
                  @click="showPassword = !showPassword"
                />
              </template>
            </v-text-field>
            <v-text-field
              v-model="newPasswordConfirmation"
              label="Repite la contraseña"
              :type="showPassword ? 'text' : 'password'"
              prepend-inner-icon="mdi-lock-check"
              :rules="[(v: string) => v === newPassword || 'Las dos contraseñas no coinciden']"
              autocomplete="new-password"
              variant="outlined"
              class="mb-3"
            />
            <v-btn type="submit" color="primary" size="large" block :loading="loading" class="mb-3">
              Guardar contraseña
            </v-btn>
            <div class="text-center">
              <v-btn variant="text" size="small" @click="goTo('login')">Volver a iniciar sesión</v-btn>
            </div>
          </v-form>

          <v-alert
            v-if="error"
            type="error"
            variant="tonal"
            class="mt-3"
            :text="error"
          />

          <v-alert
            v-if="successMessage"
            type="success"
            variant="tonal"
            class="mt-3"
            :text="successMessage"
          />

          <div class="text-center mt-6">
            <a :href="privacyHref" target="_blank" rel="noopener" class="text-caption text-medium-emphasis">
              Política de privacidad
            </a>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { APP_ICON, APP_NAME, APP_TAGLINE } from '@/utils/branding';
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useAuthStore } from '../stores/auth'
import authService from '../services/authService'
import { errorMessage } from '../utils/errors'
import { PASSWORD_HINT, passwordRules } from '../utils/validation'
import type { LoginCredentials } from '../types'

type Step = 'login' | 'two_factor' | 'forgot' | 'reset'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

// Lo que resuelve el producto, en palabras del negocio (lo ven todas las
// empresas). Solo lo que ya existe: aún no hay facturación electrónica DIAN.
const FEATURES = [
  { icon: 'mdi-receipt-text', title: 'Pedidos y mesas', text: 'Toma pedidos desde el celular.' },
  { icon: 'mdi-package-variant', title: 'Inventario al día', text: 'Cada venta descuenta el kardex.' },
  { icon: 'mdi-chart-line', title: 'Ventas y reportes', text: 'Propinas, cierres de caja y lo más vendido.' },
  { icon: 'mdi-calendar-sync', title: 'Facturación automática', text: 'Cuentas de cobro del mes para todos tus clientes, listas para imprimir.' },
  { icon: 'mdi-cash-multiple', title: 'Cartera, gastos y finanzas', text: 'Quién te debe, abonos con recibo de caja y estado de resultados.' },
]

const STEP_SUBTITLES: Record<Step, string> = {
  login: 'Ingresa con tu cuenta para continuar',
  two_factor: 'Escribe el código de 6 dígitos de tu app de autenticación',
  forgot: 'Te enviamos un enlace para que elijas una contraseña nueva',
  reset: 'Elige tu contraseña nueva',
}

const year = new Date().getFullYear()
const privacyHref = router.resolve('/privacidad').href

// El enlace del correo abre /restablecer-contrasena con el token.
const step = ref<Step>(route.name === 'ResetPassword' ? 'reset' : 'login')

// Schema de validación con Zod: correo (admins) o usuario del negocio
// (empleados); el usuario interno necesita además el código del negocio.
const loginSchema = toTypedSchema(
  z.object({
    login: z
      .string()
      .min(1, 'El correo o usuario es requerido')
      .refine(
        value => !value.includes('@') || z.string().email().safeParse(value).success,
        'El email debe ser válido',
      ),
    company: z.string().optional(),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres')
  }).refine(
    values => values.login.includes('@') || !!values.company?.trim(),
    { message: 'Indica el código del negocio', path: ['company'] },
  )
)

const { handleSubmit, defineField, errors } = useForm({
  validationSchema: loginSchema,
  initialValues: {
    login: '',
    company: '',
    password: ''
  }
})

const [loginId, loginIdAttrs] = defineField('login')
const [company, companyAttrs] = defineField('company')
const [password, passwordAttrs] = defineField('password')

// El campo de negocio solo aparece cuando se escribe un usuario, no un correo.
const needsCompany = computed((): boolean => !!loginId.value && !loginId.value.includes('@'))

// Estado local
const loading = ref<boolean>(false)
const error = ref<string>('')
const successMessage = ref<string>('')
const showPassword = ref<boolean>(false)

const challenge = ref<string | null>(null)
const twoFactorCode = ref('')
const recoveryCode = ref('')
const useRecovery = ref(false)

const resetEmail = ref('')
const resetForm = ref<any>(null)
const newPassword = ref('')
const newPasswordConfirmation = ref('')

const isFormValid = computed((): boolean => {
  const hasNoErrors = Object.keys(errors.value).length === 0
  const hasLogin = !!(loginId.value && loginId.value.trim().length > 0)
  const hasPassword = !!(password.value && password.value.trim().length > 0)
  const hasCompany = !needsCompany.value || !!(company.value && company.value.trim().length > 0)
  return hasNoErrors && hasLogin && hasPassword && hasCompany && !loading.value
})

const clearMessages = (): void => {
  error.value = ''
  successMessage.value = ''
}

const goTo = (next: Step): void => {
  clearMessages()
  step.value = next
  if (next === 'login' && route.name === 'ResetPassword') {
    router.replace('/login')
  }
}

const enterApp = (): void => {
  const userName = authStore.user?.name || 'Usuario'
  successMessage.value = `¡Bienvenido ${userName}!`
  // La cuenta de plataforma sin segundo factor solo puede configurarlo.
  const target = authStore.user?.two_factor?.setup_required ? '/plataforma/seguridad' : '/dashboard'
  setTimeout(() => router.push(target), 150)
}

const login = handleSubmit(async (values: LoginCredentials): Promise<void> => {
  loading.value = true
  clearMessages()

  try {
    const ticket = await authStore.login({
      login: values.login.trim(),
      password: values.password,
      company: values.company?.trim() || undefined,
    })

    if (ticket) {
      challenge.value = ticket
      twoFactorCode.value = ''
      recoveryCode.value = ''
      useRecovery.value = false
      step.value = 'two_factor'
      return
    }

    enterApp()
  } catch (err: any) {
    const serverErrors = err.response?.data?.errors
    const firstError = serverErrors?.email?.[0] || serverErrors?.login?.[0] || serverErrors?.company?.[0]
    error.value = firstError || errorMessage(err, 'No pudimos iniciar sesión. Revisa tus datos e inténtalo de nuevo.')
  } finally {
    loading.value = false
  }
})

const verifyCode = async (): Promise<void> => {
  if (!challenge.value) return goTo('login')
  loading.value = true
  clearMessages()
  try {
    await authStore.completeTwoFactor(
      challenge.value,
      useRecovery.value ? { recovery_code: recoveryCode.value.trim() } : { code: twoFactorCode.value.trim() },
    )
    enterApp()
  } catch (err) {
    error.value = errorMessage(err, 'No pudimos verificar el código. Inténtalo de nuevo.')
  } finally {
    loading.value = false
  }
}

const sendResetLink = async (): Promise<void> => {
  loading.value = true
  clearMessages()
  try {
    successMessage.value = await authService.forgotPassword(resetEmail.value.trim())
  } catch (err) {
    error.value = errorMessage(err, 'No pudimos enviar el enlace. Inténtalo de nuevo en un momento.')
  } finally {
    loading.value = false
  }
}

const saveNewPassword = async (): Promise<void> => {
  const { valid } = await resetForm.value.validate()
  if (!valid) return

  loading.value = true
  clearMessages()
  const email = String(route.query.email ?? '')
  try {
    await authService.resetPassword({
      token: String(route.query.token ?? ''),
      email,
      password: newPassword.value,
      password_confirmation: newPasswordConfirmation.value,
    })
    // La vista se vuelve a montar con la ruta nueva: el aviso viaja en la URL.
    await router.replace({ path: '/login', query: { restablecida: '1', email } })
  } catch (err) {
    error.value = errorMessage(err, 'No pudimos cambiar la contraseña. Pide un enlace nuevo.')
  } finally {
    loading.value = false
  }
}

if (route.query.restablecida) {
  successMessage.value = 'Tu contraseña quedó cambiada. Ya puedes iniciar sesión.'
  loginId.value = String(route.query.email ?? '')
}

if (authStore.isAuthenticated) {
  router.push('/dashboard')
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
