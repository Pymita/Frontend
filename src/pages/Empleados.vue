<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Empleados</h1>
            <p class="text-body-1 text-medium-emphasis">
              Crea las cuentas de tu equipo y decide a qué funciones tiene acceso cada uno
            </p>
          </div>
          <LockableButton icon="mdi-account-plus" color="primary" size="large" @click="openDialog()">
            Nuevo empleado
          </LockableButton>
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
            <template #item.login_id="{ item }">
              {{ item.username || item.email }}
            </template>
            <template #item.role="{ item }">
              <v-chip :color="item.role === 'admin' ? 'warning' : 'primary'" size="small" variant="tonal">
                {{ item.role === 'admin' ? 'Admin' : 'Empleado' }}
              </v-chip>
            </template>
            <template #item.active="{ item }">
              <v-chip :color="item.active ? 'success' : 'secondary'" size="small">
                {{ item.active ? 'Activo' : 'Inactivo' }}
              </v-chip>
            </template>
            <template #item.features="{ item }">
              <template v-if="item.role === 'admin'">
                <span class="text-caption text-medium-emphasis">Acceso total</span>
              </template>
              <template v-else>
                <template v-for="feature in item.features" :key="feature">
                  <v-chip size="x-small" class="mr-1 mb-1" variant="outlined">
                    {{ featureLabel(feature) }}
                  </v-chip>
                  <v-chip
                    v-if="feature === 'orders' && item.can_charge_orders"
                    size="x-small"
                    class="mr-1 mb-1"
                    variant="outlined"
                  >
                    Cobrar pedidos
                  </v-chip>
                  <v-chip
                    v-if="feature === 'orders' && item.can_change_order_status"
                    size="x-small"
                    class="mr-1 mb-1"
                    variant="outlined"
                  >
                    Cambiar estado de pedidos
                  </v-chip>
                  <v-chip
                    v-if="feature === 'inventory' && item.can_edit_kardex"
                    size="x-small"
                    class="mr-1 mb-1"
                    variant="outlined"
                  >
                    Editar movimientos del kardex
                  </v-chip>
                  <v-chip
                    v-if="feature === 'reports' && item.can_use_accounting"
                    size="x-small"
                    class="mr-1 mb-1"
                    variant="outlined"
                  >
                    Contabilidad
                  </v-chip>
                </template>
              </template>
            </template>
            <template #item.hired_at="{ item }">
              {{ item.hired_at ? formatIsoDate(item.hired_at) : '—' }}
            </template>
            <template #item.last_login_at="{ item }">
              {{ item.last_login_at ? formatMomentDay(item.last_login_at) : 'Nunca' }}
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" :disabled="isReadOnly" :aria-label="`Editar a ${item.name}`" @click="openDialog(item)">
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
        <v-card-title>{{ editing ? 'Editar empleado' : 'Nuevo empleado' }}</v-card-title>
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
              <!-- La cuenta del empleado es del negocio: entra con un usuario
                   interno, no con su correo personal. -->
              <v-col v-if="formData.role === 'employee'" cols="6">
                <v-text-field
                  v-model="formData.username"
                  label="Usuario de acceso"
                  hint="Con esto inicia sesión en la app (ej: mesero1)"
                  persistent-hint
                  :rules="usernameRules"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model="formData.email"
                  :label="formData.role === 'admin' ? 'Correo de acceso' : 'Correo (opcional)'"
                  type="email"
                  :rules="formData.role === 'admin' ? [(v: string) => !!v || 'El correo es obligatorio'] : []"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field v-model="formData.phone" label="Teléfono (opcional)" />
              </v-col>
              <v-col cols="12" sm="6">
                <PasswordField
                  v-model="formData.password"
                  :label="editing ? 'Nueva contraseña (opcional)' : 'Contraseña'"
                  :rules="currentPasswordRules"
                  :hint="PASSWORD_HINT"
                  persistent-hint
                  autocomplete="new-password"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <PasswordField
                  v-model="passwordConfirmation"
                  label="Confirmar contraseña"
                  :rules="confirmPasswordRules(() => formData.password)"
                  autocomplete="new-password"
                />
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
              <v-col cols="12" sm="8">
                <DateField v-model="formData.hired_at" label="Fecha de ingreso a la empresa (opcional)" clearable />
              </v-col>
            </v-row>

            <template v-if="formData.role === 'employee'">
              <v-divider class="my-3" />
              <p class="text-subtitle-2 mb-1">Funciones habilitadas</p>
              <p class="text-caption text-medium-emphasis mb-2">
                El empleado solo verá y podrá usar las funciones marcadas
              </p>
              <v-row dense>
                <template v-for="feature in dialogFeatures" :key="feature">
                  <v-col cols="6">
                    <v-checkbox
                      v-model="formData.permissions"
                      :label="featureLabel(feature)"
                      :value="feature"
                      density="compact"
                      hide-details
                    />
                  </v-col>
                  <!-- Tomar pedidos y recibir la plata son trabajos distintos: cobrar va aparte,
                       y también mover el pedido de cocina a la mesa. -->
                  <v-col v-if="feature === 'orders'" cols="6">
                    <v-checkbox
                      v-model="chargeOrders"
                      label="Cobrar pedidos"
                      :disabled="!formData.permissions.includes('orders')"
                      hint="Registra pagos y propinas, también desde la app"
                      persistent-hint
                      density="compact"
                    />
                    <v-checkbox
                      v-model="changeOrderStatus"
                      label="Cambiar estado de pedidos"
                      :disabled="!formData.permissions.includes('orders')"
                      hint="En preparación, listo o entregado, también desde la app"
                      persistent-hint
                      density="compact"
                    />
                  </v-col>
                  <v-col v-if="feature === 'inventory'" cols="6">
                    <v-checkbox
                      v-model="editKardex"
                      label="Editar movimientos del kardex"
                      :disabled="!formData.permissions.includes('inventory')"
                      hint="Corrige compras (FC) y ajustes (AJ) registrados a mano"
                      persistent-hint
                      density="compact"
                    />
                  </v-col>
                  <v-col v-if="feature === 'reports'" cols="6">
                    <v-checkbox
                      v-model="useAccounting"
                      label="Contabilidad"
                      :disabled="!formData.permissions.includes('reports')"
                      hint="Configura las cuentas y descarga el movimiento contable"
                      persistent-hint
                      density="compact"
                    />
                  </v-col>
                </template>
              </v-row>
            </template>
            <p v-else class="text-caption text-medium-emphasis mt-3">
              Los administradores tienen acceso a todas las funciones.
            </p>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">
            {{ editing ? 'Guardar cambios' : 'Crear empleado' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { formatIsoDate, formatMomentDay } from '@/utils/dates'
import { errorMessage } from '@/utils/errors'
import { computed, onMounted, ref } from 'vue'
import usersService, { type CompanyUser } from '../services/usersService'
import { ALL_FEATURES, type Feature } from '../types/auth'
import { useAuthStore } from '../stores/auth'
import { PASSWORD_HINT, confirmPasswordRules, optionalPasswordRules, passwordRules } from '../utils/validation'
import DateField from '../components/DateField.vue'
import LockableButton from '../components/LockableButton.vue'
import PasswordField from '../components/PasswordField.vue'
import { useReadOnly } from '../composables/useReadOnly'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

const authStore = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const users = ref<CompanyUser[]>([])
// Solo las funciones que la empresa tiene: conceder recetas en un billar
// no serviría de nada (el backend las intersecta igual).
const allFeatures = computed(() => {
  const companyModules = authStore.user?.company?.modules
  return companyModules?.length ? ALL_FEATURES.filter(f => companyModules.includes(f)) : ALL_FEATURES
})
// Pedidos, Inventario and Informes go first so the permission inside each one sits beside it in the two-column grid.
const WITH_INNER_PERMISSION: Feature[] = ['orders', 'inventory', 'reports']
const dialogFeatures = computed(() => [
  ...allFeatures.value.filter(f => WITH_INNER_PERMISSION.includes(f)),
  ...allFeatures.value.filter(f => !WITH_INNER_PERMISSION.includes(f)),
])

const headers = [
  { title: 'Nombre', key: 'name' },
  { title: 'Acceso', key: 'login_id', sortable: false },
  { title: 'Rol', key: 'role' },
  { title: 'Estado', key: 'active' },
  { title: 'Funciones', key: 'features', sortable: false },
  { title: 'Ingreso a la empresa', key: 'hired_at' },
  // When they last signed in, not the hire date.
  { title: 'Última sesión', key: 'last_login_at' },
  { title: 'Acciones', key: 'actions', sortable: false },
]

const featureLabels: Record<Feature, string> = {
  orders: 'Pedidos y mesas',
  time_billing: 'Cobro por tiempo',
  menu: 'Menú y categorías',
  inventory: 'Productos e inventario',
  recipes: 'Recetas y costeo',
  customers: 'Clientes y cartera',
  expenses: 'Gastos',
  reports: 'Inicio, ventas y reportes',
  recurring_billing: 'Facturación automática y cartera',
}
const featureLabel = (feature: Feature): string => featureLabels[feature] || feature


const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' = 'success') => {
  snackbar.value = { show: true, text, color }
}

const load = async () => {
  loading.value = true
  try {
    users.value = await usersService.list()
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar los empleados. Inténtalo de nuevo.'), 'error')
  } finally {
    loading.value = false
  }
}

// --- Crear / editar ---
const dialog = ref(false)
const editing = ref<CompanyUser | null>(null)
const form = ref()
const usernameRules = [
  (v: string) => !!v || 'Usuario requerido',
  (v: string) => !v || /^[a-zA-Z0-9._-]{3,50}$/.test(v) || 'De 3 a 50 caracteres: letras, números, punto o guion',
]

const formData = ref({
  name: '',
  email: '',
  username: '',
  password: '',
  phone: '',
  hired_at: '',
  role: 'employee' as 'admin' | 'employee',
  active: true,
  permissions: [] as Feature[],
  canChargeOrders: false,
  canChangeOrderStatus: true,
  canEditKardex: false,
  canUseAccounting: false,
})

// Cobrar is part of Pedidos: without it the box reads unchecked and nothing is granted.
const chargeOrders = computed({
  get: () => formData.value.canChargeOrders && formData.value.permissions.includes('orders'),
  set: (value: boolean) => {
    formData.value.canChargeOrders = value
  },
})

// So is changing an order's status.
const changeOrderStatus = computed({
  get: () => formData.value.canChangeOrderStatus && formData.value.permissions.includes('orders'),
  set: (value: boolean) => {
    formData.value.canChangeOrderStatus = value
  },
})

// Same for the kardex: editing its movements is part of Inventario.
const editKardex = computed({
  get: () => formData.value.canEditKardex && formData.value.permissions.includes('inventory'),
  set: (value: boolean) => {
    formData.value.canEditKardex = value
  },
})

// And accounting is part of Informes.
const useAccounting = computed({
  get: () => formData.value.canUseAccounting && formData.value.permissions.includes('reports'),
  set: (value: boolean) => {
    formData.value.canUseAccounting = value
  },
})

const isSelf = computed(() => editing.value?.id === authStore.user?.id)

const currentPasswordRules = computed(() => editing.value ? optionalPasswordRules : passwordRules)
const passwordConfirmation = ref('')

const openDialog = (user?: CompanyUser) => {
  editing.value = user ?? null
  passwordConfirmation.value = ''
  formData.value = user
    ? {
        name: user.name,
        email: user.email || '',
        username: user.username || '',
        password: '',
        phone: user.phone || '',
        hired_at: user.hired_at ?? '',
        role: user.role as 'admin' | 'employee',
        active: user.active,
        permissions: [...user.features],
        canChargeOrders: user.can_charge_orders,
        // Without Pedidos the API answers false; ticking Pedidos then starts from the default.
        canChangeOrderStatus: user.features.includes('orders') ? user.can_change_order_status : true,
        canEditKardex: user.can_edit_kardex,
        canUseAccounting: !!user.can_use_accounting,
      }
    : {
        name: '',
        email: '',
        username: '',
        password: '',
        phone: '',
        hired_at: '',
        role: 'employee',
        active: true,
        permissions: allFeatures.value.filter(f => f !== 'expenses'),
        // A new employee changes statuses but does not charge until the admin decides.
        canChargeOrders: false,
        canChangeOrderStatus: true,
        canEditKardex: false,
        canUseAccounting: false,
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
      email: formData.value.email || undefined,
      username: formData.value.role === 'employee' ? formData.value.username : undefined,
      phone: formData.value.phone || undefined,
      hired_at: formData.value.hired_at || null,
      role: formData.value.role,
      permissions: formData.value.role === 'employee' ? formData.value.permissions : undefined,
      can_charge_orders: formData.value.role === 'employee' ? chargeOrders.value : undefined,
      can_change_order_status: formData.value.role === 'employee' ? changeOrderStatus.value : undefined,
      can_edit_kardex: formData.value.role === 'employee' ? editKardex.value : undefined,
      can_use_accounting: formData.value.role === 'employee' ? useAccounting.value : undefined,
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
    notify(errorMessage(error, 'No fue posible guardar el empleado. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
