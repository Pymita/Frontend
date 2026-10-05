<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-2">
          <div>
            <h1 class="text-h4">Ventas</h1>
            <p class="text-body-1 text-medium-emphasis">
              Pedidos pagados: cuánto se ha vendido, con qué método y por quién
            </p>
          </div>
          <!-- El tooltip va sobre un span: un botón deshabilitado no emite
               eventos de mouse y el usuario no sabría por qué está apagado. -->
          <v-tooltip location="bottom" max-width="300" :text="exportHint">
            <template #activator="{ props: tooltip }">
              <span v-bind="tooltip" class="d-inline-flex">
                <v-btn
                  color="primary"
                  variant="outlined"
                  prepend-icon="mdi-microsoft-excel"
                  :loading="exporting"
                  :disabled="!canExport"
                  @click="exportExcel"
                >
                  Descargar Excel
                </v-btn>
              </span>
            </template>
          </v-tooltip>
        </div>
      </v-col>
    </v-row>

    <!-- Totales del conjunto filtrado completo (la tabla puede estar recortada) -->
    <v-row dense>
      <v-col cols="12" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Total vendido</div>
          <div class="text-h5 font-weight-bold tabular-nums">
            {{ money(report?.summary.total ?? 0) }}
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Ventas</div>
          <div class="text-h5 font-weight-bold">{{ report?.summary.sales_count ?? 0 }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" sm="4">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Propinas</div>
          <div class="text-h5 font-weight-bold">
            {{ money(report?.summary.tips ?? 0) }}
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-if="methodBreakdown.length" dense class="mb-1">
      <v-col cols="12">
        <v-chip
          v-for="entry in methodBreakdown"
          :key="entry.method"
          class="mr-2 mb-1"
          size="small"
          variant="tonal"
          color="primary"
        >
          {{ entry.label }}: {{ money(entry.amount) }}
        </v-chip>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-row dense>
      <v-col cols="6" md="2">
        <DateField v-model="filters.from" label="Desde" density="compact" hide-details />
      </v-col>
      <v-col cols="6" md="2">
        <DateField v-model="filters.to" label="Hasta" density="compact" hide-details />
      </v-col>
      <v-col cols="6" md="2">
        <v-select
          v-model="filters.payment_method"
          :items="methodOptions"
          label="Método de pago"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="6" md="3">
        <v-select
          v-model="filters.user_id"
          :items="waiterOptions"
          label="Mesero"
          density="compact"
          hide-details
          clearable
        />
      </v-col>
      <v-col cols="12" md="3">
        <v-text-field
          v-model="filters.q"
          label="Buscar factura o cliente"
          density="compact"
          hide-details
          clearable
          prepend-inner-icon="mdi-magnify"
        />
      </v-col>
    </v-row>

    <!-- Tres lecturas del mismo rango: venta por venta, qué se vendió y qué dejó cada mesa. -->
    <v-row dense class="mt-1">
      <v-col cols="12">
        <v-btn-toggle v-model="view" mandatory color="primary" density="comfortable">
          <v-btn value="sales" prepend-icon="mdi-receipt-text">Ventas</v-btn>
          <v-btn value="products" prepend-icon="mdi-food">Por producto</v-btn>
          <v-btn value="tables" prepend-icon="mdi-table-furniture">Por mesa</v-btn>
          <v-btn value="cash" prepend-icon="mdi-cash-register">Cierres de caja</v-btn>
        </v-btn-toggle>
      </v-col>
    </v-row>

    <v-row v-if="view === 'cash'">
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="cashHeaders"
            :items="cashSessions"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
            :items-per-page="25"
          >
            <template #item.opened_at="{ item }">
              <span class="text-no-wrap">{{ formatDateTime(item.opened_at) }}</span>
              <div class="text-caption text-medium-emphasis">{{ item.opened_by || 'Automática' }}</div>
              <v-btn
                v-if="correctedField(item) === 'opened_at'"
                size="x-small"
                variant="tonal"
                color="secondary"
                prepend-icon="mdi-history"
                class="mb-1"
                :aria-label="`Corregida: ver los cambios del turno ${item.number}`"
                @click="adjustmentsSession = item"
              >
                Corregida
              </v-btn>
            </template>
            <template #item.closed_at="{ item }">
              <template v-if="item.closed_at">
                <span class="text-no-wrap">{{ formatDateTime(item.closed_at) }}</span>
                <div class="text-caption text-medium-emphasis">{{ item.closed_by || '—' }}</div>
                <v-btn
                  v-if="correctedField(item) === 'closed_at'"
                  size="x-small"
                  variant="tonal"
                  color="secondary"
                  prepend-icon="mdi-history"
                  class="mb-1"
                  :aria-label="`Corregida: ver los cambios del turno ${item.number}`"
                  @click="adjustmentsSession = item"
                >
                  Corregida
                </v-btn>
              </template>
              <div v-else class="d-flex flex-wrap ga-1">
                <v-chip size="small" color="info" variant="tonal">Abierta</v-chip>
                <v-chip v-if="item.has_previous_day_movements" size="small" color="warning" variant="tonal">Tiene ventas de otro día</v-chip>
              </div>
            </template>
            <template #item.sales_total="{ item }">
              <template v-if="item.summary.sales_total !== null">
                <span class="font-weight-bold">{{ money(item.summary.sales_total) }}</span>
                <div class="text-caption text-medium-emphasis">{{ salesCountLabel(item.summary.sales_count ?? 0) }}</div>
              </template>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.methods="{ item }">
              <span v-for="entry in collectedByMethod(item)" :key="entry.method" class="d-block text-caption">
                {{ entry.label }}: {{ money(entry.amount) }}
              </span>
            </template>
            <template #item.expected_cash="{ item }">
              {{ money(item.expected_cash) }}
              <div v-if="item.opening_amount > 0" class="text-caption text-medium-emphasis">Incluye base de {{ money(item.opening_amount) }}</div>
            </template>
            <template #item.counted_cash="{ item }">{{ item.counted_cash === null ? '—' : money(item.counted_cash) }}</template>
            <template #item.difference="{ item }">
              <span v-if="item.difference === null" class="text-medium-emphasis">—</span>
              <span v-else :class="differenceClass(item.difference)" class="font-weight-bold">
                {{ differenceLabel(item.difference) }}
              </span>
            </template>
            <template #item.actions="{ item }">
              <div class="d-flex justify-end">
                <v-btn
                  v-if="item.closed_at"
                  icon="mdi-printer"
                  size="small"
                  variant="text"
                  :aria-label="`Imprimir el cierre del turno ${item.number}`"
                  :title="`Imprimir el cierre del turno ${item.number}`"
                  @click="printCashClose(item)"
                />
                <template v-if="canCorrectShifts">
                  <v-btn
                    icon="mdi-clock-edit-outline"
                    size="small"
                    variant="text"
                    :disabled="isReadOnly"
                    :aria-label="`Cambiar la apertura del turno ${item.number}`"
                    :title="`Cambiar la apertura del turno ${item.number}`"
                    @click="openOpeningDialog(item)"
                  />
                  <v-btn
                    v-if="!item.closed_at"
                    icon="mdi-lock-clock"
                    size="small"
                    variant="text"
                    :disabled="isReadOnly"
                    :aria-label="`Cerrar el turno ${item.number} con otra fecha`"
                    :title="`Cerrar el turno ${item.number} con otra fecha`"
                    @click="openBackdatedClose(item)"
                  />
                </template>
              </div>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay cierres de caja en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="view === 'products'">
      <v-col cols="12">
        <v-card>
          <v-card-text class="d-flex flex-wrap ga-4 pb-0">
            <div>
              <div class="text-caption text-medium-emphasis">Unidades vendidas</div>
              <div class="text-h6">{{ productReport?.summary.quantity ?? 0 }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Neto vendido</div>
              <div class="text-h6 tabular-nums">{{ money(productReport?.summary.net) }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Ganancia (neto - costo)</div>
              <div class="text-h6" :class="(productReport?.summary.profit ?? 0) >= 0 ? 'text-success' : 'text-error'">
                {{ money(productReport?.summary.profit) }}
              </div>
            </div>
          </v-card-text>
          <v-data-table
            :headers="productHeaders"
            :items="productReport?.products ?? []"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
            :items-per-page="25"
          >
            <template #item.category="{ item }">{{ item.category || '—' }}</template>
            <template #item.gross="{ item }">{{ money(item.gross) }}</template>
            <template #item.net="{ item }">
              <span class="font-weight-bold">{{ money(item.net) }}</span>
            </template>
            <template #item.cost="{ item }">{{ money(item.cost) }}</template>
            <template #item.profit="{ item }">
              <span :class="item.profit >= 0 ? 'text-success' : 'text-error'">{{ money(item.profit) }}</span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay ventas en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else-if="view === 'tables'">
      <v-col cols="12">
        <v-card>
          <v-card-text class="d-flex flex-wrap ga-4 pb-0">
            <div>
              <div class="text-caption text-medium-emphasis">Ventas</div>
              <div class="text-h6">{{ tableReport?.summary.sales_count ?? 0 }}</div>
            </div>
            <div v-if="hasTimeBilling">
              <div class="text-caption text-medium-emphasis">Tiempo de billar</div>
              <div class="text-h6">{{ money(tableReport?.summary.time_total) }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Total</div>
              <div class="text-h6 tabular-nums">{{ money(tableReport?.summary.total) }}</div>
            </div>
          </v-card-text>
          <v-data-table
            :headers="tableHeaders"
            :items="tableReport?.tables ?? []"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
            :items-per-page="25"
          >
            <template #item.name="{ item }">
              <v-icon v-if="item.table_type === 'billiard'" size="small" class="mr-1">mdi-billiards</v-icon>
              {{ item.name }}
            </template>
            <template #item.products_total="{ item }">{{ money(item.products_total) }}</template>
            <template #item.time_total="{ item }">
              <template v-if="item.time_minutes > 0">
                {{ money(item.time_total) }}
                <span class="text-caption text-medium-emphasis">({{ formatMinutes(item.time_minutes) }})</span>
              </template>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.tips="{ item }">{{ item.tips ? money(item.tips) : '—' }}</template>
            <template #item.total="{ item }">
              <span class="font-weight-bold">{{ money(item.total) }}</span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay ventas en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col cols="12">
        <v-card>
          <v-alert v-if="report?.truncated" type="info" variant="tonal" density="compact" class="ma-2 mb-0">
            Se muestran las primeras {{ report.sales.length }} ventas; los totales sí cubren todo el filtro.
            Acota las fechas o descarga el Excel para ver el detalle completo.
          </v-alert>
          <v-data-table
            :headers="headers"
            :items="report?.sales ?? []"
            :loading="loading"
            density="comfortable"
            class="elevation-0"
          >
            <template #item.invoice_number="{ item }">
              <v-chip
                size="small"
                variant="tonal"
                :color="item.invoice_number ? 'primary' : 'secondary'"
                :title="item.invoice_number ? 'Factura con consecutivo DIAN' : 'Sin resolución DIAN: se identifica con el número del pedido'"
              >
                {{ item.invoice_number || `Pedido #${item.id}` }}
              </v-chip>
            </template>
            <template #item.customer_name="{ item }">
              {{ customerLabel(item.customer_name) }}
            </template>
            <template #item.paid_at="{ item }">
              {{ formatDateTime(item.paid_at) }}
            </template>
            <template #item.payment_methods="{ item }">
              {{ methodsLabel(item.payment_methods) }}
            </template>
            <template #item.tip="{ item }">
              {{ item.tip ? money(item.tip) : '—' }}
            </template>
            <template #item.total="{ item }">
              <span class="font-weight-bold">{{ money(item.total) }}</span>
            </template>
            <template #no-data>
              <p class="text-medium-emphasis py-6">No hay ventas en el rango seleccionado</p>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Admin: the cut shared with the previous shift moves with the opening -->
    <v-dialog v-model="openingDialog" max-width="480">
      <v-card v-if="editedSession">
        <v-card-title>Cambiar la apertura del turno {{ editedSession.number }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-2">Úsalo si la caja quedó abierta desde una hora que no corresponde.</p>
          <p class="text-body-2 text-medium-emphasis mb-4">{{ openingImpact }}</p>
          <v-row dense>
            <v-col cols="7">
              <DateField v-model="openingForm.date" label="Fecha" :max="todayIso()" />
            </v-col>
            <v-col cols="5">
              <v-text-field
                v-model="openingForm.time"
                label="Hora"
                placeholder="08:00"
                hint="Formato 24 horas"
                persistent-hint
                :error-messages="timeError(openingForm.time)"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field
                v-model="openingForm.reason"
                label="Motivo"
                hint="Queda en el historial del turno"
                persistent-hint
                maxlength="255"
              />
            </v-col>
          </v-row>
          <v-alert v-if="shiftError" type="error" variant="tonal" density="compact" class="mt-3">{{ shiftError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="openingDialog = false">Cancelar</v-btn>
          <LockableButton color="primary" variant="flat" :loading="savingShift" :disabled="!openingReady" @click="saveOpening">
            Guardar
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Admin: a forgotten close, cut at the time that day ended -->
    <v-dialog v-model="backdatedDialog" max-width="480">
      <v-card v-if="editedSession">
        <v-card-title>Cerrar el turno {{ editedSession.number }} con otra fecha</v-card-title>
        <v-card-text>
          <template v-if="!confirmingBackdated">
            <p class="text-body-2 mb-4">
              Si se te olvidó cerrar la caja, ciérrala a la hora en que terminó ese día. Lo que se cobró después queda
              en un turno nuevo, que sigue abierto.
            </p>
            <v-row dense>
              <v-col cols="7">
                <DateField v-model="backdatedForm.date" label="Fecha" :max="todayIso()" />
              </v-col>
              <v-col cols="5">
                <v-text-field
                  v-model="backdatedForm.time"
                  label="Hora"
                  placeholder="23:00"
                  hint="Formato 24 horas"
                  persistent-hint
                  :error-messages="timeError(backdatedForm.time)"
                />
              </v-col>
              <v-col cols="12">
                <MoneyField v-model="backdatedForm.counted" label="Efectivo contado (opcional)" />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="backdatedForm.notes" label="Nota (opcional)" maxlength="500" />
              </v-col>
            </v-row>
          </template>
          <v-alert v-else type="warning" variant="tonal">
            ¿Seguro que quieres cerrar el turno {{ editedSession.number }} el {{ formatIsoDate(backdatedForm.date) }}
            a las {{ parseTimeText(backdatedForm.time) }}?
          </v-alert>
          <v-alert v-if="shiftError" type="error" variant="tonal" density="compact" class="mt-3">{{ shiftError }}</v-alert>
        </v-card-text>
        <v-card-actions v-if="!confirmingBackdated">
          <v-spacer />
          <v-btn @click="backdatedDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!backdatedReady" @click="confirmBackdated">Cerrar caja</v-btn>
        </v-card-actions>
        <v-card-actions v-else>
          <v-spacer />
          <v-btn @click="confirmingBackdated = false">Volver</v-btn>
          <LockableButton color="primary" variant="flat" :loading="savingShift" @click="saveBackdatedClose">
            Sí, cerrar caja
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="adjustmentsSession !== null" max-width="560" scrollable @update:model-value="adjustmentsSession = null">
      <v-card v-if="adjustmentsSession">
        <v-card-title>Cambios del turno {{ adjustmentsSession.number }}</v-card-title>
        <v-card-text>
          <div v-for="(entry, index) in adjustmentsSession.adjustments" :key="index" class="py-2" data-testid="cash-adjustment">
            <v-divider v-if="index > 0" class="mb-3" />
            <div class="text-body-1 font-weight-bold">
              {{ entry.field === 'opened_at' ? 'Apertura' : 'Cierre' }}: {{ formatDateTime(entry.from) }} → {{ formatDateTime(entry.to) }}
            </div>
            <div class="text-body-2">Motivo: {{ entry.reason }}</div>
            <div class="text-body-2 tabular-nums">
              Ventas {{ moneyOrDash(entry.before.sales_total) }} → {{ moneyOrDash(entry.after.sales_total) }} ·
              Efectivo del turno {{ moneyOrDash(entry.before.expected_cash) }} → {{ moneyOrDash(entry.after.expected_cash) }}
            </div>
            <div class="text-caption text-medium-emphasis">{{ entry.user_name }} · {{ formatDateTime(entry.at) }}</div>
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="adjustmentsSession = null">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="6000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDateTime, formatIsoDate, parseTimeText, toIsoDate, toTimeText, todayIso } from '@/utils/dates'
import { computed, onMounted, ref, watch } from 'vue'
import DateField from '../components/DateField.vue'
import LockableButton from '../components/LockableButton.vue'
import MoneyField from '../components/MoneyField.vue'
import salesService, {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type ProductSalesReport,
  type SalesFilters,
  type SalesReport,
  type SalesView,
  type TableSalesReport,
  type CashSession,
} from '../services/salesService'
import { billingService } from '../services/billingService'
import { errorMessage } from '@/utils/errors'
import { useAuthStore } from '@/stores/auth'
import { useReadOnly } from '@/composables/useReadOnly'
import { effectiveFeatures } from '@/types/auth'
import { customerLabel } from '@/utils/labels'
import { cashCloseHtml, fillDocumentWindow, openDocumentWindow } from '@/utils/printDocuments'

// Hoy en local (los inputs date usan YYYY-MM-DD): el día de trabajo actual
// es lo primero que quiere ver quien abre la pestaña.
const today = new Date().toLocaleDateString('sv-SE')

const filters = ref<SalesFilters>({
  from: today,
  to: today,
  payment_method: '',
  user_id: null,
  q: '',
})

const report = ref<SalesReport | null>(null)
const productReport = ref<ProductSalesReport | null>(null)
const tableReport = ref<TableSalesReport | null>(null)
// "Cierres de caja" es otra lectura del mismo rango, sin Excel propio.
type VentasView = SalesView | 'cash'
const view = ref<VentasView>('sales')
const cashSessions = ref<CashSession[]>([])
const loading = ref(false)


const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`
}

const productHeaders = [
  { title: 'Producto', key: 'name' },
  { title: 'Categoría', key: 'category' },
  { title: 'Cantidad', key: 'quantity', align: 'end' as const },
  { title: 'Bruto', key: 'gross', align: 'end' as const },
  { title: 'Neto', key: 'net', align: 'end' as const },
  { title: 'Costo', key: 'cost', align: 'end' as const },
  { title: 'Ganancia', key: 'profit', align: 'end' as const },
  { title: 'Ventas', key: 'orders_count', align: 'end' as const },
]

// El cobro por tiempo es un módulo: un restaurante no cobra por tiempo, así que
// no debe ver la columna ni el resumen de "Tiempo de billar".
const authStore = useAuthStore()
const hasTimeBilling = computed(() => effectiveFeatures(authStore.user).includes('time_billing'))

const tableHeaders = computed(() => [
  { title: 'Mesa', key: 'name' },
  { title: 'Ventas', key: 'sales_count', align: 'end' as const },
  { title: 'Productos', key: 'products_total', align: 'end' as const },
  ...(hasTimeBilling.value ? [{ title: 'Tiempo', key: 'time_total', align: 'end' as const }] : []),
  { title: 'Propinas', key: 'tips', align: 'end' as const },
  { title: 'Total', key: 'total', align: 'end' as const },
])

const cashHeaders = [
  { title: 'N.º', key: 'number', sortable: false },
  { title: 'Apertura', key: 'opened_at', sortable: false },
  { title: 'Cierre', key: 'closed_at', sortable: false },
  { title: 'Ventas', key: 'sales_total', align: 'end' as const, sortable: false },
  { title: 'Recibido por medio', key: 'methods', sortable: false },
  { title: 'Efectivo del turno', key: 'expected_cash', align: 'end' as const, sortable: false },
  { title: 'Contado', key: 'counted_cash', align: 'end' as const, sortable: false },
  { title: 'Diferencia', key: 'difference', align: 'end' as const, sortable: false },
  { title: 'Acciones', key: 'actions', align: 'end' as const, sortable: false },
]

const collectedByMethod = (session: CashSession) =>
  Object.entries(session.summary.by_method)
    .filter(([, totals]) => totals.amount > 0)
    .map(([method, totals]) => ({ method, label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method, amount: totals.amount }))

const salesCountLabel = (count: number): string => `${count} ${count === 1 ? 'venta' : 'ventas'}`
const moneyOrDash = (value: number | null): string => (value === null ? '—' : money(value))

// La diferencia es una cifra con signo: sobrante o faltante.
const differenceLabel = (difference: number): string =>
  Math.abs(difference) < 0.01 ? 'Cuadra' : difference > 0 ? `Sobran ${money(difference)}` : `Faltan ${money(Math.abs(difference))}`
const differenceClass = (difference: number): string =>
  Math.abs(difference) < 0.01 ? '' : difference > 0 ? 'text-success' : 'text-error'

// Correcting a shift rewrites closed money: the backend gates it on admin +
// orders, the page only hides it.
const isReadOnly = useReadOnly()
const canCorrectShifts = computed(() => authStore.isAdmin && effectiveFeatures(authStore.user).includes('orders'))

// One "Corregida" per row, next to the cut that moved; the dialog lists every change.
const correctedField = (session: CashSession): 'opened_at' | 'closed_at' | null =>
  session.adjustments.some(entry => entry.field === 'opened_at')
    ? 'opened_at'
    : session.adjustments.length ? 'closed_at' : null
const adjustmentsSession = ref<CashSession | null>(null)

const sameInstant = (a: string | null, b: string | null) => !!a && !!b && new Date(a).getTime() === new Date(b).getTime()

const editedSession = ref<CashSession | null>(null)
const savingShift = ref(false)
const shiftError = ref('')
const timeError = (text: string) => (text.trim() && !parseTimeText(text) ? 'Escribe la hora como 08:00 o 23:30' : undefined)

const openingDialog = ref(false)
const openingForm = ref({ date: '', time: '', reason: '' })
const openingReady = computed(
  () => !!openingForm.value.date && !!parseTimeText(openingForm.value.time) && openingForm.value.reason.trim().length >= 3,
)
// Says what the backend will recompute before saving. The previous shift may
// be outside the loaded range, hence the conditional wording.
const openingImpact = computed(() => {
  const session = editedSession.value
  if (!session) return ''
  const previous = cashSessions.value.find(other => sameInstant(other.closed_at, session.opened_at))
  const shared = previous
    ? `El cierre del turno ${previous.number} pasa a la misma hora y sus totales se recalculan con los cobros que existen hoy.`
    : 'Si el turno anterior se cerró a la hora de esta apertura, su cierre pasa a la nueva hora y sus totales se recalculan con los cobros que existen hoy.'
  return session.closed_at ? `${shared} Los totales de este turno también se recalculan.` : shared
})

const openOpeningDialog = (session: CashSession) => {
  const opened = new Date(session.opened_at)
  editedSession.value = session
  openingForm.value = { date: toIsoDate(opened), time: toTimeText(opened), reason: '' }
  shiftError.value = ''
  openingDialog.value = true
}

const saveOpening = async () => {
  const session = editedSession.value
  const time = parseTimeText(openingForm.value.time)
  if (!session || !time || !openingReady.value) return
  savingShift.value = true
  shiftError.value = ''
  try {
    const { message } = await salesService.updateCashSessionOpening(session.id, `${openingForm.value.date} ${time}`, openingForm.value.reason.trim())
    openingDialog.value = false
    notify(message, 'success')
    await load()
  } catch (error) {
    shiftError.value = errorMessage(error, 'No fue posible cambiar la apertura. Inténtalo de nuevo.')
  } finally {
    savingShift.value = false
  }
}

const backdatedDialog = ref(false)
const confirmingBackdated = ref(false)
const backdatedForm = ref<{ date: string; time: string; counted: number | null; notes: string }>({ date: '', time: '', counted: null, notes: '' })
const backdatedReady = computed(() => !!backdatedForm.value.date && !!parseTimeText(backdatedForm.value.time))

// The day to close is usually the one of the forgotten shift's first charge.
const openBackdatedClose = (session: CashSession) => {
  editedSession.value = session
  backdatedForm.value = {
    date: toIsoDate(new Date(session.summary.first_movement_at ?? session.opened_at)),
    time: '',
    counted: null,
    notes: '',
  }
  confirmingBackdated.value = false
  shiftError.value = ''
  backdatedDialog.value = true
}

const confirmBackdated = () => {
  shiftError.value = ''
  confirmingBackdated.value = true
}

const saveBackdatedClose = async () => {
  const session = editedSession.value
  const time = parseTimeText(backdatedForm.value.time)
  if (!session || !time) return
  const { date, counted, notes } = backdatedForm.value
  savingShift.value = true
  shiftError.value = ''
  try {
    const result = await salesService.closeCashSession(session.id, {
      counted_cash: typeof counted === 'number' ? counted : null,
      notes,
      closed_at: `${date} ${time}`,
    })
    backdatedDialog.value = false
    const difference = result.session.difference
    notify(result.message, difference !== null && Math.abs(difference) >= 0.01 ? 'warning' : 'success')
    // Widen the range so the shift just closed on that day stays in the list.
    if (filters.value.from && date < filters.value.from) {
      filters.value.from = date
    } else {
      await load()
    }
  } catch (error) {
    confirmingBackdated.value = false
    shiftError.value = errorMessage(error, 'No fue posible cerrar la caja. Inténtalo de nuevo.')
  } finally {
    savingShift.value = false
  }
}

const printCashClose = async (session: CashSession) => {
  const win = openDocumentWindow()
  if (!win) {
    notify('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error')
    return
  }
  try {
    const business = await billingService.getBusiness()
    fillDocumentWindow(win, `Cierre de caja ${session.number}`, cashCloseHtml(business, session))
  } catch (error) {
    win.close()
    notify(errorMessage(error, 'No fue posible generar el cierre para imprimir. Inténtalo de nuevo.'), 'error')
  }
}

const canExport = computed(() => {
  if (view.value === 'cash') return false
  if (view.value === 'products') return (productReport.value?.products.length ?? 0) > 0
  if (view.value === 'tables') return (tableReport.value?.tables.length ?? 0) > 0
  return (report.value?.sales.length ?? 0) > 0
})
const EXPORT_HINTS: Record<SalesView, string> = {
  sales: 'Descarga el listado de ventas con los filtros de arriba',
  products: 'Descarga el resumen por producto con los filtros de arriba',
  tables: 'Descarga el resumen por mesa con los filtros de arriba',
}
const exportHint = computed(() => {
  if (view.value === 'cash') return 'Cada cierre de caja se imprime desde su fila; el Excel es de las ventas'
  return canExport.value ? EXPORT_HINTS[view.value] : 'No hay ventas con estos filtros para descargar'
})
const exporting = ref(false)
const snackbar = ref({ show: false, text: '', color: 'error' })
const notify = (text: string, color = 'error') => {
  snackbar.value = { show: true, text, color }
}

const headers = [
  { title: 'Comprobante', key: 'invoice_number', sortable: false },
  { title: 'Cliente', key: 'customer_name', sortable: false },
  { title: 'Fecha de pago', key: 'paid_at' },
  { title: 'Mesero', key: 'waiter' },
  { title: 'Método', key: 'payment_methods', sortable: false },
  { title: 'Propina', key: 'tip', align: 'end' as const },
  { title: 'Total', key: 'total', align: 'end' as const },
]

const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, title]) => ({ value, title }))

// Los meseros del filtro salen de las ventas cargadas: sin llamados extra
// y sin exigir permisos de administración de empleados.
const waiterOptions = computed(() => {
  const seen = new Map<number, string>()
  for (const sale of report.value?.sales ?? []) {
    if (sale.user_id && sale.waiter) seen.set(sale.user_id, sale.waiter)
  }
  return [...seen].map(([value, title]) => ({ value, title }))
})

const methodBreakdown = computed(() =>
  Object.entries(report.value?.summary.by_payment_method ?? {})
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([method, amount]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method,
      amount: amount ?? 0,
    })),
)

const methodsLabel = (methods: PaymentMethod[]): string =>
  methods.map(m => PAYMENT_METHOD_LABELS[m] ?? m).join(' + ') || '—'


// Cada vista consulta lo suyo; los totales de arriba siempre son del listado.
const load = async () => {
  loading.value = true
  try {
    if (view.value === 'products') {
      productReport.value = await salesService.byProduct(filters.value)
    } else if (view.value === 'tables') {
      tableReport.value = await salesService.byTable(filters.value)
    } else if (view.value === 'cash') {
      cashSessions.value = await salesService.cashSessions({ from: filters.value.from || undefined, to: filters.value.to || undefined })
    }
    if (view.value === 'sales' || !report.value) {
      report.value = await salesService.report(filters.value)
    }
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar las ventas. Inténtalo de nuevo.'))
  } finally {
    loading.value = false
  }
}

watch(view, load)

const exportExcel = async () => {
  exporting.value = true
  try {
    if (view.value !== 'cash') await salesService.export(filters.value, view.value)
  } catch (error) {
    notify(errorMessage(error, 'No fue posible descargar el Excel. Inténtalo de nuevo.'))
  } finally {
    exporting.value = false
  }
}

// Cambiar un filtro consulta solo, con una pequeña espera para no disparar
// una consulta por tecla mientras se escribe.
let reloadTimer: ReturnType<typeof setTimeout> | undefined
watch(
  filters,
  () => {
    clearTimeout(reloadTimer)
    reloadTimer = setTimeout(load, 300)
  },
  { deep: true },
)

onMounted(load)
</script>
