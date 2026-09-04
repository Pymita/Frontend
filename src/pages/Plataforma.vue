<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">{{ sectionTitle }}</h1>
            <p class="text-body-1 text-grey-darken-1">{{ sectionSubtitle }}</p>
          </div>
          <v-btn v-if="tab === 'companies'" color="primary" size="large" @click="openCreateDialog">
            <v-icon start>mdi-domain-plus</v-icon>
            Nueva Empresa
          </v-btn>
          <v-btn v-else-if="tab === 'sellers'" color="primary" size="large" @click="openSellerDialog()">
            <v-icon start>mdi-account-plus</v-icon>
            Nuevo Vendedor
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row v-if="tab === 'companies'">
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="companies"
            :loading="loading"
            class="elevation-0"
          >
            <template #item.name="{ item }">
              <div>
                <strong>{{ item.name }}</strong>
                <div class="text-caption text-grey">{{ item.slug }}</div>
              </div>
            </template>
            <template #item.business_type="{ item }">
              <v-chip size="small" variant="tonal">{{ businessTypeLabel(item.business_type) }}</v-chip>
            </template>
            <template #item.users_count="{ item }">
              <v-chip size="small" color="primary" variant="tonal">
                {{ item.users_count }} usuarios
              </v-chip>
            </template>
            <template #item.active="{ item }">
              <v-chip :color="item.active ? 'success' : 'error'" size="small">
                {{ item.active ? 'Activa' : 'Inactiva' }}
              </v-chip>
            </template>
            <template #item.subscription="{ item }">
              <v-chip
                v-if="item.subscription"
                :color="statusColor(item.subscription.status)"
                size="small"
              >
                {{ statusLabel(item.subscription.status) }}
              </v-chip>
              <v-chip v-else color="grey" size="small" variant="outlined">
                Sin suscripción
              </v-chip>
            </template>
            <template #item.period_end="{ item }">
              {{ item.subscription?.current_period_end || '—' }}
            </template>
            <template #item.actions="{ item }">
              <v-tooltip text="Ver y editar empresa">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon size="small" variant="text" @click="openDetailDialog(item)">
                    <v-icon size="small">mdi-eye-outline</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip text="Gestionar suscripción y pagos">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon size="small" variant="text" @click="openSubscriptionDialog(item)">
                    <v-icon size="small">mdi-credit-card-outline</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              <v-tooltip :text="item.active ? 'Desactivar empresa' : 'Reactivar empresa'">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    :color="item.active ? 'error' : 'success'"
                    @click="confirmToggle(item)"
                  >
                    <v-icon size="small">{{ item.active ? 'mdi-domain-off' : 'mdi-domain' }}</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Vendedores del SaaS -->
    <v-row v-else-if="tab === 'sellers'">
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="sellerHeaders"
            :items="sellers"
            :loading="loadingSellers"
            class="elevation-0"
          >
            <template #item.active="{ item }">
              <v-chip :color="item.active ? 'success' : 'grey'" size="small">
                {{ item.active ? 'Activo' : 'Inactivo' }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" @click="openSellerDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
            </template>
            <template #no-data>
              <p class="text-grey py-6">Aún no hay vendedores registrados</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Ventas por vendedor -->
    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="statsHeaders"
            :items="sellerStats"
            :loading="loadingStats"
            class="elevation-0"
          >
            <template #item.monthly_recurring="{ item }">
              ${{ item.monthly_recurring.toLocaleString('es-CO') }}
            </template>
            <template #item.total_collected="{ item }">
              <span class="font-weight-bold text-success">
                ${{ item.total_collected.toLocaleString('es-CO') }}
              </span>
            </template>
            <template #item.last_sale_at="{ item }">
              {{ item.last_sale_at || '—' }}
            </template>
            <template #no-data>
              <p class="text-grey py-6">Sin ventas asociadas a vendedores todavía</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog: crear/editar vendedor -->
    <v-dialog v-model="sellerDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>{{ editingSeller ? 'Editar Vendedor' : 'Nuevo Vendedor' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="sellerForm.name"
            label="Nombre *"
            :rules="[(v: string) => !!v || 'Nombre requerido']"
          />
          <v-text-field v-model="sellerForm.email" label="Email (opcional)" type="email" />
          <v-text-field v-model="sellerForm.phone" label="Teléfono (opcional)" />
          <v-switch
            v-if="editingSeller"
            v-model="sellerForm.active"
            label="Activo"
            color="success"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="sellerDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveSeller">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: crear empresa -->
    <!-- Ancho a propósito: dos columnas para que todo el formulario quepa
         sin scrollear (empresa a la izquierda, admin y acuerdo a la derecha) -->
    <v-dialog v-model="createDialog" max-width="960" persistent>
      <v-card>
        <v-card-title>Nueva Empresa</v-card-title>
        <v-card-text>
          <v-form ref="createForm" @submit.prevent="saveCompany">
            <v-row>
              <v-col cols="12" md="6">
                <p class="text-subtitle-2 mb-2">Empresa</p>
                <v-text-field
                  v-model="createData.name"
                  label="Nombre de la empresa"
                  :rules="[(v: string) => !!v || 'Nombre requerido']"
                  required
                />
                <v-select
                  v-model="createData.business_type"
                  :items="businessTypeOptions"
                  item-title="title"
                  item-value="value"
                  label="Tipo de negocio"
                  class="mt-2"
                  hint="Marca los módulos que necesita; puedes ajustarlos"
                  persistent-hint
                  @update:model-value="createData.modules = [...presetModules($event)]"
                />

                <p class="text-subtitle-2 mt-4 mb-1">Módulos activos</p>
                <v-row dense>
                  <v-col v-for="feature in allFeatures" :key="feature" cols="6">
                    <v-checkbox
                      v-model="createData.modules"
                      :label="featureLabel(feature)"
                      :value="feature"
                      density="compact"
                      hide-details
                    />
                  </v-col>
                </v-row>
                <v-row dense class="mt-3">
                  <v-col cols="6">
                    <v-text-field v-model="createData.email" label="Email (opcional)" type="email" />
                  </v-col>
                  <v-col cols="6">
                    <v-text-field v-model="createData.phone" label="Teléfono (opcional)" />
                  </v-col>
                </v-row>
              </v-col>

              <v-col cols="12" md="6">
                <p class="text-subtitle-2 mb-2">Administrador de la empresa</p>
                <v-text-field
                  v-model="createData.admin.name"
                  label="Nombre del administrador"
                  :rules="[(v: string) => !!v || 'Nombre requerido']"
                />
                <v-row dense class="mt-1">
                  <v-col cols="6">
                    <v-text-field
                      v-model="createData.admin.email"
                      label="Email de acceso"
                      type="email"
                      :rules="[(v: string) => !!v || 'Email requerido']"
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-text-field
                      v-model="createData.admin.password"
                      label="Contraseña inicial"
                      type="password"
                      :rules="passwordRules"
                      :hint="PASSWORD_HINT"
                      persistent-hint
                    />
                  </v-col>
                </v-row>

                <v-divider class="my-3" />
                <p class="text-subtitle-2 mb-2">Acuerdo comercial</p>
                <v-row dense>
                  <v-col cols="6">
                    <v-text-field
                      v-model.number="createData.monthly_price"
                      label="Valor mensual (COP)"
                      type="number"
                      min="0"
                      prefix="$"
                      hint="Los pagos deberán coincidir con este valor"
                      persistent-hint
                    />
                  </v-col>
                  <v-col cols="6">
                    <v-select
                      v-model="createData.seller_id"
                      :items="sellers"
                      item-title="name"
                      item-value="id"
                      label="Vendedor"
                      hint="Quién hizo la venta"
                      persistent-hint
                      clearable
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      v-model.number="createData.max_tables"
                      label="Mesas incluidas"
                      type="number"
                      min="1"
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      v-model.number="createData.max_users"
                      label="Empleados incluidos"
                      type="number"
                      min="1"
                    />
                  </v-col>
                  <v-col cols="4">
                    <v-text-field
                      v-model.number="createData.trial_days"
                      label="Días de prueba"
                      type="number"
                    />
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="createDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveCompany">Crear Empresa</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: detalle y edición de empresa -->
    <v-dialog v-model="detailDialog" max-width="760">
      <v-card>
        <v-card-title class="d-flex align-center">
          <span>{{ detail?.name || 'Empresa' }}</span>
          <v-chip
            v-if="detail"
            :color="detail.active ? 'success' : 'error'"
            size="small"
            class="ml-3"
          >
            {{ detail.active ? 'Activa' : 'Inactiva' }}
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="!editingDetail"
            color="primary"
            variant="tonal"
            size="small"
            @click="startEditDetail"
          >
            <v-icon start size="small">mdi-pencil</v-icon>
            Editar
          </v-btn>
        </v-card-title>

        <v-card-text>
          <v-progress-linear v-if="loadingDetail" indeterminate color="primary" class="mb-4" />

          <template v-if="detail">
            <!-- Datos de la empresa -->
            <v-form v-if="editingDetail" ref="editFormRef" @submit.prevent="saveDetail">
              <v-row dense>
                <v-col cols="6">
                  <v-text-field
                    v-model="editData.name"
                    label="Nombre"
                    :rules="[(v: string) => !!v || 'Nombre requerido']"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field
                    v-model="editData.slug"
                    label="Slug (identificador público)"
                    hint="Lo usa la app móvil (header X-Company); cambiarlo requiere actualizar la app"
                    persistent-hint
                    :rules="[(v: string) => !!v || 'Slug requerido']"
                  />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="editData.email" label="Email" type="email" />
                </v-col>
                <v-col cols="6">
                  <v-text-field v-model="editData.phone" label="Teléfono" />
                </v-col>
              </v-row>

              <v-select
                v-model="editData.business_type"
                :items="businessTypeOptions"
                item-title="title"
                item-value="value"
                label="Tipo de negocio"
                hint="Cambiarlo re-sugiere los módulos del vertical"
                persistent-hint
              />

              <p class="text-subtitle-2 mt-4 mb-1">Módulos activos</p>
              <p class="text-caption text-grey mb-2">
                Desmarca todos para volver a los del tipo de negocio
                ({{ presetModules(editData.business_type).map(featureLabel).join(', ') }}).
              </p>
              <v-row dense>
                <v-col v-for="feature in allFeatures" :key="feature" cols="6" md="4">
                  <v-checkbox
                    v-model="editData.modules"
                    :label="featureLabel(feature)"
                    :value="feature"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
              <div class="d-flex justify-end mt-2">
                <v-btn variant="text" class="mr-2" @click="editingDetail = false">Cancelar</v-btn>
                <v-btn color="primary" :loading="saving" @click="saveDetail">Guardar cambios</v-btn>
              </div>
            </v-form>

            <v-row v-else dense>
              <v-col cols="6">
                <div class="text-caption text-grey">Slug</div>
                <div>{{ detail.slug }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-grey">Tipo de negocio</div>
                <div>
                  {{ businessTypeLabel(detail.business_type) }}
                  <v-chip v-if="detail.modules_customized" size="x-small" class="ml-1" color="info" variant="tonal">
                    módulos personalizados
                  </v-chip>
                </div>
              </v-col>
              <v-col cols="12">
                <div class="text-caption text-grey">Módulos activos</div>
                <v-chip
                  v-for="feature in detail.modules"
                  :key="feature"
                  size="x-small"
                  class="mr-1 mb-1"
                  variant="outlined"
                >
                  {{ featureLabel(feature) }}
                </v-chip>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-grey">Creada</div>
                <div>{{ formatDate(detail.created_at) }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-grey">Email</div>
                <div>{{ detail.email || '—' }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-grey">Teléfono</div>
                <div>{{ detail.phone || '—' }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-grey">Suscripción</div>
                <v-chip
                  v-if="detail.subscription"
                  :color="statusColor(detail.subscription.status)"
                  size="small"
                >
                  {{ statusLabel(detail.subscription.status) }}
                </v-chip>
                <span v-else>Sin suscripción</span>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-grey">Pagada hasta</div>
                <div>{{ detail.subscription?.current_period_end || '—' }}</div>
              </v-col>
            </v-row>

            <!-- Usuarios -->
            <v-divider class="my-4" />
            <p class="text-subtitle-2 mb-2">Usuarios ({{ detail.users.length }})</p>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Último ingreso</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in detail.users" :key="user.id">
                  <td>{{ user.name }}</td>
                  <td>{{ user.email }}</td>
                  <td>{{ user.role === 'admin' ? 'Admin' : 'Empleado' }}</td>
                  <td>
                    <v-chip :color="user.active ? 'success' : 'grey'" size="x-small">
                      {{ user.active ? 'Activo' : 'Inactivo' }}
                    </v-chip>
                  </td>
                  <td>{{ user.last_login_at ? formatDate(user.last_login_at) : 'Nunca' }}</td>
                </tr>
              </tbody>
            </v-table>

            <!-- Pagos -->
            <v-divider class="my-4" />
            <p class="text-subtitle-2 mb-2">Historial de pagos ({{ detail.payments.length }})</p>
            <v-table v-if="detail.payments.length" density="compact">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Método</th>
                  <th>Referencia</th>
                  <th>Periodo cubierto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="payment in detail.payments" :key="payment.id">
                  <td>{{ payment.paid_at }}</td>
                  <td>${{ payment.amount.toLocaleString('es-CO') }} {{ payment.currency }}</td>
                  <td>{{ methodLabel(payment.method) }}</td>
                  <td>{{ payment.reference || '—' }}</td>
                  <td>{{ payment.period_start }} → {{ payment.period_end }}</td>
                </tr>
              </tbody>
            </v-table>
            <p v-else class="text-body-2 text-grey">Sin pagos registrados todavía.</p>
          </template>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: suscripción y pagos -->
    <v-dialog v-model="subscriptionDialog" max-width="640" persistent>
      <v-card v-if="selectedCompany">
        <v-card-title>Suscripción — {{ selectedCompany.name }}</v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="6">
              <v-select
                v-model="subscriptionData.status"
                label="Estado"
                :items="statusOptions"
                item-title="label"
                item-value="value"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model="subscriptionData.current_period_end"
                label="Pagada hasta"
                type="date"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="subscriptionData.plan" label="Plan" />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="subscriptionData.grace_days"
                label="Días de gracia"
                type="number"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="subscriptionData.monthly_price"
                label="Valor mensual (COP)"
                type="number"
                min="0"
                prefix="$"
                hint="Los pagos deben coincidir con este valor"
                persistent-hint
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="subscriptionData.seller_id"
                :items="sellers"
                item-title="name"
                item-value="id"
                label="Vendedor"
                clearable
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="subscriptionData.max_tables"
                label="Límite de mesas"
                type="number"
                hint="Plan base: 10"
                persistent-hint
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="subscriptionData.max_users"
                label="Límite de usuarios"
                type="number"
                hint="Plan base: 5"
                persistent-hint
              />
            </v-col>
          </v-row>
          <v-btn color="primary" variant="tonal" block :loading="saving" @click="saveSubscription">
            Guardar suscripción
          </v-btn>

          <v-divider class="my-4" />
          <p class="text-subtitle-2 mb-2">Registrar pago manual</p>
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="paymentData.amount"
                label="Monto (COP)"
                type="number"
                prefix="$"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="paymentData.months"
                label="Meses que cubre"
                type="number"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model="paymentData.method"
                label="Método"
                :items="methodOptions"
                item-title="label"
                item-value="value"
              />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="paymentData.reference" label="Referencia (opcional)" />
            </v-col>
          </v-row>

          <!-- Pago distinto al acuerdo: el motivo es obligatorio y queda escrito -->
          <v-alert
            v-if="paymentDiffers"
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
          >
            El valor acordado es ${{ expectedPayment!.toLocaleString('es-CO') }} por
            {{ paymentData.months }} mes(es). Indica el motivo de la diferencia.
          </v-alert>
          <v-textarea
            v-if="paymentDiffers"
            v-model="paymentData.discrepancy_reason"
            label="Motivo de la diferencia *"
            rows="2"
            class="mb-2"
          />

          <v-btn
            color="success"
            block
            :loading="saving"
            :disabled="!selectedCompany.subscription || !paymentData.amount || (paymentDiffers && !paymentData.discrepancy_reason.trim())"
            @click="savePayment"
          >
            <v-icon start>mdi-cash-check</v-icon>
            Registrar pago y extender periodo
          </v-btn>
          <p v-if="!selectedCompany.subscription" class="text-caption text-error mt-2">
            Guarda primero la suscripción para poder registrar pagos.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="subscriptionDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import platformService from '../services/platformService'
import type { PlatformCompany, PlatformCompanyDetail, PlatformSeller, SellerStats } from '../types/platform'
import { ALL_FEATURES, type BusinessType, type Feature, type SubscriptionStatus } from '../types/auth'
import { PASSWORD_HINT, passwordRules } from '../utils/validation'

const loading = ref(false)
const saving = ref(false)
const companies = ref<PlatformCompany[]>([])

const headers = [
  { title: 'Empresa', key: 'name' },
  { title: 'Tipo', key: 'business_type' },
  { title: 'Usuarios', key: 'users_count', sortable: false },
  { title: 'Estado', key: 'active' },
  { title: 'Suscripción', key: 'subscription', sortable: false },
  { title: 'Pagada hasta', key: 'period_end', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false },
]

const statusOptions = [
  { label: 'Prueba', value: 'trial' },
  { label: 'Activa', value: 'active' },
  { label: 'En gracia', value: 'grace' },
  { label: 'Suspendida', value: 'suspended' },
]

const methodOptions = [
  { label: 'Transferencia', value: 'transfer' },
  { label: 'Efectivo', value: 'cash' },
  { label: 'Pasarela', value: 'gateway' },
  { label: 'Otro', value: 'other' },
]

const snackbar = ref({ show: false, text: '', color: 'success' })

const notify = (text: string, color: 'success' | 'error' = 'success') => {
  snackbar.value = { show: true, text, color }
}

const statusColor = (status: SubscriptionStatus): string => ({
  trial: 'info',
  active: 'success',
  grace: 'warning',
  suspended: 'error',
}[status] || 'grey')

const statusLabel = (status: SubscriptionStatus): string => ({
  trial: 'Prueba',
  active: 'Activa',
  grace: 'En gracia',
  suspended: 'Suspendida',
}[status] || status)

const methodLabel = (method: string): string => ({
  transfer: 'Transferencia',
  cash: 'Efectivo',
  gateway: 'Pasarela',
  other: 'Otro',
}[method] || method)

const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('es-CO', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

const loadCompanies = async () => {
  loading.value = true
  try {
    companies.value = await platformService.listCompanies()
  } catch {
    notify('Error al cargar las empresas', 'error')
  } finally {
    loading.value = false
  }
}

// --- Crear empresa ---
const createDialog = ref(false)
const createForm = ref()
const emptyCreateData = () => ({
  name: '',
  email: '',
  phone: '',
  business_type: 'restaurant' as BusinessType,
  modules: [...BUSINESS_TYPE_PRESETS.restaurant] as Feature[],
  admin: { name: '', email: '', password: '' },
  trial_days: 15,
  // Acuerdo comercial: precio, qué incluye y quién vendió.
  monthly_price: null as number | null,
  max_tables: 10,
  max_users: 5,
  seller_id: null as number | null,
})

// --- Tipos de negocio y módulos ---
const allFeatures = ALL_FEATURES

const businessTypeOptions = [
  { value: 'restaurant', title: 'Restaurante' },
  { value: 'billiard', title: 'Billar' },
  { value: 'store', title: 'Tienda' },
  { value: 'other', title: 'Otro (todo activo)' },
]

// Espejo de Company::BUSINESS_TYPES del backend: sirve solo para mostrar
// qué activará cada tipo; la lista real la calcula el servidor.
const BUSINESS_TYPE_PRESETS: Record<BusinessType, Feature[]> = {
  restaurant: ['orders', 'menu', 'inventory', 'recipes', 'customers', 'expenses', 'reports'],
  billiard: ['orders', 'menu', 'inventory', 'time_billing', 'customers', 'expenses', 'reports'],
  store: ['menu', 'inventory', 'customers', 'expenses', 'reports'],
  other: ALL_FEATURES,
}

const featureLabels: Record<Feature, string> = {
  orders: 'Pedidos y mesas',
  time_billing: 'Cobro por tiempo',
  menu: 'Menú',
  inventory: 'Inventario',
  recipes: 'Recetas',
  customers: 'Clientes',
  expenses: 'Gastos',
  reports: 'Reportes',
}

const featureLabel = (feature: Feature): string => featureLabels[feature] || feature

/**
 * Si la selección es idéntica al preset del tipo de negocio, se envía vacío:
 * así la empresa sigue heredando futuros cambios del preset en vez de quedar
 * congelada con una lista propia.
 */
const modulesToSend = (type: BusinessType, selected: Feature[]): Feature[] => {
  const preset = [...presetModules(type)].sort().join(',')
  return [...selected].sort().join(',') === preset ? [] : selected
}
const presetModules = (type: BusinessType): Feature[] => BUSINESS_TYPE_PRESETS[type] ?? []
const businessTypeLabel = (type: BusinessType): string =>
  businessTypeOptions.find(o => o.value === type)?.title ?? type
const createData = ref(emptyCreateData())

const openCreateDialog = () => {
  createData.value = emptyCreateData()
  createDialog.value = true
}

const saveCompany = async () => {
  const { valid } = await createForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    await platformService.createCompany({
      ...createData.value,
      modules: modulesToSend(createData.value.business_type, createData.value.modules),
      email: createData.value.email || undefined,
      phone: createData.value.phone || undefined,
    })
    createDialog.value = false
    notify('Empresa creada exitosamente')
    await loadCompanies()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al crear la empresa', 'error')
  } finally {
    saving.value = false
  }
}

// --- Detalle y edición de empresa ---
const detailDialog = ref(false)
const loadingDetail = ref(false)
const editingDetail = ref(false)
const detail = ref<PlatformCompanyDetail | null>(null)
const editFormRef = ref()
const editData = ref({
  name: '',
  slug: '',
  email: '',
  phone: '',
  business_type: 'restaurant' as BusinessType,
  modules: [] as Feature[],
})

const openDetailDialog = async (company: PlatformCompany) => {
  detailDialog.value = true
  editingDetail.value = false
  detail.value = null
  loadingDetail.value = true
  try {
    detail.value = await platformService.getCompany(company.id)
  } catch {
    notify('Error al cargar el detalle de la empresa', 'error')
    detailDialog.value = false
  } finally {
    loadingDetail.value = false
  }
}

const startEditDetail = () => {
  if (!detail.value) return
  editData.value = {
    name: detail.value.name,
    slug: detail.value.slug,
    email: detail.value.email || '',
    phone: detail.value.phone || '',
    business_type: detail.value.business_type,
    // Siempre se muestran los módulos efectivos (antes, si seguían el preset,
    // los checkboxes salían todos vacíos).
    modules: [...detail.value.modules],
  }
  editingDetail.value = true
}

const saveDetail = async () => {
  if (!detail.value) return
  const { valid } = await editFormRef.value.validate()
  if (!valid) return

  saving.value = true
  try {
    await platformService.updateCompany(detail.value.id, {
      name: editData.value.name,
      slug: editData.value.slug,
      email: editData.value.email || null,
      phone: editData.value.phone || null,
      business_type: editData.value.business_type,
      modules: modulesToSend(editData.value.business_type, editData.value.modules),
    })
    notify('Empresa actualizada exitosamente')
    editingDetail.value = false
    await loadCompanies()
    detail.value = await platformService.getCompany(detail.value.id)
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al actualizar la empresa', 'error')
  } finally {
    saving.value = false
  }
}

// --- Suscripción y pagos ---
const subscriptionDialog = ref(false)
const selectedCompany = ref<PlatformCompany | null>(null)
const subscriptionData = ref({
  status: 'active' as SubscriptionStatus,
  current_period_end: '',
  plan: 'standard',
  grace_days: 7,
  max_tables: 10,
  max_users: 5,
  monthly_price: null as number | null,
  seller_id: null as number | null,
})
const paymentData = ref({ amount: 0, months: 1, method: 'transfer' as const, reference: '', discrepancy_reason: '' })

// Pago vs. acuerdo: si el monto no es precio × meses, se exige motivo.
const expectedPayment = computed(() => {
  const price = subscriptionData.value.monthly_price
  return price !== null && price > 0 ? price * (paymentData.value.months || 1) : null
})
const paymentDiffers = computed(
  () =>
    expectedPayment.value !== null &&
    paymentData.value.amount > 0 &&
    Math.abs(paymentData.value.amount - expectedPayment.value) > 0.01,
)

const openSubscriptionDialog = (company: PlatformCompany) => {
  selectedCompany.value = company
  subscriptionData.value = {
    status: company.subscription?.status ?? 'trial',
    current_period_end: company.subscription?.current_period_end ?? '',
    plan: company.subscription?.plan ?? 'standard',
    grace_days: company.subscription?.grace_days ?? 7,
    max_tables: company.subscription?.max_tables ?? 10,
    max_users: company.subscription?.max_users ?? 5,
    monthly_price: company.subscription?.monthly_price ?? null,
    seller_id: company.subscription?.seller_id ?? null,
  }
  paymentData.value = { amount: 0, months: 1, method: 'transfer', reference: '', discrepancy_reason: '' }
  subscriptionDialog.value = true
}

const saveSubscription = async () => {
  if (!selectedCompany.value) return

  saving.value = true
  try {
    await platformService.saveSubscription(selectedCompany.value.id, {
      ...subscriptionData.value,
      current_period_end: subscriptionData.value.current_period_end || null,
    })
    notify('Suscripción guardada')
    await loadCompanies()
    selectedCompany.value = companies.value.find(c => c.id === selectedCompany.value?.id) ?? null
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al guardar la suscripción', 'error')
  } finally {
    saving.value = false
  }
}

const savePayment = async () => {
  if (!selectedCompany.value) return

  saving.value = true
  try {
    await platformService.registerPayment(selectedCompany.value.id, {
      amount: paymentData.value.amount,
      months: paymentData.value.months,
      method: paymentData.value.method,
      reference: paymentData.value.reference || undefined,
      discrepancy_reason: paymentDiffers.value
        ? paymentData.value.discrepancy_reason.trim()
        : undefined,
    })
    notify('Pago registrado y periodo extendido')
    subscriptionDialog.value = false
    await loadCompanies()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al registrar el pago', 'error')
  } finally {
    saving.value = false
  }
}

// --- Activar / desactivar ---
const confirmToggle = async (company: PlatformCompany) => {
  const action = company.active ? 'desactivar' : 'reactivar'
  if (!window.confirm(`¿Seguro que quieres ${action} a "${company.name}"?`)) return

  try {
    await platformService.toggleActive(company.id)
    notify(company.active ? 'Empresa desactivada' : 'Empresa reactivada')
    await loadCompanies()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al cambiar el estado', 'error')
  }
}

// --- Secciones: viven en la barra lateral, la ruta decide cuál se ve ---
const route = useRoute()
const tab = computed(() => (route.meta.section as 'companies' | 'sellers' | 'stats') ?? 'companies')

const sectionTitle = computed(() =>
  ({ companies: 'Empresas', sellers: 'Vendedores', stats: 'Ventas por Vendedor' })[tab.value],
)
const sectionSubtitle = computed(() =>
  ({
    companies: 'Administra las empresas del sistema y sus suscripciones',
    sellers: 'Quiénes venden el sistema; se asocian a cada suscripción',
    stats: 'Resultados comerciales de cada vendedor',
  })[tab.value],
)
const sellers = ref<PlatformSeller[]>([])
const loadingSellers = ref(false)
const sellerStats = ref<SellerStats[]>([])
const loadingStats = ref(false)

const sellerHeaders = [
  { title: 'Nombre', key: 'name' },
  { title: 'Email', key: 'email' },
  { title: 'Teléfono', key: 'phone' },
  { title: 'Estado', key: 'active' },
  { title: '', key: 'actions', sortable: false },
]

const statsHeaders = [
  { title: 'Vendedor', key: 'name' },
  { title: 'Empresas vendidas', key: 'companies_count' },
  { title: 'Activas', key: 'active_companies' },
  { title: 'Recurrente mensual', key: 'monthly_recurring' },
  { title: 'Total recaudado', key: 'total_collected' },
  { title: 'Última venta', key: 'last_sale_at' },
]

const loadSellers = async () => {
  loadingSellers.value = true
  try {
    sellers.value = await platformService.listSellers()
  } catch {
    notify('Error al cargar los vendedores', 'error')
  } finally {
    loadingSellers.value = false
  }
}

const loadStats = async () => {
  loadingStats.value = true
  try {
    sellerStats.value = await platformService.sellerStats()
  } catch {
    notify('Error al cargar las estadísticas', 'error')
  } finally {
    loadingStats.value = false
  }
}

const sellerDialog = ref(false)
const editingSeller = ref<PlatformSeller | null>(null)
const sellerForm = ref({ name: '', email: '', phone: '', active: true })

const openSellerDialog = (seller?: PlatformSeller) => {
  editingSeller.value = seller ?? null
  sellerForm.value = seller
    ? { name: seller.name, email: seller.email || '', phone: seller.phone || '', active: seller.active }
    : { name: '', email: '', phone: '', active: true }
  sellerDialog.value = true
}

const saveSeller = async () => {
  if (!sellerForm.value.name.trim()) {
    notify('El nombre del vendedor es obligatorio', 'error')
    return
  }
  saving.value = true
  try {
    const payload = {
      name: sellerForm.value.name.trim(),
      email: sellerForm.value.email || null,
      phone: sellerForm.value.phone || null,
      active: sellerForm.value.active,
    }
    if (editingSeller.value) {
      await platformService.updateSeller(editingSeller.value.id, payload)
      notify('Vendedor actualizado')
    } else {
      await platformService.createSeller(payload)
      notify('Vendedor creado')
    }
    sellerDialog.value = false
    await loadSellers()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al guardar el vendedor', 'error')
  } finally {
    saving.value = false
  }
}

// Cada navegación de la barra remonta la vista (router-view con :key),
// así que el montaje carga lo que la sección visible necesita. Los
// vendedores se cargan siempre: alimentan los selectores de los diálogos.
onMounted(() => {
  loadSellers()
  if (tab.value === 'companies') loadCompanies()
  if (tab.value === 'stats') loadStats()
})
</script>
