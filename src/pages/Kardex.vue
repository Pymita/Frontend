<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Kardex</h1>
            <p class="text-body-1 text-grey-darken-1">
              Movimientos de inventario con costos y saldos (promedio ponderado)
            </p>
          </div>
          <div class="d-flex ga-2">
            <LockableButton icon="mdi-plus" color="primary" size="large" @click="openMovementDialog">
              Registrar Movimiento
            </LockableButton>
            <v-btn
              color="success"
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

    <!-- Movimiento manual: devolución de ventas, compra suelta, etc.
         Los documentos automáticos (SI, FV, NC) no aparecen: esos los
         genera el sistema con las ventas y los saldos iniciales. -->
    <v-dialog v-model="movementDialog" max-width="560" persistent>
      <v-card>
        <v-card-title>Registrar Movimiento de Inventario</v-card-title>
        <v-card-text>
          <v-autocomplete
            v-model="movementForm.product_id"
            :items="products"
            item-title="name"
            item-value="id"
            label="Producto *"
            class="mb-2"
          />
          <v-row dense>
            <v-col cols="7">
              <v-select
                v-model="movementForm.document_type_id"
                :items="manualDocumentTypes"
                :item-title="(t: any) => `${t.code} — ${t.name}`"
                item-value="id"
                label="Tipo de documento *"
              />
            </v-col>
            <v-col cols="5">
              <v-select
                v-model="movementForm.movement_type"
                :items="movementTypeOptions"
                label="Dirección *"
                :disabled="movementTypeOptions.length === 1"
              />
            </v-col>
          </v-row>
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="movementForm.quantity"
                label="Cantidad *"
                type="number"
                min="0"
                step="0.01"
              />
            </v-col>
            <v-col v-if="movementForm.movement_type === 'in'" cols="6">
              <v-text-field
                v-model.number="movementForm.unit_cost"
                label="Costo unitario"
                type="number"
                min="0"
                prefix="$"
                hint="Vacío: entra al costo promedio actual"
                persistent-hint
              />
            </v-col>
          </v-row>
          <v-text-field
            v-model="movementForm.reference"
            label="Referencia"
            hint="Ej: la factura POS-105 que se devuelve"
            persistent-hint
            class="mb-2"
          />
          <v-textarea
            v-model="movementForm.notes"
            label="Motivo *"
            hint="Queda registrado en el kardex junto al movimiento"
            persistent-hint
            rows="2"
          />
        </v-card-text>
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
              <v-text-field v-model="filters.from" label="Desde" type="date" hide-details />
            </v-col>
            <v-col cols="6" md="2">
              <v-text-field v-model="filters.to" label="Hasta" type="date" hide-details />
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
          <div class="text-caption text-grey">Existencia actual</div>
          <div class="text-h5">{{ report.product.current_stock }} {{ report.product.unit }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Costo promedio</div>
          <div class="text-h5">{{ money(report.product.unit_cost) }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-grey">Valor del inventario</div>
          <div class="text-h5">{{ money(report.product.current_stock * report.product.unit_cost) }}</div>
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
              <tr v-if="report?.opening_balance" class="bg-grey-lighten-4 font-weight-medium">
                <td>{{ loadedFilters.from }}</td>
                <td>—</td>
                <td>SALDO ANTERIOR</td>
                <td v-if="showProductColumn"></td>
                <td colspan="4"></td>
                <td class="text-right">{{ report.opening_balance.quantity }}</td>
                <td class="text-right">{{ money(report.opening_balance.unit_cost) }}</td>
                <td class="text-right">{{ money(report.opening_balance.total_cost) }}</td>
                <td></td>
              </tr>
              <tr v-for="m in report?.movements ?? []" :key="m.id">
                <td>{{ formatDate(m.moved_at) }}</td>
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
                <td>{{ m.reference || '—' }}</td>
                <td v-if="showProductColumn">{{ m.product.name }}</td>
                <td class="text-right text-success">
                  {{ m.movement_type === 'in' ? m.quantity : '' }}
                </td>
                <td class="text-right text-error">
                  {{ m.movement_type === 'out' ? m.quantity : '' }}
                </td>
                <td class="text-right">{{ money(m.unit_cost) }}</td>
                <td class="text-right">{{ money(m.total_cost) }}</td>
                <td class="text-right">{{ m.balance_quantity }}</td>
                <td class="text-right">{{ money(m.balance_unit_cost) }}</td>
                <td class="text-right">{{ money(m.balance_total_cost) }}</td>
                <td class="text-caption">{{ m.user || '—' }}</td>
              </tr>
              <tr v-if="report && report.movements.length === 0">
                <td colspan="12" class="text-center text-grey py-6">
                  No hay movimientos con los filtros seleccionados
                </td>
              </tr>
            </tbody>
            <tfoot v-if="report && report.movements.length > 0">
              <tr class="font-weight-bold bg-grey-lighten-4">
                <td :colspan="showProductColumn ? 4 : 3">Totales del periodo</td>
                <td class="text-right text-success">{{ report.totals.in_quantity }}</td>
                <td class="text-right text-error">{{ report.totals.out_quantity }}</td>
                <td></td>
                <td class="text-right">
                  {{ money(report.totals.in_cost - report.totals.out_cost) }}
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
import { computed, onMounted, ref, watch } from 'vue'
import kardexService, { type DocumentType, type KardexFilters, type KardexReport } from '../services/kardexService'
import { productsService } from '../services/productsService'
import LockableButton from '../components/LockableButton.vue'

// Documentos que el sistema genera solo: no se pueden registrar a mano.
const AUTOMATIC_CODES = ['SI', 'FV', 'NC']

const movementDialog = ref(false)
const savingMovement = ref(false)
const movementForm = ref({
  product_id: null as number | null,
  document_type_id: null as number | null,
  movement_type: 'in' as 'in' | 'out',
  quantity: 0,
  unit_cost: null as number | null,
  reference: '',
  notes: '',
})

const loading = ref(false)
const exporting = ref(false)
const report = ref<KardexReport | null>(null)
const products = ref<{ id: number; name: string }[]>([])
const documentTypes = ref<DocumentType[]>([])

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

const openMovementDialog = () => {
  movementForm.value = {
    // Con un producto ya filtrado, el movimiento seguramente es para él.
    product_id: filters.value.product_id ?? null,
    document_type_id: null,
    movement_type: 'in',
    quantity: 0,
    unit_cost: null,
    reference: '',
    notes: '',
  }
  movementDialog.value = true
}

const saveMovement = async () => {
  const form = movementForm.value
  if (!form.product_id || !form.document_type_id || !form.quantity || form.quantity <= 0 || !form.notes.trim()) {
    notify('Completa producto, documento, cantidad y motivo')
    return
  }
  savingMovement.value = true
  try {
    await kardexService.createKardexMovement({
      product_id: form.product_id,
      document_type_id: form.document_type_id,
      movement_type: form.movement_type,
      quantity: form.quantity,
      unit_cost: form.movement_type === 'in' ? form.unit_cost : undefined,
      reference: form.reference.trim() || undefined,
      notes: form.notes.trim(),
    })
    notify('Movimiento registrado en el kardex', 'success')
    movementDialog.value = false
    load()
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al registrar el movimiento')
  } finally {
    savingMovement.value = false
  }
}

const notify = (text: string, color = 'error') => {
  snackbar.value = { show: true, text, color }
}

const money = (value: number): string =>
  '$' + Number(value ?? 0).toLocaleString('es-CO', { maximumFractionDigits: 2 })

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const load = async () => {
  loading.value = true
  const applied = { ...filters.value }
  try {
    report.value = await kardexService.report(applied)
    loadedFilters.value = applied
  } catch (error: any) {
    notify(error.response?.data?.message || 'Error al cargar el kardex')
  } finally {
    loading.value = false
  }
}

const exportExcel = async () => {
  exporting.value = true
  try {
    await kardexService.export(filters.value)
  } catch {
    notify('Error al exportar el kardex')
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
  } catch {
    notify('Error al cargar los filtros')
  }
  await load()
})
</script>
