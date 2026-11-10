<template>
  <v-container fluid>
    <!-- Título -->
    <v-row class="mb-2">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <div class="d-flex align-center">
            <v-icon size="40" class="mr-3" color="primary">mdi-account-multiple</v-icon>
            <div>
              <h1 class="text-h4">Clientes y proveedores</h1>
              <p class="text-body-1 text-medium-emphasis">A quién le vendes y a quién le compras</p>
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn
              v-if="activeTab === 'clientes'"
              prepend-icon="mdi-tag-multiple-outline"
              color="primary"
              variant="outlined"
              size="large"
              @click="openManager">
              Segmentos
            </v-btn>
            <LockableButton
              v-if="activeTab === 'clientes'"
              icon="mdi-microsoft-excel"
              color="primary"
              variant="outlined"
              size="large"
              @click="importDialog = true">
              Importar clientes desde Excel
            </LockableButton>
            <LockableButton
              icon="mdi-plus"
              color="primary"
              size="large"
              @click="activeTab === 'clientes' ? openDialog() : openSupplierDialog()">
              {{ activeTab === 'clientes' ? 'Nuevo cliente' : 'Nuevo proveedor' }}
            </LockableButton>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-tabs v-model="activeTab" color="primary" class="mb-4">
      <v-tab value="clientes"><v-icon start>mdi-account</v-icon>Clientes</v-tab>
      <v-tab value="proveedores"><v-icon start>mdi-truck</v-icon>Proveedores</v-tab>
    </v-tabs>

    <v-window v-model="activeTab">
      <!-- ===== Clientes ===== -->
      <v-window-item value="clientes">
        <v-row>
          <v-col cols="12">
            <v-card>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="5">
                    <v-text-field
                      v-model="search"
                      prepend-inner-icon="mdi-magnify"
                      label="Buscar cliente"
                      placeholder="Nombre, documento, correo o teléfono"
                      variant="outlined"
                      density="compact"
                      hide-details
                      clearable />
                  </v-col>
                  <v-col cols="12" md="7">
                    <CustomerSegmentPicker
                      v-model="segmentFilter"
                      :segments="segments"
                      label="Filtrar por segmentos"
                      variant="outlined"
                      density="compact"
                      persistent-hint
                      clearable />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-4">
          <v-col cols="12">
            <v-card>
              <!-- Rows ticked on any page: add them to a segment or take one away at once. -->
              <v-card-text v-if="selectedIds.length" class="d-flex flex-wrap align-center ga-2 bg-surface-light">
                <span class="text-body-2 font-weight-medium">
                  {{ selectedIds.length === 1 ? '1 cliente seleccionado' : `${selectedIds.length} clientes seleccionados` }}
                </span>
                <v-spacer />
                <LockableButton color="primary" variant="tonal" icon="mdi-tag-plus-outline" @click="openBulk('add')">
                  Agregar a segmento
                </LockableButton>
                <LockableButton color="primary" variant="text" icon="mdi-tag-minus-outline" @click="openBulk('remove')">
                  Quitar de segmento
                </LockableButton>
                <v-btn variant="text" @click="selectedIds = []">Quitar selección</v-btn>
              </v-card-text>
              <v-data-table-server
                v-model="selectedIds"
                v-model:page="page"
                v-model:items-per-page="perPage"
                v-model:sort-by="sortBy"
                :headers="headers"
                :items="clientes"
                :items-length="total"
                :items-per-page-options="PAGE_SIZE_OPTIONS"
                :loading="loading"
                item-value="id"
                show-select
                class="elevation-0">
                <template #item.name="{ item }">
                  <div>{{ item.name }}</div>
                  <div v-if="item.segments?.length" class="d-flex flex-wrap ga-1 mt-1 mb-1">
                    <v-chip
                      v-for="segment in item.segments"
                      :key="segment.id"
                      size="x-small"
                      color="secondary"
                      variant="tonal"
                      prepend-icon="mdi-tag-outline">
                      {{ segment.name }}
                    </v-chip>
                  </div>
                </template>

                <template #item.joined_at="{ item }">
                  <span class="text-no-wrap tabular-nums">{{ item.joined_at ? formatIsoDate(item.joined_at) : '—' }}</span>
                </template>

                <template #item.document_type="{ item }">
                  <v-chip size="small" color="primary" variant="outlined">
                    {{ item.document_type }}
                  </v-chip>
                </template>

                <template #item.verification_digit="{ item }">
                  <span v-if="item.verification_digit !== null && item.verification_digit !== undefined" class="tabular-nums">
                    {{ item.verification_digit }}
                  </span>
                  <span v-else class="text-medium-emphasis">—</span>
                </template>

                <template #item.person_type="{ item }">
                  <v-chip
                    size="small"
                    color="secondary"
                    :prepend-icon="item.person_type === 'legal' ? 'mdi-domain' : 'mdi-account'"
                    variant="tonal">
                    {{ item.person_type === 'legal' ? 'Jurídica' : 'Natural' }}
                  </v-chip>
                </template>

                <template #item.frequent_customer="{ item }">
                  <v-icon
                    :color="item.frequent_customer ? 'warning' : undefined"
                    :class="{ 'text-medium-emphasis': !item.frequent_customer }"
                  >
                    {{ item.frequent_customer ? 'mdi-star' : 'mdi-star-outline' }}
                  </v-icon>
                </template>

                <template #item.actions="{ item }">
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    :disabled="isReadOnly"
                    :aria-label="`Editar el cliente ${item.name}`" @click="openDialog(item)" />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="isReadOnly"
                    :aria-label="`Eliminar el cliente ${item.name}`" @click="deleteCliente(item)" />
                </template>
              </v-data-table-server>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>

      <!-- ===== Proveedores ===== -->
      <v-window-item value="proveedores">
        <v-row>
          <v-col cols="12">
            <v-card>
              <v-card-text>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="supplierSearch"
                      prepend-inner-icon="mdi-magnify"
                      label="Buscar proveedor por nombre o documento"
                      variant="outlined"
                      density="compact"
                      hide-details
                      clearable />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-row class="mt-4">
          <v-col cols="12">
            <v-card>
              <v-data-table
                :headers="supplierHeaders"
                :items="suppliers"
                :loading="loadingSuppliers"
                :search="supplierSearch"
                class="elevation-0">
                <template #item.name="{ item }">
                  {{ item.name }}
                  <v-chip
                    v-if="item.is_default"
                    size="x-small"
                    color="primary"
                    variant="tonal"
                    class="ml-2">
                    Por defecto
                  </v-chip>
                </template>

                <template #item.actions="{ item }">
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    :disabled="isReadOnly"
                    :aria-label="`Editar el proveedor ${item.name}`" @click="openSupplierDialog(item)" />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="isReadOnly || item.is_default"
                    :title="item.is_default ? 'El proveedor por defecto no se puede eliminar' : ''"
                    @click="deleteSupplier(item)" />
                </template>
              </v-data-table>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>

    <!-- Dialog Cliente -->
    <v-dialog v-model="dialog" max-width="800px" persistent>
      <v-card>
        <v-card-title class="bg-primary">
          {{ editing ? 'Editar cliente' : 'Nuevo cliente' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <v-alert type="info" density="compact" class="mb-4">
            Esta información se usará para generar facturas electrónicas
          </v-alert>

          <v-form ref="form">
            <p class="text-caption text-medium-emphasis mb-3">
              Los campos con
              <span class="text-error font-weight-bold">*</span>
              son obligatorios.
            </p>

            <v-row>
              <v-col cols="12" md="4">
                <v-select
                  v-model="formData.document_type"
                  :items="tiposDocumento"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                >
                  <template #label>
                    Tipo de documento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-select>
              </v-col>

              <v-col :cols="showsDigit ? 8 : 12" :md="showsDigit ? 5 : 8">
                <v-text-field
                  v-model="formData.document_number"
                  variant="outlined"
                  density="comfortable"
                  hint="Otro cliente con el mismo documento (otra casa, otro local): agrega -A, -B al final"
                  :rules="[rules.required, documentRule(formData.document_type)]"
                  @blur="tidyDocument"
                >
                  <template #label>
                    Número de documento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>

              <v-col v-if="showsDigit" cols="4" md="3">
                <v-text-field
                  :model-value="formDigit ?? ''"
                  label="DV"
                  variant="outlined"
                  density="comfortable"
                  readonly
                  hint="Lo calcula el sistema"
                  persistent-hint
                  aria-label="Dígito de verificación" />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="formData.name"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                >
                  <template #label>
                    Nombre / Razón social <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.email"
                  label="Correo"
                  type="email"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.phone"
                  label="Teléfono"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="formData.address"
                  label="Dirección"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="formData.person_type"
                  :items="tiposPersona"
                  label="Tipo de persona"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="8">
                <v-switch
                  v-model="formData.frequent_customer"
                  label="Marcar como cliente frecuente"
                  color="success" />
              </v-col>

              <v-col cols="12" md="4">
                <DateField
                  v-model="formData.joined_at"
                  variant="outlined"
                  density="comfortable"
                  hint="El día en que llegó como cliente"
                  persistent-hint
                  :rules="[rules.required]"
                >
                  <template #label>
                    Fecha de ingreso <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </DateField>
              </v-col>

              <v-col cols="12" md="8">
                <CustomerSegmentPicker
                  v-model="formData.segment_ids"
                  :segments="segments"
                  variant="outlined"
                  density="comfortable"
                  creatable
                  @created="onSegmentCreated" />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save()">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Proveedor -->
    <v-dialog v-model="supplierDialog" max-width="700px" persistent>
      <v-card>
        <v-card-title class="bg-primary">
          {{ supplierEditing ? 'Editar proveedor' : 'Nuevo proveedor' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <v-form ref="supplierFormRef">
            <p class="text-caption text-medium-emphasis mb-3">
              Solo el nombre es obligatorio; el resto es opcional.
            </p>
            <v-row>
              <v-col cols="12">
                <v-text-field
                  v-model="supplierForm.name"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                >
                  <template #label>
                    Nombre <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="supplierForm.document_number"
                  label="Documento / NIT"
                  variant="outlined"
                  density="comfortable"
                  :rules="[documentRule()]"
                  @blur="tidySupplierDocument" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="supplierForm.phone"
                  label="Teléfono"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="supplierForm.email"
                  label="Correo"
                  type="email"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="supplierForm.address"
                  label="Dirección"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="supplierForm.notes"
                  label="Notas"
                  variant="outlined"
                  density="comfortable"
                  rows="2" />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="supplierDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="savingSupplier" @click="saveSupplier()">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Segmentos: crear, renombrar y eliminar las etiquetas -->
    <v-dialog v-model="managerDialog" max-width="560px">
      <v-card>
        <v-card-title class="bg-primary">Segmentos</v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-2 text-medium-emphasis mb-3">
            Agrupa a tus clientes (Chinchiná, Colegio San José, Grado 5) para filtrarlos en Clientes, Cartera,
            Facturación automática e Informes. Eliminar un segmento no elimina a sus clientes.
          </p>
          <div class="d-flex ga-2 align-start">
            <v-text-field
              v-model="newSegmentName"
              label="Nuevo segmento"
              variant="outlined"
              density="compact"
              :error-messages="newSegmentError || undefined"
              :disabled="isReadOnly"
              @keydown.enter.prevent="createFromManager" />
            <LockableButton color="primary" icon="mdi-plus" :loading="savingSegment" :disabled="!newSegmentName.trim()" @click="createFromManager">
              Crear
            </LockableButton>
          </div>

          <p v-if="!segments.length" class="text-body-2 text-medium-emphasis mt-2">Aún no tienes segmentos.</p>
          <v-list v-else density="compact" class="py-0">
            <v-list-item v-for="segment in segments" :key="segment.id" class="px-0">
              <v-text-field
                v-if="renaming?.id === segment.id"
                v-model="renaming.name"
                :label="`Nuevo nombre de ${segment.name}`"
                variant="outlined"
                density="compact"
                autofocus
                :error-messages="renameError || undefined"
                @keydown.enter.prevent="saveRename"
                @keydown.esc="renaming = null" />
              <template v-else>
                <v-list-item-title>
                  <v-icon size="small" class="mr-1" icon="mdi-tag-outline" />
                  {{ segment.name }}
                </v-list-item-title>
                <v-list-item-subtitle>
                  {{ segment.customers_count === 1 ? '1 cliente' : `${segment.customers_count} clientes` }}
                </v-list-item-subtitle>
              </template>
              <template #append>
                <template v-if="renaming?.id === segment.id">
                  <v-btn
                    icon="mdi-check"
                    size="small"
                    variant="text"
                    color="primary"
                    :loading="savingSegment"
                    :aria-label="`Guardar el nombre del segmento ${segment.name}`"
                    @click="saveRename" />
                  <v-btn
                    icon="mdi-close"
                    size="small"
                    variant="text"
                    :aria-label="`Cancelar el cambio de nombre del segmento ${segment.name}`"
                    @click="renaming = null" />
                </template>
                <template v-else>
                  <v-btn
                    icon="mdi-pencil"
                    size="small"
                    variant="text"
                    :disabled="isReadOnly"
                    :aria-label="`Renombrar el segmento ${segment.name}`"
                    @click="startRename(segment)" />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="isReadOnly"
                    :aria-label="`Eliminar el segmento ${segment.name}`"
                    @click="removeSegment(segment)" />
                </template>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="managerDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Agregar o quitar un segmento a los clientes seleccionados -->
    <v-dialog v-model="bulkDialog" max-width="560px">
      <v-card>
        <v-card-title class="bg-primary">
          {{ bulkMode === 'add' ? 'Agregar a segmento' : 'Quitar de segmento' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-2 mb-3">
            {{ bulkMode === 'add' ? 'Los' : 'A los' }}
            <strong>{{ selectedIds.length === 1 ? '1 cliente seleccionado' : `${selectedIds.length} clientes seleccionados` }}</strong>
            {{ bulkMode === 'add' ? 'quedan en los segmentos que elijas; los que ya tienen siguen igual.' : 'se les quitan los segmentos que elijas.' }}
          </p>
          <CustomerSegmentPicker
            v-model="bulkSegments"
            :segments="segments"
            variant="outlined"
            density="comfortable"
            :creatable="bulkMode === 'add'"
            v-bind="bulkMode === 'remove' ? { hint: 'Los clientes siguen en tu lista: solo pierden la etiqueta' } : {}"
            persistent-hint
            @created="onSegmentCreated" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="bulkDialog = false">Cancelar</v-btn>
          <LockableButton color="primary" :loading="bulkSaving" :disabled="!bulkSegments.length" @click="applyBulk">
            {{ bulkMode === 'add' ? 'Agregar' : 'Quitar' }}
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <CustomerImportDialog v-model="importDialog" @imported="onCustomersImported" />

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarColor === 'error' ? 9000 : 3000" closable>
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/errors';
import { formatIsoDate, todayIso } from '@/utils/dates'
import {
  VERIFICATION_DIGIT_TYPES,
  customerVerificationDigit,
  documentProblem,
  documentRule,
  normalizeDocument,
} from '@/utils/validation'
import { computed, ref, onMounted } from 'vue'
import {
  billingService,
  type Customer,
  type CustomerSegment,
  type PersonType,
  type Supplier,
} from '@/services/billingService'
import CustomerImportDialog from '../components/CustomerImportDialog.vue'
import CustomerSegmentPicker from '../components/CustomerSegmentPicker.vue'
import DateField from '../components/DateField.vue'
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'
import { PAGE_SIZE_OPTIONS, useServerPage } from '../composables/useServerPage'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

// Clientes y proveedores comparten página en pestañas.
const activeTab = ref<'clientes' | 'proveedores'>('clientes')

interface ClienteForm {
  id?: number
  document_type: string
  document_number: string
  name: string
  email?: string
  phone?: string
  address?: string
  person_type: PersonType
  frequent_customer: boolean
  joined_at: string
  segment_ids: number[]
}

const dialog = ref(false)
const editing = ref<Customer | null>(null)
const saving = ref(false)

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const form = ref<any>(null)

const headers = [
  { title: 'Tipo doc', key: 'document_type', sortable: true },
  { title: 'Documento', key: 'document_number', sortable: true },
  { title: 'DV', key: 'verification_digit', sortable: false },
  // Wide enough for two segment chips per line under the name.
  { title: 'Nombre / Razón social', key: 'name', sortable: true, minWidth: '220px' },
  { title: 'Correo', key: 'email', sortable: false },
  { title: 'Teléfono', key: 'phone', sortable: false },
  { title: 'Ingreso', key: 'joined_at', sortable: true },
  { title: 'Tipo', key: 'person_type', sortable: true },
  { title: 'Frecuente', key: 'frequent_customer', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const tiposDocumento = [
  { value: 'CC', title: 'Cédula de ciudadanía (CC)' },
  { value: 'CE', title: 'Cédula de extranjería (CE)' },
  { value: 'NIT', title: 'NIT' },
  { value: 'Pasaporte', title: 'Pasaporte' },
]

const tiposPersona = [
  { value: 'natural', title: 'Persona natural' },
  { value: 'legal', title: 'Persona jurídica' },
]

const emptyForm = (): ClienteForm => ({
  document_type: 'CC',
  document_number: '',
  name: '',
  email: '',
  phone: '',
  address: '',
  person_type: 'natural',
  frequent_customer: false,
  joined_at: todayIso(),
  segment_ids: [],
})

const formData = ref<ClienteForm>(emptyForm())

// The DIAN verification digit, live as the number is typed; the API computes the one it stores.
const showsDigit = computed(() => VERIFICATION_DIGIT_TYPES.includes(formData.value.document_type))
const formDigit = computed(() => {
  const { document_type, document_number } = formData.value
  return customerVerificationDigit(document_type, normalizeDocument(document_number, document_type))
})

const importDialog = ref(false)
const onCustomersImported = (message: string) => {
  showMessage(message, 'success')
  loadClientes()
}

const rules = {
  required: (v: any) => !!v || 'Este campo es requerido',
}

// ===== Segmentos =====
const segments = ref<CustomerSegment[]>([])
// Several mean the customers carrying all of them, as the API filters.
const segmentFilter = ref<number[]>([])
const byName = (a: CustomerSegment, b: CustomerSegment) =>
  a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })

const loadSegments = async () => {
  try {
    segments.value = await billingService.getSegments()
    const existing = new Set(segments.value.map(segment => segment.id))
    if (segmentFilter.value.some(id => !existing.has(id))) {
      segmentFilter.value = segmentFilter.value.filter(id => existing.has(id))
    }
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible cargar los segmentos. Inténtalo de nuevo.'), 'error')
  }
}

const onSegmentCreated = (segment: CustomerSegment) => {
  segments.value = [...segments.value, segment].sort(byName)
}

const {
  items: clientes,
  total,
  page,
  perPage,
  sortBy,
  search,
  loading,
  load: loadClientes,
} = useServerPage<Customer>(
  query => billingService.getCustomersPage(segmentFilter.value.length ? { ...query, segment_ids: segmentFilter.value } : query),
  {
    filters: [segmentFilter],
    onError: error =>
      showMessage(errorMessage(error, 'No fue posible cargar los clientes. Inténtalo de nuevo.'), 'error'),
  },
)

// --- Varios clientes a la vez ---
const selectedIds = ref<number[]>([])
const bulkDialog = ref(false)
const bulkMode = ref<'add' | 'remove'>('add')
const bulkSegments = ref<number[]>([])
const bulkSaving = ref(false)

const openBulk = (mode: 'add' | 'remove') => {
  bulkMode.value = mode
  bulkSegments.value = []
  bulkDialog.value = true
}

const applyBulk = async () => {
  bulkSaving.value = true
  try {
    const messages: string[] = []
    for (const segmentId of bulkSegments.value) {
      const { message } = bulkMode.value === 'add'
        ? await billingService.addCustomersToSegment(segmentId, selectedIds.value)
        : await billingService.removeCustomersFromSegment(segmentId, selectedIds.value)
      messages.push(message)
    }
    showMessage(messages.join(' '), 'success')
    bulkDialog.value = false
    selectedIds.value = []
    await Promise.all([loadClientes(), loadSegments()])
  } catch (error) {
    showMessage(
      errorMessage(
        error,
        bulkMode.value === 'add'
          ? 'No fue posible agregar los clientes al segmento. Inténtalo de nuevo.'
          : 'No fue posible quitarles el segmento a los clientes. Inténtalo de nuevo.',
      ),
      'error',
    )
  } finally {
    bulkSaving.value = false
  }
}

// --- Crear, renombrar y eliminar segmentos ---
const managerDialog = ref(false)
const newSegmentName = ref('')
const newSegmentError = ref('')
const renaming = ref<{ id: number; name: string } | null>(null)
const renameError = ref('')
const savingSegment = ref(false)

const openManager = () => {
  newSegmentName.value = ''
  newSegmentError.value = ''
  renaming.value = null
  managerDialog.value = true
  loadSegments()
}

const createFromManager = async () => {
  if (!newSegmentName.value.trim() || isReadOnly.value) return
  savingSegment.value = true
  newSegmentError.value = ''
  try {
    const { data, message } = await billingService.createSegment(newSegmentName.value)
    onSegmentCreated(data)
    newSegmentName.value = ''
    showMessage(message, 'success')
  } catch (error) {
    newSegmentError.value = errorMessage(error, 'No fue posible crear el segmento. Inténtalo de nuevo.')
  } finally {
    savingSegment.value = false
  }
}

const startRename = (segment: CustomerSegment) => {
  renameError.value = ''
  renaming.value = { id: segment.id, name: segment.name }
}

const saveRename = async () => {
  if (!renaming.value) return
  savingSegment.value = true
  renameError.value = ''
  try {
    const { message } = await billingService.renameSegment(renaming.value.id, renaming.value.name)
    renaming.value = null
    showMessage(message, 'success')
    await Promise.all([loadSegments(), loadClientes()])
  } catch (error) {
    renameError.value = errorMessage(error, 'No fue posible cambiar el nombre del segmento. Inténtalo de nuevo.')
  } finally {
    savingSegment.value = false
  }
}

const removeSegment = async (segment: CustomerSegment) => {
  const carriers = segment.customers_count === 1
    ? 'Lo tiene 1 cliente: sigue en tu lista, solo pierde la etiqueta.'
    : segment.customers_count > 1
      ? `Lo tienen ${segment.customers_count} clientes: siguen en tu lista, solo pierden la etiqueta.`
      : 'Ningún cliente lo tiene.'
  if (!confirm(`¿Seguro que quieres eliminar el segmento «${segment.name}»? ${carriers}`)) return

  try {
    showMessage(await billingService.deleteSegment(segment.id), 'success')
    await loadSegments()
    loadClientes()
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible eliminar el segmento. Inténtalo de nuevo.'), 'error')
  }
}

const openDialog = (cliente?: Customer) => {
  editing.value = cliente || null
  if (cliente) {
    formData.value = {
      id: cliente.id,
      document_type: cliente.document_type,
      document_number: cliente.document_number,
      name: cliente.name,
      email: cliente.email || '',
      phone: cliente.phone || '',
      address: cliente.address || '',
      person_type: cliente.person_type || 'natural',
      frequent_customer: cliente.frequent_customer ?? false,
      joined_at: cliente.joined_at ?? todayIso(),
      segment_ids: (cliente.segments ?? []).map(segment => segment.id),
    }
  } else {
    formData.value = emptyForm()
  }
  dialog.value = true
}

// Al salir del campo se ve el documento como queda guardado (sin puntos ni espacios).
const tidyDocument = () => {
  const { document_number, document_type } = formData.value
  if (!documentProblem(document_number, document_type)) {
    formData.value.document_number = normalizeDocument(document_number, document_type)
  }
}

const save = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  const payload = {
    ...formData.value,
    document_number: normalizeDocument(formData.value.document_number, formData.value.document_type),
  }
  saving.value = true
  try {
    if (editing.value?.id) {
      await billingService.updateCustomer(editing.value.id, payload)
      showMessage('Cliente actualizado exitosamente', 'success')
    } else {
      await billingService.createCustomer(payload)
      showMessage('Cliente creado exitosamente', 'success')
    }
    dialog.value = false
    loadClientes()
    loadSegments()
  } catch (error) {
    console.error('[Clientes] Error al guardar:', error)
    showMessage(errorMessage(error, 'No fue posible guardar el cliente. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteCliente = async (cliente: Customer) => {
  if (!confirm(`¿Seguro que quieres eliminar el cliente "${cliente.name}"?`)) return

  try {
    await billingService.deleteCustomer(cliente.id)
    showMessage('Cliente eliminado exitosamente', 'success')
    selectedIds.value = selectedIds.value.filter(id => id !== cliente.id)
    loadClientes()
    loadSegments()
  } catch (error) {
    console.error('[Clientes] Error al eliminar:', error)
    showMessage(errorMessage(error, 'No fue posible eliminar el cliente. Inténtalo de nuevo.'), 'error')
  }
}

const showMessage = (text: string, color: 'success' | 'error' | 'warning') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

// ===== Proveedores =====
interface SupplierForm {
  id?: number
  name: string
  document_number?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

const suppliers = ref<Supplier[]>([])
const loadingSuppliers = ref(false)
const supplierDialog = ref(false)
const supplierEditing = ref<Supplier | null>(null)
const savingSupplier = ref(false)
const supplierSearch = ref('')
const supplierFormRef = ref<any>(null)

const supplierHeaders = [
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Documento / NIT', key: 'document_number', sortable: true },
  { title: 'Teléfono', key: 'phone', sortable: false },
  { title: 'Correo', key: 'email', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const emptySupplierForm = (): SupplierForm => ({
  name: '',
  document_number: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
})

const supplierForm = ref<SupplierForm>(emptySupplierForm())

const loadSuppliers = async () => {
  loadingSuppliers.value = true
  try {
    suppliers.value = await billingService.getSuppliers()
  } catch (error) {
    console.error('[Proveedores] Error al cargar:', error)
    showMessage(errorMessage(error, 'No fue posible cargar los proveedores. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingSuppliers.value = false
  }
}

const openSupplierDialog = (supplier?: Supplier) => {
  supplierEditing.value = supplier || null
  if (supplier) {
    supplierForm.value = {
      id: supplier.id,
      name: supplier.name,
      document_number: supplier.document_number || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    }
  } else {
    supplierForm.value = emptySupplierForm()
  }
  supplierDialog.value = true
}

const tidySupplierDocument = () => {
  const document = supplierForm.value.document_number
  if (!documentProblem(document)) {
    supplierForm.value.document_number = normalizeDocument(document)
  }
}

const saveSupplier = async () => {
  const { valid } = await supplierFormRef.value.validate()
  if (!valid) return

  const payload = { ...supplierForm.value, document_number: normalizeDocument(supplierForm.value.document_number) }
  savingSupplier.value = true
  try {
    if (supplierEditing.value?.id) {
      await billingService.updateSupplier(supplierEditing.value.id, payload)
      showMessage('Proveedor actualizado exitosamente', 'success')
    } else {
      await billingService.createSupplier(payload)
      showMessage('Proveedor creado exitosamente', 'success')
    }
    supplierDialog.value = false
    loadSuppliers()
  } catch (error) {
    console.error('[Proveedores] Error al guardar:', error)
    showMessage(errorMessage(error, 'No fue posible guardar el proveedor. Inténtalo de nuevo.'), 'error')
  } finally {
    savingSupplier.value = false
  }
}

const deleteSupplier = async (supplier: Supplier) => {
  if (supplier.is_default) return
  if (!confirm(`¿Seguro que quieres eliminar el proveedor "${supplier.name}"?`)) return

  try {
    await billingService.deleteSupplier(supplier.id)
    showMessage('Proveedor eliminado exitosamente', 'success')
    loadSuppliers()
  } catch (error) {
    console.error('[Proveedores] Error al eliminar:', error)
    showMessage(errorMessage(error, 'No fue posible eliminar el proveedor. Inténtalo de nuevo.'), 'error')
  }
}

onMounted(() => {
  loadClientes()
  loadSegments()
  loadSuppliers()
})
</script>
