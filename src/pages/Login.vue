<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <v-col cols="12" class="d-flex align-center justify-center" style="background: linear-gradient(135deg, #f26916 0%, #e3530c 100%);">
        <v-card width="400" elevation="10" class="pa-6">
          <div class="text-center mb-6">
            <v-icon size="60" color="primary" class="mb-4">mdi-bread-slice</v-icon>
            <h1 class="text-h4 text-primary mb-2">{{ APP_NAME }}</h1>
            <p class="text-body-1 text-grey-darken-1">{{ APP_TAGLINE }}</p>
          </div>

          <v-form @submit.prevent="login">
            <v-text-field
              v-model="loginId"
              v-bind="loginIdAttrs"
              label="Correo o usuario"
              prepend-inner-icon="mdi-account"
              variant="outlined"
              class="mb-3"
              :error-messages="errors.login"
            />

            <!-- Un usuario interno solo existe dentro de su negocio: el
                 backend necesita el slug para saber en cuál buscar. -->
            <v-text-field
              v-if="needsCompany"
              v-model="company"
              v-bind="companyAttrs"
              label="Código del negocio"
              hint="Pídeselo a tu administrador (ej: sabores-del-trigo)"
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
              :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="showPassword = !showPassword"
              variant="outlined"
              class="mb-3"
              :error-messages="errors.password"
            />

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              :disabled="!isFormValid"
              class="mb-3"
            >
              Iniciar Sesión
            </v-btn>
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
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { APP_NAME, APP_TAGLINE } from '@/utils/branding';
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useAuthStore } from '../stores/auth'
import type { LoginCredentials } from '../types'

const router = useRouter()
const authStore = useAuthStore()

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

const login = handleSubmit(async (values: LoginCredentials): Promise<void> => {
  loading.value = true
  clearMessages()

  try {
    await authStore.login({
      login: values.login.trim(),
      password: values.password,
      company: values.company?.trim() || undefined,
    })

    const userName = authStore.user?.name || 'Usuario'
    successMessage.value = `¡Bienvenido ${userName}!`
    
    setTimeout(() => {
      router.push('/dashboard')
    }, 150)

  } catch (err: any) {
    if (err.response?.status === 422) {
      const serverErrors = err.response.data.errors
      const firstError = serverErrors?.email?.[0] || serverErrors?.login?.[0] || serverErrors?.company?.[0]
      if (firstError) {
        error.value = firstError
      } else {
        error.value = 'Credenciales incorrectas'
      }
    } else if (err.response?.status === 401) {
      // Error de autorización - usar mensaje del servidor si está disponible
      error.value = err.response.data?.message || 'Credenciales incorrectas'
    } else if (err.response?.data?.message) {
      // Otros errores del servidor
      error.value = err.response.data.message
    } else {
      error.value = 'Error de conexión. Verifica que el backend esté funcionando.'
    }
    
  } finally {
    loading.value = false
  }
})

if (authStore.isAuthenticated) {
  router.push('/dashboard')
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
