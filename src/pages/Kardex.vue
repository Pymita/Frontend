<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Kardex</h1>
            <p class="text-body-1 text-medium-emphasis">
              Movimientos de inventario con costos y saldos (promedio ponderado)
            </p>
          </div>
          <div class="d-flex ga-2">
            <LockableButton icon="mdi-plus" color="primary" size="large" @click="openMovementDialog">
              Registrar movimiento
            </LockableButton>
            <v-btn
              color="primary"
              variant="outlined"
              size="large"
              :loading="exporting"
              :disabled="!report || report.movements.length === 0"
              @click="exportExcel"
            >
              <v-icon start>mdi-microsoft-excel</v-icon>
              Descargar Excel
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>

    <!-- Movimiento manual: devolución de ventas, compra de varios productos,
         etc. Los documentos automáticos (SI, FV, NC) no aparecen: esos los
         genera el sistema con las ventas y los saldos iniciales. -->
    <v-dialog v-model="movementDialog" max-width="820" persistent scrollable>
      <v-card>
        <v-card-title>Registrar movimiento de inventario</v-card-title>
        <v-card-text>
          <v-form ref="movementFormRef">
            <v-row dense>
              <v-col cols="12" sm="7">
                <v-select
                  v-model="movementForm.document_type_id"
                  :items="manualDocumentTypes"
                  :item-title="(t: any) => `${t.code} — ${t.name}`"
                  item-value="id"
                >
                  <template #label>
                    Tipo de documento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" sm="5">
                <v-select
                  v-model="movementForm.movement_type"
                  :items="movementTypeOptions"
                  :disabled="movementTypeOptions.length === 1"
                >
                  <template #label>
                    Dirección <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-select>
              </v-col>
            </v-row>
            <v-row dense>
              <v-col cols="12" sm="4">
                <!-- Los documentos no siempre se registran el día que ocurren -->
                <DateField
                  v-model="movementForm.moved_at"
                  :max="today"
                >
                  <template #label>
                    Fecha del movimiento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </DateField>
              </v-col>
              <v-col cols="12" sm="4">
                <v-combobox
                  v-model="movementForm.counterparty"
                  :items="counterpartyItems"
                  :label="counterpartyLabel"
                  :hint="counterpartyRequired ? 'Obligatorio para este documento' : 'Opcional'"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="movementForm.reference"
                  :label="selectedDocCode === 'FC' ? 'Número de factura' : 'Referencia'"
                  :hint="selectedDocCode === 'FC' ? 'Opcional. Ej: FE-3321 del proveedor' : 'Ej: la factura POS-105 que se devuelve'"
                  persistent-hint
                />
              </v-col>
            </v-row>

            <!-- One line per product of the invoice; they all share the date,
                 counterparty, reference and notes above and below. -->
            <div class="text-subtitle-1 mt-2">Productos</div>
            <p class="text-caption text-medium-emphasis mb-2">
              <template v-if="isEntry">
                El costo unitario trae el último costo del producto; si lo dejas vacío, entra al costo promedio.
              </template>
              Un producto repetido queda como otro movimiento. Las líneas vacías no se registran.
            </p>
            <div
              v-for="(line, index) in movementLines"
              :key="line.key"
              role="group"
              :aria-label="`Línea ${index + 1}`"
              class="mb-2"
            >
              <v-row dense align="center">
                <!-- On a phone the delete button sits beside the product, so quantity and cost get half the row each -->
                <v-col cols="10" :sm="isEntry ? 6 : 8">
                  <v-autocomplete
                    v-model="line.product_id"
                    :items="products"
                    item-title="name"
                    item-value="id"
                    :error="line.error?.field === 'product'"
                    :messages="repeatedLines.has(line.key) ? 'Ya está en otra línea: se registra aparte' : undefined"
                    hide-details="auto"
                    @update:model-value="onLineProduct(line)"
                  >
                    <template #label>
                      Producto <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                    </template>
                  </v-autocomplete>
                </v-col>
                <v-col :cols="isEntry ? 6 : 12" :sm="isEntry ? 2 : 3" order="3" order-sm="0">
                  <v-text-field
                    v-model.number="line.quantity"
                    type="number"
                    min="0"
                    step="0.01"
                    :suffix="unitOf(line.product_id)"
                    :error="line.error?.field === 'quantity'"
                    hide-details="auto"
                    @update:model-value="line.error = null"
                  >
                    <template #label>
                      Cantidad <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                    </template>
                  </v-text-field>
                </v-col>
                <v-col v-if="isEntry" cols="6" sm="3" order="3" order-sm="0">
                  <MoneyField
                    v-model="line.unit_cost"
                    label="Costo unitario"
                    :error="line.error?.field === 'unit_cost'"
                    hide-details="auto"
                    @update:model-value="line.error = null"
                  />
                </v-col>
                <v-col cols="2" sm="1" order="2" order-sm="0" class="text-center">
                  <v-btn
                    icon="mdi-delete-outline"
                    variant="text"
                    size="small"
                    :disabled="movementLines.length === 1"
                    :aria-label="line.product_id ? `Quitar ${productName(line.product_id)} del movimiento` : `Quitar la línea ${index + 1}`"
                    @click="movementLines.splice(index, 1)"
                  />
                </v-col>
              </v-row>
              <div v-if="line.error" class="text-caption text-error px-2">{{ line.error.text }}</div>
            </div>
            <div class="d-flex flex-wrap align-center justify-space-between ga-2 mb-4">
              <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addMovementLine()">
                Agregar producto
              </v-btn>
              <div v-if="isEntry" class="text-body-1">
                Costo total: <strong>{{ money(linesCost) }}</strong>
              </div>
            </div>
            <v-textarea
              v-model="movementForm.notes"
              label="Observaciones"
              hint="Opcional. Queda registrada en el kardex junto al movimiento"
              persistent-hint
              rows="2"
            />
          </v-form>
        </v-card-text>
        <!-- Errors stay inside the dialog: the page snackbar would cover its buttons -->
        <v-alert v-if="movementError" type="error" variant="tonal" density="compact" class="mx-4 mt-2">
          {{ movementError }}
        </v-alert>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="movementDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="savingMovement" @click="saveMovement">
            Registrar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Filtros -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <v-row dense align="center">
            <v-col cols="12" md="3">
              <v-autocomplete
                v-model="filters.product_id"
                :items="products"
                item-title="name"
                item-value="id"
                label="Producto"
                clearable
                hide-details
                prepend-inner-icon="mdi-package-variant"
              />
            </v-col>
            <v-col cols="6" md="2">
              <DateField v-model="filters.from" label="Desde" hide-details />
            </v-col>
            <v-col cols="6" md="2">
              <DateField v-model="filters.to" label="Hasta" hide-details />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="filters.document_type_id"
                :items="documentTypes"
                :item-title="(t: any) => `${t.code} — ${t.name}`"
                item-value="id"
                label="Tipo de documento"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="6" md="2">
              <v-select
                v-model="filters.movement_type"
                :items="[
                  { title: 'Entradas', value: 'in' },
                  { title: 'Salidas', value: 'out' },
                ]"
                label="Movimiento"
                clearable
                hide-details
              />
            </v-col>
            <v-col cols="12" md="1">
              <v-btn color="primary" block :loading="loading" @click="load">
                <v-icon>mdi-magnify</v-icon>
              </v-btn>
            </v-col>
          </v-row>
        </v-card>
      </v-col>
    </v-row>

    <!-- Resumen del producto -->
    <v-row v-if="report?.product">
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Existencia actual</div>
          <div class="text-h5" :class="{ 'text-error': report.product.current_stock <= 0 }">{{ report.product.current_stock }} {{ report.product.unit }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Costo promedio</div>
          <div class="text-h5">{{ preciseMoney(report.product.unit_cost) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Valor del inventario</div>
          <div class="text-h5" :class="{ 'text-error': report.product.current_stock < 0 }">{{ preciseMoney(report.product.current_stock * report.product.unit_cost) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabla kardex -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-alert
            v-if="report?.truncated"
            type="warning"
            variant="tonal"
            density="compact"
            class="ma-2"
          >
            Se muestran los primeros 1000 movimientos: acota el rango de fechas para ver el resto.
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Doc.</th>
                <th>Referencia</th>
                <th v-if="showProductColumn">Producto</th>
                <th class="text-right">Entrada</th>
                <th class="text-right">Salida</th>
                <th class="text-right">Costo unit.</th>
                <th class="text-right">Costo total</th>
                <th class="text-right">Saldo cant.</th>
                <th class="text-right">Saldo costo</th>
                <th class="text-right">Saldo total</th>
                <th>Usuario</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="report?.opening_balance" class="bg-surface-light font-weight-medium">
                <td>{{ loadedFilters.from }}</td>
                <td>—</td>
                <td>SALDO ANTERIOR</td>
                <td v-if="showProductColumn"></td>
                <td colspan="4"></td>
                <td class="text-right">{{ report.opening_balance.quantity }}</td>
                <td class="text-right">{{ preciseMoney(report.opening_balance.unit_cost) }}</td>
                <td class="text-right">{{ preciseMoney(report.opening_balance.total_cost) }}</td>
                <td></td>
              </tr>
              <tr v-for="m in report?.movements ?? []" :key="m.id">
                <td>{{ formatDateTime(m.moved_at) }}</td>
                <td>
                  <v-tooltip :text="m.document_name">
                    <template #activator="{ props }">
                      <v-chip
                        v-bind="props"
                        size="x-small"
                        :color="m.movement_type === 'in' ? 'success' : 'error'"
                        variant="tonal"
                      >
                        {{ m.document_code }}
                      </v-chip>
                    </template>
                  </v-tooltip>
                </td>
                <td>
                  {{ m.reference || '—' }}
                  <div v-if="m.counterparty" class="text-caption text-medium-emphasis">{{ m.counterparty }}</div>
                </td>
                <td v-if="showProductColumn">{{ m.product.name }}</td>
                <td class="text-right text-success">
                  {{ m.movement_type === 'in' ? m.quantity : '' }}
                </td>
                <td class="text-right text-error">
                  {{ m.movement_type === 'out' ? m.quantity : '' }}
                </td>
                <td class="text-right">{{ preciseMoney(m.unit_cost) }}</td>
                <td class="text-right">{{ preciseMoney(m.total_cost) }}</td>
                <td class="text-right" :class="{ 'text-error font-weight-bold': m.balance_quantity < 0 }">{{ m.balance_quantity }}</td>
                <td class="text-right">{{ preciseMoney(m.balance_unit_cost) }}</td>
                <td class="text-right" :class="{ 'text-error font-weight-bold': m.balance_total_cost < 0 }">{{ preciseMoney(m.balance_total_cost) }}</td>
                <td class="text-caption">{{ m.user || '—' }}</td>
              </tr>
              <tr v-if="report && report.movements.length === 0">
                <td colspan="12" class="text-center text-medium-emphasis py-6">
                  No hay movimientos con los filtros seleccionados
                </td>
              </tr>
            </tbody>
            <tfoot v-if="report && report.movements.length > 0">
              <tr class="font-weight-bold bg-surface-light">
                <td :colspan="showProductColumn ? 4 : 3">Totales del periodo</td>
                <td class="text-right text-success">{{ report.totals.in_quantity }}</td>
                <td class="text-right text-error">{{ report.totals.out_quantity }}</td>
                <td></td>
                <td class="text-right">
                  {{ preciseMoney(report.totals.in_cost - report.totals.out_cost) }}
                </td>
                <td colspan="4"></td>
              </tr>
            </tfoot>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { money, preciseMoney } from '@/utils/money'
import { formatDateTime } from '@/utils/dates'
import { errorMessage } from '@/utils/errors'
import { computed, onMounted, ref, watch } from 'vue'
import kardexService, { type DocumentType, type KardexFilters, type KardexReport } from '../services/kardexService'
import { productsService } from '../services/productsService'
import { billingService, type Customer, type Supplier } from '../services/billingService'
import LockableButton from '../components/LockableButton.vue'
import DateField from '../components/DateField.vue'
import MoneyField from '../components/MoneyField.vue'

// Documentos que el sistema genera solo: no se pueden registrar a mano.
const AUTOMATIC_CODES = ['SI', 'FV', 'NC']

const movementDialog = ref(false)
const savingMovement = ref(false)
const movementError = ref('')
// Hoy en local (los inputs date usan YYYY-MM-DD).
const today = new Date().toLocaleDateString('sv-SE')
const movementFormRef = ref<any>(null)
const movementForm = ref({
  document_type_id: null as number | null,
  movement_type: 'in' as 'in' | 'out',
  moved_at: today,
  counterparty: '',
  reference: '',
  notes: '',
})

interface MovementLine {
  key: number
  product_id: number | null
  /** An emptied number field gives '' */
  quantity: number | '' | null
  unit_cost: number | null
  error: { field: 'product' | 'quantity' | 'unit_cost'; text: string } | null
}
let lineKeys = 0
const movementLines = ref<MovementLine[]>([])

const loading = ref(false)
const exporting = ref(false)
const report = ref<KardexReport | null>(null)
const products = ref<{ id: number; name: string; unit?: string | null; unit_cost?: number | null }[]>([])
const documentTypes = ref<DocumentType[]>([])

// Terceros para el selector Cliente/Proveedor del movimiento.
const suppliers = ref<Supplier[]>([])
const customers = ref<Customer[]>([])
// Proveedor por defecto (nombre de la empresa): va precargado en el formulario.
const defaultSupplierName = computed(() => suppliers.value.find(s => s.is_default)?.name ?? '')
const counterpartyItems = computed(() => {
  const names = new Set<string>()
  suppliers.value.forEach(s => s.name && names.add(s.name))
  customers.value.forEach(c => c.name && names.add(c.name))
  return Array.from(names)
})

// Sin rango por defecto: se ve todo el historial del kardex, incluidos los
// saldos iniciales retrofechados. El usuario acota el rango si lo necesita.
const filters = ref<KardexFilters>({})

// Filtros con los que se armó la tabla que se está viendo. Las columnas
// dependen de ESTO y no de filters: si no, al elegir un producto la
// columna Producto desaparecía mientras las filas seguían siendo de todos.
const loadedFilters = ref<KardexFilters>({})

const showProductColumn = computed(() => !loadedFilters.value.product_id)

const snackbar = ref({ show: false, text: '', color: 'error' })
const manualDocumentTypes = computed(() =>
  documentTypes.value.filter(t => t.active && !AUTOMATIC_CODES.includes(t.code)),
)

// La dirección se acota a lo que el documento elegido permite.
const movementTypeOptions = computed(() => {
  const doc = documentTypes.value.find(t => t.id === movementForm.value.document_type_id)
  const options = [
    { value: 'in', title: 'Entrada' },
    { value: 'out', title: 'Salida' },
  ]
  if (!doc || doc.direction === 'both') return options
  return options.filter(o => o.value === doc.direction)
})

watch(movementTypeOptions, options => {
  const only = options.length === 1 ? options[0] : null
  if (only) movementForm.value.movement_type = only.value as 'in' | 'out'
})

// Compras (FC) y devoluciones (DV) llevan un tercero obligatorio.
const selectedDocCode = computed(
  () => documentTypes.value.find(t => t.id === movementForm.value.document_type_id)?.code ?? null,
)
const counterpartyRequired = computed(() => selectedDocCode.value === 'FC' || selectedDocCode.value === 'DV')
const counterpartyLabel = computed(() => {
  if (selectedDocCode.value === 'FC') return 'Proveedor *'
  if (selectedDocCode.value === 'DV') return 'Cliente *'
  return 'Cliente / Proveedor'
})

const isEntry = computed(() => movementForm.value.movement_type === 'in')

const productOf = (id: number | null) => products.value.find(p => p.id === id)
const productName = (id: number | null) => productOf(id)?.name ?? 'el producto'
const unitOf = (id: number | null) => productOf(id)?.unit || undefined

const newLine = (productId: number | null = null): MovementLine => {
  const cost = productOf(productId)?.unit_cost
  return { key: ++lineKeys, product_id: productId, quantity: null, unit_cost: cost != null ? Number(cost) : null, error: null }
}

const addMovementLine = () => movementLines.value.push(newLine())

// Al elegir producto se sugiere su último costo (editable).
const onLineProduct = (line: MovementLine) => {
  line.error = null
  if (!line.product_id) {
    line.unit_cost = null
    return
  }
  const cost = productOf(line.product_id)?.unit_cost
  if (cost != null) line.unit_cost = Number(cost)
}

const hasQuantity = (line: MovementLine) => line.quantity !== null && line.quantity !== ''
// A line with no product, quantity or cost is a leftover row: it is not sent.
const isBlankLine = (line: MovementLine) =>
  !line.product_id && !hasQuantity(line) && (!isEntry.value || line.unit_cost === null)

// Lines repeating the product of an earlier one: each is its own movement.
const repeatedLines = computed(() => {
  const seen = new Set<number>()
  const repeated = new Set<number>()
  for (const line of movementLines.value) {
    if (!line.product_id) continue
    if (seen.has(line.product_id)) repeated.add(line.key)
    seen.add(line.product_id)
  }
  return repeated
})

// A line without a cost enters at the average cost, the one suggested.
const linesCost = computed(() =>
  movementLines.value.reduce((total, line) => {
    const cost = line.unit_cost ?? productOf(line.product_id)?.unit_cost ?? 0
    return total + (Number(line.quantity) > 0 ? Number(line.quantity) * Number(cost) : 0)
  }, 0),
)

const lineProblem = (line: MovementLine): MovementLine['error'] => {
  if (!line.product_id) {
    return { field: 'product', text: 'Elige el producto de esta línea de la lista (no basta con escribirlo)' }
  }
  if (!hasQuantity(line)) return { field: 'quantity', text: `Escribe la cantidad de ${productName(line.product_id)}` }
  if (!(Number(line.quantity) > 0)) {
    return { field: 'quantity', text: `La cantidad de ${productName(line.product_id)} debe ser mayor que 0` }
  }
  return null
}

const LINE_FIELDS: Record<string, NonNullable<MovementLine['error']>['field']> = {
  product_id: 'product',
  quantity: 'quantity',
  unit_cost: 'unit_cost',
}

const openMovementDialog = () => {
  movementForm.value = {
    document_type_id: null,
    movement_type: 'in',
    moved_at: today,
    // Precargado con el proveedor por defecto (nombre de la empresa).
    counterparty: defaultSupplierName.value,
    reference: '',
    notes: '',
  }
  // Con un producto ya filtrado, el movimiento seguramente es para él.
  movementLines.value = [newLine(filters.value.product_id ?? null)]
  movementError.value = ''
  movementDialog.value = true
}

const saveMovement = async () => {
  const form = movementForm.value
  movementError.value = ''

  // Mensaje específico: decir exactamente qué falta evita adivinar.
  const missing: string[] = []
  if (!form.document_type_id) missing.push('el tipo de documento')
  if (!form.moved_at) missing.push('la fecha')
  if (counterpartyRequired.value && !(form.counterparty || '').trim()) {
    missing.push(selectedDocCode.value === 'FC' ? 'el proveedor de la compra' : 'el cliente de la devolución')
  }

  movementLines.value.forEach(line => (line.error = isBlankLine(line) ? null : lineProblem(line)))
  const lines = movementLines.value.filter(line => !isBlankLine(line))
  if (lines.length === 0) missing.push('el producto (elígelo de la lista, no basta con escribirlo)')

  if (missing.length > 0) {
    movementError.value = `Falta ${missing.join(', ')}`
    return
  }
  const problem = lines.find(line => line.error)?.error
  if (problem) {
    movementError.value = problem.text
    return
  }
  // A cost that does not read as pesos is flagged by its own field.
  const { valid } = await movementFormRef.value.validate()
  if (!valid) {
    movementError.value = 'Revisa los campos marcados en rojo'
    return
  }
  // Solo para que TypeScript sepa que ya no es null (la guarda de arriba cubre).
  if (!form.document_type_id) return
  savingMovement.value = true
  try {
    const result = await kardexService.createKardexMovement({
      document_type_id: form.document_type_id,
      movement_type: form.movement_type,
      // Empty optional columns are not sent.
      items: lines.map(line => ({
        product_id: line.product_id as number,
        quantity: Number(line.quantity),
        ...(isEntry.value && line.unit_cost !== null ? { unit_cost: line.unit_cost } : {}),
      })),
      moved_at: form.moved_at,
      counterparty: (form.counterparty || '').trim() || undefined,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim() || undefined,
    })
    notify(result.message || 'Movimiento registrado en el kardex', 'success')
    movementDialog.value = false
    load()
  } catch (error: any) {
    // The API indexes the lines it was sent, blank ones already dropped.
    const errors: Record<string, string[]> = error?.response?.data?.errors ?? {}
    for (const [key, messages] of Object.entries(errors)) {
      const [, index, field] = /^items\.(\d+)\.(\w+)$/.exec(key) ?? []
      const line = index !== undefined ? lines[Number(index)] : undefined
      if (line && field) line.error = { field: LINE_FIELDS[field] ?? 'product', text: messages[0] ?? '' }
    }
    movementError.value = errorMessage(error, 'No fue posible registrar el movimiento. Inténtalo de nuevo.')
  } finally {
    savingMovement.value = false
  }
}

const notify = (text: string, color = 'error') => {
  snackbar.value = { show: true, text, color }
}



// Cada consulta lleva su número: si una anterior responde tarde (staging es
// lento), no pisa la tabla del filtro que el usuario eligió después.
let latestRequest = 0

const load = async () => {
  const requestId = ++latestRequest
  loading.value = true
  const applied = { ...filters.value }
  try {
    const result = await kardexService.report(applied)
    if (requestId !== latestRequest) return
    report.value = result
    loadedFilters.value = applied
  } catch (error: any) {
    if (requestId !== latestRequest) return
    notify(errorMessage(error, 'No fue posible cargar el kardex. Inténtalo de nuevo.'))
  } finally {
    if (requestId === latestRequest) loading.value = false
  }
}

const exportExcel = async () => {
  exporting.value = true
  try {
    await kardexService.export(filters.value)
  } catch (error) {
    notify(errorMessage(error, 'No fue posible exportar el kardex. Inténtalo de nuevo.'))
  } finally {
    exporting.value = false
  }
}

// Cambiar un filtro consulta solo. Se espera un momento porque las fechas
// se escriben de a poco y no vale la pena una consulta por tecla.
let reloadTimer: ReturnType<typeof setTimeout> | undefined

watch(
  filters,
  () => {
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(load, 300)
  },
  { deep: true },
)

onMounted(async () => {
  try {
    const [productList, docTypes] = await Promise.all([
      productsService.getAll(),
      kardexService.documentTypes(),
    ])
    products.value = productList
    documentTypes.value = docTypes
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar los filtros. Inténtalo de nuevo.'))
  }
  // Terceros para el selector; si fallan, el combobox queda como texto libre.
  try {
    const [sup, cust] = await Promise.all([
      billingService.getSuppliers(),
      billingService.getCustomers().catch(() => [] as Customer[]),
    ])
    suppliers.value = sup
    customers.value = cust
  } catch {
    // sin terceros el movimiento se registra escribiendo el nombre a mano
  }
  await load()
})
</script>
