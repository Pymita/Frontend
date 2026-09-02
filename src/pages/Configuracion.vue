<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-1">Configuración</h1>
        <p class="text-body-1 text-grey-darken-1 mb-4">
          Catálogos del negocio: tipos de documento del kardex e impuestos
        </p>
      </v-col>
    </v-row>

    <v-row>
      <!-- Tipos de documento -->
      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Tipos de Documento</h2>
            <v-spacer />
            <LockableButton icon="mdi-plus" color="primary" size="small" @click="openDocDialog()">
              Nuevo
            </LockableButton>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="dt in documentTypes" :key="dt.id">
                <td><v-chip size="small" variant="tonal">{{ dt.code }}</v-chip></td>
                <td>{{ dt.name }}</td>
                <td class="text-caption">{{ directionLabel(dt.direction) }}</td>
                <td>
                  <v-chip :color="dt.active ? 'success' : 'grey'" size="x-small">
                    {{ dt.active ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                </td>
                <td class="text-right">
                  <v-btn icon size="x-small" variant="text" :disabled="isReadOnly" @click="openDocDialog(dt)">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn
                    v-if="!isSystemCode(dt.code)"
                    icon
                    size="x-small"
                    variant="text"
                    color="error"
                    @click="deleteDocType(dt)"
                  >
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <p class="text-caption text-grey mt-2">
            SI, FC, FV y AJ los usa el sistema y no se pueden eliminar.
          </p>
        </v-card>
      </v-col>

      <!-- Impuestos -->
      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Impuestos</h2>
            <v-spacer />
            <LockableButton icon="mdi-plus" color="primary" size="small" @click="openTaxDialog()">
              Nuevo
            </LockableButton>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Nombre</th>
                <th class="text-right">Porcentaje</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tax in taxes" :key="tax.id">
                <td>{{ tax.name }}</td>
                <td class="text-right">{{ tax.rate }}%</td>
                <td>
                  <v-chip :color="tax.active ? 'success' : 'grey'" size="x-small">
                    {{ tax.active ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                </td>
                <td class="text-right">
                  <v-btn icon size="x-small" variant="text" :disabled="isReadOnly" @click="openTaxDialog(tax)">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn icon size="x-small" variant="text" color="error" :disabled="isReadOnly" @click="deleteTax(tax)">
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <p class="text-caption text-grey mt-2">
            Estos porcentajes alimentan los selectores de impuesto en productos y menú.
          </p>
        </v-card>
      </v-col>
    </v-row>

    <!-- Resolución de facturación DIAN: rango autorizado de consecutivos.
         Cada venta toma el siguiente número y lo deja como referencia en
         el kardex; el sistema alerta antes de que el rango se agote. -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-1">
            <h2 class="text-h6">Resolución de Facturación (DIAN)</h2>
            <v-spacer />
            <v-chip
              v-if="resolutionStatus?.configured"
              :color="resolutionStatus.warning ? (resolutionStatus.blocking ? 'error' : 'warning') : 'success'"
              size="small"
              variant="tonal"
            >
              {{ resolutionStatus.blocking
                ? 'Bloqueada'
                : `Quedan ${resolutionStatus.remaining} consecutivos` }}
            </v-chip>
          </div>
          <p class="text-caption text-grey mb-4">
            Cada venta toma el siguiente consecutivo del rango y queda como referencia en el kardex.
            Te avisaremos con tiempo cuando el rango esté por agotarse, según el ritmo de ventas del negocio.
          </p>

          <v-form @submit.prevent="saveResolution">
            <v-row dense>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="resolutionForm.invoicing_resolution"
                  label="Número de resolución *"
                  hint="Ej: 18764000001234"
                  persistent-hint
                />
              </v-col>
              <v-col cols="6" md="2">
                <v-text-field v-model="resolutionForm.invoice_prefix" label="Prefijo" hint="Ej: POS" persistent-hint />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="resolutionForm.range_from"
                  label="Rango desde *"
                  type="number"
                  min="1"
                />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="resolutionForm.range_to"
                  label="Rango hasta *"
                  type="number"
                  min="1"
                />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="resolutionForm.resolution_date" label="Fecha de la resolución" type="date" />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="resolutionForm.valid_from" label="Vigente desde" type="date" />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="resolutionForm.valid_until" label="Vigente hasta" type="date" />
              </v-col>
              <v-col cols="6" md="3" class="d-flex align-center">
                <LockableButton color="primary" :loading="saving" @click="saveResolution">
                  Guardar resolución
                </LockableButton>
              </v-col>
            </v-row>
          </v-form>

          <v-alert v-if="resolutionStatus?.configured" type="info" variant="tonal" density="compact" class="mt-2">
            Próximo consecutivo:
            <strong>{{ resolutionForm.invoice_prefix ? resolutionForm.invoice_prefix + '-' : '' }}{{ resolution?.current_sequence }}</strong>
            · Guardar un rango o número de resolución distinto reinicia el consecutivo al inicio del rango nuevo.
          </v-alert>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog tipo de documento -->
    <v-dialog v-model="docDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>{{ editingDoc ? 'Editar Tipo de Documento' : 'Nuevo Tipo de Documento' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="docForm.code"
            label="Código (ej: DV, ND)"
            :disabled="!!editingDoc"
            maxlength="10"
            :rules="[(v: string) => !!v || 'Código requerido']"
          />
          <v-text-field
            v-model="docForm.name"
            label="Nombre"
            :rules="[(v: string) => !!v || 'Nombre requerido']"
          />
          <v-select
            v-model="docForm.direction"
            label="Dirección"
            :items="[
              { title: 'Entrada', value: 'in' },
              { title: 'Salida', value: 'out' },
              { title: 'Ambas', value: 'both' },
            ]"
          />
          <v-switch
            v-if="editingDoc && !isSystemCode(editingDoc.code)"
            v-model="docForm.active"
            label="Activo"
            color="success"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="docDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveDocType">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog impuesto -->
    <v-dialog v-model="taxDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>{{ editingTax ? 'Editar Impuesto' : 'Nuevo Impuesto' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="taxForm.name"
            label="Nombre (ej: IVA 19%)"
            :rules="[(v: string) => !!v || 'Nombre requerido']"
          />
          <v-text-field
            v-model.number="taxForm.rate"
            label="Porcentaje"
            type="number"
            suffix="%"
            :rules="[(v: number) => v >= 0 || 'Debe ser 0 o mayor']"
          />
          <v-switch
            v-if="editingTax"
            v-model="taxForm.active"
            label="Activo"
            color="success"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="taxDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveTax">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import kardexService, { type DocumentType, type Tax } from '../services/kardexService'
import invoicingService, { type InvoicingResolution, type ResolutionStatus } from '../services/invoicingService'
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

const SYSTEM_CODES = ['SI', 'FC', 'FV', 'AJ']
const isSystemCode = (code: string) => SYSTEM_CODES.includes(code)

const documentTypes = ref<DocumentType[]>([])
const taxes = ref<Tax[]>([])
const saving = ref(false)

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' = 'success') => {
  snackbar.value = { show: true, text, color }
}

const directionLabel = (d: string) => ({ in: 'Entrada', out: 'Salida', both: 'Ambas' }[d] || d)

const load = async () => {
  try {
    const [docs, taxList] = await Promise.all([kardexService.documentTypes(), kardexService.taxes()])
    documentTypes.value = docs
    taxes.value = taxList
  } catch {
    notify('Error al cargar los catálogos', 'error')
  }
  loadResolution()
}

// --- Resolución de facturación ---
const resolution = ref<InvoicingResolution | null>(null)
const resolutionStatus = ref<ResolutionStatus | null>(null)
const resolutionForm = ref({
  invoicing_resolution: '',
  invoice_prefix: '',
  range_from: null as number | null,
  range_to: null as number | null,
  resolution_date: '',
  valid_from: '',
  valid_until: '',
})

// Si el usuario ya empezó a escribir, la carga asíncrona no debe pisar
// sus datos (pasa con conexiones lentas y con los tests).
const resolutionFormTouched = ref(false)
watch(resolutionForm, () => { resolutionFormTouched.value = true }, { deep: true })

const loadResolution = async () => {
  try {
    const [data, status] = await Promise.all([invoicingService.resolution(), invoicingService.status()])
    resolution.value = data
    resolutionStatus.value = status
    if (resolutionFormTouched.value) return
    resolutionForm.value = {
      invoicing_resolution: data.invoicing_resolution || '',
      invoice_prefix: data.invoice_prefix || '',
      range_from: data.range_from,
      range_to: data.range_to,
      resolution_date: data.resolution_date || '',
      valid_from: data.valid_from || '',
      valid_until: data.valid_until || '',
    }
  } catch {
    // Empleados sin permiso de admin: la tarjeta queda vacía sin romper la página.
  }
}

const saveResolution = async () => {
  const form = resolutionForm.value
  if (!form.invoicing_resolution || !form.range_from || !form.range_to) {
    notify('Completa el número de resolución y el rango', 'error')
    return
  }
  saving.value = true
  try {
    resolution.value = await invoicingService.saveResolution({
      invoicing_resolution: form.invoicing_resolution,
      invoice_prefix: form.invoice_prefix || null,
      range_from: form.range_from,
      range_to: form.range_to,
      resolution_date: form.resolution_date || null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    })
    resolutionStatus.value = await invoicingService.status()
    notify('Resolución guardada')
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al guardar la resolución', 'error')
  } finally {
    saving.value = false
  }
}

// --- Tipos de documento ---
const docDialog = ref(false)
const editingDoc = ref<DocumentType | null>(null)
const docForm = ref({ code: '', name: '', direction: 'both' as 'in' | 'out' | 'both', active: true })

const openDocDialog = (dt?: DocumentType) => {
  editingDoc.value = dt ?? null
  docForm.value = dt
    ? { code: dt.code, name: dt.name, direction: dt.direction, active: dt.active }
    : { code: '', name: '', direction: 'both', active: true }
  docDialog.value = true
}

const saveDocType = async () => {
  saving.value = true
  try {
    if (editingDoc.value) {
      await kardexService.updateDocumentType(editingDoc.value.id, {
        name: docForm.value.name,
        direction: docForm.value.direction,
        active: docForm.value.active,
      })
    } else {
      await kardexService.createDocumentType({
        code: docForm.value.code.toUpperCase(),
        name: docForm.value.name,
        direction: docForm.value.direction,
      })
    }
    notify('Tipo de documento guardado')
    docDialog.value = false
    await load()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

const deleteDocType = async (dt: DocumentType) => {
  if (!window.confirm(`¿Eliminar el tipo de documento "${dt.code} — ${dt.name}"?`)) return
  try {
    await kardexService.deleteDocumentType(dt.id)
    notify('Tipo de documento eliminado')
    await load()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al eliminar', 'error')
  }
}

// --- Impuestos ---
const taxDialog = ref(false)
const editingTax = ref<Tax | null>(null)
const taxForm = ref({ name: '', rate: 0, active: true })

const openTaxDialog = (tax?: Tax) => {
  editingTax.value = tax ?? null
  taxForm.value = tax
    ? { name: tax.name, rate: tax.rate, active: tax.active }
    : { name: '', rate: 0, active: true }
  taxDialog.value = true
}

const saveTax = async () => {
  saving.value = true
  try {
    if (editingTax.value) {
      await kardexService.updateTax(editingTax.value.id, { ...taxForm.value })
    } else {
      await kardexService.createTax({ name: taxForm.value.name, rate: taxForm.value.rate })
    }
    notify('Impuesto guardado')
    taxDialog.value = false
    await load()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al guardar', 'error')
  } finally {
    saving.value = false
  }
}

const deleteTax = async (tax: Tax) => {
  if (!window.confirm(`¿Eliminar el impuesto "${tax.name}"?`)) return
  try {
    await kardexService.deleteTax(tax.id)
    notify('Impuesto eliminado')
    await load()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al eliminar', 'error')
  }
}

onMounted(load)
</script>
