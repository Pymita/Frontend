<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <v-col cols="12" class="d-flex align-center justify-center" style="background: linear-gradient(135deg, #f26916 0%, #e3530c 100%);">
        <v-card width="400" elevation="10" class="pa-6">
          <div class="text-center mb-6">
            <v-icon size="60" color="primary" class="mb-4">mdi-bread-slice</v-icon>
            <h1 class="text-h4 text-primary mb-2">Sabores del Trigo</h1>
            <p class="text-body-1 text-grey-darken-1">Sistema de Gestión</p>
          </div>

          <v-form @submit.prevent="login" v-model="valid">
            <v-text-field
              v-model="email"
              label="Email"
              type="email"
              :rules="emailRules"
              prepend-inner-icon="mdi-email"
              variant="outlined"
              class="mb-3"
              required
            />

            <v-text-field
              v-model="password"
              label="Contraseña"
              :type="showPassword ? 'text' : 'password'"
              :rules="passwordRules"
              prepend-inner-icon="mdi-lock"
              :append-inner-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
              @click:append-inner="showPassword = !showPassword"
              variant="outlined"
              class="mb-3"
              required
            />

            <v-btn
              type="submit"
              color="primary"
              size="large"
              block
              :loading="loading"
              :disabled="!valid"
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

          <!-- Usuarios de prueba -->
          <v-expansion-panels variant="accordion" class="mt-4">
            <v-expansion-panel>
              <v-expansion-panel-title>
                <v-icon class="mr-2">mdi-help-circle</v-icon>
                Usuarios de Prueba
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="text-body-2">
                  <div class="mb-2">
                    <strong>Admin:</strong><br>
                    admin@saboresdeltrigo.com / admin123
                  </div>
                  <div>
                    <strong>Empleado:</strong><br>
                    empleado@saboresdeltrigo.com / empleado123
                  </div>
                </div>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')
const showPassword = ref(false)
const valid = ref(false)

const emailRules = [
  (v: string) => !!v || 'Email es requerido',
  (v: string) => /.+@.+\..+/.test(v) || 'Email debe ser válido'
]

const passwordRules = [
  (v: string) => !!v || 'Contraseña es requerida',
  (v: string) => v.length >= 6 || 'Contraseña debe tener al menos 6 caracteres'
]

const login = async () => {
  if (!valid.value) return

  loading.value = true
  error.value = ''

  try {
    // TODO: Implementar llamada real a la API
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simular delay
    
    // Simular login exitoso
    if (email.value.includes('@saboresdeltrigo.com')) {
      localStorage.setItem('isAuthenticated', 'true')
      localStorage.setItem('user', JSON.stringify({
        name: email.value.includes('admin') ? 'Administrador' : 'Empleado',
        email: email.value,
        role: email.value.includes('admin') ? 'admin' : 'employee'
      }))
      router.push('/dashboard')
    } else {
      error.value = 'Credenciales inválidas'
    }
  } catch (err) {
    error.value = 'Error al iniciar sesión'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.fill-height {
  min-height: 100vh;
}
</style>
