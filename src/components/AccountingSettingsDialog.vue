<template>
  <v-dialog :model-value="modelValue" :fullscreen="xs" max-width="1000" persistent scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <span class="text-wrap">Configurar contabilidad</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" aria-label="Cerrar la configuración de contabilidad" @click="close" />
      </v-card-title>
      <!-- flex-0-0: in a scrollable dialog the card's column would squeeze the tab bar -->
      <v-tabs v-model="tab" color="primary" show-arrows class="flex-0-0">
        <v-tab value="payment_methods">Formas de pago</v-tab>
        <v-tab value="taxes">Impuestos</v-tab>
        <v-tab value="documents">Documentos</v-tab>
        <v-tab value="templates">Plantillas</v-tab>
      </v-tabs>
      <v-divider />

      <v-card-text>
        <div v-if="loading" class="d-flex justify-center py-12">
          <v-progress-circular indeterminate color="primary" />
        </div>
        <v-alert v-else-if="loadError" type="error" variant="tonal" density="compact">
          <div class="d-flex align-center flex-wrap ga-3">
            <span>{{ loadError }}</span>
            <v-spacer />
            <v-btn variant="text" @click="load">Reintentar</v-btn>
          </div>
        </v-alert>

        <template v-else-if="draft">
          <v-alert v-if="tab !== 'templates' && missing.length" type="warning" variant="tonal" density="compact" class="mb-4">
            <div class="font-weight-medium">{{ missing.length === 1 ? 'Falta 1 cuenta' : `Faltan ${missing.length} cuentas` }}</div>
            <div class="d-flex flex-wrap ga-1 my-2">
              <v-chip v-for="name in missing" :key="name" size="small" variant="outlined" label>{{ name }}</v-chip>
            </div>
            <div class="text-body-2">
              Puedes dejarlas en blanco mientras no uses esos documentos: el movimiento te avisa si un período las necesita.
            </div>
          </v-alert>

          <v-form ref="accountsForm" @submit.prevent="save">
            <v-tabs-window v-model="tab">
              <v-tabs-window-item value="payment_methods" eager>
                <p class="text-body-2 text-medium-emphasis mb-1">
                  La cuenta que recibe el dinero de cada forma de pago; lo que se vende a crédito va a la cuenta de Cartera.
                </p>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  Si en la venta o en el recibo de caja va a otra cuenta, escríbela al lado; en blanco usa la de la forma de pago.
                  Las formas de pago se crean en Configuración.
                </p>
                <template v-for="(method, index) in draft.payment_methods" :key="method.method">
                  <v-divider v-if="index" />
                  <div role="group" :aria-label="method.label" class="py-3">
                    <div class="d-flex align-center flex-wrap ga-2 mb-2">
                      <span class="text-subtitle-2">{{ method.label }}</span>
                      <v-chip v-if="method.active === false" size="x-small" variant="tonal" color="secondary">Inactiva</v-chip>
                    </div>
                    <v-row dense>
                      <v-col cols="12" sm="4">
                        <v-text-field
                          v-model="method.account"
                          label="Cuenta"
                          :aria-label="`Cuenta de ${method.label}`"
                          v-bind="accountProps(method.account, method.label)"
                          hide-details="auto"
                        />
                      </v-col>
                      <template v-if="method.accounts_by_document">
                        <v-col v-for="document in METHOD_DOCUMENTS" :key="document.key" cols="6" sm="4">
                          <v-text-field
                            v-model="method.accounts_by_document[document.key]"
                            :label="document.label"
                            :aria-label="`Cuenta de ${documentAccountName(method, document.key)}`"
                            v-bind="documentAccountProps(documentAccountName(method, document.key))"
                            hide-details="auto"
                          />
                        </v-col>
                      </template>
                    </v-row>
                  </div>
                </template>
              </v-tabs-window-item>

              <v-tabs-window-item value="taxes" eager>
                <p class="text-body-2 text-medium-emphasis mb-3">
                  Cada impuesto va a una cuenta en las ventas y a otra en las compras, con la base sobre la que se calculó.
                </p>
                <p v-if="!draft.taxes.length" class="text-body-2">
                  Tu negocio no tiene impuestos con tarifa. Se crean en Configuración.
                </p>
                <template v-for="(tax, index) in draft.taxes" :key="tax.id">
                  <v-divider v-if="index" />
                  <div role="group" :aria-label="tax.name" class="py-3">
                    <div class="d-flex align-center flex-wrap ga-2 mb-2">
                      <span class="text-subtitle-2">{{ tax.name }}</span>
                      <span class="text-body-2 text-medium-emphasis">Tarifa {{ percent(tax.rate) }}</span>
                    </div>
                    <v-row dense>
                      <v-col cols="12" sm="6">
                        <v-text-field
                          v-model="tax.sales_account"
                          label="Cuenta en ventas"
                          :aria-label="`Cuenta de ${taxName(tax, 'sales')}`"
                          v-bind="accountProps(tax.sales_account, taxName(tax, 'sales'))"
                          hide-details="auto"
                        />
                      </v-col>
                      <v-col cols="12" sm="6">
                        <v-text-field
                          v-model="tax.purchase_account"
                          label="Cuenta en compras"
                          :aria-label="`Cuenta de ${taxName(tax, 'purchases')}`"
                          v-bind="accountProps(tax.purchase_account, taxName(tax, 'purchases'))"
                          hide-details="auto"
                        />
                      </v-col>
                    </v-row>
                  </div>
                </template>
              </v-tabs-window-item>

              <v-tabs-window-item value="documents" eager>
                <p class="text-body-2 text-medium-emphasis mb-1">
                  Cada documento lleva el comprobante de tu programa contable (p. ej., F-1 para las ventas) y una cuenta
                  por movimiento. El número del documento sigue siendo el de Servify POS.
                </p>
                <template v-for="(document, index) in draft.documents" :key="document.key">
                  <v-divider v-if="index" />
                  <div role="group" :aria-label="document.name" class="py-3">
                    <div class="d-flex align-center flex-wrap ga-2 mb-2">
                      <v-chip size="small" label variant="tonal" color="secondary">{{ document.code }}</v-chip>
                      <span class="text-subtitle-2">{{ document.name }}</span>
                    </div>
                    <v-row dense>
                      <v-col cols="6" md="3">
                        <v-text-field
                          v-model="document.voucher_code"
                          label="Comprobante"
                          :aria-label="`Comprobante de ${document.name}`"
                          :maxlength="VOUCHER_MAX_LENGTH"
                          density="compact"
                          hide-details="auto"
                        />
                      </v-col>
                      <v-col v-for="account in document.accounts" :key="account.role" cols="6" md="3">
                        <v-text-field
                          v-model="account.account"
                          :label="account.label"
                          :aria-label="`Cuenta de ${roleName(document, account)}`"
                          v-bind="accountProps(account.account, roleName(document, account))"
                          :hint="natureHint(account)"
                          persistent-hint
                        />
                      </v-col>
                      <v-col v-if="!document.accounts.length" cols="12" sm="6" md="9" class="d-flex align-center">
                        <p class="text-body-2 text-medium-emphasis">
                          {{
                            document.key === 'sale_reversal'
                              ? 'Usa las cuentas de la venta que reversa, con los lados invertidos: lo que fue débito queda en crédito.'
                              : 'No lleva cuentas propias.'
                          }}
                        </p>
                      </v-col>
                    </v-row>
                  </div>
                </template>
              </v-tabs-window-item>

              <v-tabs-window-item value="templates">
                <div class="d-flex align-center flex-wrap ga-3 mb-3">
                  <p class="text-body-2 text-medium-emphasis flex-1-1">
                    Cada plantilla arma el Excel como lo pide tu programa contable: qué columnas, con qué encabezado y en
                    qué orden. Si tu programa te da un archivo de ejemplo, súbelo y eliges qué dato va en cada columna.
                  </p>
                  <div class="d-flex flex-wrap ga-2">
                    <LockableButton icon="mdi-upload" color="primary" variant="tonal" :loading="uploading" @click="pickTemplateFile">
                      Subir plantilla del programa contable
                    </LockableButton>
                    <LockableButton icon="mdi-plus" color="primary" variant="tonal" @click="openEditor()">
                      Nueva plantilla
                    </LockableButton>
                  </div>
                  <input
                    ref="templateFileInput"
                    type="file"
                    accept=".xlsx,.csv"
                    class="d-none"
                    aria-label="Archivo de ejemplo del programa contable"
                    @change="readTemplateFile"
                  >
                </div>
                <v-list lines="two" class="border rounded py-0">
                  <template v-for="(template, index) in templates" :key="template.id">
                    <v-divider v-if="index" />
                    <v-list-item :title="template.name" :subtitle="templateSummary(template)">
                      <template #append>
                        <div class="d-flex">
                          <v-btn
                            icon="mdi-pencil"
                            variant="text"
                            size="small"
                            :disabled="isReadOnly"
                            :aria-label="`Editar la plantilla ${template.name}`"
                            @click="openEditor(template)"
                          />
                          <v-btn
                            icon="mdi-content-copy"
                            variant="text"
                            size="small"
                            :disabled="isReadOnly"
                            :aria-label="`Duplicar la plantilla ${template.name}`"
                            @click="openEditor(template, true)"
                          />
                          <v-btn
                            icon="mdi-delete-outline"
                            variant="text"
                            size="small"
                            :disabled="isReadOnly"
                            :loading="deleting === template.id"
                            :aria-label="`Eliminar la plantilla ${template.name}`"
                            @click="removeTemplate(template)"
                          />
                        </div>
                      </template>
                    </v-list-item>
                  </template>
                </v-list>
              </v-tabs-window-item>
            </v-tabs-window>
          </v-form>
        </template>
      </v-card-text>

      <!-- Errors stay inside the dialog: a snackbar would cover its buttons -->
      <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mx-4 mt-2">{{ error }}</v-alert>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="close">Cerrar</v-btn>
        <LockableButton v-if="tab !== 'templates'" color="primary" :loading="saving" :disabled="!draft" @click="save">
          Guardar
        </LockableButton>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog v-model="editor.open" :fullscreen="xs" max-width="760" persistent scrollable>
    <v-card>
      <v-card-title class="text-wrap">{{ editor.title }}</v-card-title>
      <v-card-text>
        <v-form ref="editorForm" @submit.prevent="saveTemplate">
          <v-row dense>
            <v-col cols="12" sm="7">
              <v-text-field v-model="editor.name" label="Nombre" :rules="nameRules" maxlength="60" density="compact" />
            </v-col>
            <v-col cols="12" sm="5">
              <v-select
                v-model="editor.date_format"
                :items="options(accountingDateFormatLabels)"
                label="Formato de fecha"
                density="compact"
              />
            </v-col>
          </v-row>

          <div class="text-subtitle-2 mt-2">Columnas</div>
          <template v-if="editor.fromFile">
            <p class="text-body-2 text-medium-emphasis mb-3">
              Los encabezados de tu archivo, en su orden. Elige qué dato va en cada uno; los que tu programa espera pero
              Servify no tiene quedan como columna fija, vacía o con el valor que escribas.
            </p>
            <div
              v-for="(column, index) in editor.columns"
              :key="column.uid"
              role="group"
              :aria-label="`Columna ${column.fileHeader || excelColumn(index)}`"
              class="mb-2"
            >
              <v-row dense>
                <v-col cols="12" sm="4">
                  <v-text-field
                    v-model="column.label"
                    label="Encabezado"
                    :rules="headerRules"
                    maxlength="60"
                    density="compact"
                    hide-details="auto"
                  >
                    <template #prepend-inner>
                      <span class="text-caption text-medium-emphasis">{{ excelColumn(index) }}</span>
                    </template>
                  </v-text-field>
                </v-col>
                <v-col cols="12" :sm="column.key === FIXED ? 4 : 8">
                  <v-select
                    v-model="column.key"
                    :items="settings?.columns ?? []"
                    item-title="label"
                    item-value="key"
                    label="Dato"
                    density="compact"
                    hide-details
                  />
                </v-col>
                <v-col v-if="column.key === FIXED" cols="12" sm="4">
                  <v-text-field
                    v-model="column.value"
                    label="Valor (opcional)"
                    maxlength="100"
                    density="compact"
                    hide-details
                  />
                </v-col>
              </v-row>
            </div>
          </template>
          <template v-else>
            <p class="text-body-2 text-medium-emphasis mb-3">
              Quedan en el Excel en este orden. Cambia el encabezado para que diga lo mismo que tu programa contable.
            </p>
            <div
              v-for="(column, index) in editor.columns"
              :key="column.uid"
              role="group"
              :aria-label="`Columna ${columnName(column)}`"
              class="d-flex align-start ga-1 mb-1"
            >
              <div class="flex-grow-1">
                <v-row dense>
                  <v-col cols="12" :sm="column.key === FIXED ? 6 : 12">
                    <v-text-field
                      v-model="column.label"
                      :label="column.key === FIXED ? 'Columna fija' : sourceName(column.key)"
                      :aria-label="`Encabezado de ${fieldName(column, index)}`"
                      :rules="headerRules"
                      maxlength="60"
                      density="compact"
                      hide-details="auto"
                    >
                      <template #prepend-inner>
                        <span class="text-caption text-medium-emphasis">{{ excelColumn(index) }}</span>
                      </template>
                    </v-text-field>
                  </v-col>
                  <v-col v-if="column.key === FIXED" cols="12" sm="6">
                    <v-text-field
                      v-model="column.value"
                      label="Valor"
                      :aria-label="`Valor de ${fieldName(column, index)}`"
                      hint="El mismo en todas las filas"
                      persistent-hint
                      maxlength="100"
                      density="compact"
                    />
                  </v-col>
                </v-row>
              </div>
              <div class="d-flex pt-1">
                <v-btn
                  icon="mdi-arrow-up"
                  variant="text"
                  size="small"
                  :disabled="index === 0"
                  :aria-label="`Subir la columna ${columnName(column)}`"
                  @click="moveColumn(index, -1)"
                />
                <v-btn
                  icon="mdi-arrow-down"
                  variant="text"
                  size="small"
                  :disabled="index === editor.columns.length - 1"
                  :aria-label="`Bajar la columna ${columnName(column)}`"
                  @click="moveColumn(index, 1)"
                />
                <v-btn
                  icon="mdi-close"
                  variant="text"
                  size="small"
                  :disabled="editor.columns.length === 1"
                  :aria-label="`Quitar la columna ${columnName(column)}`"
                  @click="editor.columns.splice(index, 1)"
                />
              </div>
            </div>

            <div class="d-flex flex-wrap align-center ga-2 mt-2">
              <v-menu location="bottom start" max-height="360">
                <template #activator="{ props: menu }">
                  <v-btn
                    v-bind="menu"
                    variant="tonal"
                    color="primary"
                    prepend-icon="mdi-plus"
                    :disabled="editor.columns.length >= MAX_COLUMNS || !addableColumns.length"
                  >
                    Agregar columna
                  </v-btn>
                </template>
                <v-list density="compact">
                  <v-list-item
                    v-for="column in addableColumns"
                    :key="column.key"
                    :title="column.label"
                    @click="addColumn(column.key)"
                  />
                </v-list>
              </v-menu>
              <v-btn
                variant="tonal"
                color="secondary"
                prepend-icon="mdi-format-text"
                :disabled="editor.columns.length >= MAX_COLUMNS"
                @click="addColumn(FIXED)"
              >
                Columna fija
              </v-btn>
              <span class="text-caption text-medium-emphasis">{{ editor.columns.length }} de {{ MAX_COLUMNS }} columnas</span>
            </div>
          </template>

          <div class="text-subtitle-2 mt-5 mb-1">Así queda la primera fila del Excel</div>
          <v-table density="compact" class="border rounded">
            <caption class="d-sr-only">Encabezados de la plantilla</caption>
            <thead>
              <tr>
                <th v-for="(column, index) in editor.columns" :key="column.uid" class="text-medium-emphasis">
                  {{ excelColumn(index) }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td v-for="column in editor.columns" :key="column.uid" class="text-no-wrap font-weight-medium">
                  {{ column.label.trim() || '—' }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-form>
      </v-card-text>
      <v-alert v-if="editorError" type="error" variant="tonal" density="compact" class="mx-4 mt-2">{{ editorError }}</v-alert>
      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="editorSaving" @click="editor.open = false">Cancelar</v-btn>
        <LockableButton color="primary" :loading="editorSaving" @click="saveTemplate">Guardar plantilla</LockableButton>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar v-model="snackbar.show" color="success" :timeout="3000" closable>{{ snackbar.text }}</v-snackbar>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import LockableButton from './LockableButton.vue'
import { useReadOnly } from '@/composables/useReadOnly'
import reportsService, {
  type AccountingDateFormat,
  type AccountingDocument,
  type AccountingMethodDocument,
  type AccountingPaymentMethod,
  type AccountingRole,
  type AccountingSettings,
  type AccountingSettingsUpdate,
  type AccountingTax,
  type AccountingTemplate,
  type AccountingTemplateColumn,
  type AccountingTemplateHeaders,
} from '@/services/reportsService'
import { errorMessage } from '@/utils/errors'
import { accountingDateFormatLabels, accountingNatureLabels, label, options } from '@/utils/labels'
import { percent } from '@/utils/money'
import { ACCOUNT_MAX_LENGTH, accountProblem, accountRule } from '@/utils/validation'

export type AccountingTab = 'payment_methods' | 'documents' | 'taxes' | 'templates'

const props = defineProps<{
  modelValue: boolean
  /** Names of blank accounts a movement needed (its 422 `missing`): the dialog opens on the first one. */
  focus?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  /** Something was saved: the page reloads its template list. */
  changed: []
}>()

const { xs } = useDisplay()
const isReadOnly = useReadOnly()

const VOUCHER_MAX_LENGTH = 20
const FIXED = 'fixed'
const MAX_COLUMNS = 40
/** What "Genérica" carries: a new template starts from it. */
const GENERIC_COLUMNS = [
  'voucher', 'document_number', 'date', 'account', 'third_party_document', 'third_party_dv',
  'third_party_name', 'description', 'debit', 'credit', 'base', 'tax_rate',
]

const tab = ref<AccountingTab>('payment_methods')
const settings = ref<AccountingSettings | null>(null)
/** The accounts and voucher codes being typed; `settings` keeps what is saved. */
const draft = ref<AccountingSettings | null>(null)
const templates = ref<AccountingTemplate[]>([])
const loading = ref(false)
const loadError = ref('')
const error = ref('')
const saving = ref(false)
const accountsForm = ref()

const snackbar = ref({ show: false, text: '' })
const notify = (text: string) => {
  snackbar.value = { show: true, text }
}

// --- Accounts ---
/** How the API names each account in `missing` and in its messages. */
const roleName = (document: AccountingDocument, account: AccountingRole): string => `${account.label} · ${document.name}`
const taxName = (tax: AccountingTax, side: 'sales' | 'purchases'): string => `${tax.name} (${side === 'sales' ? 'ventas' : 'compras'})`

const natureHint = (account: AccountingRole): string =>
  account.nature ? label(accountingNatureLabels, account.nature) : 'Débito o crédito, según el movimiento'

// A blank account is allowed, so it is marked instead of refused.
const accountProps = (value: string | null, name: string) => ({
  rules: [accountRule(name)],
  maxlength: ACCOUNT_MAX_LENGTH,
  inputmode: 'numeric',
  density: 'compact' as const,
  placeholder: 'Sin cuenta',
  persistentPlaceholder: true,
  baseColor: (value ?? '').trim() ? undefined : 'warning',
})

/** A method's own account in one document: blank is the usual case (it posts to the method's account). */
const METHOD_DOCUMENTS: { key: AccountingMethodDocument; label: string }[] = [
  { key: 'sale', label: 'Venta' },
  { key: 'cash_receipt', label: 'Recibo de caja' },
]
/** As the API names it in its messages: "Efectivo · Recibo de caja". */
const documentAccountName = (method: AccountingPaymentMethod, document: AccountingMethodDocument): string =>
  `${method.label} · ${METHOD_DOCUMENTS.find(entry => entry.key === document)?.label ?? document}`
const documentAccountProps = (name: string) => ({
  rules: [accountRule(name)],
  maxlength: ACCOUNT_MAX_LENGTH,
  inputmode: 'numeric',
  density: 'compact' as const,
  placeholder: 'La misma',
  persistentPlaceholder: true,
})

interface AccountField {
  tab: AccountingTab
  name: string
  value: string | null
}

/** Every account field in the order the screen shows them, which is also the order of the API's `missing`. */
const accountFields = computed((): AccountField[] => {
  const current = draft.value
  if (!current) return []
  return [
    ...current.payment_methods.flatMap(method => [
      { tab: 'payment_methods' as const, name: method.label, value: method.account },
      ...(method.accounts_by_document
        ? METHOD_DOCUMENTS.map(document => ({
            tab: 'payment_methods' as const,
            name: documentAccountName(method, document.key),
            value: method.accounts_by_document?.[document.key] ?? null,
          }))
        : []),
    ]),
    ...current.taxes.flatMap(tax => [
      { tab: 'taxes' as const, name: taxName(tax, 'sales'), value: tax.sales_account },
      { tab: 'taxes' as const, name: taxName(tax, 'purchases'), value: tax.purchase_account },
    ]),
    ...current.documents.flatMap(document =>
      document.accounts.map(account => ({ tab: 'documents' as const, name: roleName(document, account), value: account.account })),
    ),
  ]
})

const missing = computed(() => settings.value?.missing ?? [])

const blankToNull = (value: string | null | undefined): string | null => (value ?? '').trim() || null

const updateFrom = (from: AccountingSettings): AccountingSettingsUpdate => ({
  payment_methods: from.payment_methods.map(method => ({
    method: method.method,
    account: blankToNull(method.account),
    ...(method.accounts_by_document
      ? {
          accounts_by_document: {
            sale: blankToNull(method.accounts_by_document.sale),
            cash_receipt: blankToNull(method.accounts_by_document.cash_receipt),
          },
        }
      : {}),
  })),
  taxes: from.taxes.map(tax => ({
    id: tax.id,
    sales_account: blankToNull(tax.sales_account),
    purchase_account: blankToNull(tax.purchase_account),
  })),
  documents: from.documents.map(document => ({
    key: document.key,
    voucher_code: blankToNull(document.voucher_code),
    accounts: document.accounts.map(account => ({ role: account.role, account: blankToNull(account.account) })),
  })),
})

// The message about an account goes once the user edits again.
watch(draft, () => { error.value = '' }, { deep: true })

const dirty = computed(
  () => !!settings.value && !!draft.value && JSON.stringify(updateFrom(draft.value)) !== JSON.stringify(updateFrom(settings.value)),
)

const apply = (answer: AccountingSettings) => {
  settings.value = answer
  draft.value = JSON.parse(JSON.stringify(answer))
  templates.value = answer.templates
}

/** The tab of a name the API listed, when no field carries exactly that name. */
const guessTab = (name: string): AccountingTab => {
  if (name.includes(' · ')) return 'documents'
  if (draft.value?.taxes.some(tax => name.startsWith(tax.name))) return 'taxes'
  if (draft.value?.payment_methods.some(method => name.includes(method.label))) return 'payment_methods'
  return 'documents'
}

/** Opens the tab of the first missing account and puts the cursor in it. */
const focusMissing = (names: string[]) => {
  const target = accountFields.value.find(field => names.includes(field.name))
  tab.value = target?.tab ?? guessTab(names[0] ?? '')
  if (!target) return
  // The window slides in first; an input still hidden cannot take the focus.
  setTimeout(() => {
    const input = document.querySelector<HTMLInputElement>(`input[aria-label="${CSS.escape(`Cuenta de ${target.name}`)}"]`)
    input?.focus()
    input?.scrollIntoView({ block: 'center' })
  }, 350)
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  error.value = ''
  try {
    apply(await reportsService.accountingSettings())
    await nextTick()
    if (props.focus?.length) focusMissing(props.focus)
  } catch (failure) {
    loadError.value = errorMessage(failure, 'No fue posible cargar la contabilidad. Inténtalo de nuevo.')
  } finally {
    loading.value = false
  }
}

watch(
  () => props.modelValue,
  open => {
    if (!open) return
    tab.value = 'payment_methods'
    load()
  },
  { immediate: true },
)

const save = async () => {
  if (!draft.value) return
  error.value = ''
  await accountsForm.value?.validate()
  const invalid = accountFields.value.find(field => accountProblem(field.value, field.name))
  if (invalid) {
    tab.value = invalid.tab
    error.value = accountProblem(invalid.value, invalid.name) ?? ''
    return
  }
  saving.value = true
  try {
    const { settings: answer, message } = await reportsService.saveAccountingSettings(updateFrom(draft.value))
    apply(answer)
    notify(message)
    emit('changed')
  } catch (failure) {
    error.value = errorMessage(failure, 'No fue posible guardar la contabilidad. Inténtalo de nuevo.')
  } finally {
    saving.value = false
  }
}

const close = () => {
  if (dirty.value && !confirm('Tienes cuentas sin guardar. ¿Quieres cerrar sin guardarlas?')) return
  emit('update:modelValue', false)
}

// --- Templates ---
const sourceName = (key: string): string => settings.value?.columns.find(column => column.key === key)?.label ?? key

// The headers matter more than the date's example, which the editor shows.
const templateSummary = (template: AccountingTemplate): string => {
  const dates = label(accountingDateFormatLabels, template.date_format).split(' (')[0]
  return `${template.columns.length} columnas, fechas ${dates}: ${template.columns.map(column => column.label).join(', ')}`
}

interface EditorColumn extends AccountingTemplateColumn {
  uid: number
  /** The header as the uploaded file wrote it: names the column while its header is edited. */
  fileHeader?: string
}

let columnUid = 0
const editor = reactive({
  open: false,
  id: null as string | null,
  title: '',
  name: '',
  date_format: 'd/m/Y' as AccountingDateFormat,
  columns: [] as EditorColumn[],
  /** Built from the accounting software's file: its headers stay in their order, each picks its datum. */
  fromFile: false,
})
const editorForm = ref()
const editorSaving = ref(false)
const editorError = ref('')
const deleting = ref<string | null>(null)

const nameRules = [
  (v: string) => !!v?.trim() || 'Escribe el nombre de la plantilla.',
  (v: string) => (v?.trim().length ?? 0) <= 60 || 'El nombre puede tener hasta 60 caracteres.',
]
const headerRules = [(v: string) => !!v?.trim() || 'Escribe el encabezado de la columna.']

const editorColumn = (column: AccountingTemplateColumn): EditorColumn => ({
  key: column.key,
  label: column.label,
  ...(column.key === FIXED ? { value: column.value ?? '' } : {}),
  uid: ++columnUid,
})

const openEditor = (template?: AccountingTemplate, copy = false) => {
  editorError.value = ''
  editor.fromFile = false
  editor.id = template && !copy ? template.id : null
  editor.title = template && !copy ? `Editar la plantilla ${template.name}` : 'Nueva plantilla'
  editor.name = template ? (copy ? `${template.name} (copia)` : template.name) : ''
  editor.date_format = template?.date_format ?? 'd/m/Y'
  const known = new Set(settings.value?.columns.map(column => column.key))
  const columns = template?.columns ?? GENERIC_COLUMNS.filter(key => known.has(key)).map(key => ({ key, label: sourceName(key) }))
  editor.columns = columns.map(editorColumn)
  editor.open = true
}

// --- A template from the accounting software's own file ---
const templateFileInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const pickTemplateFile = () => templateFileInput.value?.click()

/**
 * Each header of the file, in order, with the datum the API suggests for it;
 * one it could not match stays a fixed column, empty until a value is typed.
 */
const openEditorFromFile = (fileName: string, { headers, suggestions }: AccountingTemplateHeaders) => {
  const known = new Set(settings.value?.columns.map(column => column.key))
  editorError.value = ''
  editor.fromFile = true
  editor.id = null
  editor.title = `Nueva plantilla desde ${fileName}`
  editor.name = fileName.replace(/\.(xlsx|csv)$/i, '').trim().slice(0, 60)
  editor.date_format = 'd/m/Y'
  editor.columns = headers.map((header, index) => {
    const suggested = (suggestions[index]?.label === header ? suggestions[index] : suggestions.find(entry => entry.label === header))?.key
    const key = suggested && known.has(suggested) ? suggested : FIXED
    // A value is kept for every column: its datum may still be switched to "Columna fija".
    return { ...editorColumn({ key, label: header }), value: '', fileHeader: header }
  })
  editor.open = true
}

const readTemplateFile = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Choosing the same file again is another upload.
  input.value = ''
  if (!file) return
  error.value = ''
  uploading.value = true
  try {
    openEditorFromFile(file.name, await reportsService.accountingTemplateHeaders(file))
  } catch (failure) {
    error.value = errorMessage(failure, 'No fue posible leer el archivo. Sube el Excel (.xlsx) o CSV de ejemplo de tu programa contable.')
  } finally {
    uploading.value = false
  }
}

/** Its header as typed, or what it carries while the header is empty. */
const columnName = (column: EditorColumn): string => column.label.trim() || sourceName(column.key)

/** A stable name for the column's fields while its header is being typed. */
const fieldName = (column: EditorColumn, index: number): string => {
  if (column.key !== FIXED) return `la columna ${sourceName(column.key)}`
  const fixedBefore = editor.columns.slice(0, index).filter(other => other.key === FIXED).length
  return fixedBefore ? `la columna fija ${fixedBefore + 1}` : 'la columna fija'
}

const addableColumns = computed(() =>
  (settings.value?.columns ?? []).filter(column => column.key !== FIXED && !editor.columns.some(used => used.key === column.key)),
)

const addColumn = (key: string) => {
  editor.columns.push(editorColumn({ key, label: sourceName(key), value: '' }))
}

const moveColumn = (index: number, delta: -1 | 1) => {
  const [column] = editor.columns.splice(index, 1)
  if (column) editor.columns.splice(index + delta, 0, column)
}

const excelColumn = (index: number): string => {
  let letters = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  }
  return letters
}

const saveTemplate = async () => {
  const { valid } = await editorForm.value.validate()
  if (!valid) return
  editorSaving.value = true
  editorError.value = ''
  try {
    const payload = {
      name: editor.name.trim(),
      date_format: editor.date_format,
      columns: editor.columns.map(column =>
        column.key === FIXED
          ? { key: column.key, label: column.label.trim(), value: (column.value ?? '').trim() }
          : { key: column.key, label: column.label.trim() },
      ),
    }
    const { template, message } = editor.id
      ? await reportsService.updateAccountingTemplate(editor.id, payload)
      : await reportsService.createAccountingTemplate(payload)
    const index = templates.value.findIndex(known => known.id === template.id)
    if (index >= 0) templates.value.splice(index, 1, template)
    else templates.value.push(template)
    editor.open = false
    notify(message)
    emit('changed')
  } catch (failure) {
    editorError.value = errorMessage(failure, 'No fue posible guardar la plantilla. Inténtalo de nuevo.')
  } finally {
    editorSaving.value = false
  }
}

const removeTemplate = async (template: AccountingTemplate) => {
  if (!confirm(`¿Seguro que quieres eliminar la plantilla «${template.name}»?`)) return
  error.value = ''
  deleting.value = template.id
  try {
    const message = await reportsService.deleteAccountingTemplate(template.id)
    templates.value = templates.value.filter(known => known.id !== template.id)
    notify(message)
    emit('changed')
  } catch (failure) {
    error.value = errorMessage(failure, 'No fue posible eliminar la plantilla. Inténtalo de nuevo.')
  } finally {
    deleting.value = null
  }
}
</script>
