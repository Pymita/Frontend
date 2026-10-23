<template>
  <v-container fluid>
    <v-row class="mb-2">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="40" class="mr-3" color="primary">mdi-calendar-sync</v-icon>
          <div>
            <h1 class="text-h4">Facturación automática</h1>
            <p class="text-body-1 text-medium-emphasis">
              Cuotas fijas del mes: factura a todos, a algunos o a uno
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
      <v-tab to="/cartera"><v-icon start>mdi-wallet</v-icon>Cartera</v-tab>
      <v-tab value="clientes"><v-icon start>mdi-account-group</v-icon>Clientes</v-tab>
    </v-tabs>

    <v-window v-model="activeTab">
      <!-- ===== Facturar ===== -->
      <v-window-item value="facturar">
        <v-card class="mb-4">
          <v-card-text>
            <v-row dense>
              <v-col cols="12" sm="4" md="3">
                <DateField
                  v-model="issueDate"
                  label="Día a facturar"
                  density="compact"
                  hint="Es la fecha de emisión; se marcan los clientes con corte ese día"
                  persistent-hint />
              </v-col>
              <v-col cols="12" sm="4" md="3">
                <DateField
                  v-model="period"
                  label="Mes a facturar"
                  month
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
            <v-alert
              v-if="billsAnotherMonth"
              type="info"
              variant="tonal"
              density="compact"
              class="mt-3"
            >
              Vas a facturar {{ periodLabel }} con fecha {{ formatDay(issueDate) }}. Si el día de corte ya pasó,
              el documento vence el mismo día de emisión: ningún documento nace vencido.
            </v-alert>
          </v-card-text>
        </v-card>

        <v-row dense class="mb-2">
          <v-col cols="6" md="3">
            <v-card class="pa-4 text-center">
              <div class="text-caption text-medium-emphasis">Clientes con cobro automático</div>
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
          Aún no hay clientes con cobro automático. Agrégalos en la pestaña Clientes con su cuota y día de corte,
          uno por uno o importándolos desde Excel.
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
              Quien tiene «Concepto propio» no toma el concepto general.
            </span>
          </v-card-text>
          <v-alert
            v-if="preview && preview.rows.length"
            type="info"
            variant="tonal"
            density="compact"
            class="mx-4 mb-2">
            <div class="d-flex flex-wrap align-center ga-2">
              <span>{{ cutoffHint }}</span>
              <v-spacer />
              <v-btn
                size="small"
                variant="outlined"
                color="primary"
                prepend-icon="mdi-calendar-check"
                :disabled="dueOnIssueDate.length === 0 || selectionIsDue"
                @click="selectDueOnIssueDate">
                Seleccionar los del día ({{ dueOnIssueDate.length }})
              </v-btn>
            </div>
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
            no-data-text="No hay clientes para facturar">
            <!-- Una fila facturada muestra lo que dice su documento, no lo que se facturaría hoy. -->
            <template #item.customer_name="{ item }">
              <template v-if="item.billed">
                <div class="font-weight-medium">{{ item.billed.customer_name ?? item.customer_name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.customer_document_type }} {{ item.billed.customer_document ?? item.customer_document }}
                </div>
              </template>
              <template v-else>
                <div class="font-weight-medium">{{ rowValue(item).customer_name }}</div>
                <div class="text-caption text-medium-emphasis">{{ item.customer_document_type }} {{ rowValue(item).customer_document }}</div>
                <v-chip v-if="edits[item.customer_id]" size="x-small" color="secondary" variant="tonal" class="mt-1">
                  Editado
                </v-chip>
              </template>
            </template>

            <template #item.concept="{ item }">
              <template v-if="item.billed">
                <div>{{ item.billed.concept ?? rowValue(item).concept }}</div>
                <div class="text-caption text-medium-emphasis">Facturado en {{ item.billed.document_number }}</div>
              </template>
              <template v-else>
                <div>{{ rowValue(item).concept }}</div>
                <v-chip v-if="usesOwnConcept(item)" size="x-small" color="secondary" variant="tonal" class="mt-1">
                  Concepto propio
                </v-chip>
              </template>
            </template>

            <template #item.due_date="{ item }">
              {{ formatDay(item.billed ? item.billed.due_date ?? null : rowValue(item).due_date) }}
            </template>

            <template #item.tax_name="{ item }">
              {{ item.billed ? item.billed.tax_name || 'Sin impuesto' : taxLabel(rowValue(item).tax_id) }}
            </template>

            <template #item.unit_price="{ item }">
              <span v-if="item.billed" class="tabular-nums">{{ money(item.billed.total) }}</span>
              <span v-else class="tabular-nums">{{ rowValue(item).unit_price === null ? 'Sin cuota' : money(rowTotal(item)) }}</span>
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

      <!-- ===== Clientes ===== -->
      <v-window-item value="clientes">
        <v-card>
          <v-card-text>
            <v-row dense align="center">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="customerSearch"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar por nombre o documento"
                  density="compact"
                  hide-details
                  clearable />
              </v-col>
              <v-col cols="12" md="3">
                <v-switch
                  v-model="onlyRecurring"
                  label="Solo con cobro automático"
                  color="primary"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col cols="12" md="5" class="d-flex flex-wrap ga-2 justify-md-end">
                <LockableButton color="primary" variant="outlined" icon="mdi-microsoft-excel" @click="openImportDialog">
                  Importar clientes desde Excel
                </LockableButton>
                <LockableButton color="primary" icon="mdi-plus" @click="openCustomerDialog()">
                  Nuevo cliente
                </LockableButton>
              </v-col>
            </v-row>
          </v-card-text>

          <v-data-table
            :headers="customerHeaders"
            :items="visibleCustomers"
            :loading="loadingCustomers"
            :search="customerSearch"
            :custom-filter="customerFilter"
            class="elevation-0"
            no-data-text="No hay clientes registrados">
            <template #item.name="{ item }">
              <div class="font-weight-medium">{{ item.name }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.document_type }} {{ item.document_number }}</div>
            </template>
            <template #item.monthly_fee="{ item }">
              <span class="tabular-nums">{{ item.monthly_fee !== null && item.monthly_fee !== undefined ? money(item.monthly_fee) : '—' }}</span>
            </template>
            <template #item.billing_day="{ item }">{{ item.billing_day ? `Día ${item.billing_day}` : '—' }}</template>
            <template #item.billing_concept="{ item }">
              <span v-if="item.billing_concept?.trim()">{{ item.billing_concept }}</span>
              <span v-else class="text-medium-emphasis">El general</span>
            </template>
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
        <v-card-title class="bg-primary">Factura de {{ rowForm.customer_name || 'cliente' }}</v-card-title>
        <v-card-text class="pt-4">
          <p class="text-caption text-medium-emphasis mb-3">
            Los cambios aplican solo a esta factura: el cliente queda como está.
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
              <v-text-field v-model="rowForm.customer_email" label="Correo" type="email" density="comfortable" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="rowForm.concept" label="Concepto" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <v-text-field v-model.number="rowForm.quantity" label="Cantidad" type="number" min="1" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <MoneyField v-model="rowForm.unit_price" label="Valor unitario" density="comfortable" />
            </v-col>
            <v-col cols="6" md="3">
              <MoneyField v-model="rowForm.discount" label="Descuento" density="comfortable" empty-as-zero />
            </v-col>
            <v-col cols="6" md="3">
              <DateField
                v-model="rowForm.due_date"
                label="Vence"
                :min="issueDate"
                hint="No puede ser antes de la fecha de emisión"
                persistent-hint
                density="comfortable"
              />
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

    <!-- Cliente -->
    <v-dialog v-model="customerDialog" max-width="760" persistent>
      <v-card>
        <v-card-title class="bg-primary">{{ customerForm.id ? 'Editar cliente' : 'Nuevo cliente' }}</v-card-title>
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
                <v-text-field
                  v-model="customerForm.document_number"
                  density="comfortable"
                  :rules="[rules.required, documentRule(customerForm.document_type)]"
                  @blur="tidyCustomerDocument">
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
                <v-text-field v-model="customerForm.email" label="Correo" type="email" density="comfortable" />
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
                <MoneyField
                  v-model="customerForm.monthly_fee"
                  density="comfortable"
                  hint="Impuesto incluido"
                  persistent-hint
                  :rules="[feeRule]">
                  <template #label>
                    Cuota mensual <span v-if="customerForm.recurring_active" class="text-error font-weight-bold">*</span>
                  </template>
                </MoneyField>
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

    <!-- Importar clientes desde Excel: se revisa primero y se crean las filas válidas -->
    <v-dialog v-model="importDialog" max-width="960" scrollable>
      <v-card>
        <v-card-title class="bg-primary">
          <v-icon start>mdi-microsoft-excel</v-icon>
          Importar clientes desde Excel
        </v-card-title>
        <v-card-text class="pt-4">
          <p class="text-body-2 mb-3">
            Sube un Excel con una fila por cliente. Si la fila trae la cuota mensual, el cliente queda listo para
            la facturación automática; si no, se crea solo el cliente.
          </p>
          <div class="d-flex align-center flex-wrap ga-2 mb-4">
            <v-btn color="primary" variant="tonal" prepend-icon="mdi-download" :loading="downloadingTemplate" @click="downloadImportTemplate">
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
                  :headers="importColumnHeaders"
                  :items="importFormat?.columns ?? []"
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
                  <li v-for="note in importFormat?.notes ?? []" :key="note">{{ note }}</li>
                </ul>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <v-file-input
            v-model="importFile"
            label="Archivo de clientes (.xlsx o .csv)"
            accept=".xlsx,.csv"
            prepend-icon="mdi-paperclip"
            density="comfortable"
            show-size
            :disabled="importing" />

          <v-alert v-if="importError" type="error" variant="tonal" class="mt-2">
            {{ importError }}
            <ul v-if="importFileErrors.length > 1" class="pl-4 mt-1">
              <li v-for="item in importFileErrors" :key="item">{{ item }}</li>
            </ul>
          </v-alert>

          <template v-if="importResult">
            <v-alert
              :type="importResult.dry_run ? 'info' : importResult.summary.errors ? 'warning' : 'success'"
              variant="tonal"
              class="mt-2 mb-3">
              <div class="font-weight-medium">{{ importMessage }}</div>
              <div v-if="importResult.dry_run" class="text-body-2">
                Todavía no se creó ningún cliente: revisa las filas y confirma.
              </div>
              <div v-else-if="importResult.summary.errors" class="text-body-2">
                Corrige las filas con error y vuelve a subir el archivo: las que ya entraron se saltan.
              </div>
            </v-alert>
            <v-alert v-if="importResult.ignored_columns.length" type="warning" variant="tonal" density="compact" class="mb-3">
              No usamos estas columnas porque no las reconocimos: {{ importResult.ignored_columns.join(', ') }}.
              Si debían importarse, cámbiales el nombre como dice la tabla de columnas.
            </v-alert>
            <v-data-table
              :headers="importHeaders"
              :items="importResult.rows"
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
          <v-btn :disabled="importing" @click="importDialog = false">Cerrar</v-btn>
          <v-spacer />
          <LockableButton
            v-if="!importResult"
            color="primary"
            icon="mdi-file-search"
            :loading="importing"
            :disabled="!importFile"
            @click="runImport(true)">
            Revisar archivo
          </LockableButton>
          <LockableButton
            v-else-if="importResult.dry_run"
            color="primary"
            icon="mdi-upload"
            :loading="importing"
            :disabled="importResult.summary.valid === 0"
            @click="runImport(false)">
            {{ importButtonLabel }}
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
import { formatDay } from '@/utils/dates'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import LockableButton from '../components/LockableButton.vue'
import DateField from '../components/DateField.vue'
import MoneyField from '../components/MoneyField.vue'
import { useReadOnly } from '../composables/useReadOnly'
import {
  billingService,
  type Customer,
  type CustomerImportResult,
  type GenerateItem,
  type RecurringPreview,
  type RecurringPreviewRow,
} from '../services/billingService'
import {
  fillDocumentWindow,
  invoiceHtml,
  openDocumentWindow,
  type DocumentBusiness,
} from '../utils/printDocuments'
import kardexService, { type Tax } from '../services/kardexService'
import type { ImportFormat } from '../services/productImportService'
import { useAuthStore } from '../stores/auth'
import { errorMessage } from '../utils/errors'
import { documentProblem, documentRule, normalizeDocument } from '../utils/validation'
import {
  customerImportStatusColors,
  customerImportStatusLabels,
  label,
  recurringInvoiceStatusColors,
  recurringInvoiceStatusLabels,
} from '../utils/labels'

const isReadOnly = useReadOnly()
const authStore = useAuthStore()
const isAdmin = computed(() => authStore.isAdmin)

const activeTab = ref<'facturar' | 'clientes'>('facturar')

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' | 'warning' = 'success') => {
  snackbar.value = { show: true, text, color }
}

// ===== Formato =====

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

// ===== Impuestos =====
const taxes = ref<Tax[]>([])
const taxOptions = computed(() => [
  { value: null, title: 'Sin impuesto' },
  ...taxes.value.filter(t => t.active).map(t => ({ value: t.id, title: t.name })),
])
const taxLabel = (taxId: number | null | undefined): string =>
  taxes.value.find(t => t.id === taxId)?.name ?? 'Sin impuesto'

// ===== Facturar =====
// The issue date the page set by itself (today when it opened).
let autoIssueDate = localDate()
const period = ref(autoIssueDate.slice(0, 7))
const issueDate = ref(autoIssueDate)

/**
 * A tab left open overnight must not issue with yesterday's date: if the
 * issue date is still the one the page set by itself, it moves to today (the
 * selection follows, as when the date is changed by hand) and says so. A
 * date picked by hand stays. True when it moved, so the caller stops.
 */
const followToday = (): boolean => {
  const now = localDate()
  if (now === autoIssueDate || issueDate.value !== autoIssueDate) return false
  autoIssueDate = now
  issueDate.value = now
  notify(`Ya es otro día: la fecha de emisión pasó a hoy, ${formatDay(now)}. Revisa la selección antes de facturar.`, 'warning')
  return true
}
const followTodayWhenVisible = () => {
  if (document.visibilityState === 'visible') followToday()
}
const generalConcept = ref('')
const preview = ref<RecurringPreview | null>(null)
const loadingPreview = ref(false)
const selected = ref<number[]>([])
const generating = ref(false)

const periodLabel = computed(() => (period.value ? periodName(period.value) : ''))

type RowEdit = Required<Pick<GenerateItem, 'customer_name' | 'customer_document' | 'customer_address' | 'customer_city' | 'customer_phone' | 'customer_email' | 'concept' | 'quantity' | 'discount'>>
  & { unit_price: number | null; tax_id: number | null; due_date: string | null }
/**
 * Lo que se editó por fila antes de facturar (solo para ese documento): solo
 * los campos que cambiaron, para que lo demás siga al cliente y al concepto general.
 */
const edits = ref<Record<number, Partial<RowEdit>>>({})

const previewHeaders = [
  { title: 'Cliente', key: 'customer_name' },
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

const rowValue = (row: RecurringPreviewRow): RowEdit => ({ ...defaultsFor(row), ...edits.value[row.customer_id] })

/** The customer's own concept wins over the general one (the server's precedence). */
const usesOwnConcept = (row: RecurringPreviewRow): boolean =>
  !!row.concept?.trim() && edits.value[row.customer_id]?.concept === undefined

/** The fields of the dialog that differ from what the row bills without edits. */
const changedFields = (row: RecurringPreviewRow, form: RowEdit): Partial<RowEdit> => {
  const base = defaultsFor(row)
  return Object.fromEntries(
    (Object.keys(form) as (keyof RowEdit)[])
      .filter(key => form[key] !== base[key])
      .map(key => [key, form[key]]),
  ) as Partial<RowEdit>
}

const totalOf = (value: RowEdit): number =>
  Math.max(0, (value.quantity || 1) * (value.unit_price ?? 0) - (value.discount || 0))

const rowTotal = (row: RecurringPreviewRow): number => totalOf(rowValue(row))

const pendingRows = computed(() => (preview.value?.rows ?? []).filter(r => !r.billed))
const pendingTotal = computed(() => pendingRows.value.reduce((sum, row) => sum + rowTotal(row), 0))

const billedRows = computed(() => (preview.value?.rows ?? []).filter(r => r.billed))

const cutsOnIssueDate = (row: RecurringPreviewRow) => (row.cutoff_date ?? row.due_date) === issueDate.value
// Los que tienen el corte el día a facturar van marcados de entrada: es a
// quienes les toca hoy.
const dueOnIssueDate = computed(() => pendingRows.value.filter(cutsOnIssueDate))
// Cortan ese día pero ya tienen su documento del mes: no se facturan dos veces.
const billedOnIssueDate = computed(() => billedRows.value.filter(cutsOnIssueDate))
// "Seleccionar los del día" vuelve a esta selección después de marcar todos
// o a mano, en todas las páginas de la lista.
const selectDueOnIssueDate = () => {
  selected.value = dueOnIssueDate.value.map(r => r.customer_id)
}
const selectionIsDue = computed(() =>
  selected.value.length === dueOnIssueDate.value.length &&
  dueOnIssueDate.value.every(r => selected.value.includes(r.customer_id)),
)
// Al cambiar el día o el mes se marcan de nuevo los del día. Si la lista se
// recarga porque se editó o importó un cliente, solo quien entró o salió de
// ese día cambia: lo que el usuario marcó a mano se queda como estaba.
let dueFor = ''
let dueIds = new Set<number>()
const syncDueSelection = () => {
  const key = `${period.value}|${issueDate.value}`
  const due = dueOnIssueDate.value.map(r => r.customer_id)
  if (key !== dueFor) {
    selected.value = due
  } else {
    const kept = selected.value.filter(id => !dueIds.has(id) || due.includes(id))
    selected.value = [...kept, ...due.filter(id => !dueIds.has(id) && !kept.includes(id))]
  }
  dueFor = key
  dueIds = new Set(due)
}

const cutoffHint = computed(() => {
  const count = dueOnIssueDate.value.length
  const day = formatDay(issueDate.value)
  const month = periodLabel.value
  const billed = billedOnIssueDate.value
  const [firstBilled] = billed
  if (count === 0) {
    if (!firstBilled) {
      return `Nadie tiene su corte el ${day}: marca a mano a quién facturar o usa "Facturar a todos".`
    }
    return billed.length === 1
      ? `${firstBilled.customer_name} tiene su corte el ${day}, pero ya tiene su documento de ${month} (${firstBilled.billed!.document_number}): cada cliente se factura una vez por mes.`
      : `Los ${billed.length} clientes con corte el ${day} ya tienen su documento de ${month}: cada cliente se factura una vez por mes.`
  }
  const dueText = !selectionIsDue.value
    ? count === 1 ? `1 cliente tiene su corte el ${day}.` : `${count} clientes tienen su corte el ${day}.`
    : count === 1
      ? `Quedó marcado 1 cliente con corte el ${day}. Puedes marcar o desmarcar otros.`
      : `Quedaron marcados ${count} clientes con corte el ${day}. Puedes marcar o desmarcar otros.`
  if (!firstBilled) return dueText
  return billed.length === 1
    ? `${dueText} ${firstBilled.customer_name} también tiene su corte ese día, pero ya tiene su documento de ${month}.`
    : `${dueText} Hay ${billed.length} más con ese corte que ya tienen su documento de ${month}.`
})

const loadPreview = async () => {
  if (!period.value) return
  loadingPreview.value = true
  try {
    preview.value = await billingService.getRecurringPreview(period.value, issueDate.value)
    if (!generalConcept.value) generalConcept.value = preview.value.default_concept
    // La selección y las ediciones son de un mes: al cambiar de mes se limpian.
    const billable = new Set(pendingRows.value.map(r => r.customer_id))
    selected.value = selected.value.filter(id => billable.has(id))
    syncDueSelection()
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar los clientes para facturar. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingPreview.value = false
  }
}

watch(period, () => {
  edits.value = {}
  selected.value = []
  loadPreview()
})

// El mes sigue al día a facturar. Si el mes no cambia se recarga igual: el
// vencimiento de cada fila depende de la fecha de emisión.
watch(issueDate, value => {
  if (!value) return
  const month = value.slice(0, 7)
  if (month !== period.value) {
    period.value = month
  } else {
    loadPreview()
  }
})

// Facturar un mes distinto al de la emisión (ponerse al día con uno pasado).
const billsAnotherMonth = computed(() => !!issueDate.value && !!period.value && issueDate.value.slice(0, 7) !== period.value)

// --- Impresión (cuenta de cobro / factura) ---
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

/** Solo se envía lo que cambió: lo demás lo pone el servidor (cliente, concepto general). */
const itemFor = (row: RecurringPreviewRow): GenerateItem => ({ customer_id: row.customer_id, ...edits.value[row.customer_id] })

// --- Editar una fila ---
const rowDialog = ref(false)
const rowForm = ref<RowEdit | null>(null)
const rowTarget = ref<RecurringPreviewRow | null>(null)
const formTotal = computed(() => (rowForm.value ? totalOf(rowForm.value) : 0))

const openRowDialog = (row: RecurringPreviewRow) => {
  if (followToday()) return
  rowTarget.value = row
  rowForm.value = { ...rowValue(row) }
  rowDialog.value = true
}

const storeRowEdits = (row: RecurringPreviewRow, form: RowEdit) => {
  const { [row.customer_id]: _previous, ...rest } = edits.value
  const changed = changedFields(row, form)
  edits.value = Object.keys(changed).length ? { ...rest, [row.customer_id]: changed } : rest
}

const saveRowEdits = () => {
  if (!rowTarget.value || !rowForm.value) return
  storeRowEdits(rowTarget.value, rowForm.value)
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
    await loadPreview()
  } catch (error) {
    notify(errorMessage(error, 'No se pudieron generar los documentos'), 'error')
  } finally {
    generating.value = false
  }
}

const generateSingle = () => {
  if (!rowTarget.value || !rowForm.value) return
  storeRowEdits(rowTarget.value, rowForm.value)
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
  if (followToday()) return
  confirmMode.value = mode
  confirmDialog.value = true
}

const generateBatch = () => runGeneration(confirmRows.value.map(itemFor))

// ===== Clientes =====
const customers = ref<Customer[]>([])
const loadingCustomers = ref(false)
const customerSearch = ref('')
const onlyRecurring = ref(false)

const customerHeaders = [
  { title: 'Cliente', key: 'name' },
  { title: 'Ciudad', key: 'city' },
  { title: 'Teléfono', key: 'phone', sortable: false },
  { title: 'Cuota', key: 'monthly_fee', align: 'end' as const },
  { title: 'Corte', key: 'billing_day' },
  { title: 'Concepto', key: 'billing_concept', sortable: false },
  { title: 'Cobro automático', key: 'recurring_active' },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const visibleCustomers = computed(() =>
  onlyRecurring.value ? customers.value.filter(c => c.recurring_active) : customers.value,
)

// La tabla solo busca en sus columnas y el documento va bajo el nombre: se compara aparte, con o sin puntos.
const customerFilter = (value: string, query: string, item?: { raw: Customer }) =>
  (value == null ? '' : String(value)).toLocaleLowerCase().includes(query.toLocaleLowerCase()) ||
  (/\d/.test(query) && !!item?.raw.document_number?.includes(normalizeDocument(query)))

const documentTypes = [
  { value: 'CC', title: 'Cédula de ciudadanía (CC)' },
  { value: 'NIT', title: 'NIT' },
  { value: 'CE', title: 'Cédula de extranjería (CE)' },
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
const feeRule = (amount: number | null) =>
  !customerForm.value.recurring_active || amount !== null || 'Escribe la cuota mensual para incluirlo en la facturación automática'
const dayRule = (v: number | null | string) =>
  blank(v) || (Number(v) >= 1 && Number(v) <= 31) || 'El día de corte debe estar entre 1 y 31'

const loadCustomers = async () => {
  loadingCustomers.value = true
  try {
    customers.value = await billingService.getCustomers()
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar los clientes. Inténtalo de nuevo.'), 'error')
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

// Al salir del campo se ve el documento como queda guardado (sin puntos ni espacios).
const tidyCustomerDocument = () => {
  const { document_number, document_type } = customerForm.value
  if (!documentProblem(document_number, document_type)) {
    customerForm.value.document_number = normalizeDocument(document_number, document_type)
  }
}

const saveCustomer = async () => {
  const { valid } = await customerFormRef.value.validate()
  if (!valid) return

  const { id, ...form } = customerForm.value
  const payload = {
    ...form,
    document_number: normalizeDocument(form.document_number, form.document_type),
    email: form.email || undefined,
    monthly_fee: blank(form.monthly_fee) ? null : Number(form.monthly_fee),
    billing_day: blank(form.billing_day) ? null : Number(form.billing_day),
    billing_concept: form.billing_concept || null,
  }

  savingCustomer.value = true
  try {
    if (id) {
      await billingService.updateCustomer(id, payload as Partial<Customer>)
      notify('Cliente actualizado exitosamente')
    } else {
      await billingService.createCustomer(payload as Partial<Customer>)
      notify('Cliente creado exitosamente')
    }
    customerDialog.value = false
    await Promise.all([loadCustomers(), loadPreview()])
  } catch (error) {
    notify(errorMessage(error, 'No se pudo guardar el cliente'), 'error')
  } finally {
    savingCustomer.value = false
  }
}

// --- Importar clientes desde Excel ---
const importDialog = ref(false)
const importFormat = ref<ImportFormat | null>(null)
const importFile = ref<File | File[] | null>(null)
const importResult = ref<CustomerImportResult | null>(null)
const importMessage = ref('')
const importError = ref('')
const importFileErrors = ref<string[]>([])
const importing = ref(false)
const downloadingTemplate = ref(false)
const tutorialOpen = ref<string[]>(['tutorial'])

// En el teléfono cada fila se apila con sus propias etiquetas: el encabezado sobra.
const { xs } = useDisplay()

const importColumnHeaders = [
  { title: 'Columna', key: 'label' },
  { title: '¿Obligatoria?', key: 'required' },
  { title: 'Qué va ahí', key: 'help' },
  { title: 'Ejemplo', key: 'example' },
]

const importHeaders = [
  { title: 'Fila', key: 'fila' },
  { title: 'Cliente', key: 'name' },
  { title: 'Cuota', key: 'monthly_fee', align: 'end' as const },
  { title: 'Estado', key: 'status' },
  { title: 'Detalle', key: 'message', sortable: false },
]

const importButtonLabel = computed(() => {
  const valid = importResult.value?.summary.valid ?? 0
  if (valid === 0) return 'Importar clientes'
  return valid === 1 ? 'Importar 1 cliente' : `Importar ${valid} clientes`
})

const clearImportResult = () => {
  importResult.value = null
  importMessage.value = ''
  importError.value = ''
  importFileErrors.value = []
}

// Otro archivo es otra revisión.
watch(importFile, clearImportResult)

const openImportDialog = async () => {
  importFile.value = null
  clearImportResult()
  tutorialOpen.value = ['tutorial']
  importDialog.value = true
  if (importFormat.value) return
  try {
    importFormat.value = await billingService.getCustomerImportFormat()
  } catch (error) {
    importError.value = errorMessage(error, 'No fue posible cargar las instrucciones. Inténtalo de nuevo.')
  }
}

const downloadImportTemplate = async () => {
  downloadingTemplate.value = true
  try {
    await billingService.downloadCustomerImportTemplate()
  } catch (error) {
    importError.value = errorMessage(error, 'No fue posible descargar la plantilla. Inténtalo de nuevo.')
  } finally {
    downloadingTemplate.value = false
  }
}

/** v-file-input devuelve File o File[] según la versión. */
const chosenImportFile = (): File | null => {
  const value = importFile.value
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const runImport = async (dryRun: boolean) => {
  const file = chosenImportFile()
  if (!file) return
  importing.value = true
  importError.value = ''
  importFileErrors.value = []
  try {
    const { data, message } = await billingService.importCustomers(file, dryRun)
    importResult.value = data
    importMessage.value = message
    tutorialOpen.value = []
    if (!dryRun) {
      notify(message)
      await Promise.all([loadCustomers(), loadPreview()])
    }
  } catch (error: any) {
    importError.value = errorMessage(
      error,
      dryRun ? 'No fue posible revisar el archivo. Inténtalo de nuevo.' : 'No fue posible importar los clientes. Inténtalo de nuevo.',
    )
    importFileErrors.value = (error?.response?.data?.data?.errors ?? []).map((item: { error: string }) => item.error)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', followTodayWhenVisible)
  try {
    taxes.value = await kardexService.taxes()
  } catch {
    taxes.value = []
  }
  billingService.getBusiness().then(b => (business.value = b)).catch(() => {})
  await Promise.all([loadPreview(), loadCustomers()])
})

onBeforeUnmount(() => document.removeEventListener('visibilitychange', followTodayWhenVisible))
</script>
