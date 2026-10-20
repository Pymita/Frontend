<template>
  <v-container fluid>
    <v-row class="mb-2">
      <v-col cols="12">
        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <div class="d-flex align-center">
            <v-icon size="40" class="mr-3" color="primary">mdi-wallet</v-icon>
            <div>
              <h1 class="text-h4">Cartera</h1>
              <p class="text-body-1 text-medium-emphasis">
                Lo que te deben tus clientes, sus abonos y los recibos de caja
              </p>
            </div>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-alert
      v-if="business && !business.complete"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-4">
      Tus facturas y recibos salen solo con el nombre de la empresa.
      <template v-if="isAdmin">
        Completa el NIT, la dirección y los teléfonos en
        <router-link to="/configuracion">Configuración › Datos del negocio</router-link>.
      </template>
      <template v-else>Pídele al administrador que complete los datos del negocio.</template>
    </v-alert>

    <v-row dense class="mb-2">
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Saldo por cobrar</div>
          <div class="text-h5 font-weight-bold tabular-nums">{{ money(receivables?.summary.balance) }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Vencido</div>
          <div class="text-h5 font-weight-bold tabular-nums">{{ money(receivables?.summary.overdue_balance) }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Clientes con saldo</div>
          <div class="text-h5 font-weight-bold">{{ receivables?.summary.customers ?? 0 }}</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center">
          <div class="text-caption text-medium-emphasis">Abonado</div>
          <div class="text-h5 font-weight-bold tabular-nums">{{ money(receivables?.summary.paid) }}</div>
        </v-card>
      </v-col>
    </v-row>

    <v-card class="mb-4">
      <v-card-text>
        <v-row dense align="center">
          <v-col cols="12" md="5">
            <v-text-field
              v-model="receivableFilters.q"
              prepend-inner-icon="mdi-magnify"
              label="Buscar cliente, documento o concepto"
              density="compact"
              hide-details
              clearable />
          </v-col>
          <v-col cols="12" md="4">
            <v-switch
              v-model="receivableFilters.all"
              label="Incluir documentos pagados"
              color="primary"
              density="compact"
              hide-details />
          </v-col>
          <v-col cols="12" md="3" class="d-flex justify-md-end">
            <v-btn
              color="primary"
              variant="outlined"
              prepend-icon="mdi-microsoft-excel"
              :loading="exporting"
              :disabled="(receivables?.customers.length ?? 0) === 0"
              @click="exportReceivables">
              Descargar Excel
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-progress-linear v-if="loadingReceivables" indeterminate color="primary" class="mb-2" />

    <v-alert
      v-if="!loadingReceivables && receivables && receivables.customers.length === 0"
      type="success"
      variant="tonal">
      Nadie tiene saldo pendiente.
    </v-alert>

    <v-expansion-panels v-else multiple>
      <v-expansion-panel
        v-for="customer in receivables?.customers ?? []"
        :key="customer.customer_id ?? customer.customer_document ?? customer.customer_name">
        <v-expansion-panel-title>
          <div class="d-flex flex-wrap align-center ga-2 w-100 pr-2">
            <div>
              <div class="font-weight-medium">{{ customer.customer_name }}</div>
              <div class="text-caption text-medium-emphasis">{{ customer.customer_document || 'Sin documento' }}</div>
            </div>
            <v-spacer />
            <v-chip v-if="customer.overdue_balance > 0" size="small" color="error" variant="tonal">
              Vencido {{ money(customer.overdue_balance) }}
            </v-chip>
            <span class="text-body-1 font-weight-bold tabular-nums">Saldo {{ money(customer.balance) }}</span>
            <!-- El abono va al cliente: paga sus documentos del más viejo al más nuevo. -->
            <v-btn
              v-if="customer.balance > 0 && customer.customer_id"
              color="primary"
              size="small"
              variant="flat"
              prepend-icon="mdi-cash-plus"
              :disabled="isReadOnly"
              @click.stop="openCustomerPayment(customer)">
              Registrar abono
            </v-btn>
          </div>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Documento</th>
                <th>Concepto</th>
                <th>Vence</th>
                <th class="text-end">Valor</th>
                <th class="text-end">Abonos</th>
                <th class="text-end">Saldo</th>
                <th>Estado</th>
                <th class="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in customer.documents" :key="doc.id">
                <td class="text-no-wrap">{{ formatDay(doc.issued_at) }}</td>
                <td class="text-no-wrap">{{ label(documentKindLabels, doc.document_kind) }}</td>
                <td class="font-weight-medium text-no-wrap">{{ doc.document_number }}</td>
                <td>{{ doc.concept }} <span v-if="doc.period" class="text-medium-emphasis">({{ periodName(doc.period) }})</span></td>
                <td class="text-no-wrap">
                  {{ formatDay(doc.due_date) }}
                  <v-chip v-if="doc.overdue" size="x-small" color="error" variant="tonal" class="ml-1">Vencida</v-chip>
                </td>
                <td class="text-end tabular-nums">{{ money(doc.total) }}</td>
                <td class="text-end tabular-nums">{{ money(doc.paid) }}</td>
                <td class="text-end tabular-nums font-weight-bold">{{ money(doc.balance) }}</td>
                <td>
                  <v-chip size="small" variant="tonal" :color="recurringInvoiceStatusColors[doc.status]">
                    {{ label(recurringInvoiceStatusLabels, doc.status) }}
                  </v-chip>
                </td>
                <td class="text-end text-no-wrap">
                  <v-btn
                    v-if="doc.document_kind !== 'credit_sale' || canPrintSales"
                    icon="mdi-printer"
                    size="small"
                    variant="text"
                    :aria-label="`Imprimir ${doc.document_number}`"
                    @click="printInvoice(doc)" />
                  <v-btn
                    size="small"
                    variant="text"
                    color="primary"
                    prepend-icon="mdi-cash-plus"
                    :disabled="isReadOnly"
                    @click="openPaymentDialog(doc.id)">
                    {{ doc.balance > 0 ? 'Abonar' : 'Ver abonos' }}
                  </v-btn>
                  <v-btn
                    v-if="canCancel && doc.paid === 0 && doc.document_kind !== 'credit_sale'"
                    icon="mdi-cancel"
                    size="small"
                    variant="text"
                    color="error"
                    :aria-label="`Anular ${doc.document_number}`"
                    :disabled="isReadOnly"
                    @click="openCancelDialog(doc, customer.customer_name)" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Histórico de abonos: cada recibo de caja, parcial o total -->
    <v-card class="mt-6" data-testid="historico-abonos">
      <v-card-title class="d-flex flex-wrap align-center ga-2">
        <v-icon start>mdi-history</v-icon>
        Histórico de abonos
        <v-spacer />
        <v-btn
          color="primary"
          variant="outlined"
          prepend-icon="mdi-file-pdf-box"
          :loading="exportingPdf"
          :disabled="paymentHistoryTotal === 0"
          @click="downloadHistoryPdf">
          Descargar PDF
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-row dense class="mb-2" align="center">
          <v-col cols="12" md="4">
            <v-autocomplete
              v-model="historyFilters.customer_id"
              :items="historyCustomerOptions"
              item-title="title"
              item-value="value"
              label="Cliente"
              density="compact"
              hide-details
              clearable />
          </v-col>
          <v-col cols="6" md="3">
            <DateField v-model="historyFilters.from" label="Desde" density="compact" hide-details clearable />
          </v-col>
          <v-col cols="6" md="3">
            <DateField
              v-model="historyFilters.to"
              label="Hasta"
              density="compact"
              hide-details
              clearable
              :min="historyFilters.from || undefined" />
          </v-col>
          <v-col cols="12" md="2" class="text-md-end text-body-2 text-medium-emphasis">
            {{ paymentHistorySummary.count }} recibo{{ paymentHistorySummary.count === 1 ? '' : 's' }}
            · {{ money(paymentHistorySummary.total) }}
          </v-col>
        </v-row>

        <v-data-table-server
          v-model:page="historyPage"
          v-model:items-per-page="historyPerPage"
          :headers="historyHeaders"
          :items="paymentHistory"
          :items-length="paymentHistoryTotal"
          :items-per-page-options="PAGE_SIZE_OPTIONS"
          :loading="loadingHistory"
          class="elevation-0"
          hover>
          <template #item.paid_at="{ item }">
            <div class="text-no-wrap">{{ formatDay(item.paid_at) }}</div>
            <div v-if="item.registered_at" class="text-caption text-medium-emphasis">
              {{ formatTime(item.registered_at) }}
            </div>
          </template>
          <template #item.reference="{ item }">
            <v-btn
              size="small"
              variant="text"
              color="primary"
              prepend-icon="mdi-printer"
              :aria-label="`Imprimir ${item.reference}`"
              @click="printReceipt(item.number)">
              {{ item.reference }}
            </v-btn>
          </template>
          <template #item.customer="{ item }">
            <div>{{ item.customer.name }}</div>
            <div class="text-caption text-medium-emphasis">{{ item.customer.document || 'Sin documento' }}</div>
          </template>
          <template #item.documents="{ item }">
            <div v-for="line in item.lines" :key="line.payment_id ?? `${line.document_number}-${line.amount}`" class="text-no-wrap">
              {{ line.document_number }}
              <span class="tabular-nums">{{ money(line.amount) }}</span>
            </div>
          </template>
          <template #item.payment_method="{ item }">
            {{ (item.payment_method && PAYMENT_METHOD_LABELS[item.payment_method as PaymentMethod]) || item.payment_method || '—' }}
          </template>
          <template #item.total="{ item }">
            <span class="tabular-nums font-weight-medium">{{ money(item.total) }}</span>
          </template>
          <template #item.balance_after="{ item }">
            <span class="tabular-nums">{{ money(item.balance_after) }}</span>
          </template>
          <template #item.received_by="{ item }">
            {{ item.received_by || '—' }}
          </template>
          <template #no-data>
            <div class="text-center text-medium-emphasis py-6">
              Aún no hay abonos con estos filtros.
            </div>
          </template>
        </v-data-table-server>
      </v-card-text>
    </v-card>

    <!-- Abonos de un documento -->
    <v-dialog v-model="paymentDialog" max-width="620">
      <v-card v-if="paymentInvoice">
        <v-card-title class="bg-primary">
          {{ paymentInvoice.document_number }} · {{ paymentInvoice.customer_name }}
        </v-card-title>
        <v-card-text class="pt-4">
          <div class="d-flex flex-wrap ga-6 mb-4">
            <div>
              <div class="text-caption text-medium-emphasis">Valor</div>
              <div class="text-h6 tabular-nums">{{ money(paymentInvoice.total) }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Abonado</div>
              <div class="text-h6 tabular-nums">{{ money(paymentInvoice.amount_paid) }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">Saldo</div>
              <div class="text-h6 font-weight-bold tabular-nums">{{ money(paymentInvoice.balance) }}</div>
            </div>
          </div>

          <v-table v-if="paymentInvoice.payments.length" density="compact" class="mb-4">
            <thead>
              <tr>
                <th>Recibo</th>
                <th>Fecha</th>
                <th>Método</th>
                <th class="text-end">Valor</th>
                <th v-if="isAdmin" class="text-end"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="payment in paymentInvoice.payments" :key="payment.id">
                <td>
                  <v-btn
                    v-if="payment.receipt_number"
                    size="small"
                    variant="text"
                    color="primary"
                    prepend-icon="mdi-printer"
                    @click="printReceipt(payment.receipt_number)">
                    RC-{{ payment.receipt_number }}
                  </v-btn>
                </td>
                <td>{{ formatDay(payment.paid_at) }}</td>
                <td>{{ PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method }}</td>
                <td class="text-end tabular-nums">{{ money(payment.amount) }}</td>
                <td v-if="isAdmin" class="text-end">
                  <v-btn
                    size="small"
                    variant="text"
                    color="error"
                    :disabled="isReadOnly"
                    @click="revertPayment(payment.id)">
                    Revertir
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>

          <v-form v-if="paymentInvoice.balance > 0" ref="paymentFormRef">
            <v-row dense>
              <v-col cols="12" md="4">
                <MoneyField
                  v-model="paymentForm.amount"
                  label="Valor del abono"
                  :rules="[positiveAmount]"
                  density="comfortable"
                  empty-as-zero />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="paymentForm.payment_method"
                  :items="methodOptions"
                  label="Método de pago"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="4">
                <DateField v-model="paymentForm.paid_at" label="Fecha" :max="today" density="comfortable" />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="lastReceiptNumber"
            variant="outlined"
            color="primary"
            prepend-icon="mdi-printer"
            @click="printReceipt(lastReceiptNumber)">
            Imprimir recibo RC-{{ lastReceiptNumber }}
          </v-btn>
          <v-spacer />
          <v-btn @click="paymentDialog = false">Cerrar</v-btn>
          <LockableButton
            v-if="paymentInvoice.balance > 0"
            color="primary"
            :loading="savingPayment"
            @click="savePayment">
            Registrar abono
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Abono al cliente: se reparte del documento más viejo al más nuevo -->
    <v-dialog v-model="customerPaymentDialog" max-width="640">
      <v-card v-if="customerPaymentTarget">
        <v-card-title class="bg-primary">Abono de {{ customerPaymentTarget.customer_name }}</v-card-title>
        <v-card-text class="pt-4">
          <template v-if="!customerReceipt">
            <p class="text-body-2 mb-3">
              Debe <strong class="tabular-nums">{{ money(customerPaymentTarget.balance) }}</strong>.
              El abono paga primero los documentos más viejos.
            </p>
            <v-form ref="customerPaymentFormRef">
              <v-row dense>
                <v-col cols="12" md="4">
                  <MoneyField
                    v-model="customerPaymentForm.amount"
                    label="Valor del abono"
                    :rules="[positiveAmount]"
                    density="comfortable"
                    empty-as-zero />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="customerPaymentForm.payment_method"
                    :items="methodOptions"
                    label="Método de pago"
                    density="comfortable" />
                </v-col>
                <v-col cols="12" md="4">
                  <DateField v-model="customerPaymentForm.paid_at" label="Fecha" :max="today" density="comfortable" />
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="customerPaymentForm.notes" label="Nota (opcional)" density="comfortable" />
                </v-col>
              </v-row>
            </v-form>
            <v-table density="compact">
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Vence</th>
                  <th class="text-end">Saldo</th>
                  <th class="text-end">Se abona</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="line in distribution" :key="line.id">
                  <td>{{ line.document_number }} <span v-if="line.period" class="text-medium-emphasis">({{ periodName(line.period) }})</span></td>
                  <td>{{ formatDay(line.due_date) }}</td>
                  <td class="text-end tabular-nums">{{ money(line.balance) }}</td>
                  <td class="text-end tabular-nums font-weight-bold">{{ line.applied ? money(line.applied) : '—' }}</td>
                </tr>
              </tbody>
            </v-table>
          </template>
          <v-alert v-else type="success" variant="tonal">
            Abono registrado en el recibo de caja <strong>{{ customerReceipt.reference }}</strong>
            por <strong class="tabular-nums">{{ money(customerReceipt.total) }}</strong>.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="customerReceipt"
            variant="outlined"
            color="primary"
            prepend-icon="mdi-printer"
            @click="printReceipt(customerReceipt.number)">
            Imprimir recibo {{ customerReceipt.reference }}
          </v-btn>
          <v-spacer />
          <v-btn @click="customerPaymentDialog = false">{{ customerReceipt ? 'Cerrar' : 'Cancelar' }}</v-btn>
          <LockableButton
            v-if="!customerReceipt"
            color="primary"
            :loading="savingCustomerPayment"
            @click="saveCustomerPayment">
            Registrar abono
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Anular documento (admin) -->
    <v-dialog v-model="cancelDialog" max-width="480">
      <v-card v-if="cancelTarget">
        <v-card-title class="bg-primary">Anular {{ cancelTarget.document_number }}</v-card-title>
        <v-card-text class="pt-4">
          <p class="mb-3">
            El documento de <strong>{{ cancelTarget.customer }}</strong> sale de la cartera y el número no se vuelve a usar.
            Podrás facturarle de nuevo ese mes.
          </p>
          <v-text-field v-model="cancelReason" label="Motivo (opcional)" density="comfortable" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="cancelDialog = false">Volver</v-btn>
          <v-btn color="error" :loading="cancelling" @click="confirmCancel">Anular</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 4000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDay, formatTime } from '@/utils/dates'
import { downloadAbonosPdf } from '@/utils/abonosPdf'
import { PAGE_SIZE_OPTIONS, useServerPage } from '@/composables/useServerPage'
import { computed, onMounted, ref, watch } from 'vue'
import LockableButton from '../components/LockableButton.vue'
import DateField from '../components/DateField.vue'
import MoneyField from '../components/MoneyField.vue'
import { useReadOnly } from '../composables/useReadOnly'
import {
  billingService,
  type CashReceipt,
  type Customer,
  type ReceivableCustomer,
  type ReceivableDocument,
  type Receivables,
  type RecurringInvoice,
} from '../services/billingService'
import {
  fillDocumentWindow,
  invoiceHtml,
  openDocumentWindow,
  receiptHtml,
  saleDocumentNumber,
  saleInvoiceHtml,
  type DocumentBusiness,
} from '../utils/printDocuments'
import { ordersService } from '../services/ordersService'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../services/salesService'
import { useAuthStore } from '../stores/auth'
import { effectiveFeatures } from '../types/auth'
import { errorMessage } from '../utils/errors'
import {
  documentKindLabels,
  label,
  recurringInvoiceStatusColors,
  recurringInvoiceStatusLabels,
} from '../utils/labels'

const isReadOnly = useReadOnly()
const authStore = useAuthStore()
// Revertir abonos cambia la cartera ya reportada: solo el admin.
const isAdmin = computed(() => authStore.isAdmin)
// Anular un documento es además de la facturación automática (el API lo pide).
const canCancel = computed(() => isAdmin.value && effectiveFeatures(authStore.user).includes('recurring_billing'))

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' | 'warning' = 'success') => {
  snackbar.value = { show: true, text, color }
}

const localDate = (date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Las fechas llegan como AAAA-MM-DD: se arman a mano para que la zona horaria
// del navegador no las corra un día.
const periodName = (value: string): string => {
  const [y = 0, m = 1] = value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

const today = localDate()
const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, title]) => ({ value, title }))
const positiveAmount = (amount: number | null) => (amount ?? 0) > 0 || 'Escribe el valor del abono'

// --- Impresión (cuenta de cobro / factura y recibo de caja) ---
const business = ref<DocumentBusiness | null>(null)
const printBlocked = () =>
  notify('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error')

// A credit sale prints the POS factura of its order's sale, not the monthly template.
const canPrintSales = computed(() => effectiveFeatures(authStore.user).some(f => f === 'orders' || f === 'reports'))

const printInvoice = async (receivable: ReceivableDocument) => {
  const win = openDocumentWindow()
  if (!win) return printBlocked()
  try {
    if (receivable.document_kind === 'credit_sale' && receivable.order_id && receivable.order_payment_id) {
      const [header, sale] = await Promise.all([
        business.value ? Promise.resolve(business.value) : billingService.getBusiness(),
        ordersService.saleReceipt(receivable.order_id, receivable.order_payment_id),
      ])
      fillDocumentWindow(win, saleDocumentNumber(sale), saleInvoiceHtml(header, sale))
      return
    }
    const doc = await billingService.getInvoiceDocument(receivable.id)
    fillDocumentWindow(win, doc.invoice.document_number, invoiceHtml(doc.business, doc.invoice, doc.resolution))
  } catch (error) {
    win.close()
    notify(errorMessage(error, 'No se pudo generar el documento para imprimir'), 'error')
  }
}

const printReceipt = async (receiptNumber: number) => {
  const win = openDocumentWindow()
  if (!win) return printBlocked()
  try {
    const { business: header, receipt } = await billingService.getReceipt(receiptNumber)
    fillDocumentWindow(win, receipt.reference, receiptHtml(header, receipt))
  } catch (error) {
    win.close()
    notify(errorMessage(error, 'No se pudo generar el recibo para imprimir'), 'error')
  }
}

// ===== Saldos por cliente =====
const receivables = ref<Receivables | null>(null)
const loadingReceivables = ref(false)
const receivableFilters = ref({ q: '', all: false })
const exporting = ref(false)

const loadReceivables = async () => {
  loadingReceivables.value = true
  try {
    receivables.value = await billingService.getReceivables(receivableFilters.value)
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar la cartera. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingReceivables.value = false
  }
}

let receivablesTimer: ReturnType<typeof setTimeout> | undefined
watch(
  receivableFilters,
  () => {
    clearTimeout(receivablesTimer)
    receivablesTimer = setTimeout(loadReceivables, 300)
  },
  { deep: true },
)

const exportReceivables = async () => {
  exporting.value = true
  try {
    await billingService.exportReceivables(receivableFilters.value)
  } catch (error) {
    notify(errorMessage(error, 'No fue posible descargar la cartera. Inténtalo de nuevo.'), 'error')
  } finally {
    exporting.value = false
  }
}

// --- Histórico de abonos ---
const customers = ref<Customer[]>([])

const loadCustomers = async () => {
  try {
    customers.value = await billingService.getCustomers()
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar los clientes. Inténtalo de nuevo.'), 'error')
  }
}

const historyFilters = ref<{ customer_id: number | null; from: string; to: string }>({
  customer_id: null,
  from: '',
  to: '',
})
const paymentHistorySummary = ref({ count: 0, total: 0 })
const exportingPdf = ref(false)
const historyHeaders = [
  { title: 'Fecha', key: 'paid_at', sortable: false },
  { title: 'Recibo', key: 'reference', sortable: false },
  { title: 'Cliente', key: 'customer', sortable: false },
  { title: 'Documentos', key: 'documents', sortable: false },
  { title: 'Método', key: 'payment_method', sortable: false },
  { title: 'Total', key: 'total', sortable: false, align: 'end' as const },
  { title: 'Saldo', key: 'balance_after', sortable: false, align: 'end' as const },
  { title: 'Registró', key: 'received_by', sortable: false },
]

const historyCustomerOptions = computed(() =>
  customers.value.map(customer => ({
    value: customer.id,
    title: `${customer.name}${customer.document_number ? ` (${customer.document_number})` : ''}`,
  })),
)

const {
  items: paymentHistory,
  total: paymentHistoryTotal,
  page: historyPage,
  perPage: historyPerPage,
  loading: loadingHistory,
  load: loadPaymentHistory,
} = useServerPage<CashReceipt>(
  async query => {
    const page = await billingService.getPaymentHistory(
      {
        customer_id: historyFilters.value.customer_id || undefined,
        from: historyFilters.value.from || undefined,
        to: historyFilters.value.to || undefined,
      },
      query,
    )
    paymentHistorySummary.value = page.summary
    return { data: page.data, meta: page.meta }
  },
  {
    filters: [historyFilters],
    onError: error => notify(errorMessage(error, 'No fue posible cargar el histórico de abonos.'), 'error'),
  },
)

const downloadHistoryPdf = async () => {
  exportingPdf.value = true
  try {
    const filters = {
      customer_id: historyFilters.value.customer_id || undefined,
      from: historyFilters.value.from || undefined,
      to: historyFilters.value.to || undefined,
    }
    const [{ data, summary }, header] = await Promise.all([
      billingService.listPaymentHistory(filters),
      business.value ? Promise.resolve(business.value) : billingService.getBusiness(),
    ])
    if (!business.value) business.value = header
    const customerName = historyFilters.value.customer_id
      ? customers.value.find(c => c.id === historyFilters.value.customer_id)?.name
      : undefined
    await downloadAbonosPdf(header, data, {
      from: filters.from,
      to: filters.to,
      customerName,
    }, summary.total)
  } catch (error) {
    notify(errorMessage(error, 'No se pudo descargar el PDF del histórico.'), 'error')
  } finally {
    exportingPdf.value = false
  }
}

const refreshCartera = async () => {
  await Promise.all([loadReceivables(), loadPaymentHistory()])
}

// --- Abonos ---
const paymentDialog = ref(false)
const paymentInvoice = ref<RecurringInvoice | null>(null)
const paymentFormRef = ref<any>(null)
const savingPayment = ref(false)
const paymentForm = ref({ amount: 0, payment_method: 'cash' as PaymentMethod, paid_at: today })

const resetPaymentForm = (invoice: RecurringInvoice) => {
  paymentForm.value = { amount: invoice.balance, payment_method: 'cash', paid_at: today }
}

// El recibo del abono recién registrado, para imprimirlo con un clic.
const lastReceiptNumber = ref<number | null>(null)

const openPaymentDialog = async (invoiceId: number) => {
  try {
    paymentInvoice.value = await billingService.getRecurringInvoice(invoiceId)
    resetPaymentForm(paymentInvoice.value)
    lastReceiptNumber.value = null
    paymentDialog.value = true
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar el documento. Inténtalo de nuevo.'), 'error')
  }
}

const savePayment = async () => {
  if (!paymentInvoice.value) return
  const { valid } = await paymentFormRef.value.validate()
  if (!valid) return

  savingPayment.value = true
  try {
    const { data, message } = await billingService.addRecurringPayment(paymentInvoice.value.id, paymentForm.value)
    paymentInvoice.value = data
    lastReceiptNumber.value = data.receipt_number ?? null
    resetPaymentForm(data)
    notify(message)
    await refreshCartera()
  } catch (error) {
    notify(errorMessage(error, 'No se pudo registrar el abono'), 'error')
  } finally {
    savingPayment.value = false
  }
}

// --- Abono al cliente ---
const customerPaymentDialog = ref(false)
const customerPaymentTarget = ref<ReceivableCustomer | null>(null)
const customerPaymentFormRef = ref<any>(null)
const savingCustomerPayment = ref(false)
const customerReceipt = ref<CashReceipt | null>(null)
const customerPaymentForm = ref({ amount: 0, payment_method: 'cash' as PaymentMethod, paid_at: today, notes: '' })

const openCustomerPayment = (customer: ReceivableCustomer) => {
  customerPaymentTarget.value = customer
  customerReceipt.value = null
  customerPaymentForm.value = { amount: customer.balance, payment_method: 'cash', paid_at: today, notes: '' }
  customerPaymentDialog.value = true
}

/** Cómo se repartiría el abono: primero lo más viejo (igual que el servidor). */
const distribution = computed(() => {
  let left = Number(customerPaymentForm.value.amount) || 0
  return (customerPaymentTarget.value?.documents ?? [])
    .filter(doc => doc.balance > 0)
    .map(doc => {
      const applied = Math.max(0, Math.min(left, doc.balance))
      left -= applied
      return { ...doc, applied }
    })
})

const saveCustomerPayment = async () => {
  const target = customerPaymentTarget.value
  if (!target?.customer_id) return
  const { valid } = await customerPaymentFormRef.value.validate()
  if (!valid) return

  savingCustomerPayment.value = true
  try {
    const { data, message } = await billingService.payCustomer(target.customer_id, {
      ...customerPaymentForm.value,
      notes: customerPaymentForm.value.notes || undefined,
    })
    customerReceipt.value = data
    notify(message)
    await refreshCartera()
  } catch (error) {
    notify(errorMessage(error, 'No se pudo registrar el abono'), 'error')
  } finally {
    savingCustomerPayment.value = false
  }
}

const revertPayment = async (paymentId: number) => {
  if (!confirm('¿Revertir este abono? El saldo del documento vuelve a subir.')) return
  try {
    paymentInvoice.value = await billingService.deleteRecurringPayment(paymentId)
    resetPaymentForm(paymentInvoice.value)
    notify('Abono revertido exitosamente')
    await refreshCartera()
  } catch (error) {
    notify(errorMessage(error, 'No se pudo revertir el abono'), 'error')
  }
}

// --- Anular ---
const cancelDialog = ref(false)
const cancelTarget = ref<{ id: number; document_number: string; customer: string } | null>(null)
const cancelReason = ref('')
const cancelling = ref(false)

const openCancelDialog = (doc: ReceivableDocument, customer: string) => {
  cancelTarget.value = { id: doc.id, document_number: doc.document_number, customer }
  cancelReason.value = ''
  cancelDialog.value = true
}

const confirmCancel = async () => {
  if (!cancelTarget.value) return
  cancelling.value = true
  try {
    await billingService.cancelRecurringInvoice(cancelTarget.value.id, cancelReason.value || undefined)
    notify('Documento anulado exitosamente')
    cancelDialog.value = false
    await refreshCartera()
  } catch (error) {
    notify(errorMessage(error, 'No se pudo anular el documento'), 'error')
  } finally {
    cancelling.value = false
  }
}

onMounted(async () => {
  billingService.getBusiness().then(b => (business.value = b)).catch(() => {})
  await Promise.all([loadReceivables(), loadCustomers(), loadPaymentHistory()])
})
</script>
