<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Empleados</h1>
            <p class="text-body-1 text-grey-darken-1">
              Crea las cuentas de tu equipo y decide a qué funciones tiene acceso cada uno
            </p>
          </div>
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-account-plus</v-icon>
            Nuevo Empleado
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="users"
            :loading="loading"
            class="elevation-0"
          >
            <template #item.role="{ item }">
              <v-chip :color="item.role === 'admin' ? 'warning' : 'primary'" size="small" variant="tonal">
                {{ item.role === 'admin' ? 'Admin' : 'Empleado' }}
              </v-chip>
            </template>
            <template #item.active="{ item }">
              <v-chip :color="item.active ? 'success' : 'grey'" size="small">
                {{ item.active ? 'Activo' : 'Inactivo' }}
              </v-chip>
            </template>
            <template #item.features="{ item }">
              <template v-if="item.role === 'admin'">
                <span class="text-caption text-grey">Acceso total</span>
              </template>
              <template v-else>
                <v-chip
                  v-for="feature in item.features"
                  :key="feature"
                  size="x-small"
                  class="mr-1 mb-1"
                  variant="outlined"
                >
                  {{ featureLabel(feature) }}
                </v-chip>
              </template>
            </template>
            <template #item.last_login_at="{ item }">
              {{ item.last_login_at ? formatDate(item.last_login_at) : 'Nunca' }}
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" @click="openDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog crear/editar empleado -->
    <v-dialog v-model="dialog" max-width="640" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Editar Empleado' : 'Nuevo Empleado' }}</v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent="save">
            <v-row dense>
              <v-col cols="6">
                <v-text-field
                  v-model="formData.name"
                  label="Nombre"
                  :rules="[(v: string) => !!v || 'Nombre requerido']"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="formData.email"
                  label="Email de acceso"
                  type="email"
                  :rules="[(v: string) => !!v || 'Email requerido']"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="formData.password"
                  :label="editing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
                  type="password"
                  :rules="passwordRules"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="formData.phone" label="Teléfono (opcional)" />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="formData.role"
                  label="Rol"
                  :items="[
                    { title: 'Empleado', value: 'employee' },
                    { title: 'Administrador', value: 'admin' },
                  ]"
                  :disabled="isSelf"
                />
              </v-col>
              <v-col cols="6" class="d-flex align-center">
                <v-switch
                  v-if="editing"
                  v-model="formData.active"
                  label="Cuenta activa"
                  color="success"
                  hide-details
                  :disabled="isSelf"
                />
              </v-col>
            </v-row>

            <template v-if="formData.role === 'employee'">
              <v-divider class="my-3" />
              <p class="text-subtitle-2 mb-1">Funciones habilitadas</p>
              <p class="text-caption text-grey mb-2">
                El empleado solo verá y podrá usar las funciones marcadas
              </p>
              <v-row dense>
                <v-col v-for="feature in allFeatures" :key="feature" cols="6">
                  <v-checkbox
                    v-model="formData.permissions"
                    :label="featureLabel(feature)"
                    :value="feature"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
            </template>
            <p v-else class="text-caption text-grey mt-3">
              Los administradores tienen acceso a todas las funciones.
            </p>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">
            {{ editing ? 'Guardar cambios' : 'Crear Empleado' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="4000">
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import usersService, { type CompanyUser } from '../services/usersService'
import { ALL_FEATURES, type Feature } from '../types/auth'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const users = ref<CompanyUser[]>([])
const allFeatures = ALL_FEATURES

const headers = [
  { title: 'Nombre', key: 'name' },
  { title: 'Email', key: 'email' },
  { title: 'Rol', key: 'role' },
  { title: 'Estado', key: 'active' },
  { title: 'Funciones', key: 'features', sortable: false },
  { title: 'Último ingreso', key: 'last_login_at' },
  { title: 'Acciones', key: 'actions', sortable: false },
]

const featureLabels: Record<Feature, string> = {
  orders: 'Pedidos y mesas',
  menu: 'Menú y categorías',
  inventory: 'Productos y recetas',
  customers: 'Clientes',
  expenses: 'Gastos',
  reports: 'Dashboard',
}
const featureLabel = (feature: Feature): string => featureLabels[feature] || feature

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('es-CO', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' = 'success') => {
  snackbar.value = { show: true, text, color }
}

const load = async () => {
  loading.value = true
  try {
    users.value = await usersService.list()
  } catch {
    notify('Error al cargar los empleados', 'error')
  } finally {
    loading.value = false
  }
}

// --- Crear / editar ---
const dialog = ref(false)
const editing = ref<CompanyUser | null>(null)
const form = ref()
const formData = ref({
  name: '',
  email: '',
  password: '',
  phone: '',
  role: 'employee' as 'admin' | 'employee',
  active: true,
  permissions: [] as Feature[],
})

const isSelf = computed(() => editing.value?.id === authStore.user?.id)

const passwordRules = computed(() => editing.value
  ? [(v: string) => !v || v.length >= 8 || 'Mínimo 8 caracteres']
  : [(v: string) => (v && v.length >= 8) || 'Mínimo 8 caracteres'])

const openDialog = (user?: CompanyUser) => {
  editing.value = user ?? null
  formData.value = user
    ? {
        name: user.name,
        email: user.email,
        password: '',
        phone: user.phone || '',
        role: user.role as 'admin' | 'employee',
        active: user.active,
        permissions: [...user.features],
      }
    : {
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'employee',
        active: true,
        permissions: ['orders', 'menu', 'inventory', 'customers', 'reports'],
      }
  dialog.value = true
}

const save = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  saving.value = true
  try {
    const base = {
      name: formData.value.name,
      email: formData.value.email,
      phone: formData.value.phone || undefined,
      role: formData.value.role,
      permissions: formData.value.role === 'employee' ? formData.value.permissions : undefined,
    }

    if (editing.value) {
      await usersService.update(editing.value.id, {
        ...base,
        active: formData.value.active,
        password: formData.value.password || undefined,
      })
      notify('Empleado actualizado exitosamente')
    } else {
      await usersService.create({
        ...base,
        password: formData.value.password,
      })
      notify('Empleado creado exitosamente')
    }

    dialog.value = false
    await load()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al guardar el empleado', 'error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
