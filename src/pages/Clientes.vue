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
            <template #item.tipo_documento="{ item }">
              <v-chip size="small" color="primary" variant="outlined">
                {{ item.tipo_documento }}
              </v-chip>
            </template>

            <template #item.tipo_persona="{ item }">
              <v-chip 
                size="small" 
                :color="item.tipo_persona === 'juridica' ? 'purple' : 'blue'"
                variant="tonal">
                {{ item.tipo_persona === 'juridica' ? 'Jurídica' : 'Natural' }}
              </v-chip>
            </template>

            <template #item.cliente_frecuente="{ item }">
              <v-icon :color="item.cliente_frecuente ? 'success' : 'grey'">
                {{ item.cliente_frecuente ? 'mdi-star' : 'mdi-star-outline' }}
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
                  v-model="formData.tipo_documento"
                  :items="tiposDocumento"
                  label="Tipo de Documento *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]" />
              </v-col>

              <v-col cols="12" md="8">
                <v-text-field
                  v-model="formData.numero_documento"
                  label="Número de Documento *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]" />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="formData.nombre"
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
                  v-model="formData.telefono"
                  label="Teléfono"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="formData.direccion"
                  label="Dirección"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="4">
                <v-select
                  v-model="formData.tipo_persona"
                  :items="tiposPersona"
                  label="Tipo de Persona"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="8">
                <v-switch
                  v-model="formData.cliente_frecuente"
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

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { facturacionService } from '@/services/facturacionService'

interface Cliente {
  id?: number
  tipo_documento: string
  numero_documento: string
  nombre: string
  email?: string
  telefono?: string
  direccion?: string
  tipo_persona: 'natural' | 'juridica'
  cliente_frecuente: boolean
}

const clientes = ref<Cliente[]>([])
const loading = ref(false)
const dialog = ref(false)
const editing = ref<Cliente | null>(null)
const saving = ref(false)
const search = ref('')

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const form = ref<any>(null)

const headers = [
  { title: 'Tipo Doc', key: 'tipo_documento', sortable: true },
  { title: 'Documento', key: 'numero_documento', sortable: true },
  { title: 'Nombre / Razón Social', key: 'nombre', sortable: true },
  { title: 'Email', key: 'email', sortable: false },
  { title: 'Teléfono', key: 'telefono', sortable: false },
  { title: 'Tipo', key: 'tipo_persona', sortable: true },
  { title: 'Frecuente', key: 'cliente_frecuente', sortable: true },
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
  { value: 'juridica', title: 'Persona Jurídica' },
]

const formData = ref<Cliente>({
  tipo_documento: 'CC',
  numero_documento: '',
  nombre: '',
  email: '',
  telefono: '',
  direccion: '',
  tipo_persona: 'natural',
  cliente_frecuente: false,
})

const rules = {
  required: (v: any) => !!v || 'Este campo es requerido',
}

const filteredClientes = computed(() => {
  if (!search.value) return clientes.value
  
  const searchLower = search.value.toLowerCase()
  return clientes.value.filter(
    c =>
      c.nombre?.toLowerCase().includes(searchLower) ||
      c.numero_documento?.toLowerCase().includes(searchLower)
  )
})

const loadClientes = async () => {
  loading.value = true
  try {
    clientes.value = await facturacionService.getAll()
  } catch (error) {
    console.error('[Clientes] Error al cargar:', error)
    showMessage('Error al cargar clientes', 'error')
  } finally {
    loading.value = false
  }
}

const openDialog = (cliente?: Cliente) => {
  editing.value = cliente || null
  if (cliente) {
    formData.value = { ...cliente }
  } else {
    formData.value = {
      tipo_documento: 'CC',
      numero_documento: '',
      nombre: '',
      email: '',
      telefono: '',
      direccion: '',
      tipo_persona: 'natural',
      cliente_frecuente: false,
    }
  }
  dialog.value = true
}

const save = async () => {
  const { valid } = await form.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editing.value?.id) {
      await facturacionService.update(editing.value.id, formData.value)
      showMessage('Cliente actualizado exitosamente', 'success')
    } else {
      await facturacionService.create(formData.value)
      showMessage('Cliente creado exitosamente', 'success')
    }
    dialog.value = false
    loadClientes()
  } catch (error) {
    console.error('[Clientes] Error al guardar:', error)
    showMessage('Error al guardar cliente', 'error')
  } finally {
    saving.value = false
  }
}

const deleteCliente = async (cliente: Cliente) => {
  if (!confirm(`¿Está seguro de eliminar el cliente "${cliente.nombre}"?`)) return

  try {
    await facturacionService.delete(cliente.id!)
    showMessage('Cliente eliminado exitosamente', 'success')
    loadClientes()
  } catch (error) {
    console.error('[Clientes] Error al eliminar:', error)
    showMessage('Error al eliminar cliente', 'error')
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
