<template>
  <div class="d-flex align-center flex-wrap ga-2">
    <template v-if="session">
      <v-chip
        :color="session.has_previous_day_movements ? 'warning' : 'info'"
        variant="tonal"
        :prepend-icon="session.has_previous_day_movements ? 'mdi-alert-outline' : 'mdi-cash-register'"
        data-testid="cash-open-chip"
      >
        {{ chipText }}
      </v-chip>
      <LockableButton variant="outlined" color="primary" icon="mdi-lock-outline" @click="openCloseDialog">
        Cerrar caja
      </LockableButton>
    </template>

    <!-- Review the live shift, reconfirm, then show the summary the close froze -->
    <v-dialog v-model="closeDialog" max-width="600" scrollable>
      <v-card v-if="shown">
        <v-card-title>{{ step === 'done' ? 'Caja cerrada' : 'Cerrar caja' }}</v-card-title>
        <v-card-text>
          <template v-if="step === 'confirm'">
            <v-alert type="warning" variant="tonal">
              <div class="font-weight-bold mb-1">¿Seguro que quieres cerrar la caja?</div>
              El turno {{ shown.number }} queda cerrado con {{ money(shown.summary.sales_total) }} en ventas y empieza
              uno nuevo de inmediato. Si te equivocas, el administrador lo corrige en Ventas › Cierres de caja.
            </v-alert>
            <p v-if="typeof countedCash === 'number'" class="text-body-2 mt-3">
              Efectivo contado {{ money(countedCash) }}: {{ differenceText }}
            </p>
          </template>

          <template v-else>
            <v-alert v-if="step === 'done'" :type="resultType" variant="tonal" density="compact" class="mb-4">
              {{ resultMessage }}
            </v-alert>
            <v-alert v-else-if="shown.has_previous_day_movements" type="warning" variant="tonal" density="compact" class="mb-4">
              Este turno tiene ventas desde el {{ formatMomentDay(shown.summary.first_movement_at) }}. Si se te olvidó
              cerrar la caja ese día, pide al administrador que la cierre con esa fecha en Ventas › Cierres de caja:
              así lo de hoy queda en un turno nuevo.
            </v-alert>

            <p class="text-body-2 text-medium-emphasis">Turno {{ shown.number }} · {{ periodText }}</p>
            <p v-if="invoiceRange" class="text-body-2 text-medium-emphasis">Facturas {{ invoiceRange }}</p>

            <div class="d-flex flex-wrap ga-6 my-3">
              <div>
                <div class="text-caption text-medium-emphasis">Ventas</div>
                <div class="text-h6 tabular-nums" data-testid="cash-sales-total">{{ money(shown.summary.sales_total) }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ plural(shown.summary.sales_count ?? 0, 'venta', 'ventas') }} ·
                  {{ plural(shown.summary.orders_count ?? 0, 'pedido', 'pedidos') }}
                </div>
              </div>
              <div>
                <div class="text-caption text-medium-emphasis">Propinas</div>
                <div class="text-h6 tabular-nums">{{ money(shown.summary.tips_total) }}</div>
              </div>
              <div v-if="shown.summary.order_abonos">
                <div class="text-caption text-medium-emphasis">Abonos a cuentas abiertas</div>
                <div class="text-h6 tabular-nums">{{ money(shown.summary.order_abonos) }}</div>
              </div>
            </div>

            <v-table density="compact" class="mb-4">
              <thead>
                <tr>
                  <th>Medio</th>
                  <th class="text-end">Cobros</th>
                  <th class="text-end d-none d-sm-table-cell">Propinas</th>
                  <th class="text-end">Recibido</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in methodRows" :key="entry.method">
                  <td>{{ entry.label }}</td>
                  <td class="text-end tabular-nums">{{ entry.count }}</td>
                  <td class="text-end tabular-nums d-none d-sm-table-cell">{{ money(entry.tips) }}</td>
                  <td class="text-end tabular-nums">{{ money(entry.amount) }}</td>
                </tr>
                <tr v-if="!methodRows.length">
                  <td colspan="4" class="text-medium-emphasis">Aún no hay cobros en este turno.</td>
                </tr>
              </tbody>
            </v-table>

            <div class="mb-4">
              <div v-if="shown.opening_amount > 0" class="d-flex justify-space-between">
                <span>+ Base</span><span class="tabular-nums">{{ money(shown.opening_amount) }}</span>
              </div>
              <div class="d-flex justify-space-between"><span>+ Cobros en efectivo (con propinas)</span><span class="tabular-nums">{{ money(shown.summary.cash_sales) }}</span></div>
              <div v-if="shown.summary.cash_recurring" class="d-flex justify-space-between">
                <span>+ Abonos de cuotas en efectivo</span><span class="tabular-nums">{{ money(shown.summary.cash_recurring) }}</span>
              </div>
              <div v-if="shown.summary.cash_expenses" class="d-flex justify-space-between">
                <span>− Gastos pagados en efectivo</span><span class="tabular-nums">{{ money(shown.summary.cash_expenses) }}</span>
              </div>
              <v-divider class="my-2" />
              <div class="d-flex justify-space-between font-weight-bold">
                <span>Efectivo del turno</span><span class="tabular-nums" data-testid="cash-expected">{{ money(shown.expected_cash) }}</span>
              </div>
              <template v-if="step === 'done' && shown.counted_cash !== null">
                <div class="d-flex justify-space-between">
                  <span>Efectivo contado</span><span class="tabular-nums">{{ money(shown.counted_cash) }}</span>
                </div>
                <div class="d-flex justify-space-between font-weight-bold">
                  <span>Diferencia</span>
                  <span :class="differenceClass(shown.difference ?? 0)" data-testid="cash-difference">{{ differenceLabel(shown.difference ?? 0) }}</span>
                </div>
              </template>
            </div>

            <div v-if="topProducts.length" class="mb-4">
              <div class="text-subtitle-2 mb-1">Productos más vendidos</div>
              <div
                v-for="product in topProducts"
                :key="product.name"
                class="d-flex justify-space-between text-body-2"
                data-testid="cash-product"
              >
                <span>{{ product.name }}</span><span class="tabular-nums">{{ product.quantity }}</span>
              </div>
              <div v-if="moreProducts" class="text-caption text-medium-emphasis">
                y {{ moreProducts }} más en el resumen impreso
              </div>
            </div>

            <template v-if="step === 'review'">
              <v-text-field
                v-model.number="countedCash"
                label="Efectivo contado (opcional)"
                type="number"
                min="0"
                prefix="$"
                hint="Cuenta el efectivo de las ventas, sin la base que dejas en el cajón"
                persistent-hint
              />
              <p
                v-if="typeof countedCash === 'number'"
                class="text-body-1 font-weight-bold mt-2"
                :class="differenceClass(liveDifference)"
                data-testid="cash-difference"
              >
                {{ differenceText }}
              </p>
              <v-text-field v-model="closingNotes" label="Nota (opcional)" class="mt-2" />
            </template>
          </template>
        </v-card-text>

        <v-card-actions v-if="step === 'review'">
          <v-spacer />
          <v-btn @click="closeDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :disabled="typeof countedCash === 'number' && countedCash < 0" @click="step = 'confirm'">
            Cerrar caja
          </v-btn>
        </v-card-actions>
        <v-card-actions v-else-if="step === 'confirm'">
          <v-spacer />
          <v-btn @click="step = 'review'">Volver</v-btn>
          <LockableButton color="primary" variant="flat" :loading="saving" @click="closeRegister">Sí, cerrar caja</LockableButton>
        </v-card-actions>
        <v-card-actions v-else>
          <v-btn variant="outlined" color="primary" prepend-icon="mdi-printer" @click="printSummary">Imprimir resumen</v-btn>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="closeDialog = false">Listo</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" timeout="5000">{{ snackbar.text }}</v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDateTime, formatMomentDay, formatRecent } from '@/utils/dates'
import { computed, onMounted, ref } from 'vue'
import LockableButton from './LockableButton.vue'
import salesService, { PAYMENT_METHOD_LABELS, type CashSession, type PaymentMethod } from '../services/salesService'
import { billingService } from '../services/billingService'
import { cashCloseHtml, fillDocumentWindow, openDocumentWindow } from '../utils/printDocuments'
import { errorMessage } from '../utils/errors'

// The printed summary lists up to 20.
const PRODUCTS_SHOWN = 5

const session = ref<CashSession | null>(null)
const closed = ref<CashSession | null>(null)
const step = ref<'review' | 'confirm' | 'done'>('review')
const resultMessage = ref('')
const saving = ref(false)
const closeDialog = ref(false)
const countedCash = ref<number | null>(null)
const closingNotes = ref('')
const snackbar = ref({ show: false, text: '', color: 'success' })

const shown = computed(() => (step.value === 'done' ? closed.value : session.value))

const chipText = computed(() => {
  const current = session.value
  if (!current) return ''
  return current.has_previous_day_movements && current.summary.first_movement_at
    ? `Caja sin cerrar desde ${formatRecent(current.summary.first_movement_at)}`
    : `Caja abierta desde ${formatRecent(current.opened_at)}`
})

const periodText = computed(() =>
  shown.value?.closed_at
    ? `${formatDateTime(shown.value.opened_at)} a ${formatDateTime(shown.value.closed_at)}`
    : `desde ${formatDateTime(shown.value?.opened_at)}`,
)

const invoiceRange = computed(() => {
  const { first_invoice: first, last_invoice: last } = shown.value?.summary ?? {}
  if (!first) return ''
  return first === last ? first : `${first} a ${last}`
})

const methodRows = computed(() =>
  Object.entries(shown.value?.summary.by_method ?? {})
    .filter(([, totals]) => totals.count > 0)
    .map(([method, totals]) => ({
      method,
      label: PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method,
      count: totals.count,
      tips: totals.tips,
      amount: totals.amount,
    })),
)

const topProducts = computed(() => (shown.value?.summary.products ?? []).slice(0, PRODUCTS_SHOWN))
const moreProducts = computed(() => {
  const summary = shown.value?.summary
  return Math.max((summary?.products?.length ?? 0) - PRODUCTS_SHOWN, 0) + (summary?.products_others?.count ?? 0)
})

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const differenceLabel = (value: number): string =>
  Math.abs(value) < 0.01 ? 'Cuadra: el efectivo está completo' : value > 0 ? `Sobran ${money(value)}` : `Faltan ${money(Math.abs(value))}`
// Sobrante o faltante es una cifra con signo: verde o rojo.
const differenceClass = (value: number): string => (Math.abs(value) < 0.01 || value > 0 ? 'text-success' : 'text-error')

const liveDifference = computed(() => Number(countedCash.value ?? 0) - Number(session.value?.expected_cash ?? 0))
const differenceText = computed(() => differenceLabel(liveDifference.value))

const resultType = computed(() => {
  const difference = closed.value?.difference
  return difference !== null && difference !== undefined && Math.abs(difference) >= 0.01 ? 'warning' : 'success'
})

const notify = (text: string, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

const load = async () => {
  try {
    session.value = await salesService.currentCashSession()
  } catch (error) {
    notify(errorMessage(error, 'No fue posible consultar la caja. Inténtalo de nuevo.'), 'error')
  }
}

// Al abrir el cierre se trae el turno al día: pudo cobrarse algo más.
const openCloseDialog = async () => {
  countedCash.value = null
  closingNotes.value = ''
  closed.value = null
  step.value = 'review'
  await load()
  closeDialog.value = true
}

const closeRegister = async () => {
  if (!session.value) return
  const attempted = session.value.id
  saving.value = true
  try {
    const result = await salesService.closeCashSession(attempted, {
      counted_cash: typeof countedCash.value === 'number' ? countedCash.value : null,
      notes: closingNotes.value,
    })
    closed.value = result.session
    session.value = result.next
    resultMessage.value = result.message
    step.value = 'done'
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cerrar la caja. Inténtalo de nuevo.'), 'error')
    // Another cashier may have closed it first: show the shift that runs now.
    try {
      const current = await salesService.currentCashSession()
      if (current.id !== attempted) {
        session.value = current
        closeDialog.value = false
      }
    } catch {
      // Optional refresh: the failed close was already reported.
    }
  } finally {
    saving.value = false
  }
}

const printSummary = async () => {
  const summary = closed.value
  if (!summary) return
  const win = openDocumentWindow()
  if (!win) {
    notify('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error')
    return
  }
  try {
    const business = await billingService.getBusiness()
    fillDocumentWindow(win, `Cierre de caja ${summary.number}`, cashCloseHtml(business, summary))
  } catch (error) {
    win.close()
    notify(errorMessage(error, 'No fue posible generar el resumen para imprimir. Inténtalo de nuevo.'), 'error')
  }
}

onMounted(load)
</script>
