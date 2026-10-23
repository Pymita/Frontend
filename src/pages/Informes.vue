<template>
  <v-container fluid>
    <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-2">
      <div>
        <h1 class="text-h4">Informes</h1>
        <p class="text-body-1 text-medium-emphasis">Elige qué quieres saber, filtra, agrupa y escoge las columnas</p>
      </div>
      <!-- El tooltip va sobre un span: un botón deshabilitado no emite eventos de mouse. -->
      <v-tooltip v-if="definition" location="bottom" max-width="300" :text="downloadHint">
        <template #activator="{ props: tooltip }">
          <span v-bind="tooltip" class="d-inline-flex">
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-microsoft-excel"
              :loading="downloading"
              :disabled="!canDownload"
              @click="downloadExcel"
            >
              Descargar Excel
            </v-btn>
          </span>
        </template>
      </v-tooltip>
    </div>

    <v-alert v-if="catalogError" type="error" variant="tonal" density="compact">
      <div class="d-flex align-center flex-wrap ga-3">
        <span>{{ catalogError }}</span>
        <v-spacer />
        <v-btn variant="text" @click="loadCatalog">Reintentar</v-btn>
      </div>
    </v-alert>
    <div v-else-if="loadingCatalog" class="d-flex justify-center py-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-alert v-else-if="!definition" type="info" variant="tonal" density="compact">
      Ningún informe aplica a los módulos de tu negocio o a tus permisos. Pídele al administrador que te habilite el
      módulo que quieres consultar.
    </v-alert>

    <template v-else>
      <v-row dense>
        <v-col cols="12" md="5">
          <v-select
            v-model="reportKey"
            :items="reportItems"
            label="Informe"
            density="compact"
            :hint="definition.question"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" sm="8" md="4">
          <v-select
            v-model="groupBy"
            :items="groupOptions"
            label="Agrupar por"
            placeholder="Sin agrupar"
            density="compact"
            multiple
            chips
            closable-chips
            clearable
            :hint="`Hasta ${definition.group_by.max}`"
            persistent-hint
          />
        </v-col>
        <v-col cols="12" sm="4" md="3">
          <v-menu v-model="columnsMenu" :close-on-content-click="false" location="bottom end">
            <template #activator="{ props: menu }">
              <v-btn v-bind="menu" variant="tonal" color="secondary" prepend-icon="mdi-view-column-outline" block>
                Columnas ({{ tableColumns.length }})
              </v-btn>
            </template>
            <v-card min-width="280" max-width="360">
              <v-card-text class="pa-2">
                <div class="text-caption text-medium-emphasis px-2 pb-1">
                  Lo que agrupas siempre se muestra.
                  <template v-if="hiddenColumns">Agrupa de otra forma para ver más columnas.</template>
                </div>
                <div class="columns-list">
                  <v-checkbox
                    v-for="column in offeredColumns"
                    :key="column.key"
                    :model-value="isShown(column.key)"
                    :disabled="isLocked(column.key)"
                    :label="column.label"
                    color="primary"
                    density="compact"
                    hide-details
                    @update:model-value="toggleColumn(column.key, !!$event)"
                  />
                </div>
              </v-card-text>
              <v-divider />
              <v-card-actions>
                <v-btn variant="text" color="primary" prepend-icon="mdi-restore" @click="resetColumns">
                  Restablecer columnas
                </v-btn>
              </v-card-actions>
            </v-card>
          </v-menu>
        </v-col>
      </v-row>

      <v-row dense class="mt-2">
        <template v-if="definition.period.type === 'range'">
          <v-col cols="6" sm="3" md="2">
            <DateField v-model="period.from" label="Desde" density="compact" hide-details @update:model-value="periodEdited = true" />
          </v-col>
          <v-col cols="6" sm="3" md="2">
            <DateField v-model="period.to" label="Hasta" density="compact" hide-details @update:model-value="periodEdited = true" />
          </v-col>
        </template>
        <v-col v-else-if="definition.period.type === 'cut'" cols="12" sm="6" md="2">
          <DateField v-model="period.cut" label="Saldo al" density="compact" hide-details />
        </v-col>

        <v-col
          v-for="filter in definition.filters"
          :key="filter.key"
          :cols="filter.type === 'boolean' ? 'auto' : 12"
          :sm="filter.type === 'boolean' ? 'auto' : 6"
          :md="filter.type === 'boolean' ? 'auto' : 3"
          :lg="filterWidth(filter)"
        >
          <v-autocomplete
            v-if="filter.type === 'select' || filter.type === 'multiselect'"
            v-model="filterValues[filter.key]"
            :items="filterOptions(filter)"
            :label="filter.label"
            :multiple="filter.type === 'multiselect'"
            :chips="filter.type === 'multiselect'"
            :closable-chips="filter.type === 'multiselect'"
            density="compact"
            hide-details
            :clearable="filter.default === undefined || filter.default === null"
          />
          <v-checkbox
            v-else-if="filter.type === 'boolean'"
            v-model="filterValues[filter.key]"
            :label="filter.label"
            color="primary"
            density="compact"
            hide-details
          />
          <DateField
            v-else-if="filter.type === 'date'"
            :model-value="filterValues[filter.key] as string | null"
            :label="filter.label"
            density="compact"
            hide-details
            @update:model-value="filterValues[filter.key] = $event"
          />
          <v-text-field
            v-else
            v-model="filterValues[filter.key]"
            :label="filter.label"
            density="compact"
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
          />
        </v-col>
      </v-row>

      <v-alert v-if="reportError" type="error" variant="tonal" density="compact" class="mt-3">{{ reportError }}</v-alert>

      <v-alert v-if="notes.length" type="info" variant="tonal" density="compact" class="mt-3">
        <div v-for="note in notes" :key="note">{{ note }}</div>
      </v-alert>

      <v-card v-if="!reportError" class="mt-3">
        <v-data-table-server
          v-model:page="page"
          v-model:items-per-page="perPage"
          v-model:sort-by="sortBy"
          :headers="headers"
          :items="rows"
          :items-length="total"
          :items-per-page-options="PAGE_SIZE_OPTIONS"
          :item-value="rowKey"
          :loading="loading"
          density="comfortable"
          class="elevation-0"
        >
          <template v-for="column in tableColumns" #[`item.${column.key}`]="{ item }">
            <v-chip
              v-if="stateColor(column, item[column.key])"
              size="small"
              variant="tonal"
              :color="stateColor(column, item[column.key])"
            >
              {{ cell(column, item[column.key]) }}
            </v-chip>
            <span v-else :class="cellClass(column, item[column.key])">{{ cell(column, item[column.key]) }}</span>
          </template>

          <template #tfoot>
            <tfoot v-if="rows.length">
              <tr class="font-weight-bold bg-surface-light">
                <td
                  v-for="(column, index) in tableColumns"
                  :key="column.key"
                  :class="[isNumeric(column) ? 'text-end' : '', ...cellClass(column, totals[column.key])]"
                >
                  {{ totalCell(column, index) }}
                </td>
              </tr>
            </tfoot>
          </template>

          <template #no-data>
            <p class="text-medium-emphasis py-6">No hay datos con estos filtros.</p>
          </template>
        </v-data-table-server>
      </v-card>
    </template>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import DateField from '../components/DateField.vue'
import { PAGE_SIZE_OPTIONS, useServerPage } from '@/composables/useServerPage'
import reportsService, {
  type ReportCatalog,
  type ReportColumn,
  type ReportDefinition,
  type ReportFilter,
  type ReportFilterValue,
  type ReportPage,
  type ReportRequest,
  type ReportRow,
} from '@/services/reportsService'
import { useAuthStore } from '@/stores/auth'
import type { PageQuery } from '@/types/api'
import { formatDay, formatIsoMonth, toIsoDate, todayIso } from '@/utils/dates'
import { errorMessage } from '@/utils/errors'
import { enumColors, enumLabels, label, options } from '@/utils/labels'
import { money, percent, preciseMoney, quantity } from '@/utils/money'

const authStore = useAuthStore()

const catalog = ref<ReportCatalog>({ reports: [], areas: [] })
const loadingCatalog = ref(true)
const catalogError = ref('')

const reportKey = ref('')
const definition = computed(() => catalog.value.reports.find(report => report.key === reportKey.value) ?? null)

const period = reactive({ from: todayIso(), to: todayIso(), cut: todayIso() })
// Dates the user typed stay when another report is picked (the same period is usually what is
// compared); until then each report opens on its own default.
const periodEdited = ref(false)
const firstOfMonth = (): string => {
  const now = new Date()
  return toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1))
}
const filterValues = ref<Record<string, ReportFilterValue>>({})
const groupBy = ref<string[]>([])
/** The columns the user checked; the grouping's dimensions show whether checked or not. */
const chosenColumns = ref<string[]>([])
const columnsMenu = ref(false)

const reportItems = computed(() => {
  const { reports, areas } = catalog.value
  const item = (report: ReportDefinition) => ({
    title: report.title,
    value: report.key,
    props: { subtitle: report.question, lines: 'two' as const },
  })
  const known = new Set(areas.map(area => area.key))
  return [
    ...areas.flatMap(area => {
      const own = reports.filter(report => report.area === area.key)
      return own.length ? [{ type: 'subheader' as const, title: area.title }, ...own.map(item)] : []
    }),
    ...reports.filter(report => !known.has(report.area)).map(item),
  ]
})

const groupOptions = computed(() => {
  const report = definition.value
  if (!report) return []
  return report.columns
    .filter(column => column.dimension)
    .map(column => ({
      title: column.label,
      value: column.key,
      props: { disabled: groupBy.value.length >= report.group_by.max && !groupBy.value.includes(column.key) },
    }))
})

const isLocked = (key: string): boolean => groupBy.value.includes(key)
const isShown = (key: string): boolean => isLocked(key) || chosenColumns.value.includes(key)

/**
 * Whether a column has a value under the grouping (ReportRequest::carries in
 * the API): another dimension does not, and an attribute (the SKU) only while
 * what it describes (the product) is grouped.
 */
const carries = (column: ReportColumn): boolean => {
  if (isLocked(column.key)) return true
  if (column.attribute_of) return column.attribute_of.some(key => isLocked(key))
  return !column.dimension
}

/** The menu offers what has a value: the other dimensions are chosen in "Agrupar por". */
const offeredColumns = computed(() => definition.value?.columns.filter(carries) ?? [])
const hiddenColumns = computed(() => (definition.value?.columns.length ?? 0) - offeredColumns.value.length)

const toggleColumn = (key: string, on: boolean) => {
  const others = chosenColumns.value.filter(chosen => chosen !== key)
  chosenColumns.value = on ? [...others, key] : others
}

const defaultColumns = (report: ReportDefinition): string[] =>
  report.columns.filter(column => column.default).map(column => column.key)

const resetColumns = () => {
  if (definition.value) chosenColumns.value = defaultColumns(definition.value)
}

/**
 * What is asked for: the grouping first, in its order, then the checked
 * columns that have a value under it, in the report's order. A checked SKU
 * stays checked while grouping by category and comes back with the product.
 */
const requestedColumns = computed((): ReportColumn[] => {
  const report = definition.value
  if (!report) return []
  const byKey = new Map(report.columns.map(column => [column.key, column]))
  const grouped = groupBy.value.map(key => byKey.get(key)).filter((column): column is ReportColumn => !!column)
  const chosen = report.columns.filter(column => !isLocked(column.key) && carries(column) && chosenColumns.value.includes(column.key))
  return [...grouped, ...chosen]
})

// --- What each user chose, per report: localStorage `pos.reports`, keyed by user id ---
const STORAGE_KEY = 'pos.reports'

interface ReportChoice {
  columns?: unknown
  group_by?: unknown
}
type UserChoices = { last?: string } & Record<string, ReportChoice | string | undefined>

const readStored = (): Record<string, UserChoices> => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}
  } catch {
    // Not JSON (edited by hand, an older format): every report starts from its defaults.
    return {}
  }
}

const readChoices = (): UserChoices => {
  const userId = authStore.user?.id
  const mine = userId ? readStored()[userId] : undefined
  return mine && typeof mine === 'object' ? mine : {}
}

const saveChoices = () => {
  const userId = authStore.user?.id
  const report = definition.value
  if (!userId || !report) return
  const stored = readStored()
  stored[userId] = {
    ...readChoices(),
    last: report.key,
    [report.key]: { columns: chosenColumns.value, group_by: groupBy.value },
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

const knownKeys = (value: unknown, allowed: Set<string>): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string' && allowed.has(key)))] : []

/** A remembered choice keeps only what the report still has; nothing left means its defaults. */
const rememberedChoice = (report: ReportDefinition): { columns: string[]; group_by: string[] } => {
  const saved = readChoices()[report.key]
  const choice: ReportChoice = saved && typeof saved === 'object' ? saved : {}
  const columnKeys = new Set(report.columns.map(column => column.key))
  const dimensionKeys = new Set(report.columns.filter(column => column.dimension).map(column => column.key))
  const columns = knownKeys(choice.columns, columnKeys)
  const grouping = knownKeys(choice.group_by, dimensionKeys).slice(0, report.group_by.max)
  return {
    columns: columns.length ? columns : defaultColumns(report),
    group_by: grouping.length ? grouping : report.group_by.default.filter(key => dimensionKeys.has(key)),
  }
}

const startValue = (filter: ReportFilter): ReportFilterValue => {
  if (filter.default !== undefined && filter.default !== null) return filter.default
  if (filter.type === 'multiselect') return []
  if (filter.type === 'boolean') return false
  return null
}

// Two columns of twelve fit "Vendedor" but cut "Método de pago" short.
const filterWidth = (filter: ReportFilter): string | number => {
  if (filter.type === 'boolean') return 'auto'
  return filter.type === 'multiselect' || filter.label.length > 10 ? 3 : 2
}

const filterOptions = (filter: ReportFilter) => {
  if (filter.options) return filter.options
  const labels = filter.enum ? enumLabels[filter.enum] : undefined
  return labels ? options(labels) : []
}

// --- The report's page ---
/** The report whose remembered columns, grouping and filters are in place: asking before would ask for nothing. */
const readyFor = ref('')

const request = computed((): ReportRequest | null => {
  const report = definition.value
  if (!report || readyFor.value !== report.key) return null
  const dates =
    report.period.type === 'range'
      ? { from: period.from, to: period.to }
      : report.period.type === 'cut'
        ? { cut: period.cut }
        : {}
  return {
    report: report.key,
    ...dates,
    group_by: [...groupBy.value],
    columns: requestedColumns.value.map(column => column.key),
    filters: { ...filterValues.value },
  }
})

// Typing a filter waits a moment instead of asking on every key; another report is asked at once.
const requested = ref<ReportRequest | null>(null)
let requestTimer: ReturnType<typeof setTimeout> | undefined
watch(
  request,
  value => {
    clearTimeout(requestTimer)
    if (!value) return
    if (value.report !== requested.value?.report) {
      requested.value = value
    } else {
      requestTimer = setTimeout(() => { requested.value = value }, 300)
    }
  },
  { deep: true },
)

const applied = ref<ReportPage['report'] | null>(null)
const totals = ref<ReportRow>({})
const reportError = ref('')
let latestPage = 0

const fetchPage = async (query: PageQuery): Promise<ReportPage> => {
  const current = requested.value
  if (!current) throw new Error('No report chosen yet')
  const pageRequest = ++latestPage
  const result = await reportsService.page(current, query)
  if (pageRequest === latestPage) {
    applied.value = result.report
    totals.value = result.totals ?? {}
    reportError.value = ''
  }
  return result
}

const { items: rows, total, page, perPage, sortBy, loading } = useServerPage<ReportRow>(fetchPage, {
  filters: [requested],
  onError: error => {
    if (!requested.value) return
    // Near the filters, where the user fixes it (a range too long, a module off).
    reportError.value = errorMessage(error, 'No fue posible generar el informe. Inténtalo de nuevo.')
    rows.value = []
    total.value = 0
    totals.value = {}
  },
})

// Picking a report (or opening the page) brings its remembered columns and grouping; its filters start over.
watch(definition, (report, previous) => {
  if (!report || report.key === previous?.key) return
  const choice = rememberedChoice(report)
  chosenColumns.value = choice.columns
  groupBy.value = choice.group_by
  if (!periodEdited.value && report.period.type === 'range') {
    period.from = report.period.default === 'month' ? firstOfMonth() : todayIso()
    period.to = todayIso()
  }
  filterValues.value = Object.fromEntries(report.filters.map(filter => [filter.key, startValue(filter)]))
  if (sortBy.value.length) sortBy.value = []
  rows.value = []
  total.value = 0
  applied.value = null
  totals.value = {}
  reportError.value = ''
  readyFor.value = report.key
})

watch([chosenColumns, groupBy], saveChoices, { deep: true })

// A column taken off cannot stay as the order: the API sorts only by the columns it returns.
watch(requestedColumns, columns => {
  const sorted = sortBy.value[0]?.key
  if (sorted && !columns.some(column => column.key === sorted)) sortBy.value = []
})

/** What came back, read with its definition (enum, sign); before the first answer, what was asked. */
const tableColumns = computed((): ReportColumn[] => {
  const report = definition.value
  if (!report) return []
  if (!applied.value || applied.value.key !== report.key) return requestedColumns.value
  return applied.value.columns.map(column => ({
    ...column,
    ...report.columns.find(known => known.key === column.key),
  }))
})

const NUMERIC_TYPES = new Set(['integer', 'quantity', 'money', 'percent'])
const isNumeric = (column: ReportColumn): boolean => NUMERIC_TYPES.has(column.type)
// On a phone "23 de oct de 2026" took three lines per row: figures and dates scroll sideways instead.
const keepsOneLine = (column: ReportColumn): boolean => isNumeric(column) || ['date', 'week', 'month', 'hour'].includes(column.type)

const headers = computed(() =>
  tableColumns.value.map(column => ({
    title: column.label,
    key: column.key,
    align: isNumeric(column) ? ('end' as const) : ('start' as const),
    nowrap: keepsOneLine(column),
  })),
)

const notes = computed(() => applied.value?.notes ?? definition.value?.notes ?? [])

const rowKey = (row: ReportRow): string => JSON.stringify(row)

type CellValue = ReportRow[string] | undefined

// The API types every amount as money, but a unit cost carries cents ("$3,45" a gram), as in Kardex.
const UNIT_COSTS = new Set(['average_cost', 'average_unit_cost', 'closing_average', 'last_purchase_cost'])

const cell = (column: ReportColumn, value: CellValue): string => {
  // A document has no payment method or table: the Excel writes the same words.
  if (value === null || value === undefined || value === '') return column.enum && column.dimension ? 'Sin asignar' : '—'
  switch (column.type) {
    case 'money':
      return UNIT_COSTS.has(column.key) ? preciseMoney(Number(value)) : money(Number(value))
    case 'quantity':
    case 'integer':
      return quantity(Number(value))
    case 'percent':
      return percent(Number(value))
    case 'date':
      return formatDay(String(value))
    case 'week':
      return `Semana del ${formatDay(String(value))}`
    case 'month':
      return formatIsoMonth(String(value))
    case 'hour':
      return `${String(value).padStart(2, '0')}:00`
    case 'enum': {
      const labels = column.enum ? enumLabels[column.enum] : undefined
      return labels ? label(labels, String(value)) : String(value)
    }
    default:
      return String(value)
  }
}

const stateColor = (column: ReportColumn, value: CellValue): string | undefined =>
  column.type === 'enum' && column.enum && value !== null && value !== undefined
    ? enumColors[column.enum]?.[String(value)]
    : undefined

// Green and red only for figures with a sign: a profit or a margin can be a loss.
const SIGNED_FIGURES = new Set(['estimated_profit', 'margin'])

const cellClass = (column: ReportColumn, value: CellValue): string[] => {
  const classes = keepsOneLine(column) ? ['text-no-wrap'] : []
  const amount = Number(value)
  if (SIGNED_FIGURES.has(column.key) && value !== null && Number.isFinite(amount) && amount !== 0) {
    classes.push(amount > 0 ? 'text-success' : 'text-error')
  }
  return classes
}

const totalCell = (column: ReportColumn, index: number): string => {
  const value = totals.value[column.key]
  const hasValue = value !== null && value !== undefined && value !== ''
  if (index === 0) return hasValue ? `Total: ${cell(column, value)}` : 'Total'
  return hasValue ? cell(column, value) : ''
}

// --- Excel ---
const downloading = ref(false)
const canDownload = computed(() => total.value > 0 && !reportError.value)
const downloadHint = computed(() =>
  canDownload.value
    ? 'Descarga el informe con los filtros, la agrupación y las columnas de arriba'
    : 'No hay datos con estos filtros para descargar',
)

const downloadExcel = async () => {
  if (!requested.value) return
  downloading.value = true
  try {
    await reportsService.download(requested.value)
  } catch (error) {
    reportError.value = errorMessage(error, 'No fue posible descargar el Excel. Inténtalo de nuevo.')
  } finally {
    downloading.value = false
  }
}

// --- Catalog ---
const loadCatalog = async () => {
  loadingCatalog.value = true
  catalogError.value = ''
  try {
    catalog.value = await reportsService.definitions()
    const last = readChoices().last
    const keys = catalog.value.reports.map(report => report.key)
    reportKey.value = last && keys.includes(last) ? last : (keys[0] ?? '')
  } catch (error) {
    catalogError.value = errorMessage(error, 'No fue posible cargar los informes. Inténtalo de nuevo.')
  } finally {
    loadingCatalog.value = false
  }
}

onMounted(loadCatalog)
</script>

<style scoped>
.columns-list {
  max-height: 360px;
  overflow-y: auto;
}
</style>
