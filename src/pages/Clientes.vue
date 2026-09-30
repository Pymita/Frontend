<template>
  <v-container fluid>
    <!-- Título -->
    <v-row class="mb-2">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-icon size="40" class="mr-3" color="primary">mdi-account-multiple</v-icon>
            <div>
              <h1 class="text-h4">Clientes y proveedores</h1>
              <p class="text-body-1 text-medium-emphasis">A quién le vendes y a quién le compras</p>
            </div>
          </div>
          <LockableButton
            icon="mdi-plus"
            color="primary"
            size="large"
            @click="activeTab === 'clientes' ? openDialog() : openSupplierDialog()">
            {{ activeTab === 'clientes' ? 'Nuevo cliente' : 'Nuevo proveedor' }}
          </LockableButton>
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
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="search"
                      prepend-inner-icon="mdi-magnify"
                      label="Buscar por nombre o documento"
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
                :headers="headers"
                :items="filteredClientes"
                :loading="loading"
                :search="search"
                class="elevation-0">
                <template #item.document_type="{ item }">
                  <v-chip size="small" color="primary" variant="outlined">
                    {{ item.document_type }}
                  </v-chip>
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
                    @click="openDialog(item)" />
                  <v-btn
                    icon="mdi-delete"
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="isReadOnly"
                    @click="deleteCliente(item)" />
                </template>
              </v-data-table>
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
                    @click="openSupplierDialog(item)" />
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

              <v-col cols="12" md="8">
                <v-text-field
                  v-model="formData.document_number"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                >
                  <template #label>
                    Número de documento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
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
                  density="comfortable" />
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

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarColor === 'error' ? 9000 : 3000" closable>
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/errors';
import { ref, computed, onMounted } from 'vue'
import { billingService, type Customer, type PersonType, type Supplier } from '@/services/billingService'
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'

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
}

const clientes = ref<Customer[]>([])
const loading = ref(false)
const dialog = ref(false)
const editing = ref<Customer | null>(null)
const saving = ref(false)
const search = ref('')

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const form = ref<any>(null)

const headers = [
  { title: 'Tipo doc', key: 'document_type', sortable: true },
  { title: 'Documento', key: 'document_number', sortable: true },
  { title: 'Nombre / Razón social', key: 'name', sortable: true },
  { title: 'Correo', key: 'email', sortable: false },
  { title: 'Teléfono', key: 'phone', sortable: false },
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
})

const formData = ref<ClienteForm>(emptyForm())

const rules = {
  required: (v: any) => !!v || 'Este campo es requerido',
}

const filteredClientes = computed(() => {
  if (!search.value) return clientes.value

  const searchLower = search.value.toLowerCase()
  return clientes.value.filter(
    c =>
      c.name?.toLowerCase().includes(searchLower) ||
      c.document_number?.toLowerCase().includes(searchLower)
  )
})

const loadClientes = async () => {
  loading.value = true
  try {
    clientes.value = await billingService.getCustomers()
  } catch (error) {
    console.error('[Clientes] Error al cargar:', error)
    showMessage(errorMessage(error, 'No fue posible cargar los clientes. Inténtalo de nuevo.'), 'error')
  } finally {
    loading.value = false
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
    }
  } else {
    formData.value = emptyForm()
  }
  dialog.value = true
}

const save = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editing.value?.id) {
      await billingService.updateCustomer(editing.value.id, formData.value)
      showMessage('Cliente actualizado exitosamente', 'success')
    } else {
      await billingService.createCustomer(formData.value)
      showMessage('Cliente creado exitosamente', 'success')
    }
    dialog.value = false
    loadClientes()
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
    loadClientes()
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

const saveSupplier = async () => {
  const { valid } = await supplierFormRef.value.validate()
  if (!valid) return

  savingSupplier.value = true
  try {
    if (supplierEditing.value?.id) {
      await billingService.updateSupplier(supplierEditing.value.id, supplierForm.value)
      showMessage('Proveedor actualizado exitosamente', 'success')
    } else {
      await billingService.createSupplier(supplierForm.value)
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
  loadSuppliers()
})
</script>
