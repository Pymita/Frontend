<template>
  <v-container fluid>
    <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-2">
      <div>
        <h1 class="text-h4">Informes</h1>
        <p class="text-body-1 text-medium-emphasis">Elige qué quieres saber, filtra, agrupa y escoge las columnas</p>
      </div>
      <!-- El tooltip va sobre un span: un botón deshabilitado no emite eventos de mouse. -->
      <v-tooltip v-if="definition || isAccounting" location="bottom" max-width="300" :text="downloadHint">
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
    <v-alert v-else-if="!reportItems.length" type="info" variant="tonal" density="compact">
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
            :hint="definition?.question ?? (isAccounting ? ACCOUNTING_QUESTION : '')"
            persistent-hint
          />
        </v-col>
        <v-col v-if="definition" cols="12" sm="8" md="4">
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
        <v-col v-if="definition" cols="12" sm="4" md="3">
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

      <v-row v-if="definition" dense class="mt-2">
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

      <v-alert v-if="definition && reportError" type="error" variant="tonal" density="compact" class="mt-3">{{ reportError }}</v-alert>

      <v-alert v-if="definition && notes.length" type="info" variant="tonal" density="compact" class="mt-3">
        <div v-for="note in notes" :key="note">{{ note }}</div>
      </v-alert>

      <v-card v-if="definition && !reportError" class="mt-3">
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

      <!-- Movimiento contable: one entry per document, in the columns of the chosen template -->
      <template v-if="isAccounting">
        <v-row dense class="mt-2" align="center">
          <v-col cols="6" sm="3" md="2">
            <DateField v-model="period.from" label="Desde" density="compact" hide-details @update:model-value="periodEdited = true" />
          </v-col>
          <v-col cols="6" sm="3" md="2">
            <DateField v-model="period.to" label="Hasta" density="compact" hide-details @update:model-value="periodEdited = true" />
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <v-select
              v-model="templateId"
              :items="templates"
              item-title="name"
              item-value="id"
              label="Plantilla"
              density="compact"
              hide-details
            />
          </v-col>
          <v-col cols="12" md="5" class="d-flex flex-wrap ga-2">
            <v-btn
              color="primary"
              prepend-icon="mdi-eye-outline"
              :loading="movementLoading"
              :disabled="!movementRequest"
              @click="loadMovement"
            >
              Ver movimiento
            </v-btn>
            <v-btn variant="tonal" color="secondary" prepend-icon="mdi-cog-outline" @click="openSettings()">
              Configurar contabilidad
            </v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="periodProblem" type="info" variant="tonal" density="compact" class="mt-3">{{ periodProblem }}</v-alert>
        <v-alert v-if="templatesError" type="error" variant="tonal" density="compact" class="mt-3">
          <div class="d-flex align-center flex-wrap ga-3">
            <span>{{ templatesError }}</span>
            <v-spacer />
            <v-btn variant="text" @click="loadTemplates">Reintentar</v-btn>
          </div>
        </v-alert>
        <v-alert v-if="missingAccounts.length" type="warning" variant="tonal" class="mt-3">
          <div class="d-flex align-center flex-wrap ga-3">
            <span class="flex-1-1">{{ movementError }}</span>
            <v-btn color="primary" variant="flat" prepend-icon="mdi-cog-outline" @click="openSettings(missingAccounts)">
              Configurar contabilidad
            </v-btn>
          </div>
        </v-alert>
        <v-alert v-else-if="movementError" type="error" variant="tonal" density="compact" class="mt-3">{{ movementError }}</v-alert>

        <template v-if="movement">
          <v-card class="mt-3">
            <v-card-text role="group" aria-label="Resumen del movimiento">
              <v-row dense>
                <v-col
                  v-for="figure in movementFigures"
                  :key="figure.label"
                  role="group"
                  :aria-label="figure.label"
                  cols="6"
                  sm="3"
                  lg="2"
                >
                  <div class="text-caption text-medium-emphasis">{{ figure.label }}</div>
                  <div class="text-h6 tabular-nums">{{ figure.value }}</div>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>

          <v-alert v-if="movement.warnings.length" type="warning" variant="tonal" density="compact" class="mt-3">
            <div class="font-weight-medium mb-1">Revisa antes de importar</div>
            <ul class="pl-4">
              <li v-for="warning in movement.warnings" :key="warning">{{ warning }}</li>
            </ul>
          </v-alert>

          <p v-if="movement.rows_count > movement.rows.length" class="text-body-2 text-medium-emphasis mt-3">
            Aquí ves las primeras {{ quantity(movement.rows.length) }} de {{ quantity(movement.rows_count) }} líneas; el Excel
            trae todas.
          </p>

          <v-card class="mt-3">
            <v-table v-if="movement.rows.length" density="compact" fixed-header :height="movement.rows.length > 15 ? 560 : undefined">
              <caption class="d-sr-only">Vista previa del movimiento contable</caption>
              <thead>
                <tr>
                  <th
                    v-for="column in movement.columns"
                    :key="column.key"
                    class="text-no-wrap"
                    :class="{ 'text-end': AMOUNT_COLUMNS.has(column.key) }"
                  >
                    {{ column.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in movement.rows" :key="index">
                  <td v-for="(value, position) in row" :key="position" :class="movementCellClass(movement.columns[position]?.key)">
                    {{ movementCell(movement.columns[position]?.key, value) }}
                  </td>
                </tr>
              </tbody>
            </v-table>
            <p v-else class="text-medium-emphasis pa-6">No hay documentos en este período.</p>
          </v-card>
        </template>
        <p v-else-if="!movementError && !periodProblem" class="text-body-2 text-medium-emphasis mt-4">
          Elige el período y la plantilla y revisa el movimiento con «Ver movimiento» antes de descargarlo.
        </p>
      </template>
    </template>

    <AccountingSettingsDialog
      v-if="canUseAccounting"
      v-model="settingsDialog"
      :focus="settingsFocus"
      @changed="settingsChanged = true"
    />
  </v-container>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import AccountingSettingsDialog from '../components/AccountingSettingsDialog.vue'
import DateField from '../components/DateField.vue'
import { PAGE_SIZE_OPTIONS, useServerPage } from '@/composables/useServerPage'
import reportsService, {
  type AccountingCell,
  type AccountingMovement,
  type AccountingMovementRequest,
  type AccountingTemplate,
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

/** Movimiento contable is not a report definition: it has its own endpoints and the "Contabilidad" grant. */
const ACCOUNTING_KEY = 'accounting_movement'
const ACCOUNTING_QUESTION = 'Los asientos de cada documento del período, para importarlos en tu programa contable'
const canUseAccounting = computed(() => authStore.isAdmin || authStore.user?.can_use_accounting === true)
const isAccounting = computed(() => canUseAccounting.value && reportKey.value === ACCOUNTING_KEY)

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
  const accounting = canUseAccounting.value
    ? [
        { type: 'subheader' as const, title: 'Contabilidad' },
        { title: 'Movimiento contable', value: ACCOUNTING_KEY, props: { subtitle: ACCOUNTING_QUESTION, lines: 'two' as const } },
      ]
    : []
  return [
    ...areas.flatMap(area => {
      const own = reports.filter(report => report.area === area.key)
      return own.length ? [{ type: 'subheader' as const, title: area.title }, ...own.map(item)] : []
    }),
    ...reports.filter(report => !known.has(report.area)).map(item),
    ...accounting,
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
  /** Movimiento contable: the template last used. */
  template?: unknown
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

// --- Movimiento contable ---
const MAX_RANGE_DAYS = 366
/** Amounts and rates: numbers in `rows` (debit and credit 0 on the other side; base and rate null off tax lines). */
const AMOUNT_COLUMNS = new Set(['debit', 'credit', 'base', 'tax_rate'])

const templates = ref<AccountingTemplate[]>([])
const templateId = ref<string | null>(null)
const templatesError = ref('')
const movement = ref<AccountingMovement | null>(null)
const movementLoading = ref(false)
const movementError = ref('')
/** The blank accounts the period needs (a 422 with `missing`): the message offers to fill them. */
const missingAccounts = ref<string[]>([])
const settingsDialog = ref(false)
const settingsFocus = ref<string[]>([])
const settingsChanged = ref(false)

const isoDay = (iso: string): number => {
  const [year = 1970, month = 1, day = 1] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

/** The same checks as the API, before asking: both days count. */
const periodProblem = computed((): string => {
  if (!period.from || !period.to) return 'Elige las fechas Desde y Hasta.'
  if (period.from > period.to) return 'Desde tiene que ser antes de Hasta o el mismo día.'
  if (isoDay(period.to) - isoDay(period.from) + 1 > MAX_RANGE_DAYS) {
    return `El rango puede ser de máximo ${MAX_RANGE_DAYS} días. Elige un periodo más corto.`
  }
  return ''
})

const movementRequest = computed((): AccountingMovementRequest | null =>
  periodProblem.value || !templateId.value ? null : { from: period.from, to: period.to, template: templateId.value },
)

const rememberAccounting = () => {
  const userId = authStore.user?.id
  if (!userId) return
  const stored = readStored()
  const previous = readChoices()[ACCOUNTING_KEY]
  // Until the templates load there is no choice yet: the remembered one stays.
  const template = templateId.value ?? (previous && typeof previous === 'object' ? previous.template : undefined)
  stored[userId] = { ...readChoices(), last: ACCOUNTING_KEY, [ACCOUNTING_KEY]: { template } }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
}

const loadTemplates = async () => {
  templatesError.value = ''
  try {
    templates.value = (await reportsService.accountingSettings()).templates
    const saved = readChoices()[ACCOUNTING_KEY]
    const remembered = saved && typeof saved === 'object' ? saved.template : undefined
    const ids = templates.value.map(template => template.id)
    if (!templateId.value || !ids.includes(templateId.value)) {
      templateId.value = typeof remembered === 'string' && ids.includes(remembered) ? remembered : (ids[0] ?? null)
    }
  } catch (error) {
    templatesError.value = errorMessage(error, 'No fue posible cargar las plantillas de contabilidad. Inténtalo de nuevo.')
  }
}

// Opening the entry brings the month (what is usually exported) unless the user already typed dates.
watch(isAccounting, on => {
  if (!on) return
  if (!periodEdited.value) {
    period.from = firstOfMonth()
    period.to = todayIso()
  }
  rememberAccounting()
  loadTemplates()
})

watch(templateId, () => {
  if (isAccounting.value) rememberAccounting()
})

// What is shown always matches the period and template above it.
let movementTicket = 0
watch(
  movementRequest,
  () => {
    movementTicket++
    movement.value = null
    movementError.value = ''
    missingAccounts.value = []
  },
  { deep: true },
)

const showMovementError = (error: unknown, fallback: string) => {
  const missing = (error as { response?: { data?: { missing?: unknown } } })?.response?.data?.missing
  missingAccounts.value = Array.isArray(missing) ? missing.filter((name): name is string => typeof name === 'string') : []
  movementError.value = errorMessage(error, fallback)
}

const loadMovement = async () => {
  const request = movementRequest.value
  if (!request) return
  const ticket = ++movementTicket
  movementLoading.value = true
  movementError.value = ''
  missingAccounts.value = []
  try {
    const answer = await reportsService.accountingMovement(request)
    if (ticket === movementTicket) movement.value = answer
  } catch (error) {
    if (ticket !== movementTicket) return
    movement.value = null
    showMovementError(error, 'No fue posible ver el movimiento. Inténtalo de nuevo.')
  } finally {
    if (ticket === movementTicket) movementLoading.value = false
  }
}

const movementFigures = computed(() => {
  const shown = movement.value
  if (!shown) return []
  return [
    { label: 'Asientos', value: quantity(shown.entries_count) },
    { label: 'Líneas', value: quantity(shown.rows_count) },
    { label: 'Total débito', value: money(shown.totals.debit) },
    { label: 'Total crédito', value: money(shown.totals.credit) },
  ]
})

// A line can carry cents (a tax on its base): the preview shows them as the file has them. The file
// writes 0 on the side a line does not post on; here that side stays blank, as a journal reads.
const movementCell = (key: string | undefined, value: AccountingCell): string => {
  if (value === null || value === '') return ''
  if ((key === 'debit' || key === 'credit') && Number(value) === 0) return ''
  if (key === 'tax_rate') return percent(Number(value))
  if (key && AMOUNT_COLUMNS.has(key)) return preciseMoney(Number(value))
  return String(value)
}

// A code split in two ("FE-" / "3321") reads as two values: only names and details wrap.
const WRAPPING_COLUMNS = new Set(['third_party_name', 'description', 'user', 'fixed'])
const movementCellClass = (key: string | undefined): string[] => [
  key && WRAPPING_COLUMNS.has(key) ? 'movement-text' : 'text-no-wrap',
  ...(key && AMOUNT_COLUMNS.has(key) ? ['text-end'] : []),
]

const openSettings = (missing: string[] = []) => {
  settingsFocus.value = missing
  settingsDialog.value = true
}

// Closing after saving brings the new templates, and what was on screen is asked again with the new accounts.
watch(settingsDialog, async open => {
  if (open || !settingsChanged.value) return
  settingsChanged.value = false
  const shown = !!movement.value || !!movementError.value
  await loadTemplates()
  await nextTick()
  if (shown) loadMovement()
})

// --- Excel ---
const downloading = ref(false)
const canDownload = computed(() => (isAccounting.value ? !!movementRequest.value : total.value > 0 && !reportError.value))
const downloadHint = computed(() => {
  if (isAccounting.value) {
    return canDownload.value
      ? 'Descarga todas las líneas del período con la plantilla elegida, listas para importar'
      : periodProblem.value || 'Elige una plantilla para descargar el movimiento'
  }
  return canDownload.value
    ? 'Descarga el informe con los filtros, la agrupación y las columnas de arriba'
    : 'No hay datos con estos filtros para descargar'
})

const downloadMovement = async () => {
  if (!movementRequest.value) return
  downloading.value = true
  try {
    await reportsService.downloadAccountingMovement(movementRequest.value)
  } catch (error) {
    showMovementError(error, 'No fue posible descargar el Excel. Inténtalo de nuevo.')
  } finally {
    downloading.value = false
  }
}

const downloadExcel = async () => {
  if (isAccounting.value) return downloadMovement()
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
    const keys = [...catalog.value.reports.map(report => report.key), ...(canUseAccounting.value ? [ACCOUNTING_KEY] : [])]
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

/* Beside columns that never wrap, a detail would shrink to a word per line. */
.movement-text {
  min-width: 220px;
}
</style>
