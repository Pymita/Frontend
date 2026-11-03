<template>
  <!-- Importar clientes desde Excel: se revisa primero y se crean las filas válidas -->
  <v-dialog :model-value="modelValue" max-width="960" scrollable @update:model-value="close">
    <v-card>
      <v-card-title class="bg-primary">
        <v-icon start>mdi-microsoft-excel</v-icon>
        Importar clientes desde Excel
      </v-card-title>
      <v-card-text class="pt-4">
        <p class="text-body-2 mb-3">
          Sube un Excel con una fila por cliente.
          <template v-if="withFee">
            Si la fila trae la cuota mensual, el cliente queda listo para la facturación automática; si no, se crea solo
            el cliente.
          </template>
        </p>
        <div class="d-flex align-center flex-wrap ga-2 mb-4">
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-download" :loading="downloadingTemplate" @click="downloadTemplate">
            Descargar plantilla
          </v-btn>
          <span class="text-caption text-medium-emphasis">
            Trae los encabezados, una fila de ejemplo y una hoja con estas instrucciones.
          </span>
        </div>

        <v-expansion-panels v-model="tutorialOpen" multiple class="mb-4">
          <v-expansion-panel value="tutorial">
            <v-expansion-panel-title>Cómo armar el archivo: columnas y ejemplo</v-expansion-panel-title>
            <v-expansion-panel-text>
              <p class="text-body-2 text-medium-emphasis mb-3">
                La primera fila lleva los nombres de las columnas. La columna Ejemplo es una fila completa de muestra.
              </p>
              <v-data-table
                :headers="columnHeaders"
                :items="format?.columns ?? []"
                item-value="key"
                density="compact"
                :items-per-page="-1"
                disable-sort
                hide-default-footer
                mobile-breakpoint="sm"
                :hide-default-header="xs"
                class="mb-3 border rounded">
                <template #item.label="{ item }">
                  <span class="font-weight-bold text-no-wrap">{{ item.label }}</span>
                </template>
                <template #item.required="{ item }">
                  <v-chip :color="item.required ? 'error' : 'secondary'" size="x-small" variant="flat">
                    {{ item.required ? 'Obligatoria' : 'Opcional' }}
                  </v-chip>
                </template>
                <template #item.help="{ item }">
                  <span class="text-body-2">{{ item.help }}</span>
                </template>
                <template #item.example="{ item }">
                  <span class="text-body-2 text-medium-emphasis">{{ item.example }}</span>
                </template>
              </v-data-table>
              <ul class="text-body-2 text-medium-emphasis pl-4">
                <li v-for="note in format?.notes ?? []" :key="note">{{ note }}</li>
              </ul>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

        <v-file-input
          v-model="file"
          label="Archivo de clientes (.xlsx o .csv)"
          accept=".xlsx,.csv"
          prepend-icon="mdi-paperclip"
          density="comfortable"
          show-size
          :disabled="importing" />

        <v-alert v-if="error" type="error" variant="tonal" class="mt-2">
          {{ error }}
          <ul v-if="fileErrors.length > 1" class="pl-4 mt-1">
            <li v-for="item in fileErrors" :key="item">{{ item }}</li>
          </ul>
        </v-alert>

        <template v-if="result">
          <v-alert
            :type="result.dry_run ? 'info' : result.summary.errors ? 'warning' : 'success'"
            variant="tonal"
            class="mt-2 mb-3">
            <div class="font-weight-medium">{{ message }}</div>
            <div v-if="result.dry_run" class="text-body-2">
              Todavía no se creó ningún cliente: revisa las filas y confirma.
            </div>
            <div v-else-if="result.summary.errors" class="text-body-2">
              Corrige las filas con error y vuelve a subir el archivo: las que ya entraron se saltan.
            </div>
          </v-alert>
          <v-alert v-if="ignoredFeeColumns.length" type="info" variant="tonal" density="compact" class="mb-3">
            Tu negocio no tiene facturación automática: no usamos las columnas de la cuota
            ({{ ignoredFeeColumns.join(', ') }}). Los clientes se crean sin cuota.
          </v-alert>
          <v-alert v-if="unknownColumns.length" type="warning" variant="tonal" density="compact" class="mb-3">
            No usamos estas columnas porque no las reconocimos: {{ unknownColumns.join(', ') }}.
            Si debían importarse, cámbiales el nombre como dice la tabla de columnas.
          </v-alert>
          <v-data-table
            :headers="rowHeaders"
            :items="result.rows"
            item-value="fila"
            density="compact"
            :items-per-page="10"
            disable-sort
            mobile-breakpoint="sm"
            :hide-default-header="xs"
            class="border rounded">
            <template #item.name="{ item }">
              <div class="font-weight-medium">{{ item.name || 'Sin nombre' }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.document_number || 'Sin documento' }}</div>
            </template>
            <template #item.monthly_fee="{ item }">
              <span class="tabular-nums">{{ item.monthly_fee === null ? '—' : money(item.monthly_fee) }}</span>
            </template>
            <template #item.status="{ item }">
              <v-chip size="small" variant="tonal" :color="customerImportStatusColors[item.status]">
                {{ label(customerImportStatusLabels, item.status) }}
              </v-chip>
            </template>
            <template #item.message="{ item }">
              <span class="text-body-2">{{ item.message ?? '' }}</span>
            </template>
          </v-data-table>
        </template>
      </v-card-text>
      <v-card-actions>
        <v-btn :disabled="importing" @click="close(false)">Cerrar</v-btn>
        <v-spacer />
        <LockableButton
          v-if="!result"
          color="primary"
          icon="mdi-file-search"
          :loading="importing"
          :disabled="!file"
          @click="run(true)">
          Revisar archivo
        </LockableButton>
        <LockableButton
          v-else-if="result.dry_run"
          color="primary"
          icon="mdi-upload"
          :loading="importing"
          :disabled="result.summary.valid === 0"
          @click="run(false)">
          {{ importButtonLabel }}
        </LockableButton>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * The one "Importar clientes desde Excel" dialog, opened from Clientes and
 * from Facturación automática › Clientes: the API decides the columns (the
 * monthly fee only for a company with automatic billing), so both pages
 * read the same tutorial, template and review.
 */
import { computed, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import LockableButton from './LockableButton.vue'
import { billingService, type CustomerImportFormat, type CustomerImportResult } from '../services/billingService'
import { errorMessage } from '../utils/errors'
import { customerImportStatusColors, customerImportStatusLabels, label } from '../utils/labels'
import { money } from '../utils/money'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Customers were created; `message` is the API's summary. */
  imported: [message: string]
}>()

const format = ref<CustomerImportFormat | null>(null)
const file = ref<File | File[] | null>(null)
const result = ref<CustomerImportResult | null>(null)
const message = ref('')
const error = ref('')
const fileErrors = ref<string[]>([])
const importing = ref(false)
const downloadingTemplate = ref(false)
const tutorialOpen = ref<string[]>(['tutorial'])

// En el teléfono cada fila se apila con sus propias etiquetas: el encabezado sobra.
const { xs } = useDisplay()

const withFee = computed(() => format.value?.with_fee ?? false)

const columnHeaders = [
  { title: 'Columna', key: 'label' },
  { title: '¿Obligatoria?', key: 'required' },
  { title: 'Qué va ahí', key: 'help' },
  { title: 'Ejemplo', key: 'example' },
]

const rowHeaders = computed(() => [
  { title: 'Fila', key: 'fila' },
  { title: 'Cliente', key: 'name' },
  ...(withFee.value ? [{ title: 'Cuota', key: 'monthly_fee', align: 'end' as const }] : []),
  { title: 'Estado', key: 'status' },
  { title: 'Detalle', key: 'message', sortable: false },
])

const ignoredFeeColumns = computed(() => result.value?.ignored_fee_columns ?? [])
const unknownColumns = computed(() =>
  (result.value?.ignored_columns ?? []).filter(column => !ignoredFeeColumns.value.includes(column)),
)

const importButtonLabel = computed(() => {
  const valid = result.value?.summary.valid ?? 0
  if (valid === 0) return 'Importar clientes'
  return valid === 1 ? 'Importar 1 cliente' : `Importar ${valid} clientes`
})

const clearResult = () => {
  result.value = null
  message.value = ''
  error.value = ''
  fileErrors.value = []
}

// Otro archivo es otra revisión.
watch(file, clearResult)

watch(
  () => props.modelValue,
  async open => {
    if (!open) return
    file.value = null
    clearResult()
    tutorialOpen.value = ['tutorial']
    if (format.value) return
    try {
      format.value = await billingService.getCustomerImportFormat()
    } catch (failure) {
      error.value = errorMessage(failure, 'No fue posible cargar las instrucciones. Inténtalo de nuevo.')
    }
  },
)

const close = (value: boolean) => emit('update:modelValue', value)

const downloadTemplate = async () => {
  downloadingTemplate.value = true
  try {
    await billingService.downloadCustomerImportTemplate()
  } catch (failure) {
    error.value = errorMessage(failure, 'No fue posible descargar la plantilla. Inténtalo de nuevo.')
  } finally {
    downloadingTemplate.value = false
  }
}

/** v-file-input devuelve File o File[] según la versión. */
const chosenFile = (): File | null => {
  const value = file.value
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const run = async (dryRun: boolean) => {
  const chosen = chosenFile()
  if (!chosen) return
  importing.value = true
  error.value = ''
  fileErrors.value = []
  try {
    const { data, message: summary } = await billingService.importCustomers(chosen, dryRun)
    result.value = data
    message.value = summary
    tutorialOpen.value = []
    if (!dryRun) emit('imported', summary)
  } catch (failure: any) {
    error.value = errorMessage(
      failure,
      dryRun ? 'No fue posible revisar el archivo. Inténtalo de nuevo.' : 'No fue posible importar los clientes. Inténtalo de nuevo.',
    )
    fileErrors.value = (failure?.response?.data?.data?.errors ?? []).map((item: { error: string }) => item.error)
  } finally {
    importing.value = false
  }
}
</script>
