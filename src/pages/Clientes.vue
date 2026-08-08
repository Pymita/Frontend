<template>
  <v-container fluid>
    <!-- Título -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-icon size="40" class="mr-3" color="primary">mdi-account-multiple</v-icon>
            <div>
              <h1 class="text-h3">Clientes</h1>
              <p class="text-body-1 text-grey">Gestiona la base de datos de clientes para facturación</p>
            </div>
          </div>
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-plus</v-icon>
            Nuevo Cliente
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Filtros -->
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

    <!-- Tabla de Clientes -->
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
                :color="item.person_type === 'legal' ? 'purple' : 'blue'"
                variant="tonal">
                {{ item.person_type === 'legal' ? 'Jurídica' : 'Natural' }}
              </v-chip>
            </template>

            <template #item.frequent_customer="{ item }">
              <v-icon :color="item.frequent_customer ? 'success' : 'grey'">
                {{ item.frequent_customer ? 'mdi-star' : 'mdi-star-outline' }}
              </v-icon>
            </template>

            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                @click="openDialog(item)" />
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="error"
                @click="deleteCliente(item)" />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Cliente -->
    <v-dialog v-model="dialog" max-width="800px" persistent>
      <v-card>
        <v-card-title class="bg-primary">
          {{ editing ? 'Editar Cliente' : 'Nuevo Cliente' }}
        </v-card-title>
        <v-card-text class="pt-4">
          <v-alert type="info" density="compact" class="mb-4">
            Esta información se usará para generar facturas electrónicas
          </v-alert>

          <v-form ref="form">
            <v-row>
              <v-col cols="12" md="4">
                <v-select
                  v-model="formData.document_type"
                  :items="tiposDocumento"
                  label="Tipo de Documento *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]" />
              </v-col>

              <v-col cols="12" md="8">
                <v-text-field
                  v-model="formData.document_number"
                  label="Número de Documento *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]" />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="formData.name"
                  label="Nombre / Razón Social *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]" />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.email"
                  label="Email"
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
                  label="Tipo de Persona"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="8">
                <v-switch
                  v-model="formData.frequent_customer"
                  label="Marcar como Cliente Frecuente"
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

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarColor === 'error' ? 9000 : 3000" closable>
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/errors';
import { ref, computed, onMounted } from 'vue'
import { billingService, type Customer, type PersonType } from '@/services/billingService'

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
  { title: 'Tipo Doc', key: 'document_type', sortable: true },
  { title: 'Documento', key: 'document_number', sortable: true },
  { title: 'Nombre / Razón Social', key: 'name', sortable: true },
  { title: 'Email', key: 'email', sortable: false },
  { title: 'Teléfono', key: 'phone', sortable: false },
  { title: 'Tipo', key: 'person_type', sortable: true },
  { title: 'Frecuente', key: 'frequent_customer', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const tiposDocumento = [
  { value: 'CC', title: 'Cédula de Ciudadanía (CC)' },
  { value: 'CE', title: 'Cédula de Extranjería (CE)' },
  { value: 'NIT', title: 'NIT' },
  { value: 'Pasaporte', title: 'Pasaporte' },
]

const tiposPersona = [
  { value: 'natural', title: 'Persona Natural' },
  { value: 'legal', title: 'Persona Jurídica' },
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
    showMessage(errorMessage(error, 'Error al cargar clientes'), 'error')
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
    showMessage(errorMessage(error, 'Error al guardar cliente'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteCliente = async (cliente: Customer) => {
  if (!confirm(`¿Está seguro de eliminar el cliente "${cliente.name}"?`)) return

  try {
    await billingService.deleteCustomer(cliente.id)
    showMessage('Cliente eliminado exitosamente', 'success')
    loadClientes()
  } catch (error) {
    console.error('[Clientes] Error al eliminar:', error)
    showMessage(errorMessage(error, 'Error al eliminar cliente'), 'error')
  }
}

const showMessage = (text: string, color: 'success' | 'error' | 'warning') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

onMounted(() => {
  loadClientes()
})
</script>
