<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-1">Configuración</h1>
        <p class="text-body-1 text-medium-emphasis mb-4">
          Datos del negocio y catálogos: tipos de documento del kardex, impuestos y resolución DIAN
        </p>
      </v-col>
    </v-row>

    <!-- Encabezado de las facturas, cuentas de cobro y recibos de caja: una
         sola plantilla para todas las empresas, con los datos de cada una. -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-1">
            <h2 class="text-h6">Datos del negocio</h2>
            <v-spacer />
            <v-chip v-if="business" size="small" variant="tonal" :color="business.complete ? 'success' : 'warning'">
              {{ business.complete ? 'Completo' : 'Faltan datos' }}
            </v-chip>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Van en el encabezado de las facturas, cuentas de cobro y recibos de caja que imprimes.
            Los campos con <span class="text-error font-weight-bold">*</span> son obligatorios.
          </p>
          <v-form ref="businessFormRef">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.legal_name" :rules="[required]">
                  <template #label>Nombre o razón social <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.trade_name" label="Nombre comercial (opcional)" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="businessForm.nit" :rules="[required]">
                  <template #label>NIT o documento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="businessForm.tax_regime"
                  :items="taxRegimeOptions"
                  label="Régimen"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="businessForm.phone" :rules="[required]" hint="Puedes poner varios: 3159276091 - 3001571023" persistent-hint>
                  <template #label>Teléfonos <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.address" :rules="[required]">
                  <template #label>Dirección <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="businessForm.city" label="Ciudad" />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="businessForm.department" label="Departamento" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.email" label="Email (opcional)" type="email" />
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="businessForm.document_notes"
                  label="Observaciones de los documentos"
                  placeholder="Ej.: Favor consignar en Cta ahorros 37342931449 Bancolombia a nombre de…"
                  hint="Salen al pie de cada factura, cuenta de cobro y recibo"
                  persistent-hint
                  rows="2"
                  auto-grow
                />
              </v-col>
            </v-row>
          </v-form>
          <div class="d-flex justify-end mt-3">
            <LockableButton color="primary" :loading="savingBusiness" @click="saveBusiness">
              Guardar datos del negocio
            </LockableButton>
          </div>
        </v-card>
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
                  <v-chip :color="dt.active ? 'success' : 'secondary'" size="x-small">
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
          <p class="text-caption text-medium-emphasis mt-2">
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
                  <v-chip :color="tax.active ? 'success' : 'secondary'" size="x-small">
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
          <p class="text-caption text-medium-emphasis mt-2">
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
          <p class="text-caption text-medium-emphasis mb-4">
            Cada venta toma el siguiente consecutivo del rango y queda como referencia en el kardex.
            Te avisaremos con tiempo cuando el rango esté por agotarse, según el ritmo de ventas del negocio.
          </p>

          <v-form @submit.prevent="saveResolution">
            <p class="text-caption text-medium-emphasis mb-3">
              Los campos con
              <span class="text-error font-weight-bold">*</span>
              son obligatorios.
            </p>

            <v-row dense>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="resolutionForm.invoicing_resolution"
                  hint="Ej: 18764000001234"
                  persistent-hint
                >
                  <template #label>
                    Número de resolución <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="6" md="2">
                <v-text-field v-model="resolutionForm.invoice_prefix" label="Prefijo" hint="Ej: POS" persistent-hint />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="resolutionForm.range_from"
                  type="number"
                  min="1"
                >
                  <template #label>
                    Rango desde <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="resolutionForm.range_to"
                  type="number"
                  min="1"
                >
                  <template #label>
                    Rango hasta <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model.number="resolutionForm.start_number"
                  type="number"
                  min="1"
                  label="La numeración empieza en"
                  hint="Si ya facturaste con otros números, indica desde cuál sigue"
                  persistent-hint
                />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field
                  v-model="resolutionForm.resolution_date"
                  label="Fecha de la resolución"
                  type="date"
                  hint="Es también el inicio de la vigencia"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <p class="text-caption text-medium-emphasis mb-1">Vigencia hasta</p>
                <v-btn-toggle
                  v-model="validityMode"
                  color="primary"
                  density="compact"
                  variant="outlined"
                  mandatory
                  class="mb-2"
                >
                  <v-btn value="months" size="small">Por meses</v-btn>
                  <v-btn value="date" size="small">Elegir fecha</v-btn>
                </v-btn-toggle>

                <v-text-field
                  v-if="validityMode === 'months'"
                  v-model.number="resolutionForm.validity_months"
                  type="number"
                  min="1"
                  max="120"
                  label="Meses de vigencia"
                  :hint="computedValidUntil ? `Vence el ${computedValidUntil}` : 'Ej: 48 meses desde la fecha de la resolución'"
                  persistent-hint
                />
                <v-text-field
                  v-else
                  v-model="resolutionForm.valid_until"
                  label="Vigente hasta"
                  type="date"
                />
              </v-col>
              <v-col cols="12" class="d-flex align-center">
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
import { computed, onMounted, ref, watch } from 'vue'
import kardexService, { type DocumentType, type Tax } from '../services/kardexService'
import invoicingService, { type InvoicingResolution, type ResolutionStatus } from '../services/invoicingService'
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'
import { billingService, type BusinessForm } from '../services/billingService'
import type { DocumentBusiness } from '../utils/printDocuments'
import { taxRegimeLabels } from '../utils/labels'
import { errorMessage } from '../utils/errors'

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
  loadBusiness()
}

// --- Datos del negocio (encabezado de los documentos) ---
const business = ref<DocumentBusiness | null>(null)
const businessFormRef = ref<any>(null)
const savingBusiness = ref(false)
const emptyBusiness = (): BusinessForm => ({
  legal_name: '',
  trade_name: '',
  nit: '',
  tax_regime: null,
  address: '',
  city: '',
  department: '',
  phone: '',
  email: '',
  document_notes: '',
})
const businessForm = ref<BusinessForm>(emptyBusiness())
const required = (v: string | null | undefined) => !!(v && String(v).trim()) || 'Este campo es obligatorio'
const taxRegimeOptions = Object.entries(taxRegimeLabels).map(([value, title]) => ({ value, title }))

const loadBusiness = async () => {
  try {
    business.value = await billingService.getBusiness()
    const { complete: _complete, ...data } = business.value
    businessForm.value = { ...emptyBusiness(), ...data }
  } catch {
    // Sin la sección no se bloquea el resto de la configuración.
  }
}

const saveBusiness = async () => {
  const { valid } = await businessFormRef.value.validate()
  if (!valid) return
  savingBusiness.value = true
  try {
    business.value = await billingService.updateBusiness(businessForm.value)
    notify('Datos del negocio guardados')
  } catch (error) {
    notify(errorMessage(error, 'No se pudieron guardar los datos del negocio'), 'error')
  } finally {
    savingBusiness.value = false
  }
}

// --- Resolución de facturación ---
const resolution = ref<InvoicingResolution | null>(null)
const resolutionStatus = ref<ResolutionStatus | null>(null)
const resolutionForm = ref({
  invoicing_resolution: '',
  invoice_prefix: '',
  range_from: null as number | null,
  range_to: null as number | null,
  start_number: null as number | null,
  resolution_date: '',
  valid_until: '',
  validity_months: null as number | null,
})

// Vigencia: calcularla por meses desde la fecha de la resolución, o elegir
// la fecha de vencimiento a mano.
const validityMode = ref<'months' | 'date'>('months')

// Fecha de vencimiento que se calcula al vuelo cuando el usuario indica meses,
// solo para mostrarla como pista (el backend la calcula de forma definitiva).
const computedValidUntil = computed(() => {
  const months = resolutionForm.value.validity_months
  const start = resolutionForm.value.resolution_date
  if (!months || !start) return ''
  const date = new Date(start + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return ''
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
})

// Si el usuario ya empezó a escribir, la carga asíncrona no debe pisar
// sus datos (pasa con conexiones lentas y con los tests).
const resolutionFormTouched = ref(false)
watch(resolutionForm, () => { resolutionFormTouched.value = true }, { deep: true })

// Al cambiar el rango, el número inicial se ajusta si quedó por fuera de él.
watch(
  () => [resolutionForm.value.range_from, resolutionForm.value.range_to],
  () => {
    const { range_from, range_to, start_number } = resolutionForm.value
    if (range_from == null) return
    const outOfRange =
      start_number == null ||
      start_number < range_from ||
      (range_to != null && start_number > range_to)
    if (outOfRange) resolutionForm.value.start_number = range_from
  },
)

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
      // El inicio de la numeración es el próximo consecutivo (o el inicio del rango).
      start_number: data.current_sequence ?? data.range_from,
      resolution_date: data.resolution_date || '',
      valid_until: data.valid_until || '',
      validity_months: data.validity_months,
    }
    // Recuerda el modo con el que se guardó: si hay meses, "por meses".
    validityMode.value = data.validity_months ? 'months' : (data.valid_until ? 'date' : 'months')
    // La carga no cuenta como edición del usuario.
    resolutionFormTouched.value = false
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
  const byMonths = validityMode.value === 'months'
  saving.value = true
  try {
    resolution.value = await invoicingService.saveResolution({
      invoicing_resolution: form.invoicing_resolution,
      invoice_prefix: form.invoice_prefix || null,
      range_from: form.range_from,
      range_to: form.range_to,
      start_number: form.start_number ?? null,
      resolution_date: form.resolution_date || null,
      // Solo se envía el modo elegido; el otro se limpia en el backend.
      valid_until: byMonths ? null : (form.valid_until || null),
      validity_months: byMonths ? (form.validity_months || null) : null,
    })
    resolutionStatus.value = await invoicingService.status()
    resolutionFormTouched.value = false
    await loadResolution()
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
