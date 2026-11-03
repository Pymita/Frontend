<template>
  <div class="d-flex align-center flex-wrap justify-lg-end ga-2">
    <!-- The chips and the actions wrap as pairs: a lone "Cerrar caja" on its own line read as detached. -->
    <template v-if="session">
      <div class="d-flex align-center flex-wrap ga-2">
        <v-chip
          :color="session.has_previous_day_movements ? 'warning' : 'info'"
          variant="tonal"
          :prepend-icon="session.has_previous_day_movements ? 'mdi-alert-outline' : 'mdi-cash-register'"
          data-testid="cash-open-chip"
        >
          {{ chipText }}
        </v-chip>
        <v-chip
          v-if="running.count"
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-cash-minus"
          data-testid="cash-withdrawals-chip"
          @click="withdrawalsDialog = true"
        >
          {{ withdrawalsText(running) }}
        </v-chip>
      </div>
      <div class="d-flex align-center flex-wrap ga-2">
        <LockableButton variant="outlined" color="primary" icon="mdi-cash-minus" @click="openWithdrawDialog">
          Retirar dinero
        </LockableButton>
        <LockableButton variant="outlined" color="primary" icon="mdi-lock-outline" @click="openCloseDialog">
          Cerrar caja
        </LockableButton>
      </div>
    </template>

    <!-- Take cash out of the drawer: the server stamps when and who -->
    <v-dialog v-model="withdrawDialog" max-width="460">
      <v-card v-if="session">
        <v-card-title>Retirar dinero</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Sale del cajón del turno {{ session.number }} con la fecha y la hora de ahora, y al cerrar la caja se
            resta del efectivo a entregar. Ahora debería haber {{ money(session.expected_cash) }} en el cajón.
          </p>
          <MoneyField v-model="withdrawAmount" label="Valor" autofocus />
          <p v-if="aboveDrawer" class="text-body-2 text-warning mb-2" data-testid="withdraw-above-drawer">
            Es más de lo que debería haber en el cajón: revisa el valor antes de registrarlo.
          </p>
          <v-text-field
            v-model="withdrawNotes"
            label="Nota (opcional)"
            hint="Motivo o quién recibe el dinero"
            persistent-hint
            maxlength="255"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="withdrawDialog = false">Cancelar</v-btn>
          <LockableButton
            color="primary"
            variant="flat"
            :loading="withdrawing"
            :disabled="!(withdrawAmount && withdrawAmount > 0)"
            @click="registerWithdrawal"
          >
            Registrar retiro
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- What was taken out of the running shift, to reprint each comprobante -->
    <v-dialog v-model="withdrawalsDialog" max-width="560" scrollable>
      <v-card v-if="session">
        <v-card-title>Retiros del turno {{ session.number }}</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-2">
            {{ plural(running.count, 'retiro', 'retiros') }} por {{ money(running.total) }}. Al cerrar la caja se restan del
            efectivo a entregar.
          </p>
          <div
            v-for="withdrawal in running.list"
            :key="withdrawal.number"
            class="d-flex align-center ga-2 py-1"
            data-testid="cash-withdrawal"
          >
            <div class="flex-grow-1">
              <div class="d-flex justify-space-between ga-2">
                <span>No. {{ withdrawal.number }} · {{ formatRecent(withdrawal.at) }}</span>
                <span class="tabular-nums font-weight-medium">{{ money(withdrawal.amount) }}</span>
              </div>
              <div class="text-caption text-medium-emphasis">{{ withdrawalDetail(withdrawal) }}</div>
            </div>
            <v-btn
              icon="mdi-printer"
              size="small"
              variant="text"
              :aria-label="`Imprimir el retiro de caja No. ${withdrawal.number}`"
              :title="`Imprimir el retiro de caja No. ${withdrawal.number}`"
              @click="printWithdrawal(withdrawal, session.number)"
            />
          </div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="withdrawalsDialog = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Review the live shift, reconfirm, then show the summary the close froze -->
    <v-dialog v-model="closeDialog" max-width="600" scrollable>
      <v-card v-if="shown">
        <v-card-title>{{ step === 'done' ? 'Caja cerrada' : 'Cerrar caja' }}</v-card-title>
        <v-card-text>
          <template v-if="step === 'confirm'">
            <v-alert type="warning" variant="tonal">
              <div class="font-weight-bold mb-1">¿Seguro que quieres cerrar la caja?</div>
              El turno {{ shown.number }} queda cerrado con {{ closingAmounts }} y empieza
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
              Este turno tiene {{ received.plain }} desde el {{ formatMomentDay(shown.summary.first_movement_at) }}. Si se te olvidó
              cerrar la caja ese día, pide al administrador que la cierre con esa fecha en Ventas › Cierres de caja:
              así lo de hoy queda en un turno nuevo.
            </v-alert>

            <p class="text-body-2 text-medium-emphasis">Turno {{ shown.number }} · {{ periodText }}</p>
            <p v-if="invoiceRange" class="text-body-2 text-medium-emphasis">Facturas {{ invoiceRange }}</p>

            <div class="d-flex flex-wrap ga-6 my-3">
              <template v-if="showSales">
                <div>
                  <div class="text-caption text-medium-emphasis">{{ salesLabel }}</div>
                  <div class="text-h6 tabular-nums" data-testid="cash-sales-total">{{ money(shown.summary.sales_total) }}</div>
                  <div class="text-caption text-medium-emphasis">
                    {{ plural(shown.summary.sales_count ?? 0, 'venta', 'ventas') }} ·
                    {{ plural(shown.summary.orders_count ?? 0, 'pedido', 'pedidos') }}
                  </div>
                  <div v-if="shown.summary.credit_sales?.total" class="text-caption text-medium-emphasis" data-testid="cash-credit-sales">
                    {{ money(shown.summary.credit_sales.total) }} a crédito, en Cartera
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
              </template>
              <div v-if="showAbonos">
                <div class="text-caption text-medium-emphasis">Abonos de cuotas</div>
                <div class="text-h6 tabular-nums" data-testid="cash-abonos-total">{{ money(abonosTotal) }}</div>
              </div>
            </div>

            <v-table density="compact" class="mb-4">
              <thead>
                <tr>
                  <th>Medio</th>
                  <template v-if="showSales">
                    <th class="text-end">Cobros</th>
                    <th class="text-end d-none d-sm-table-cell">Propinas</th>
                  </template>
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
                <tr v-for="entry in abonoRows" :key="`abonos-${entry.method}`" data-testid="cash-abono-method">
                  <td>Abonos de cuotas · {{ entry.label }}</td>
                  <template v-if="showSales">
                    <td class="text-end text-medium-emphasis">—</td>
                    <td class="text-end text-medium-emphasis d-none d-sm-table-cell">—</td>
                  </template>
                  <td class="text-end tabular-nums">{{ money(entry.amount) }}</td>
                </tr>
                <tr v-if="!methodRows.length && !abonoRows.length">
                  <td :colspan="showSales ? 4 : 2" class="text-medium-emphasis">Aún no hay {{ received.none }} en este turno.</td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="shownWithdrawals.count" class="mb-4" data-testid="cash-withdrawals">
              <div class="text-subtitle-2 mb-1">Retiros de caja</div>
              <div
                v-for="withdrawal in shownWithdrawals.list"
                :key="withdrawal.number"
                class="d-flex align-center ga-2 text-body-2"
                data-testid="cash-withdrawal"
              >
                <div class="flex-grow-1">
                  <div class="d-flex justify-space-between ga-2">
                    <span>No. {{ withdrawal.number }} · {{ formatRecent(withdrawal.at) }}</span>
                    <span class="tabular-nums">{{ money(withdrawal.amount) }}</span>
                  </div>
                  <div class="text-caption text-medium-emphasis">{{ withdrawalDetail(withdrawal) }}</div>
                </div>
                <v-btn
                  icon="mdi-printer"
                  size="small"
                  variant="text"
                  density="comfortable"
                  :aria-label="`Imprimir el retiro de caja No. ${withdrawal.number}`"
                  :title="`Imprimir el retiro de caja No. ${withdrawal.number}`"
                  @click="printWithdrawal(withdrawal, shown.number)"
                />
              </div>
            </div>

            <div class="mb-4">
              <div v-if="shown.opening_amount > 0" class="d-flex justify-space-between">
                <span>+ Base</span><span class="tabular-nums">{{ money(shown.opening_amount) }}</span>
              </div>
              <div v-if="showSales" class="d-flex justify-space-between">
                <span>+ Cobros {{ drawer }} (con propinas)</span><span class="tabular-nums">{{ money(shown.summary.cash_sales) }}</span>
              </div>
              <div v-if="showAbonos" class="d-flex justify-space-between">
                <span>+ Abonos de cuotas {{ drawer }}</span><span class="tabular-nums">{{ money(shown.summary.cash_recurring) }}</span>
              </div>
              <div v-if="shown.summary.cash_expenses" class="d-flex justify-space-between">
                <span>− Gastos pagados {{ drawer }}</span><span class="tabular-nums">{{ money(shown.summary.cash_expenses) }}</span>
              </div>
              <div v-if="shownWithdrawals.total" class="d-flex justify-space-between">
                <span>− Retiros de caja</span><span class="tabular-nums" data-testid="cash-withdrawn">{{ money(shownWithdrawals.total) }}</span>
              </div>
              <v-divider class="my-2" />
              <div class="d-flex justify-space-between font-weight-bold">
                <span>Efectivo a entregar</span><span class="tabular-nums" data-testid="cash-expected">{{ money(shown.expected_cash) }}</span>
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
              <MoneyField
                v-model="countedCash"
                label="Efectivo contado (opcional)"
                :hint="countHint"
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

    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      :timeout="snackbar.actions.length ? 10000 : 5000"
      closable
    >
      {{ snackbar.text }}
      <template v-if="snackbar.actions.length" #actions>
        <v-btn v-for="action in snackbar.actions" :key="action.text" @click="runSnackbarAction(action)">
          {{ action.text }}
        </v-btn>
      </template>
    </v-snackbar>
  </div>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDateTime, formatMomentDay, formatRecent } from '@/utils/dates'
import { computed, onMounted, ref } from 'vue'
import LockableButton from './LockableButton.vue'
import MoneyField from './MoneyField.vue'
import salesService, { type CashSession, type CashWithdrawal } from '../services/salesService'
import { billingService } from '../services/billingService'
import { closeMethodLabel, compareMethodKeys, drawerText, usePaymentMethods } from '../composables/usePaymentMethods'
import {
  cashCloseHtml,
  cashWithdrawalHtml,
  fillDocumentWindow,
  openDocumentWindow,
  type DocumentBusiness,
} from '../utils/printDocuments'
import { errorMessage } from '../utils/errors'
import { useAuthStore } from '../stores/auth'

// The printed summary lists up to 20.
const PRODUCTS_SHOWN = 5
const NO_WITHDRAWALS: CashSession['summary']['cash_withdrawals'] = { count: 0, total: 0, list: [] }

interface MessageAction { text: string; run: () => void }

const authStore = useAuthStore()
// The page that holds the panel already asked for them: their names label the methods.
usePaymentMethods()

const session = ref<CashSession | null>(null)
const closed = ref<CashSession | null>(null)
const step = ref<'review' | 'confirm' | 'done'>('review')
const resultMessage = ref('')
const saving = ref(false)
const closeDialog = ref(false)
const countedCash = ref<number | null>(null)
const closingNotes = ref('')
const snackbar = ref<{ show: boolean; text: string; color: string; actions: MessageAction[] }>({
  show: false,
  text: '',
  color: 'success',
  actions: [],
})

const withdrawDialog = ref(false)
const withdrawalsDialog = ref(false)
const withdrawAmount = ref<number | null>(null)
const withdrawNotes = ref('')
const withdrawing = ref(false)

const shown = computed(() => (step.value === 'done' ? closed.value : session.value))

const withdrawalsOf = (shift: CashSession | null | undefined) => shift?.summary.cash_withdrawals ?? NO_WITHDRAWALS
const running = computed(() => withdrawalsOf(session.value))
const shownWithdrawals = computed(() => withdrawalsOf(shown.value))
const withdrawalsText = ({ count, total }: { count: number; total: number }) =>
  `${plural(count, 'retiro', 'retiros')} · ${money(total)}`
const withdrawalDetail = (withdrawal: CashWithdrawal) => [withdrawal.user_name, withdrawal.notes].filter(Boolean).join(' · ')
const aboveDrawer = computed(() => (withdrawAmount.value ?? 0) > Number(session.value?.expected_cash ?? 0))

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
    .sort(([a], [b]) => compareMethodKeys(a, b))
    .map(([method, totals]) => ({
      method,
      label: closeMethodLabel(shown.value?.summary, method),
      count: totals.count,
      tips: totals.tips,
      amount: totals.amount,
    })),
)

// An abono is cash of the cartera, never a sale: its own rows, by method.
const abonoRows = computed(() =>
  Object.entries(shown.value?.summary.recurring_by_method ?? {})
    .filter(([, amount]) => (amount ?? 0) > 0)
    .sort(([a], [b]) => compareMethodKeys(a, b))
    .map(([method, amount]) => ({
      method,
      label: closeMethodLabel(shown.value?.summary, method),
      amount: amount ?? 0,
    })),
)
const abonosTotal = computed(() => abonoRows.value.reduce((sum, entry) => sum + entry.amount, 0))
// The cash block adds what came in by the methods that go into the drawer, as the API names them.
const drawer = computed(() => drawerText(shown.value?.summary))

// The shift is the company's drawer, whoever closes it, so the close follows
// the company's modules; money that came in always shows. A session stored
// before `modules` existed sees the close as it always was.
const companyModules = computed(() => authStore.user?.company?.modules)
const showSales = computed(() => (companyModules.value?.includes('orders') ?? true) || methodRows.value.length > 0)
const showAbonos = computed(() => !!companyModules.value?.includes('recurring_billing') || abonoRows.value.length > 0)
// With monthly fees "venta" is what gets billed: the close's sales are the orders' only.
const salesLabel = computed(() => (showAbonos.value ? 'Ventas de pedidos' : 'Ventas'))
const received = computed(() => {
  if (!showSales.value) return { plain: 'abonos', named: 'los abonos', none: 'abonos' }
  if (showAbonos.value) return { plain: 'ventas y abonos', named: 'las ventas y los abonos', none: 'cobros ni abonos' }
  return { plain: 'ventas', named: 'las ventas', none: 'cobros' }
})
const closingAmounts = computed(() =>
  [
    showSales.value ? `${money(shown.value?.summary.sales_total)} en ventas` : '',
    showAbonos.value ? `${money(abonosTotal.value)} en abonos` : '',
  ]
    .filter(Boolean)
    .join(' y '),
)
const countHint = computed(() =>
  `Cuenta el efectivo de ${received.value.named}${shownWithdrawals.value.count ? ' que quedó después de los retiros' : ''}, ` +
  'sin la base que dejas en el cajón',
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

const notify = (text: string, color = 'success', actions: MessageAction[] = []) => {
  snackbar.value = { show: true, text, color, actions }
}

const runSnackbarAction = (action: MessageAction) => {
  snackbar.value.show = false
  action.run()
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

// One key per withdrawal until the server confirms it: sending the same
// amount and note again (a double click, a lost answer) replays the first
// answer instead of taking the money out twice; changing them is a new one.
let pendingWithdrawal: { body: string; key: string } | null = null
const withdrawalKey = (body: string): string => {
  if (pendingWithdrawal?.body !== body) {
    // randomUUID needs a secure context: a till opened over plain HTTP on the LAN has none.
    const key = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    pendingWithdrawal = { body, key }
  }
  return pendingWithdrawal.key
}

// Brought up to date first: the drawer may have changed since the page loaded.
const openWithdrawDialog = async () => {
  withdrawAmount.value = null
  withdrawNotes.value = ''
  withdrawalsDialog.value = false
  await load()
  withdrawDialog.value = true
}

const registerWithdrawal = async () => {
  const amount = withdrawAmount.value
  if (!session.value || !amount || amount <= 0) return
  const shift = session.value.id
  const notes = withdrawNotes.value.trim()
  withdrawing.value = true
  try {
    const result = await salesService.withdrawCash(shift, { amount, notes }, withdrawalKey(JSON.stringify([shift, amount, notes])))
    pendingWithdrawal = null
    session.value = result.session
    withdrawDialog.value = false
    // Printing is the cashier's choice, as with a charge's ticket.
    notify(result.message, 'success', [
      { text: 'Imprimir comprobante', run: () => printWithdrawal(result.withdrawal, result.session.number) },
    ])
  } catch (error) {
    notify(errorMessage(error, 'No fue posible registrar el retiro. Inténtalo de nuevo.'), 'error')
    // A shift closed meanwhile: the next attempt goes to the one that runs now.
    try {
      session.value = await salesService.currentCashSession()
    } catch {
      // Optional refresh: the failed withdrawal was already reported.
    }
  } finally {
    withdrawing.value = false
  }
}

/** Opens the print window in the same click (popup blockers) and fills it once the business header arrives. */
const printDocument = async (title: string, build: (business: DocumentBusiness) => string, failure: string) => {
  const win = openDocumentWindow()
  if (!win) {
    notify('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error')
    return
  }
  try {
    fillDocumentWindow(win, title, build(await billingService.getBusiness()))
  } catch (error) {
    win.close()
    notify(errorMessage(error, failure), 'error')
  }
}

const printSummary = () => {
  const summary = closed.value
  if (!summary) return
  printDocument(
    `Cierre de caja ${summary.number}`,
    business => cashCloseHtml(business, summary, { orders: showSales.value }),
    'No fue posible generar el resumen para imprimir. Inténtalo de nuevo.',
  )
}

const printWithdrawal = (withdrawal: CashWithdrawal, shiftNumber: number) =>
  printDocument(
    `Retiro de caja ${withdrawal.number}`,
    business => cashWithdrawalHtml(business, withdrawal, shiftNumber),
    'No fue posible generar el comprobante para imprimir. Inténtalo de nuevo.',
  )

onMounted(load)

// The page that owns the money (Cartera) reloads the chip after each abono.
defineExpose({ load })
</script>
