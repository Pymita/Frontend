<template>
  <v-container fluid>
    <v-row class="mb-2">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="40" class="mr-3" color="primary">mdi-calendar-sync</v-icon>
          <div>
            <h1 class="text-h4">Facturación automática</h1>
            <p class="text-body-1 text-medium-emphasis">
              Cuotas fijas del mes: factura a todos, a algunos o a uno, y lleva la cartera
            </p>
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

    <v-tabs v-model="activeTab" color="primary" class="mb-4">
      <v-tab value="facturar"><v-icon start>mdi-file-document-multiple</v-icon>Facturar</v-tab>
      <v-tab value="cartera"><v-icon start>mdi-wallet</v-icon>Cartera</v-tab>
      <v-tab value="terceros"><v-icon start>mdi-account-group</v-icon>Terceros</v-tab>
    </v-tabs>

    <v-window v-model="activeTab">
      <!-- ===== Facturar ===== -->
      <v-window-item value="facturar">
        <v-card class="mb-4">
          <v-card-text>
            <v-row dense>
              <v-col cols="12" sm="4" md="3">
                <v-text-field
                  v-model="issueDate"
                  label="Día a facturar"
                  type="date"
                  density="compact"
                  hint="Es la fecha de emisión; se marcan los terceros con corte ese día"
                  persistent-hint />
              </v-col>
              <v-col cols="12" sm="4" md="3">
                <v-text-field
                  v-model="period"
                  label="Mes a facturar"
                  type="month"
                  density="compact"
                  hint="Sigue al día a facturar; cámbialo para facturar otro mes"
                  persistent-hint />
              </v-col>
              <v-col cols="12" sm="4" md="6">
                <v-text-field
                  v-model="generalConcept"
                  label="Concepto general"
                  density="compact"
                  hint="Se usa para quienes no tienen un concepto propio"
                  persistent-hint />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <v-row dense class="mb-2">
          <v-col cols="6" md="3">
            <v-card class="pa-4 text-center">
              <div class="text-caption text-medium-emphasis">Terceros con cobro automático</div>
              <div class="text-h5 font-weight-bold">{{ preview?.summary.customers ?? 0 }}</div>
            </v-card>
          </v-col>
          <v-col cols="6" md="3">
            <v-card class="pa-4 text-center">
              <div class="text-caption text-medium-emphasis">Ya facturados en {{ periodLabel }}</div>
              <div class="text-h5 font-weight-bold">{{ preview?.summary.billed ?? 0 }}</div>
            </v-card>
          </v-col>
          <v-col cols="6" md="3">
            <v-card class="pa-4 text-center">
              <div class="text-caption text-medium-emphasis">Por facturar</div>
              <div class="text-h5 font-weight-bold">{{ pendingRows.length }}</div>
            </v-card>
          </v-col>
          <v-col cols="6" md="3">
            <v-card class="pa-4 text-center">
              <div class="text-caption text-medium-emphasis">Valor por facturar</div>
              <div class="text-h5 font-weight-bold tabular-nums">{{ money(pendingTotal) }}</div>
            </v-card>
          </v-col>
        </v-row>

        <v-alert
          v-if="!loadingPreview && preview && preview.rows.length === 0"
          type="info"
          variant="tonal"
          class="mb-4">
          Aún no hay terceros con cobro automático. Agrégalos en la pestaña Terceros con su cuota y día de corte.
        </v-alert>

        <v-card>
          <v-card-text class="d-flex flex-wrap align-center ga-2">
            <LockableButton
              color="primary"
              icon="mdi-file-document-check"
              :disabled="selected.length === 0"
              @click="openConfirm('selected')">
              Facturar seleccionados ({{ selected.length }})
            </LockableButton>
            <LockableButton
              color="secondary"
              variant="tonal"
              icon="mdi-file-document-multiple"
              :disabled="pendingRows.length === 0"
              @click="openConfirm('all')">
              Facturar a todos ({{ pendingRows.length }})
            </LockableButton>
            <v-btn
              variant="outlined"
              color="primary"
              prepend-icon="mdi-printer"
              :disabled="billedRows.length === 0"
              @click="printInvoices(billedRows.map(r => r.billed!.id))">
              Imprimir los del mes ({{ billedRows.length }})
            </v-btn>
            <v-spacer />
            <span class="text-caption text-medium-emphasis">
              Usa el lápiz para cambiar el nombre, el valor o el concepto de una persona antes de facturar.
            </span>
          </v-card-text>
          <v-alert
            v-if="preview && preview.rows.length"
            type="info"
            variant="tonal"
            density="compact"
            class="mx-4 mb-2">
            {{ cutoffHint }}
          </v-alert>

          <v-data-table
            v-model="selected"
            :headers="previewHeaders"
            :items="preview?.rows ?? []"
            :loading="loadingPreview"
            item-value="customer_id"
            :item-selectable="(row: RecurringPreviewRow) => !row.billed"
            show-select
            class="elevation-0"
            no-data-text="No hay terceros para facturar">
            <template #item.customer_name="{ item }">
              <div class="font-weight-medium">{{ rowValue(item).customer_name }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.customer_document_type }} {{ rowValue(item).customer_document }}</div>
              <v-chip v-if="edits[item.customer_id]" size="x-small" color="secondary" variant="tonal" class="mt-1">
                Editado
              </v-chip>
            </template>

            <template #item.concept="{ item }">{{ rowValue(item).concept }}</template>

            <template #item.due_date="{ item }">{{ formatDay(rowValue(item).due_date) }}</template>

            <template #item.tax_name="{ item }">{{ taxLabel(rowValue(item).tax_id) }}</template>

            <template #item.unit_price="{ item }">
              <span class="tabular-nums">{{ rowValue(item).unit_price === null ? 'Sin cuota' : money(rowTotal(item)) }}</span>
            </template>

            <template #item.billed="{ item }">
              <v-chip
                v-if="item.billed"
                size="small"
                variant="tonal"
                :color="recurringInvoiceStatusColors[item.billed.status]">
                {{ item.billed.document_number }} · {{ label(recurringInvoiceStatusLabels, item.billed.status) }}
              </v-chip>
              <v-chip v-else size="small" variant="outlined">Por facturar</v-chip>
            </template>

            <template #item.actions="{ item }">
              <v-btn
                v-if="item.billed"
                icon="mdi-printer"
                size="small"
                variant="text"
                :aria-label="`Imprimir ${item.billed.document_number}`"
                @click="printInvoices([item.billed.id])" />
              <v-btn
                v-else
                icon="mdi-pencil"
                size="small"
                variant="text"
                :aria-label="`Editar y facturar a ${item.customer_name}`"
                :disabled="isReadOnly"
                @click="openRowDialog(item)" />
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>

      <!-- ===== Cartera ===== -->
      <v-window-item value="cartera">
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
              <div class="text-caption text-medium-emphasis">Terceros con saldo</div>
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
                  label="Buscar tercero, documento o concepto"
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
                  color="secondary"
                  variant="tonal"
                  prepend-icon="mdi-file-excel"
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
                <!-- El abono va al tercero: paga sus documentos del más viejo al más nuevo. -->
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
                    <td>{{ doc.concept }} <span class="text-medium-emphasis">({{ periodName(doc.period) }})</span></td>
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
                        icon="mdi-printer"
                        size="small"
                        variant="text"
                        :aria-label="`Imprimir ${doc.document_number}`"
                        @click="printInvoices([doc.id])" />
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
                        v-if="isAdmin && doc.paid === 0"
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
      </v-window-item>

      <!-- ===== Terceros ===== -->
      <v-window-item value="terceros">
        <v-card>
          <v-card-text>
            <v-row dense align="center">
              <v-col cols="12" md="5">
                <v-text-field
                  v-model="customerSearch"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar por nombre o documento"
                  density="compact"
                  hide-details
                  clearable />
              </v-col>
              <v-col cols="12" md="4">
                <v-switch
                  v-model="onlyRecurring"
                  label="Solo con cobro automático"
                  color="primary"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col cols="12" md="3" class="d-flex justify-md-end">
                <LockableButton color="primary" icon="mdi-plus" @click="openCustomerDialog()">
                  Nuevo tercero
                </LockableButton>
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table
            :headers="customerHeaders"
            :items="visibleCustomers"
            :loading="loadingCustomers"
            :search="customerSearch"
            class="elevation-0"
            no-data-text="No hay terceros registrados">
            <template #item.name="{ item }">
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.document_type }} {{ item.document_number }}</div>
            </template>
            <template #item.monthly_fee="{ item }">
              <span class="tabular-nums">{{ item.monthly_fee !== null && item.monthly_fee !== undefined ? money(item.monthly_fee) : '—' }}</span>
            </template>
            <template #item.billing_day="{ item }">{{ item.billing_day ? `Día ${item.billing_day}` : '—' }}</template>
            <template #item.recurring_active="{ item }">
              <v-chip size="small" variant="tonal" :color="item.recurring_active ? 'success' : undefined">
                {{ item.recurring_active ? 'Activo' : 'Pausado' }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-btn
                icon="mdi-pencil"
                size="small"
                variant="text"
                :aria-label="`Editar a ${item.name}`"
                :disabled="isReadOnly"
                @click="openCustomerDialog(item)" />
            </template>
          </v-data-table>
        </v-card>
      </v-window-item>
    </v-window>

    <!-- Editar una fila antes de facturar (o facturar solo a esa persona) -->
    <v-dialog v-model="rowDialog" max-width="760" persistent>
      <v-card v-if="rowForm">
        <v-card-title class="bg-primary">Factura de {{ rowForm.customer_name || 'tercero' }}</v-card-title>
        <v-card-text class="pt-4">
          <p class="text-caption text-medium-emphasis mb-3">
            Los cambios aplican solo a esta factura: el tercero queda como está.
          </p>
          <v-row dense>
            <v-col cols="12" md="8">
              <v-text-field v-model="rowForm.customer_name" label="Nombre en la factura" density="comfortable" />
            </v-col>
            <v-col cols="12" md="4">
              <v-text-field v-model="rowForm.customer_document" label="NIT / Documento" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="rowForm.customer_address" label="Dirección" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="rowForm.customer_city" label="Ciudad" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="rowForm.customer_phone" label="Teléfono" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-text-field v-model="rowForm.customer_email" label="Email" type="email" density="comfortable" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="rowForm.concept" label="Concepto" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model.number="rowForm.quantity" label="Cantidad" type="number" min="1" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model.number="rowForm.unit_price" label="Valor unitario" type="number" min="0" prefix="$" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model.number="rowForm.discount" label="Descuento" type="number" min="0" prefix="$" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model="rowForm.due_date" label="Vence" type="date" density="comfortable" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                v-model="rowForm.tax_id"
                :items="taxOptions"
                label="Impuesto (incluido en el valor)"
                density="comfortable" />
            </v-col>
            <v-col cols="12" md="6" class="d-flex align-center justify-end">
              <span class="text-h6 tabular-nums">Total {{ money(formTotal) }}</span>
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-btn @click="rowDialog = false">Cancelar</v-btn>
          <v-spacer />
          <v-btn variant="tonal" color="secondary" @click="saveRowEdits">Guardar cambios</v-btn>
          <LockableButton color="primary" :loading="generating" @click="generateSingle">
            Facturar solo a esta persona
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Confirmar generación en lote -->
    <v-dialog v-model="confirmDialog" max-width="520">
      <v-card>
        <v-card-title class="bg-primary">Generar documentos de {{ periodLabel }}</v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-1">
            {{ confirmRows.length === 1 ? 'Se va a generar' : 'Se van a generar' }}
            <strong>{{ confirmRows.length }}</strong>
            {{ confirmRows.length === 1 ? 'documento' : 'documentos' }} por
            <strong class="tabular-nums">{{ money(confirmTotal) }}</strong>.
          </p>
          <p v-if="confirmMissingFee.length" class="text-body-2 text-error mt-2">
            Sin cuota: {{ confirmMissingFee.map(r => r.customer_name).join(', ') }}. Usa el lápiz para escribir el valor o quítalos de la selección.
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="confirmDialog = false">Cancelar</v-btn>
          <LockableButton
            color="primary"
            :loading="generating"
            :disabled="confirmMissingFee.length > 0"
            @click="generateBatch">
            Generar
          </LockableButton>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
                <v-text-field
                  v-model.number="paymentForm.amount"
                  label="Valor del abono"
                  type="number"
                  prefix="$"
                  min="0"
                  :rules="[(v: number) => v > 0 || 'Escribe el valor del abono']"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="paymentForm.payment_method"
                  :items="methodOptions"
                  label="Método de pago"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="paymentForm.paid_at" label="Fecha" type="date" :max="today" density="comfortable" />
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

    <!-- Abono al tercero: se reparte del documento más viejo al más nuevo -->
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
                  <v-text-field
                    v-model.number="customerPaymentForm.amount"
                    label="Valor del abono"
                    type="number"
                    prefix="$"
                    min="0"
                    :rules="[(v: number) => v > 0 || 'Escribe el valor del abono']"
                    density="comfortable" />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="customerPaymentForm.payment_method"
                    :items="methodOptions"
                    label="Método de pago"
                    density="comfortable" />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field v-model="customerPaymentForm.paid_at" label="Fecha" type="date" :max="today" density="comfortable" />
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
                  <td>{{ line.document_number }} <span class="text-medium-emphasis">({{ periodName(line.period) }})</span></td>
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

    <!-- Tercero -->
    <v-dialog v-model="customerDialog" max-width="760" persistent>
      <v-card>
        <v-card-title class="bg-primary">{{ customerForm.id ? 'Editar tercero' : 'Nuevo tercero' }}</v-card-title>
        <v-card-text class="pt-4">
          <v-form ref="customerFormRef">
            <p class="text-caption text-medium-emphasis mb-3">
              Los campos con
              <span class="text-error font-weight-bold">*</span>
              son obligatorios.
            </p>
            <v-row dense>
              <v-col cols="12" md="4">
                <v-select
                  v-model="customerForm.document_type"
                  :items="documentTypes"
                  density="comfortable"
                  :rules="[rules.required]">
                  <template #label>
                    Tipo de documento <span class="text-error font-weight-bold">*</span>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="8">
                <v-text-field v-model="customerForm.document_number" density="comfortable" :rules="[rules.required]">
                  <template #label>
                    NIT / Número de documento <span class="text-error font-weight-bold">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="customerForm.name" density="comfortable" :rules="[rules.required]">
                  <template #label>
                    Nombre <span class="text-error font-weight-bold">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="customerForm.address" label="Dirección" density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="customerForm.city" label="Ciudad" density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="customerForm.phone" label="Teléfono" density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="customerForm.email" label="Email" type="email" density="comfortable" />
              </v-col>
            </v-row>

            <p class="text-subtitle-2 mt-2 mb-2">Cobro mensual</p>
            <v-row dense>
              <v-col cols="12">
                <v-switch
                  v-model="customerForm.recurring_active"
                  label="Incluir en la facturación automática"
                  color="primary"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="customerForm.monthly_fee"
                  type="number"
                  min="0"
                  prefix="$"
                  density="comfortable"
                  hint="Impuesto incluido"
                  persistent-hint
                  :rules="[feeRule]">
                  <template #label>
                    Cuota mensual <span v-if="customerForm.recurring_active" class="text-error font-weight-bold">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="customerForm.billing_day"
                  label="Día de corte (vence)"
                  type="number"
                  min="1"
                  max="31"
                  density="comfortable"
                  hint="Día del mes en que vence la cuota"
                  persistent-hint
                  :rules="[dayRule]" />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="customerForm.billing_tax_id"
                  :items="taxOptions"
                  label="Impuesto"
                  density="comfortable" />
              </v-col>
              <v-col cols="12">
                <v-text-field
                  v-model="customerForm.billing_concept"
                  label="Concepto propio (opcional)"
                  placeholder="Ej.: Cuota parqueadero"
                  density="comfortable" />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="customerDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="savingCustomer" @click="saveCustomer">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 4000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'
import {
  billingService,
  type CashReceipt,
  type Customer,
  type GenerateItem,
  type ReceivableCustomer,
  type ReceivableDocument,
  type Receivables,
  type RecurringInvoice,
  type RecurringPreview,
  type RecurringPreviewRow,
} from '../services/billingService'
import {
  fillDocumentWindow,
  invoiceHtml,
  openDocumentWindow,
  receiptHtml,
  type DocumentBusiness,
} from '../utils/printDocuments'
import kardexService, { type Tax } from '../services/kardexService'
import { PAYMENT_METHOD_LABELS, type PaymentMethod } from '../services/salesService'
import { useAuthStore } from '../stores/auth'
import { errorMessage } from '../utils/errors'
import {
  documentKindLabels,
  label,
  recurringInvoiceStatusColors,
  recurringInvoiceStatusLabels,
} from '../utils/labels'

const isReadOnly = useReadOnly()
const authStore = useAuthStore()
// Anular documentos y revertir abonos cambia la cartera ya reportada: solo el admin.
const isAdmin = computed(() => authStore.isAdmin)

const activeTab = ref<'facturar' | 'cartera' | 'terceros'>('facturar')

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' | 'warning' = 'success') => {
  snackbar.value = { show: true, text, color }
}

// ===== Formato =====
const money = (value: number | null | undefined): string =>
  '$' + Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 })

const localDate = (date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Las fechas llegan como AAAA-MM-DD: se arman a mano para que la zona horaria
// del navegador no las corra un día.
const formatDay = (value: string | null | undefined): string => {
  if (!value) return '—'
  const [y = 0, m = 1, d = 1] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const periodName = (value: string): string => {
  const [y = 0, m = 1] = value.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
}

const today = localDate()
const methodOptions = Object.entries(PAYMENT_METHOD_LABELS).map(([value, title]) => ({ value, title }))

// ===== Impuestos =====
const taxes = ref<Tax[]>([])
const taxOptions = computed(() => [
  { value: null, title: 'Sin impuesto' },
  ...taxes.value.filter(t => t.active).map(t => ({ value: t.id, title: t.name })),
])
const taxLabel = (taxId: number | null | undefined): string =>
  taxes.value.find(t => t.id === taxId)?.name ?? 'Sin impuesto'

// ===== Facturar =====
const period = ref(today.slice(0, 7))
const issueDate = ref(today)
const generalConcept = ref('')
const preview = ref<RecurringPreview | null>(null)
const loadingPreview = ref(false)
const selected = ref<number[]>([])
const generating = ref(false)

const periodLabel = computed(() => (period.value ? periodName(period.value) : ''))

/** Lo que se editó por fila antes de facturar (solo para ese documento). */
type RowEdit = Required<Pick<GenerateItem, 'customer_name' | 'customer_document' | 'customer_address' | 'customer_city' | 'customer_phone' | 'customer_email' | 'concept' | 'quantity' | 'discount'>>
  & { unit_price: number | null; tax_id: number | null; due_date: string | null }
const edits = ref<Record<number, RowEdit>>({})

const previewHeaders = [
  { title: 'Tercero', key: 'customer_name' },
  { title: 'Concepto', key: 'concept', sortable: false },
  { title: 'Vence', key: 'due_date' },
  { title: 'Impuesto', key: 'tax_name', sortable: false },
  { title: 'Valor', key: 'unit_price', align: 'end' as const },
  { title: 'Estado', key: 'billed', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const defaultsFor = (row: RecurringPreviewRow): RowEdit => ({
  customer_name: row.customer_name,
  customer_document: row.customer_document ?? '',
  customer_address: row.customer_address ?? '',
  customer_city: row.customer_city ?? '',
  customer_phone: row.customer_phone ?? '',
  customer_email: row.customer_email ?? '',
  concept: row.concept || generalConcept.value || preview.value?.default_concept || '',
  quantity: 1,
  unit_price: row.unit_price,
  discount: 0,
  tax_id: row.tax_id,
  due_date: row.due_date,
})

const rowValue = (row: RecurringPreviewRow): RowEdit => edits.value[row.customer_id] ?? defaultsFor(row)

const totalOf = (value: RowEdit): number =>
  Math.max(0, (value.quantity || 1) * (value.unit_price ?? 0) - (value.discount || 0))

const rowTotal = (row: RecurringPreviewRow): number => totalOf(rowValue(row))

const pendingRows = computed(() => (preview.value?.rows ?? []).filter(r => !r.billed))
const pendingTotal = computed(() => pendingRows.value.reduce((sum, row) => sum + rowTotal(row), 0))

const billedRows = computed(() => (preview.value?.rows ?? []).filter(r => r.billed))

// Los que tienen el corte el día a facturar van marcados de entrada: es a
// quienes les toca hoy. Se recalcula solo al cambiar el día o el mes, para
// no deshacer lo que el usuario marcó a mano.
const dueOnIssueDate = computed(() => pendingRows.value.filter(r => r.due_date === issueDate.value))
let autoSelectedFor = ''
const autoSelect = () => {
  const key = `${period.value}|${issueDate.value}`
  if (key === autoSelectedFor || !preview.value) return
  autoSelectedFor = key
  selected.value = dueOnIssueDate.value.map(r => r.customer_id)
}

const cutoffHint = computed(() => {
  const count = dueOnIssueDate.value.length
  const day = formatDay(issueDate.value)
  if (count === 0) {
    return `Nadie tiene su corte el ${day}: marca a mano a quién facturar o usa "Facturar a todos".`
  }
  return count === 1
    ? `Quedó marcado 1 tercero con corte el ${day}. Puedes marcar o desmarcar otros.`
    : `Quedaron marcados ${count} terceros con corte el ${day}. Puedes marcar o desmarcar otros.`
})

const loadPreview = async () => {
  if (!period.value) return
  loadingPreview.value = true
  try {
    preview.value = await billingService.getRecurringPreview(period.value)
    if (!generalConcept.value) generalConcept.value = preview.value.default_concept
    // La selección y las ediciones son de un mes: al cambiar de mes se limpian.
    const billable = new Set(pendingRows.value.map(r => r.customer_id))
    selected.value = selected.value.filter(id => billable.has(id))
    autoSelect()
  } catch (error) {
    notify(errorMessage(error, 'Error al cargar los terceros para facturar'), 'error')
  } finally {
    loadingPreview.value = false
  }
}

watch(period, () => {
  edits.value = {}
  selected.value = []
  loadPreview()
})

// El mes sigue al día a facturar; si el mes no cambia, solo se remarca.
watch(issueDate, value => {
  if (!value) return
  const month = value.slice(0, 7)
  if (month !== period.value) {
    period.value = month
  } else {
    autoSelect()
  }
})

// --- Impresión (cuenta de cobro / factura y recibo de caja) ---
const business = ref<DocumentBusiness | null>(null)
const printBlocked = () =>
  notify('El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para este sitio', 'error')

const printInvoices = async (ids: number[]) => {
  if (!ids.length) return
  const win = openDocumentWindow()
  if (!win) return printBlocked()
  try {
    const docs = await Promise.all(ids.map(id => billingService.getInvoiceDocument(id)))
    const title = docs.length === 1 ? docs[0]!.invoice.document_number : `${docs.length} documentos de ${periodLabel.value}`
    fillDocumentWindow(win, title, docs.map(d => invoiceHtml(d.business, d.invoice, d.resolution)).join(''))
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

/** Solo se envía lo que cambió respecto a lo que el servidor ya sabe. */
const itemFor = (row: RecurringPreviewRow): GenerateItem => {
  const edit = edits.value[row.customer_id]
  if (!edit) {
    return { customer_id: row.customer_id }
  }
  return { customer_id: row.customer_id, ...edit }
}

// --- Editar una fila ---
const rowDialog = ref(false)
const rowForm = ref<RowEdit | null>(null)
const rowTarget = ref<RecurringPreviewRow | null>(null)
const formTotal = computed(() => (rowForm.value ? totalOf(rowForm.value) : 0))

const openRowDialog = (row: RecurringPreviewRow) => {
  rowTarget.value = row
  rowForm.value = { ...rowValue(row) }
  rowDialog.value = true
}

const saveRowEdits = () => {
  if (!rowTarget.value || !rowForm.value) return
  edits.value = { ...edits.value, [rowTarget.value.customer_id]: { ...rowForm.value } }
  if (!selected.value.includes(rowTarget.value.customer_id)) {
    selected.value = [...selected.value, rowTarget.value.customer_id]
  }
  rowDialog.value = false
}

const runGeneration = async (items: GenerateItem[]) => {
  generating.value = true
  try {
    const { data, message } = await billingService.generateRecurringInvoices({
      period: period.value,
      issue_date: issueDate.value || undefined,
      concept: generalConcept.value || undefined,
      items,
    })
    const skipped = data.skipped.length ? ` · ${data.skipped.length} ya tenían documento del mes` : ''
    notify(`${message}${skipped}`)
    for (const invoice of data.created) {
      if (invoice.customer_id) delete edits.value[invoice.customer_id]
    }
    selected.value = []
    rowDialog.value = false
    confirmDialog.value = false
    await Promise.all([loadPreview(), loadReceivables()])
  } catch (error) {
    notify(errorMessage(error, 'No se pudieron generar los documentos'), 'error')
  } finally {
    generating.value = false
  }
}

const generateSingle = () => {
  if (!rowTarget.value || !rowForm.value) return
  edits.value = { ...edits.value, [rowTarget.value.customer_id]: { ...rowForm.value } }
  runGeneration([itemFor(rowTarget.value)])
}

// --- Lote: seleccionados o todos ---
const confirmDialog = ref(false)
const confirmMode = ref<'selected' | 'all'>('selected')
const confirmRows = computed(() =>
  confirmMode.value === 'all'
    ? pendingRows.value
    : pendingRows.value.filter(r => selected.value.includes(r.customer_id)),
)
const confirmTotal = computed(() => confirmRows.value.reduce((sum, row) => sum + rowTotal(row), 0))
const confirmMissingFee = computed(() => confirmRows.value.filter(r => rowValue(r).unit_price === null))

const openConfirm = (mode: 'selected' | 'all') => {
  confirmMode.value = mode
  confirmDialog.value = true
}

const generateBatch = () => runGeneration(confirmRows.value.map(itemFor))

// ===== Cartera =====
const receivables = ref<Receivables | null>(null)
const loadingReceivables = ref(false)
const receivableFilters = ref({ q: '', all: false })
const exporting = ref(false)

const loadReceivables = async () => {
  loadingReceivables.value = true
  try {
    receivables.value = await billingService.getReceivables(receivableFilters.value)
  } catch (error) {
    notify(errorMessage(error, 'Error al cargar la cartera'), 'error')
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
    notify(errorMessage(error, 'Error al descargar la cartera'), 'error')
  } finally {
    exporting.value = false
  }
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
    notify(errorMessage(error, 'Error al cargar el documento'), 'error')
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
    await Promise.all([loadReceivables(), loadPreview()])
  } catch (error) {
    notify(errorMessage(error, 'No se pudo registrar el abono'), 'error')
  } finally {
    savingPayment.value = false
  }
}

// --- Abono al tercero ---
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
    await Promise.all([loadReceivables(), loadPreview()])
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
    await Promise.all([loadReceivables(), loadPreview()])
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
    await Promise.all([loadReceivables(), loadPreview()])
  } catch (error) {
    notify(errorMessage(error, 'No se pudo anular el documento'), 'error')
  } finally {
    cancelling.value = false
  }
}

// ===== Terceros =====
const customers = ref<Customer[]>([])
const loadingCustomers = ref(false)
const customerSearch = ref('')
const onlyRecurring = ref(false)

const customerHeaders = [
  { title: 'Tercero', key: 'name' },
  { title: 'Ciudad', key: 'city' },
  { title: 'Teléfono', key: 'phone', sortable: false },
  { title: 'Cuota', key: 'monthly_fee', align: 'end' as const },
  { title: 'Corte', key: 'billing_day' },
  { title: 'Cobro automático', key: 'recurring_active' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const visibleCustomers = computed(() =>
  onlyRecurring.value ? customers.value.filter(c => c.recurring_active) : customers.value,
)

const documentTypes = [
  { value: 'CC', title: 'Cédula de Ciudadanía (CC)' },
  { value: 'NIT', title: 'NIT' },
  { value: 'CE', title: 'Cédula de Extranjería (CE)' },
  { value: 'Pasaporte', title: 'Pasaporte' },
]

interface CustomerForm {
  id?: number
  document_type: string
  document_number: string
  name: string
  address: string
  city: string
  phone: string
  email: string
  recurring_active: boolean
  monthly_fee: number | null
  billing_day: number | null
  billing_concept: string
  billing_tax_id: number | null
}

const emptyCustomerForm = (): CustomerForm => ({
  document_type: 'CC',
  document_number: '',
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  recurring_active: true,
  monthly_fee: null,
  billing_day: null,
  billing_concept: '',
  billing_tax_id: null,
})

const customerDialog = ref(false)
const customerForm = ref<CustomerForm>(emptyCustomerForm())
const customerFormRef = ref<any>(null)
const savingCustomer = ref(false)

const rules = {
  required: (v: any) => !!v || 'Este campo es requerido',
}
const blank = (v: unknown) => v === null || v === undefined || v === ''
const feeRule = (v: number | null | string) =>
  !customerForm.value.recurring_active || !blank(v) || 'Escribe la cuota mensual para incluirlo en la facturación automática'
const dayRule = (v: number | null | string) =>
  blank(v) || (Number(v) >= 1 && Number(v) <= 31) || 'El día de corte debe estar entre 1 y 31'

const loadCustomers = async () => {
  loadingCustomers.value = true
  try {
    customers.value = await billingService.getCustomers()
  } catch (error) {
    notify(errorMessage(error, 'Error al cargar los terceros'), 'error')
  } finally {
    loadingCustomers.value = false
  }
}

const openCustomerDialog = (customer?: Customer) => {
  customerForm.value = customer
    ? {
        id: customer.id,
        document_type: customer.document_type,
        document_number: customer.document_number,
        name: customer.name,
        address: customer.address ?? '',
        city: customer.city ?? '',
        phone: customer.phone ?? '',
        email: customer.email ?? '',
        recurring_active: !!customer.recurring_active,
        monthly_fee: customer.monthly_fee ?? null,
        billing_day: customer.billing_day ?? null,
        billing_concept: customer.billing_concept ?? '',
        billing_tax_id: customer.billing_tax_id ?? null,
      }
    : emptyCustomerForm()
  customerDialog.value = true
}

const saveCustomer = async () => {
  const { valid } = await customerFormRef.value.validate()
  if (!valid) return

  const { id, ...form } = customerForm.value
  const payload = {
    ...form,
    email: form.email || undefined,
    monthly_fee: blank(form.monthly_fee) ? null : Number(form.monthly_fee),
    billing_day: blank(form.billing_day) ? null : Number(form.billing_day),
    billing_concept: form.billing_concept || null,
  }

  savingCustomer.value = true
  try {
    if (id) {
      await billingService.updateCustomer(id, payload as Partial<Customer>)
      notify('Tercero actualizado exitosamente')
    } else {
      await billingService.createCustomer(payload as Partial<Customer>)
      notify('Tercero creado exitosamente')
    }
    customerDialog.value = false
    await Promise.all([loadCustomers(), loadPreview()])
  } catch (error) {
    notify(errorMessage(error, 'No se pudo guardar el tercero'), 'error')
  } finally {
    savingCustomer.value = false
  }
}

onMounted(async () => {
  try {
    taxes.value = await kardexService.taxes()
  } catch {
    taxes.value = []
  }
  billingService.getBusiness().then(b => (business.value = b)).catch(() => {})
  await Promise.all([loadPreview(), loadReceivables(), loadCustomers()])
})
</script>
