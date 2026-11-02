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
          <CashRegisterPanel v-if="canUseCashRegister" ref="cashPanel" />
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
        <!-- What customers owed before Servify: typed by hand or from a spreadsheet. -->
        <div class="d-flex flex-wrap align-center ga-2 mt-3">
          <LockableButton color="primary" icon="mdi-file-document-plus-outline" @click="openOpeningDialog">
            Registrar saldos iniciales
          </LockableButton>
          <LockableButton color="primary" variant="outlined" icon="mdi-microsoft-excel" @click="openOpeningImport">
            Importar saldos iniciales desde Excel
          </LockableButton>
          <span class="text-caption text-medium-emphasis">
            Lo que tus clientes ya te debían antes de usar Servify POS. No es una venta: solo queda en la cartera.
          </span>
        </div>
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
          <!-- Nine columns fit the panel at 1440 px only with half the default cell padding. -->
          <v-table density="compact">
            <thead>
              <tr>
                <th class="px-2">Fecha</th>
                <th class="px-2">Documento</th>
                <th class="px-2">Concepto</th>
                <th class="px-2">Vence</th>
                <th class="px-2 text-end">Valor</th>
                <th class="px-2 text-end">Abonos</th>
                <th class="px-2 text-end">Saldo</th>
                <th class="px-2">Estado</th>
                <th class="px-2 text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="doc in customer.documents" :key="doc.id">
                <td class="px-2 text-no-wrap">{{ formatDay(doc.issued_at) }}</td>
                <td class="px-2 py-1">
                  <div class="font-weight-medium text-no-wrap">{{ doc.document_number }}</div>
                  <v-chip v-if="doc.document_kind === 'opening_balance'" size="x-small" variant="tonal" color="secondary">
                    {{ label(documentKindLabels, doc.document_kind) }}
                  </v-chip>
                  <div v-else class="text-caption text-medium-emphasis text-no-wrap">{{ label(documentKindLabels, doc.document_kind) }}</div>
                </td>
                <td class="px-2 py-1">
                  <div>{{ doc.concept }}</div>
                  <div v-if="doc.period" class="text-caption text-medium-emphasis">{{ periodName(doc.period) }}</div>
                </td>
                <td class="px-2 py-1">
                  <div class="text-no-wrap">{{ formatDay(doc.due_date) }}</div>
                  <v-chip v-if="doc.overdue" size="x-small" color="error" variant="tonal">Vencida</v-chip>
                </td>
                <td class="px-2 text-end tabular-nums">{{ money(doc.total) }}</td>
                <td class="px-2 text-end tabular-nums">{{ money(doc.paid) }}</td>
                <td class="px-2 text-end tabular-nums font-weight-bold">{{ money(doc.balance) }}</td>
                <td class="px-2">
                  <v-chip size="small" variant="tonal" :color="recurringInvoiceStatusColors[doc.status]">
                    {{ label(recurringInvoiceStatusLabels, doc.status) }}
                  </v-chip>
                </td>
                <td class="px-2 text-end text-no-wrap">
                  <v-btn
                    v-if="canPrint(doc)"
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
                    v-if="canCancel(doc)"
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
              :items="customerOptions"
              :custom-filter="customerFilter"
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
          <p v-if="cancelTarget.kind === 'opening_balance'" class="mb-3">
            El saldo inicial de <strong>{{ cancelTarget.customer }}</strong> sale de la cartera.
            Si lo registraste mal, puedes registrarlo de nuevo con el mismo número.
          </p>
          <p v-else class="mb-3">
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

    <!-- Saldos iniciales of one customer: one line per pending document, like
         a purchase with several products in Kardex › Registrar movimiento. -->
    <v-dialog v-model="openingDialog" max-width="960" persistent scrollable>
      <v-card>
        <v-card-title class="text-wrap">Registrar saldos iniciales</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Lo que el cliente ya te debía antes de usar Servify POS, con el número de cada factura. No es una venta:
            no suma en Ventas ni en los informes de ventas; queda en la cartera para recibir sus abonos.
          </p>
          <v-autocomplete
            v-model="openingForm.customer_id"
            :items="customerOptions"
            item-title="title"
            item-value="value"
            :custom-filter="customerFilter"
            hint="Búscalo por nombre o documento"
            persistent-hint
            @update:model-value="openingError = ''">
            <template #label>
              Cliente <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
            </template>
          </v-autocomplete>
          <v-btn
            v-if="!newCustomerOpen"
            variant="text"
            color="primary"
            size="small"
            prepend-icon="mdi-account-plus"
            class="mt-1"
            @click="openNewCustomer">
            Nuevo cliente
          </v-btn>
          <v-card v-else variant="outlined" class="pa-3 mt-3">
            <v-form ref="newCustomerFormRef" @submit.prevent="createOpeningCustomer">
              <div class="text-subtitle-2 mb-2">Nuevo cliente</div>
              <v-row dense>
                <v-col cols="12" sm="5">
                  <v-select
                    v-model="newCustomer.document_type"
                    :items="options(customerDocumentTypeLabels)"
                    label="Tipo de documento"
                    density="compact" />
                </v-col>
                <v-col cols="12" sm="7">
                  <v-text-field
                    v-model="newCustomer.document_number"
                    label="Número de documento"
                    density="compact"
                    :rules="[filled('Escribe el número de documento'), documentRule(newCustomer.document_type)]" />
                </v-col>
                <v-col cols="12" sm="7">
                  <v-text-field
                    v-model="newCustomer.name"
                    label="Nombre"
                    density="compact"
                    :rules="[filled('Escribe el nombre del cliente')]" />
                </v-col>
                <v-col cols="12" sm="5">
                  <v-text-field v-model="newCustomer.phone" label="Teléfono (opcional)" density="compact" />
                </v-col>
              </v-row>
              <v-alert v-if="newCustomerError" type="error" variant="tonal" density="compact" class="mb-2">
                {{ newCustomerError }}
              </v-alert>
              <div class="d-flex justify-end ga-2">
                <v-btn variant="text" @click="newCustomerOpen = false">Cancelar</v-btn>
                <v-btn type="submit" color="primary" variant="tonal" :loading="creatingCustomer">Crear cliente</v-btn>
              </div>
            </v-form>
          </v-card>

          <div class="text-subtitle-1 mt-4">Documentos</div>
          <p class="text-caption text-medium-emphasis mb-2">
            Una línea por factura o documento pendiente. Vence es opcional: si lo dejas vacío, vence en la fecha del
            documento. Las líneas vacías no se registran.
          </p>
          <div
            v-for="(line, index) in openingLines"
            :key="line.key"
            role="group"
            :aria-label="`Línea ${index + 1}`"
            class="mb-2">
            <v-row dense align="center">
              <!-- On a phone the delete button sits beside the number; on a wide screen it closes the line. -->
              <v-col cols="10" sm="4" md="3">
                <v-text-field
                  v-model="line.document_number"
                  :error="line.error?.field === 'document_number'"
                  hide-details="auto"
                  @update:model-value="line.error = null">
                  <template #label>
                    N.º de documento <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="2" sm="1" order-md="last" class="text-center">
                <v-btn
                  icon="mdi-delete-outline"
                  variant="text"
                  size="small"
                  :disabled="openingLines.length === 1"
                  :aria-label="line.document_number.trim() ? `Quitar el documento ${line.document_number.trim()}` : `Quitar la línea ${index + 1}`"
                  @click="openingLines.splice(index, 1)" />
              </v-col>
              <v-col cols="6" sm="4" md="2">
                <DateField
                  v-model="line.issued_at"
                  :max="today"
                  :error="line.error?.field === 'issued_at'"
                  hide-details="auto"
                  @update:model-value="line.error = null">
                  <template #label>
                    Fecha <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </DateField>
              </v-col>
              <v-col cols="6" sm="3" md="2">
                <!-- No focus hint: it vanished on blur and moved Registrar away from a click. -->
                <DateField
                  v-model="line.due_date"
                  label="Vence"
                  :error="line.error?.field === 'due_date'"
                  hide-details="auto"
                  @update:model-value="line.error = null" />
              </v-col>
              <v-col cols="6" sm="4" md="2">
                <MoneyField
                  v-model="line.total"
                  :error="line.error?.field === 'total'"
                  hide-details="auto"
                  @update:model-value="line.error = null">
                  <template #label>
                    Valor <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </MoneyField>
              </v-col>
              <v-col cols="6" sm="8" md="2">
                <v-text-field
                  v-model="line.concept"
                  label="Concepto"
                  placeholder="Saldo inicial"
                  :error="line.error?.field === 'concept'"
                  hide-details="auto"
                  @update:model-value="line.error = null" />
              </v-col>
            </v-row>
            <div v-if="line.error" class="text-caption text-error px-2">{{ line.error.text }}</div>
          </div>
          <div class="d-flex flex-wrap align-center justify-space-between ga-2">
            <v-btn variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addOpeningLine">Agregar documento</v-btn>
            <div class="text-body-1 font-weight-bold tabular-nums" data-testid="opening-total">
              Total {{ money(openingTotal) }}
            </div>
          </div>
        </v-card-text>
        <!-- Errors stay inside the dialog: the page snackbar would cover its buttons -->
        <v-alert v-if="openingError" type="error" variant="tonal" density="compact" class="mx-4 mt-2">
          {{ openingError }}
        </v-alert>
        <v-card-actions>
          <v-spacer />
          <v-btn :disabled="savingOpening" @click="openingDialog = false">Cancelar</v-btn>
          <LockableButton color="primary" :loading="savingOpening" @click="saveOpeningBalances">Registrar</LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Saldos iniciales from Excel: reviewed first, then the valid rows (the customers import's pattern) -->
    <v-dialog v-model="openingImportDialog" max-width="960" scrollable>
      <v-card>
        <v-card-title class="bg-primary text-wrap">
          <v-icon start>mdi-microsoft-excel</v-icon>
          Importar saldos iniciales desde Excel
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-2 mb-3">
            Sube un Excel con una fila por cada factura que un cliente te debía antes de usar Servify POS. Si el cliente
            todavía no existe, se crea con el nombre y el documento de la fila.
          </p>
          <div class="d-flex align-center flex-wrap ga-2 mb-4">
            <v-btn
              color="primary"
              variant="tonal"
              prepend-icon="mdi-download"
              :loading="downloadingOpeningTemplate"
              @click="downloadOpeningTemplate">
              Descargar plantilla
            </v-btn>
            <span class="text-caption text-medium-emphasis">
              Trae los encabezados, una fila de ejemplo y una hoja con estas instrucciones.
            </span>
          </div>

          <v-expansion-panels v-model="openingTutorialOpen" multiple class="mb-4">
            <v-expansion-panel value="tutorial">
              <v-expansion-panel-title>Cómo armar el archivo: columnas y ejemplo</v-expansion-panel-title>
              <v-expansion-panel-text>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  La primera fila lleva los nombres de las columnas. La columna Ejemplo es una fila completa de muestra.
                </p>
                <v-data-table
                  :headers="importColumnHeaders"
                  :items="openingImportFormat?.columns ?? []"
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
                  <li v-for="note in openingImportFormat?.notes ?? []" :key="note">{{ note }}</li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-file-input
            v-model="openingImportFile"
            label="Archivo de saldos iniciales (.xlsx o .csv)"
            accept=".xlsx,.csv"
            prepend-icon="mdi-paperclip"
            density="comfortable"
            show-size
            :disabled="importingOpening" />

          <v-alert v-if="openingImportError" type="error" variant="tonal" class="mt-2">
            {{ openingImportError }}
            <ul v-if="openingImportFileErrors.length > 1" class="pl-4 mt-1">
              <li v-for="item in openingImportFileErrors" :key="item">{{ item }}</li>
            </ul>
          </v-alert>

          <template v-if="openingImportResult">
            <v-alert
              :type="openingImportResult.dry_run ? 'info' : openingImportResult.summary.errors ? 'warning' : 'success'"
              variant="tonal"
              class="mt-2 mb-3">
              <div class="font-weight-medium">{{ openingImportMessage }}</div>
              <div v-if="openingImportResult.dry_run" class="text-body-2">
                Todavía no se registró nada: revisa las filas y confirma.
              </div>
              <div v-else-if="openingImportResult.summary.errors" class="text-body-2">
                Corrige las filas con error y vuelve a subir el archivo: las que ya entraron se saltan.
              </div>
            </v-alert>
            <v-alert
              v-if="openingImportResult.ignored_columns.length"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3">
              No usamos estas columnas porque no las reconocimos: {{ openingImportResult.ignored_columns.join(', ') }}.
              Si debían importarse, cámbiales el nombre como dice la tabla de columnas.
            </v-alert>
            <v-data-table
              :headers="openingImportHeaders"
              :items="openingImportResult.rows"
              item-value="fila"
              density="compact"
              :items-per-page="10"
              disable-sort
              mobile-breakpoint="sm"
              :hide-default-header="xs"
              class="border rounded">
              <template #item.customer_name="{ item }">
                <div class="font-weight-medium">{{ item.customer_name || 'Sin nombre' }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.customer_document || 'Sin documento' }}</div>
              </template>
              <template #item.document_number="{ item }">
                <div class="font-weight-medium text-no-wrap">{{ item.document_number || '—' }}</div>
                <div v-if="item.issued_at" class="text-caption text-medium-emphasis">
                  {{ formatDay(item.issued_at) }}<template v-if="item.due_date && item.due_date !== item.issued_at">
                    · vence {{ formatDay(item.due_date) }}</template>
                </div>
              </template>
              <template #item.total="{ item }">
                <span class="tabular-nums">{{ item.total === null ? '—' : money(item.total) }}</span>
              </template>
              <template #item.status="{ item }">
                <v-chip size="small" variant="tonal" :color="customerImportStatusColors[item.status]">
                  {{ label(openingBalanceImportStatusLabels, item.status) }}
                </v-chip>
              </template>
              <template #item.message="{ item }">
                <span class="text-body-2">{{ item.message ?? '' }}</span>
              </template>
            </v-data-table>
          </template>
        </v-card-text>
        <v-card-actions>
          <v-btn :disabled="importingOpening" @click="openingImportDialog = false">Cerrar</v-btn>
          <v-spacer />
          <LockableButton
            v-if="!openingImportResult"
            color="primary"
            icon="mdi-file-search"
            :loading="importingOpening"
            :disabled="!openingImportFile"
            @click="runOpeningImport(true)">
            Revisar archivo
          </LockableButton>
          <LockableButton
            v-else-if="openingImportResult.dry_run"
            color="primary"
            icon="mdi-upload"
            :loading="importingOpening"
            :disabled="openingImportResult.summary.valid === 0"
            @click="runOpeningImport(false)">
            {{ openingImportButtonLabel }}
          </LockableButton>
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
import { useDisplay } from 'vuetify'
import LockableButton from '../components/LockableButton.vue'
import CashRegisterPanel from '../components/CashRegisterPanel.vue'
import DateField from '../components/DateField.vue'
import MoneyField from '../components/MoneyField.vue'
import { useReadOnly } from '../composables/useReadOnly'
import {
  billingService,
  type CashReceipt,
  type Customer,
  type OpeningBalanceImportResult,
  type OpeningBalanceLine,
  type ReceivableCustomer,
  type ReceivableDocument,
  type Receivables,
  type RecurringInvoice,
} from '../services/billingService'
import type { ImportFormat } from '../services/productImportService'
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
import { documentRule } from '../utils/validation'
import {
  customerDocumentTypeLabels,
  customerImportStatusColors,
  documentKindLabels,
  label,
  openingBalanceImportStatusLabels,
  options,
  recurringInvoiceStatusColors,
  recurringInvoiceStatusLabels,
} from '../utils/labels'

const isReadOnly = useReadOnly()
const authStore = useAuthStore()
// Revertir abonos cambia la cartera ya reportada: solo el admin.
const isAdmin = computed(() => authStore.isAdmin)
const hasAutomaticBilling = computed(() => effectiveFeatures(authStore.user).includes('recurring_billing'))
// Cancelling is the admin's, only without abonos. An opening balance belongs
// to Cartera itself; any other document also needs automatic billing (the API
// asks for it), and a credit sale is undone by reverting its charge in Pedidos.
const canCancel = (doc: ReceivableDocument): boolean => {
  if (!isAdmin.value || doc.paid !== 0 || doc.document_kind === 'credit_sale') return false
  return doc.document_kind === 'opening_balance' || hasAutomaticBilling.value
}
// The abonos are cash of the shift: the register opens with orders or automatic
// billing, like the API (feature:orders,recurring_billing). Clientes alone has none.
const canUseCashRegister = computed(() =>
  effectiveFeatures(authStore.user).some(feature => feature === 'orders' || feature === 'recurring_billing'),
)
const cashPanel = ref<InstanceType<typeof CashRegisterPanel> | null>(null)

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

// The default date of an abono and the latest one the picker allows. Set
// when each dialog opens: a tab left open overnight would record yesterday.
const today = ref(localDate())
const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, title]) => ({ value, title }))
const positiveAmount = (amount: number | null) => (amount ?? 0) > 0 || 'Escribe el valor del abono'

// --- Impresión (cuenta de cobro / factura y recibo de caja) ---
const business = ref<DocumentBusiness | null>(null)
const printBlocked = () =>
  notify('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error')

// A credit sale prints the POS factura of its order's sale, not the monthly
// template. An opening balance was printed before Servify, by someone else.
const canPrintSales = computed(() => effectiveFeatures(authStore.user).some(f => f === 'orders' || f === 'reports'))
const canPrint = (doc: ReceivableDocument): boolean => {
  if (doc.document_kind === 'opening_balance') return false
  return doc.document_kind !== 'credit_sale' || canPrintSales.value
}

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

const customerOptions = computed(() =>
  customers.value.map(customer => ({
    value: customer.id,
    title: `${customer.name}${customer.document_number ? ` (${customer.document_number})` : ''}`,
    name: customer.name,
    document: customer.document_number ?? '',
  })),
)

const plainText = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// By name without accents, or by document written with or without dots.
const customerFilter = (_value: string, query: string, item?: { raw: { name: string; document: string } }) => {
  if (!item) return false
  const typed = plainText(query.trim())
  const digits = query.replace(/\D/g, '')
  return (
    plainText(item.raw.name).includes(typed) ||
    plainText(item.raw.document).includes(typed) ||
    (digits !== '' && item.raw.document.replace(/\D/g, '').includes(digits))
  )
}

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
  await Promise.all([loadReceivables(), loadPaymentHistory(), cashPanel.value?.load()])
}

// --- Abonos ---
const paymentDialog = ref(false)
const paymentInvoice = ref<RecurringInvoice | null>(null)
const paymentFormRef = ref<any>(null)
const savingPayment = ref(false)
const paymentForm = ref({ amount: 0, payment_method: 'cash' as PaymentMethod, paid_at: today.value })

const resetPaymentForm = (invoice: RecurringInvoice) => {
  paymentForm.value = { amount: invoice.balance, payment_method: 'cash', paid_at: today.value }
}

// El recibo del abono recién registrado, para imprimirlo con un clic.
const lastReceiptNumber = ref<number | null>(null)

const openPaymentDialog = async (invoiceId: number) => {
  try {
    paymentInvoice.value = await billingService.getRecurringInvoice(invoiceId)
    today.value = localDate()
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
const customerPaymentForm = ref({ amount: 0, payment_method: 'cash' as PaymentMethod, paid_at: today.value, notes: '' })

const openCustomerPayment = (customer: ReceivableCustomer) => {
  customerPaymentTarget.value = customer
  customerReceipt.value = null
  today.value = localDate()
  customerPaymentForm.value = { amount: customer.balance, payment_method: 'cash', paid_at: today.value, notes: '' }
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
    const invoice = await billingService.deleteRecurringPayment(paymentId)
    paymentInvoice.value = invoice
    // A reverted receipt no longer exists: its print button would print nothing.
    if (!invoice.payments.some(payment => payment.receipt_number === lastReceiptNumber.value)) {
      lastReceiptNumber.value = null
    }
    resetPaymentForm(invoice)
    notify('Abono revertido exitosamente')
    await refreshCartera()
  } catch (error) {
    notify(errorMessage(error, 'No se pudo revertir el abono'), 'error')
  }
}

// --- Anular ---
const cancelDialog = ref(false)
const cancelTarget = ref<{ id: number; document_number: string; customer: string; kind: ReceivableDocument['document_kind'] } | null>(null)
const cancelReason = ref('')
const cancelling = ref(false)

const openCancelDialog = (doc: ReceivableDocument, customer: string) => {
  cancelTarget.value = { id: doc.id, document_number: doc.document_number, customer, kind: doc.document_kind }
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

// ===== Saldos iniciales =====
interface OpeningLine {
  key: number
  document_number: string
  issued_at: string
  due_date: string
  total: number | null
  concept: string
  error: { field: 'document_number' | 'issued_at' | 'due_date' | 'total' | 'concept'; text: string } | null
}

let openingLineKey = 0
const newOpeningLine = (): OpeningLine => ({
  key: ++openingLineKey,
  document_number: '',
  issued_at: '',
  due_date: '',
  total: null,
  concept: '',
  error: null,
})

const openingDialog = ref(false)
const openingForm = ref<{ customer_id: number | null }>({ customer_id: null })
const openingLines = ref<OpeningLine[]>([newOpeningLine()])
const openingError = ref('')
const savingOpening = ref(false)

const addOpeningLine = () => openingLines.value.push(newOpeningLine())
const openingTotal = computed(() => openingLines.value.reduce((sum, line) => sum + (line.total ?? 0), 0))

const openOpeningDialog = () => {
  today.value = localDate()
  openingForm.value = { customer_id: null }
  openingLines.value = [newOpeningLine(), newOpeningLine()]
  openingError.value = ''
  newCustomerOpen.value = false
  openingDialog.value = true
}

// A line with nothing typed is a leftover row: it is not sent.
const isBlankOpeningLine = (line: OpeningLine) =>
  !line.document_number.trim() && !line.issued_at && !line.due_date && line.total === null && !line.concept.trim()

const openingLineProblem = (line: OpeningLine): OpeningLine['error'] => {
  const number = line.document_number.trim()
  if (!number) return { field: 'document_number', text: 'Escribe el número de este documento, como sale en la factura' }
  if (!line.issued_at) return { field: 'issued_at', text: `Escribe la fecha del documento ${number}` }
  if (!(Number(line.total) > 0)) return { field: 'total', text: `Escribe el valor del documento ${number}` }
  return null
}

const OPENING_FIELDS = ['document_number', 'issued_at', 'due_date', 'total', 'concept'] as const

const saveOpeningBalances = async () => {
  openingError.value = ''
  openingLines.value.forEach(line => (line.error = isBlankOpeningLine(line) ? null : openingLineProblem(line)))
  const lines = openingLines.value.filter(line => !isBlankOpeningLine(line))

  const customerId = openingForm.value.customer_id
  if (!customerId) {
    openingError.value = 'Falta el cliente que te debe esos documentos: búscalo o créalo con Nuevo cliente'
    return
  }
  if (lines.length === 0) {
    openingError.value = 'Falta al menos un documento con su número, fecha y valor'
    return
  }
  const problem = lines.find(line => line.error)?.error
  if (problem) {
    openingError.value = problem.text
    return
  }

  // Optional fields left empty are not sent: no due date is due on the document's date.
  const payload: OpeningBalanceLine[] = lines.map(line => ({
    document_number: line.document_number.trim(),
    issued_at: line.issued_at,
    total: Number(line.total),
    ...(line.due_date ? { due_date: line.due_date } : {}),
    ...(line.concept.trim() ? { concept: line.concept.trim() } : {}),
  }))

  savingOpening.value = true
  try {
    const { message } = await billingService.registerOpeningBalances(customerId, payload)
    notify(message)
    openingDialog.value = false
    await refreshCartera()
  } catch (error: any) {
    // The API indexes the lines it was sent, blank ones already dropped.
    const errors: Record<string, string[]> = error?.response?.data?.errors ?? {}
    for (const [key, messages] of Object.entries(errors)) {
      const [, index, field] = /^lines\.(\d+)\.(\w+)$/.exec(key) ?? []
      const line = index !== undefined ? lines[Number(index)] : undefined
      const known = OPENING_FIELDS.find(name => name === field)
      if (line && known) line.error = { field: known, text: messages[0] ?? '' }
    }
    openingError.value = errorMessage(error, 'No fue posible registrar los saldos iniciales. Inténtalo de nuevo.')
  } finally {
    savingOpening.value = false
  }
}

// A customer created right there, as Pedidos does when it sells on credit.
const emptyNewCustomer = () => ({ document_type: 'CC', document_number: '', name: '', phone: '' })
const newCustomer = ref(emptyNewCustomer())
const newCustomerOpen = ref(false)
const newCustomerFormRef = ref<any>(null)
const newCustomerError = ref('')
const creatingCustomer = ref(false)
const filled = (message: string) => (value: string | null) => !!value?.trim() || message

const openNewCustomer = () => {
  newCustomer.value = emptyNewCustomer()
  newCustomerError.value = ''
  newCustomerOpen.value = true
}

const createOpeningCustomer = async () => {
  const { valid } = await newCustomerFormRef.value.validate()
  if (!valid) return
  creatingCustomer.value = true
  newCustomerError.value = ''
  try {
    const created = await billingService.createCustomer({
      ...newCustomer.value,
      name: newCustomer.value.name.trim(),
      phone: newCustomer.value.phone.trim() || undefined,
    })
    customers.value = [...customers.value, created]
    openingForm.value.customer_id = created.id
    newCustomerOpen.value = false
    openingError.value = ''
  } catch (error) {
    newCustomerError.value = errorMessage(error, 'No fue posible crear el cliente. Inténtalo de nuevo.')
  } finally {
    creatingCustomer.value = false
  }
}

// --- Saldos iniciales desde Excel ---
const openingImportDialog = ref(false)
const openingImportFormat = ref<ImportFormat | null>(null)
const openingImportFile = ref<File | File[] | null>(null)
const openingImportResult = ref<OpeningBalanceImportResult | null>(null)
const openingImportMessage = ref('')
const openingImportError = ref('')
const openingImportFileErrors = ref<string[]>([])
const importingOpening = ref(false)
const downloadingOpeningTemplate = ref(false)
const openingTutorialOpen = ref<string[]>(['tutorial'])

// On a phone each row stacks with its own labels: the header is not needed.
const { xs } = useDisplay()

const importColumnHeaders = [
  { title: 'Columna', key: 'label' },
  { title: '¿Obligatoria?', key: 'required' },
  { title: 'Qué va ahí', key: 'help' },
  { title: 'Ejemplo', key: 'example' },
]

const openingImportHeaders = [
  { title: 'Fila', key: 'fila' },
  { title: 'Cliente', key: 'customer_name' },
  { title: 'Documento', key: 'document_number' },
  { title: 'Valor', key: 'total', align: 'end' as const },
  { title: 'Estado', key: 'status' },
  { title: 'Detalle', key: 'message', sortable: false },
]

const openingImportButtonLabel = computed(() => {
  const valid = openingImportResult.value?.summary.valid ?? 0
  if (valid === 0) return 'Registrar saldos'
  return valid === 1 ? 'Registrar 1 saldo inicial' : `Registrar ${valid} saldos iniciales`
})

const clearOpeningImport = () => {
  openingImportResult.value = null
  openingImportMessage.value = ''
  openingImportError.value = ''
  openingImportFileErrors.value = []
}

// Another file is another review.
watch(openingImportFile, clearOpeningImport)

const openOpeningImport = async () => {
  openingImportFile.value = null
  clearOpeningImport()
  openingTutorialOpen.value = ['tutorial']
  openingImportDialog.value = true
  if (openingImportFormat.value) return
  try {
    openingImportFormat.value = await billingService.getOpeningBalanceImportFormat()
  } catch (error) {
    openingImportError.value = errorMessage(error, 'No fue posible cargar las instrucciones. Inténtalo de nuevo.')
  }
}

const downloadOpeningTemplate = async () => {
  downloadingOpeningTemplate.value = true
  try {
    await billingService.downloadOpeningBalanceImportTemplate()
  } catch (error) {
    openingImportError.value = errorMessage(error, 'No fue posible descargar la plantilla. Inténtalo de nuevo.')
  } finally {
    downloadingOpeningTemplate.value = false
  }
}

const runOpeningImport = async (dryRun: boolean) => {
  const value = openingImportFile.value
  const file = Array.isArray(value) ? value[0] ?? null : value
  if (!file) return
  importingOpening.value = true
  openingImportError.value = ''
  openingImportFileErrors.value = []
  try {
    const { data, message } = await billingService.importOpeningBalances(file, dryRun)
    openingImportResult.value = data
    openingImportMessage.value = message
    openingTutorialOpen.value = []
    if (!dryRun) {
      notify(message)
      await Promise.all([refreshCartera(), loadCustomers()])
    }
  } catch (error: any) {
    openingImportError.value = errorMessage(
      error,
      dryRun
        ? 'No fue posible revisar el archivo. Inténtalo de nuevo.'
        : 'No fue posible importar los saldos iniciales. Inténtalo de nuevo.',
    )
    openingImportFileErrors.value = (error?.response?.data?.data?.errors ?? []).map((item: { error: string }) => item.error)
  } finally {
    importingOpening.value = false
  }
}

onMounted(async () => {
  billingService.getBusiness().then(b => (business.value = b)).catch(() => {})
  await Promise.all([loadReceivables(), loadCustomers(), loadPaymentHistory()])
})
</script>
