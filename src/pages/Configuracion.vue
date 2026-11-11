<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-1">Configuración</h1>
        <p class="text-body-1 text-medium-emphasis mb-4">
          Datos del negocio y catálogos: tipos de documento del kardex, impuestos y resolución DIAN
        </p>
      </v-col>
    </v-row>

    <!-- Encabezado de las facturas, cuentas de cobro y recibos de caja: una
         sola plantilla para todas las empresas, con los datos de cada una. -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-1">
            <h2 class="text-h6">Datos del negocio</h2>
            <v-spacer />
            <v-chip v-if="business" size="small" variant="tonal" :color="business.complete ? 'success' : 'warning'">
              {{ business.complete ? 'Completo' : 'Faltan datos' }}
            </v-chip>
          </div>
          <p class="text-body-2 text-medium-emphasis mb-4">
            Van en el encabezado de las facturas, cuentas de cobro y recibos de caja que imprimes.
            Los campos con <span class="text-error font-weight-bold">*</span> son obligatorios.
          </p>
          <v-form ref="businessFormRef">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.legal_name" :rules="[required]">
                  <template #label>Nombre o razón social <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.trade_name" label="Nombre comercial (opcional)" />
              </v-col>
              <v-col cols="8" md="3">
                <v-text-field
                  v-model="businessForm.nit"
                  :rules="[required, documentRule('NIT')]"
                  hint="Persona natural: tu cédula, que es tu NIT en el RUT"
                  persistent-hint
                  @blur="tidyNit"
                >
                  <template #label>NIT <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="4" md="2">
                <v-text-field
                  :model-value="nitDigit ?? ''"
                  label="DV"
                  readonly
                  hint="Lo calcula el sistema"
                  persistent-hint
                  aria-label="Dígito de verificación del NIT del negocio"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="businessForm.tax_regime"
                  :items="taxRegimeOptions"
                  label="Régimen"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field v-model="businessForm.phone" :rules="[required]" hint="Puedes poner varios: 3159276091 - 3001571023" persistent-hint>
                  <template #label>Teléfonos <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.address" :rules="[required]">
                  <template #label>Dirección <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
                </v-text-field>
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="businessForm.city" label="Ciudad" />
              </v-col>
              <v-col cols="6" md="3">
                <v-text-field v-model="businessForm.department" label="Departamento" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="businessForm.email" label="Correo (opcional)" type="email" />
              </v-col>
              <v-col cols="12" md="6">
                <ImageUploader v-model="businessForm.logo_url" folder="companies" label="Logo (opcional)" contain keep-previous />
                <p class="text-caption text-medium-emphasis mt-1">
                  Sale en el encabezado de cada documento y arriba en la tirilla. Guarda los datos del negocio para usarlo.
                </p>
              </v-col>
              <v-col cols="12">
                <v-textarea
                  v-model="businessForm.document_notes"
                  label="Observaciones de los documentos"
                  placeholder="Ej.: Favor consignar en Cta ahorros 37342931449 Bancolombia a nombre de…"
                  hint="Salen en las observaciones de cada factura y cuenta de cobro"
                  persistent-hint
                  rows="2"
                  auto-grow
                />
              </v-col>
            </v-row>
          </v-form>
          <div class="d-flex justify-end mt-3">
            <LockableButton color="primary" :loading="savingBusiness" @click="saveBusiness">
              Guardar datos del negocio
            </LockableButton>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Presentation, not a module: the API takes an order with or without a
         table in any mode, so switching back loses nothing. -->
    <v-row v-if="takesOrders">
      <v-col cols="12">
        <v-card class="pa-4">
          <h2 class="text-h6 mb-1">Cómo tomas los pedidos</h2>
          <p class="text-body-2 text-medium-emphasis mb-2">
            Lo que eligen tus meseros en la app y tú en Nuevo pedido: la mesa, el cliente o cualquiera de los dos.
          </p>
          <v-radio-group v-model="orderModeChoice" :disabled="isReadOnly" hide-details aria-label="Cómo tomas los pedidos">
            <v-radio v-for="mode in orderModes" :key="mode" :value="mode" color="primary" class="mb-2">
              <template #label>
                <div>
                  <div class="text-body-1 font-weight-medium text-high-emphasis">{{ orderModeLabels[mode] }}</div>
                  <div class="text-body-2 text-medium-emphasis">{{ orderModeHints[mode] }}</div>
                </div>
              </template>
            </v-radio>
          </v-radio-group>
          <p class="text-caption text-medium-emphasis mt-2">
            Tus mesas no se borran: vuelven a salir si eliges mesas otra vez. La app de los meseros lo toma al abrirla.
          </p>
          <div class="d-flex justify-end mt-3">
            <LockableButton
              color="primary"
              :loading="savingOrderMode"
              :disabled="orderModeChoice === authStore.orderMode"
              @click="saveOrderMode"
            >
              Guardar cómo tomas los pedidos
            </LockableButton>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <!-- Tipos de documento -->
      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Tipos de documento</h2>
            <v-spacer />
            <LockableButton icon="mdi-plus" color="primary" size="small" @click="openDocDialog()">
              Nuevo
            </LockableButton>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="dt in documentTypes" :key="dt.id">
                <td><v-chip size="small" variant="tonal">{{ dt.code }}</v-chip></td>
                <td>{{ dt.name }}</td>
                <td class="text-caption">{{ directionLabel(dt.direction) }}</td>
                <td>
                  <v-chip :color="dt.active ? 'success' : 'secondary'" size="x-small">
                    {{ dt.active ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                </td>
                <td class="text-right">
                  <v-btn icon size="x-small" variant="text" :disabled="isReadOnly" :aria-label="`Editar el tipo de documento ${dt.code}`" @click="openDocDialog(dt)">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn
                    v-if="!isSystemCode(dt.code)"
                    icon
                    size="x-small"
                    variant="text"
                    color="error"
                    :aria-label="`Eliminar el tipo de documento ${dt.code}`" @click="deleteDocType(dt)"
                  >
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <p class="text-caption text-medium-emphasis mt-2">
            SI, FC, FV y AJ los usa el sistema y no se pueden eliminar.
          </p>
        </v-card>
      </v-col>

      <!-- Impuestos -->
      <v-col cols="12" md="6">
        <v-card class="pa-4">
          <div class="d-flex align-center mb-3">
            <h2 class="text-h6">Impuestos</h2>
            <v-spacer />
            <LockableButton icon="mdi-plus" color="primary" size="small" @click="openTaxDialog()">
              Nuevo
            </LockableButton>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Nombre</th>
                <th class="text-right">Porcentaje</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tax in taxes" :key="tax.id">
                <td>{{ tax.name }}</td>
                <td class="text-right">{{ tax.rate }}%</td>
                <td>
                  <v-chip :color="tax.active ? 'success' : 'secondary'" size="x-small">
                    {{ tax.active ? 'Activo' : 'Inactivo' }}
                  </v-chip>
                </td>
                <td class="text-right">
                  <v-btn icon size="x-small" variant="text" :disabled="isReadOnly" :aria-label="`Editar el impuesto ${tax.name}`" @click="openTaxDialog(tax)">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn icon size="x-small" variant="text" color="error" :disabled="isReadOnly" :aria-label="`Eliminar el impuesto ${tax.name}`" @click="deleteTax(tax)">
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <p class="text-caption text-medium-emphasis mt-2">
            Estos porcentajes alimentan los selectores de impuesto en productos y menú.
          </p>
        </v-card>
      </v-col>
    </v-row>

    <!-- Formas de pago: cada negocio define las suyas, dónde se usa cada una,
         su cuenta contable y, si quiere, la cuenta bancaria donde le pagan.
         El orden es el de los selectores de cobro. -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <div class="d-flex flex-wrap align-center ga-2 mb-1">
            <h2 class="text-h6">Formas de pago</h2>
            <v-spacer />
            <LockableButton icon="mdi-plus" color="primary" size="small" aria-label="Nueva forma de pago" @click="openMethodDialog()">
              Nueva
            </LockableButton>
          </div>
          <p class="text-caption text-medium-emphasis mb-3">
            Las que ofreces al cobrar, en este orden. La cuenta contable es la que usa el movimiento contable. Si
            escribes el número de cuenta bancaria, puedes mostrarlo como observación en las facturas, las cuentas de
            cobro, los recibos de caja y las tirillas para que tus clientes sepan dónde pagarte.
          </p>
          <v-alert v-if="methodsError" type="error" variant="tonal" density="compact" class="mb-3">{{ methodsError }}</v-alert>
          <v-data-table
            :headers="methodHeaders"
            :items="paymentMethods"
            item-value="id"
            :items-per-page="-1"
            hide-default-footer
            density="compact"
            mobile-breakpoint="sm"
            :hide-default-header="xs"
            aria-label="Formas de pago"
          >
            <template #item.name="{ item }">
              <span class="font-weight-medium text-no-wrap">{{ item.name }}</span>
            </template>
            <template #item.is_cash="{ item }">
              <v-chip v-if="item.is_cash" size="x-small" variant="tonal" color="secondary" prepend-icon="mdi-cash-register">Sí</v-chip>
              <span v-else class="text-medium-emphasis">No</span>
            </template>
            <template #item.account="{ item }">
              <span v-if="item.account">{{ item.account }}</span>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.bank_account="{ item }">
              <div v-if="item.bank_account" class="d-flex flex-wrap align-center ga-1 py-1">
                <span>{{ item.bank_account }}</span>
                <v-chip v-if="item.show_bank_account" size="x-small" variant="tonal" color="secondary" prepend-icon="mdi-printer">
                  Se imprime
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis">—</span>
            </template>
            <template #item.documents="{ item }">
              <span class="text-body-2">{{ documentsText(item.documents) }}</span>
            </template>
            <template #item.active="{ item }">
              <v-chip :color="item.active ? 'success' : 'secondary'" size="x-small">
                {{ item.active ? 'Activa' : 'Inactiva' }}
              </v-chip>
            </template>
            <template #item.actions="{ item, index }">
              <div class="d-flex justify-end text-no-wrap">
                <v-btn
                  icon="mdi-arrow-up"
                  size="x-small"
                  variant="text"
                  :disabled="isReadOnly || index === 0 || reordering"
                  :aria-label="`Subir la forma de pago ${item.name}`"
                  @click="moveMethod(index, -1)"
                />
                <v-btn
                  icon="mdi-arrow-down"
                  size="x-small"
                  variant="text"
                  :disabled="isReadOnly || index === paymentMethods.length - 1 || reordering"
                  :aria-label="`Bajar la forma de pago ${item.name}`"
                  @click="moveMethod(index, 1)"
                />
                <v-btn
                  icon="mdi-pencil"
                  size="x-small"
                  variant="text"
                  :disabled="isReadOnly"
                  :aria-label="`Editar la forma de pago ${item.name}`"
                  @click="openMethodDialog(item)"
                />
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  color="error"
                  :disabled="isReadOnly"
                  :aria-label="`Eliminar la forma de pago ${item.name}`"
                  @click="deleteMethod(item)"
                />
              </div>
            </template>
            <template #no-data>
              <div class="text-medium-emphasis py-4">Todavía no tienes formas de pago.</div>
            </template>
          </v-data-table>
          <p class="text-caption text-medium-emphasis mt-2">
            Una forma de pago con movimientos no se puede eliminar: desactívala y deja de salir al cobrar.
          </p>
        </v-card>
      </v-col>
    </v-row>

    <!-- Resolución de facturación DIAN: rango autorizado de consecutivos.
         Cada venta toma el siguiente número y lo deja como referencia en
         el kardex; el sistema alerta antes de que el rango se agote. -->
    <v-row>
      <v-col cols="12">
        <v-card class="pa-4">
          <div class="d-flex flex-wrap align-center ga-2 mb-1">
            <h2 class="text-h6">Resolución de facturación (DIAN)</h2>
            <v-spacer />
            <v-chip
              v-if="resolutionStatus?.configured"
              :color="resolutionStatus.warning ? (resolutionStatus.blocking ? 'error' : 'warning') : 'success'"
              size="small"
              variant="tonal"
            >
              {{ resolutionStatus.blocking
                ? 'Bloqueada'
                : `Quedan ${resolutionStatus.remaining} consecutivos` }}
            </v-chip>
          </div>
          <p class="text-caption text-medium-emphasis mb-4">
            Cada venta toma el siguiente consecutivo del rango y queda como referencia en el kardex.
            Te avisaremos con tiempo cuando el rango esté por agotarse, según el ritmo de ventas del negocio.
          </p>

          <v-form ref="resolutionFormRef" @submit.prevent="saveResolution">
            <p class="text-caption text-medium-emphasis mb-3">
              Los campos con
              <span class="text-error font-weight-bold">*</span>
              son obligatorios.
            </p>

            <v-row dense>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="resolutionForm.invoicing_resolution"
                  hint="Ej: 18764000001234"
                  persistent-hint
                >
                  <template #label>
                    Número de resolución <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="6" md="2">
                <v-text-field v-model="resolutionForm.invoice_prefix" label="Prefijo" hint="Ej: POS" persistent-hint />
              </v-col>
              <v-col cols="6" md="3">
                <MoneyField
                  v-model="resolutionForm.range_from"
                  count
                  :rules="[requiredNumber, rangeNumber]"
                >
                  <template #label>
                    Rango desde <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </MoneyField>
              </v-col>
              <v-col cols="6" md="3">
                <MoneyField
                  v-model="resolutionForm.range_to"
                  count
                  :rules="[requiredNumber, rangeNumber, rangeEnd]"
                >
                  <template #label>
                    Rango hasta <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </MoneyField>
              </v-col>
              <v-col cols="6" md="3">
                <MoneyField
                  v-model="resolutionForm.start_number"
                  count
                  :rules="[rangeNumber, startInRange]"
                  label="La numeración empieza en"
                  hint="Si ya facturaste con otros números, indica desde cuál sigue"
                  persistent-hint
                />
              </v-col>
              <v-col cols="6" md="3">
                <DateField
                  v-model="resolutionForm.resolution_date"
                  label="Fecha de la resolución"
                  hint="Es también el inicio de la vigencia"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <p class="text-caption text-medium-emphasis mb-1">Vigencia hasta</p>
                <v-btn-toggle
                  v-model="validityMode"
                  color="primary"
                  density="compact"
                  variant="outlined"
                  mandatory
                  class="mb-2"
                >
                  <v-btn value="months" size="small">Por meses</v-btn>
                  <v-btn value="date" size="small">Elegir fecha</v-btn>
                </v-btn-toggle>

                <v-text-field
                  v-if="validityMode === 'months'"
                  v-model.number="resolutionForm.validity_months"
                  type="number"
                  min="1"
                  max="120"
                  label="Meses de vigencia"
                  :hint="computedValidUntil ? `Vence el ${computedValidUntil}` : 'Ej: 48 meses desde la fecha de la resolución'"
                  persistent-hint
                />
                <DateField
                  v-else
                  v-model="resolutionForm.valid_until"
                  label="Vigente hasta"
                />
              </v-col>
              <v-col cols="12" class="d-flex align-center">
                <LockableButton color="primary" :loading="saving" @click="saveResolution">
                  Guardar resolución
                </LockableButton>
              </v-col>
            </v-row>
          </v-form>

          <v-alert v-if="resolutionStatus?.configured" type="info" variant="tonal" density="compact" class="mt-2">
            Próximo consecutivo:
            <strong>{{ resolutionForm.invoice_prefix }}{{ resolution?.current_sequence }}</strong>
            · Guardar un rango o número de resolución distinto reinicia el consecutivo al inicio del rango nuevo.
          </v-alert>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog tipo de documento -->
    <v-dialog v-model="docDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>{{ editingDoc ? 'Editar tipo de documento' : 'Nuevo tipo de documento' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="docForm.code"
            label="Código (ej: DV, ND)"
            :disabled="!!editingDoc"
            maxlength="10"
            :rules="[(v: string) => !!v || 'Código requerido']"
          />
          <v-text-field
            v-model="docForm.name"
            label="Nombre"
            :rules="[(v: string) => !!v || 'Nombre requerido']"
          />
          <v-select
            v-model="docForm.direction"
            label="Dirección"
            :items="[
              { title: 'Entrada', value: 'in' },
              { title: 'Salida', value: 'out' },
              { title: 'Ambas', value: 'both' },
            ]"
          />
          <v-switch
            v-if="editingDoc && !isSystemCode(editingDoc.code)"
            v-model="docForm.active"
            label="Activo"
            color="primary"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="docDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveDocType">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog impuesto -->
    <v-dialog v-model="taxDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>{{ editingTax ? 'Editar impuesto' : 'Nuevo impuesto' }}</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="taxForm.name"
            label="Nombre (ej: IVA 19%)"
            :rules="[(v: string) => !!v || 'Nombre requerido']"
          />
          <v-text-field
            v-model.number="taxForm.rate"
            label="Porcentaje"
            type="number"
            suffix="%"
            :rules="[(v: number) => v >= 0 || 'Debe ser 0 o mayor']"
          />
          <v-switch
            v-if="editingTax"
            v-model="taxForm.active"
            label="Activo"
            color="primary"
            hide-details
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="taxDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveTax">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog forma de pago -->
    <v-dialog v-model="methodDialog" max-width="520" persistent scrollable>
      <v-card>
        <v-card-title>{{ editingMethod ? `Editar ${editingMethod.name}` : 'Nueva forma de pago' }}</v-card-title>
        <v-card-text>
          <v-form ref="methodFormRef" @submit.prevent="saveMethod">
            <v-text-field
              v-model="methodForm.name"
              :maxlength="PAYMENT_METHOD_NAME_MAX_LENGTH"
              :rules="paymentMethodNameRules"
            >
              <template #label>Nombre <span class="text-error font-weight-bold" title="Campo obligatorio">*</span></template>
            </v-text-field>
            <v-switch
              v-model="methodForm.is_cash"
              label="Entra al cajón"
              color="primary"
              hint="Como el efectivo: suma en el efectivo a entregar del cierre"
              persistent-hint
              class="mb-2"
            />
            <v-text-field
              v-model="methodForm.account"
              label="Cuenta contable (opcional)"
              :maxlength="ACCOUNT_MAX_LENGTH"
              inputmode="numeric"
              :rules="[accountRule(methodForm.name.trim() || 'la forma de pago')]"
              hint="Ej: 110505. La usa el movimiento contable"
              persistent-hint
              class="mb-2"
            />
            <v-text-field
              v-model="methodForm.bank_account"
              label="Número de cuenta bancaria (opcional)"
              :maxlength="BANK_ACCOUNT_MAX_LENGTH"
              :rules="[bankAccountRule]"
              hint="Ej: Bancolombia ahorros 123-456"
              persistent-hint
              class="mb-2"
            />
            <v-switch
              v-model="methodForm.show_bank_account"
              label="Mostrar como observación en los documentos"
              color="primary"
              :disabled="!methodForm.bank_account?.trim()"
              :hint="methodForm.bank_account?.trim()
                ? 'Sale en las observaciones de facturas, cuentas de cobro, recibos de caja y tirillas'
                : 'Escribe el número de cuenta bancaria para mostrarlo'"
              persistent-hint
              class="mb-2"
            />
            <div role="group" aria-labelledby="method-documents-label" class="mt-2">
              <div id="method-documents-label" class="text-subtitle-2">Dónde se puede usar</div>
              <v-checkbox
                v-for="document in documentOptions"
                :key="document.value"
                v-model="methodForm.documents"
                :value="document.value"
                :label="document.title"
                color="primary"
                density="compact"
                hide-details
              />
              <p v-if="!methodForm.documents.length" class="text-caption text-error mt-1">
                {{ PAYMENT_METHOD_DOCUMENTS_MESSAGE }}
              </p>
            </div>
            <v-switch v-model="methodForm.active" label="Activa" color="primary" hide-details class="mt-2" />
          </v-form>
        </v-card-text>
        <v-alert v-if="methodError" type="error" variant="tonal" density="compact" class="mx-4 mt-2">{{ methodError }}</v-alert>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" :disabled="savingMethod" @click="methodDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="savingMethod" :disabled="!methodForm.documents.length" @click="saveMethod">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useDisplay } from 'vuetify'
import kardexService, { type DocumentType, type Tax } from '../services/kardexService'
import invoicingService, { type InvoicingResolution, type ResolutionStatus } from '../services/invoicingService'
import LockableButton from '../components/LockableButton.vue'
import ImageUploader from '../components/ImageUploader.vue'
import DateField from '../components/DateField.vue'
import MoneyField from '../components/MoneyField.vue'
import { useReadOnly } from '../composables/useReadOnly'
import { usePaymentMethods } from '../composables/usePaymentMethods'
import { billingService, type BusinessForm } from '../services/billingService'
import salesService, { type PaymentDocument, type PaymentMethodPayload, type PaymentMethodRow } from '../services/salesService'
import type { DocumentBusiness } from '../utils/printDocuments'
import { label, options, orderModeHints, orderModeLabels, paymentDocumentLabels, taxRegimeLabels } from '../utils/labels'
import { useAuthStore } from '../stores/auth'
import { effectiveFeatures, type OrderMode } from '../types/auth'
import { toIsoDate } from '../utils/dates'
import { errorMessage } from '../utils/errors'
import {
  ACCOUNT_MAX_LENGTH,
  BANK_ACCOUNT_MAX_LENGTH,
  PAYMENT_METHOD_DOCUMENTS_MESSAGE,
  PAYMENT_METHOD_NAME_MAX_LENGTH,
  accountRule,
  bankAccountRule,
  customerVerificationDigit,
  documentProblem,
  documentRule,
  normalizeDocument,
  paymentMethodNameRules,
} from '../utils/validation'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

const SYSTEM_CODES = ['SI', 'FC', 'FV', 'AJ']
const isSystemCode = (code: string) => SYSTEM_CODES.includes(code)

const documentTypes = ref<DocumentType[]>([])
const taxes = ref<Tax[]>([])
const saving = ref(false)

const snackbar = ref({ show: false, text: '', color: 'success' })
const notify = (text: string, color: 'success' | 'error' = 'success') => {
  snackbar.value = { show: true, text, color }
}

const directionLabel = (d: string) => ({ in: 'Entrada', out: 'Salida', both: 'Ambas' }[d] || d)

const load = async () => {
  try {
    const [docs, taxList] = await Promise.all([kardexService.documentTypes(), kardexService.taxes()])
    documentTypes.value = docs
    taxes.value = taxList
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cargar los catálogos. Inténtalo de nuevo.'), 'error')
  }
  loadResolution()
  loadBusiness()
}

// --- Datos del negocio (encabezado de los documentos) ---
const business = ref<DocumentBusiness | null>(null)
const businessFormRef = ref<any>(null)
const savingBusiness = ref(false)
const emptyBusiness = (): BusinessForm => ({
  legal_name: '',
  trade_name: '',
  nit: '',
  tax_regime: null,
  address: '',
  city: '',
  department: '',
  phone: '',
  email: '',
  document_notes: '',
  logo_url: null,
})
const businessForm = ref<BusinessForm>(emptyBusiness())
const required = (v: string | null | undefined) => !!(v && String(v).trim()) || 'Este campo es obligatorio'
const taxRegimeOptions = options(taxRegimeLabels)
// Live, as the customer forms show it; the API computes the one every document prints.
const nitDigit = computed(() => customerVerificationDigit('NIT', normalizeDocument(businessForm.value.nit, 'NIT')))
const tidyNit = () => {
  if (!documentProblem(businessForm.value.nit, 'NIT')) {
    businessForm.value.nit = normalizeDocument(businessForm.value.nit, 'NIT')
  }
}

const loadBusiness = async () => {
  try {
    business.value = await billingService.getBusiness()
    const { complete: _complete, verification_digit: _digit, ...data } = business.value
    businessForm.value = { ...emptyBusiness(), ...data }
  } catch {
    // Sin la sección no se bloquea el resto de la configuración.
  }
}

const saveBusiness = async () => {
  const { valid } = await businessFormRef.value.validate()
  if (!valid) return
  savingBusiness.value = true
  try {
    business.value = await billingService.updateBusiness(businessForm.value)
    notify('Datos del negocio guardados')
  } catch (error) {
    notify(errorMessage(error, 'No se pudieron guardar los datos del negocio'), 'error')
  } finally {
    savingBusiness.value = false
  }
}

// --- Cómo tomas los pedidos (only for a company that takes orders) ---
const authStore = useAuthStore()
const takesOrders = computed(() => effectiveFeatures(authStore.user).includes('orders'))
const orderModes: OrderMode[] = ['tables', 'customers', 'both']
const orderModeChoice = ref<OrderMode>(authStore.orderMode)
const savingOrderMode = ref(false)

const saveOrderMode = async () => {
  savingOrderMode.value = true
  try {
    notify(await authStore.setOrderMode(orderModeChoice.value))
  } catch (error) {
    notify(errorMessage(error, 'No fue posible guardar cómo tomas los pedidos. Inténtalo de nuevo.'), 'error')
  } finally {
    savingOrderMode.value = false
  }
}

// --- Resolución de facturación ---
const resolution = ref<InvoicingResolution | null>(null)
const resolutionStatus = ref<ResolutionStatus | null>(null)
const resolutionForm = ref({
  invoicing_resolution: '',
  invoice_prefix: '',
  range_from: null as number | null,
  range_to: null as number | null,
  start_number: null as number | null,
  resolution_date: '',
  valid_until: '',
  validity_months: null as number | null,
})

const resolutionFormRef = ref<any>(null)
// Mismas reglas que el backend (InvoicingResolutionController::update).
const requiredNumber = (v: number | null) => v !== null || 'Este campo es obligatorio'
const rangeNumber = (v: number | null) =>
  v === null || (Number.isInteger(v) && v >= 1) || 'Escribe un número entero mayor o igual a 1'
const rangeEnd = (v: number | null) => {
  const from = resolutionForm.value.range_from
  return v === null || from === null || v >= from || 'El fin del rango debe ser mayor o igual al inicio.'
}
const startInRange = (v: number | null) => {
  const { range_from: from, range_to: to } = resolutionForm.value
  return v === null || ((from === null || v >= from) && (to === null || v <= to)) ||
    'El número inicial debe estar dentro del rango autorizado.'
}

// Vigencia: calcularla por meses desde la fecha de la resolución, o elegir
// la fecha de vencimiento a mano.
const validityMode = ref<'months' | 'date'>('months')

// Fecha de vencimiento que se calcula al vuelo cuando el usuario indica meses,
// solo para mostrarla como pista (el backend la calcula de forma definitiva).
const computedValidUntil = computed(() => {
  const months = resolutionForm.value.validity_months
  const start = resolutionForm.value.resolution_date
  if (!months || !start) return ''
  const date = new Date(start + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return ''
  date.setMonth(date.getMonth() + months)
  return toIsoDate(date)
})

// Si el usuario ya empezó a escribir, la carga asíncrona no debe pisar
// sus datos (pasa con conexiones lentas y con los tests).
const resolutionFormTouched = ref(false)
watch(resolutionForm, () => { resolutionFormTouched.value = true }, { deep: true })

// Al cambiar el rango, el número inicial se ajusta si quedó por fuera de él.
watch(
  () => [resolutionForm.value.range_from, resolutionForm.value.range_to],
  () => {
    const { range_from, range_to, start_number } = resolutionForm.value
    if (range_from == null) return
    const outOfRange =
      start_number == null ||
      start_number < range_from ||
      (range_to != null && start_number > range_to)
    if (outOfRange) resolutionForm.value.start_number = range_from
  },
)

const loadResolution = async () => {
  try {
    const [data, status] = await Promise.all([invoicingService.resolution(), invoicingService.status()])
    resolution.value = data
    resolutionStatus.value = status
    if (resolutionFormTouched.value) return
    resolutionForm.value = {
      invoicing_resolution: data.invoicing_resolution || '',
      invoice_prefix: data.invoice_prefix || '',
      range_from: data.range_from,
      range_to: data.range_to,
      // El inicio de la numeración es el próximo consecutivo (o el inicio del rango).
      start_number: data.current_sequence ?? data.range_from,
      resolution_date: data.resolution_date || '',
      valid_until: data.valid_until || '',
      validity_months: data.validity_months,
    }
    // Recuerda el modo con el que se guardó: si hay meses, "por meses".
    validityMode.value = data.validity_months ? 'months' : (data.valid_until ? 'date' : 'months')
    // La carga no cuenta como edición del usuario.
    resolutionFormTouched.value = false
  } catch {
    // Empleados sin permiso de admin: la tarjeta queda vacía sin romper la página.
  }
}

const saveResolution = async () => {
  const form = resolutionForm.value
  if (!form.invoicing_resolution || !form.range_from || !form.range_to) {
    notify('Completa el número de resolución y el rango', 'error')
    return
  }
  const { valid } = await resolutionFormRef.value.validate()
  if (!valid) return
  const byMonths = validityMode.value === 'months'
  saving.value = true
  try {
    resolution.value = await invoicingService.saveResolution({
      invoicing_resolution: form.invoicing_resolution,
      invoice_prefix: form.invoice_prefix || null,
      range_from: form.range_from,
      range_to: form.range_to,
      start_number: form.start_number ?? null,
      resolution_date: form.resolution_date || null,
      // Solo se envía el modo elegido; el otro se limpia en el backend.
      valid_until: byMonths ? null : (form.valid_until || null),
      validity_months: byMonths ? (form.validity_months || null) : null,
    })
    resolutionStatus.value = await invoicingService.status()
    resolutionFormTouched.value = false
    await loadResolution()
    notify('Resolución guardada')
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible guardar la resolución. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

// --- Tipos de documento ---
const docDialog = ref(false)
const editingDoc = ref<DocumentType | null>(null)
const docForm = ref({ code: '', name: '', direction: 'both' as 'in' | 'out' | 'both', active: true })

const openDocDialog = (dt?: DocumentType) => {
  editingDoc.value = dt ?? null
  docForm.value = dt
    ? { code: dt.code, name: dt.name, direction: dt.direction, active: dt.active }
    : { code: '', name: '', direction: 'both', active: true }
  docDialog.value = true
}

const saveDocType = async () => {
  saving.value = true
  try {
    if (editingDoc.value) {
      await kardexService.updateDocumentType(editingDoc.value.id, {
        name: docForm.value.name,
        direction: docForm.value.direction,
        active: docForm.value.active,
      })
    } else {
      await kardexService.createDocumentType({
        code: docForm.value.code.toUpperCase(),
        name: docForm.value.name,
        direction: docForm.value.direction,
      })
    }
    notify('Tipo de documento guardado')
    docDialog.value = false
    await load()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible guardar. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteDocType = async (dt: DocumentType) => {
  if (!window.confirm(`¿Eliminar el tipo de documento "${dt.code} — ${dt.name}"?`)) return
  try {
    await kardexService.deleteDocumentType(dt.id)
    notify('Tipo de documento eliminado')
    await load()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible eliminar. Inténtalo de nuevo.'), 'error')
  }
}

// --- Impuestos ---
const taxDialog = ref(false)
const editingTax = ref<Tax | null>(null)
const taxForm = ref({ name: '', rate: 0, active: true })

const openTaxDialog = (tax?: Tax) => {
  editingTax.value = tax ?? null
  taxForm.value = tax
    ? { name: tax.name, rate: tax.rate, active: tax.active }
    : { name: '', rate: 0, active: true }
  taxDialog.value = true
}

const saveTax = async () => {
  saving.value = true
  try {
    if (editingTax.value) {
      await kardexService.updateTax(editingTax.value.id, { ...taxForm.value })
    } else {
      await kardexService.createTax({ name: taxForm.value.name, rate: taxForm.value.rate })
    }
    notify('Impuesto guardado')
    taxDialog.value = false
    await load()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible guardar. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteTax = async (tax: Tax) => {
  if (!window.confirm(`¿Eliminar el impuesto "${tax.name}"?`)) return
  try {
    await kardexService.deleteTax(tax.id)
    notify('Impuesto eliminado')
    await load()
  } catch (error: any) {
    notify(errorMessage(error, 'No fue posible eliminar. Inténtalo de nuevo.'), 'error')
  }
}

// --- Formas de pago (the admin reads the inactive ones too) ---
const { methods: paymentMethods, loadError: methodsError, reload: reloadMethods } = usePaymentMethods({ fresh: true })
const documentOptions = options(paymentDocumentLabels) as { value: PaymentDocument; title: string }[]
const documentsText = (documents: PaymentDocument[]): string =>
  documentOptions.every(option => documents.includes(option.value))
    ? 'En todos'
    : documentOptions.filter(option => documents.includes(option.value)).map(option => label(paymentDocumentLabels, option.value)).join(', ')
// On a phone the rows stack with their own labels: the header (a sort picker there) is not needed.
const { xs } = useDisplay()

const methodHeaders = [
  { title: 'Nombre', key: 'name', sortable: false },
  { title: 'Entra al cajón', key: 'is_cash', sortable: false },
  { title: 'Cuenta contable', key: 'account', sortable: false },
  { title: 'Cuenta bancaria', key: 'bank_account', sortable: false },
  { title: 'Dónde se puede usar', key: 'documents', sortable: false },
  { title: 'Estado', key: 'active', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const methodDialog = ref(false)
const editingMethod = ref<PaymentMethodRow | null>(null)
const methodFormRef = ref<any>(null)
const savingMethod = ref(false)
const methodError = ref('')
const reordering = ref(false)
const emptyMethod = (): PaymentMethodPayload => ({
  name: '',
  is_cash: false,
  account: '',
  bank_account: '',
  show_bank_account: false,
  documents: documentOptions.map(option => option.value),
  active: true,
})
const methodForm = ref<PaymentMethodPayload>(emptyMethod())

const payloadOf = (method: PaymentMethodRow): PaymentMethodPayload => ({
  name: method.name,
  is_cash: method.is_cash,
  account: method.account ?? '',
  bank_account: method.bank_account ?? '',
  show_bank_account: method.show_bank_account,
  documents: [...method.documents],
  active: method.active,
})

// Without a number there is nothing to show: the switch goes off with it, as the API keeps it.
watch(() => methodForm.value.bank_account?.trim(), number => {
  if (!number) methodForm.value.show_bank_account = false
})

const openMethodDialog = (method?: PaymentMethodRow) => {
  editingMethod.value = method ?? null
  methodForm.value = method ? payloadOf(method) : emptyMethod()
  methodError.value = ''
  methodDialog.value = true
}

const saveMethod = async () => {
  const { valid } = await methodFormRef.value.validate()
  if (!valid || !methodForm.value.documents.length) return
  savingMethod.value = true
  methodError.value = ''
  const payload: PaymentMethodPayload = {
    ...methodForm.value,
    name: methodForm.value.name.trim(),
    account: methodForm.value.account?.trim() || null,
    bank_account: methodForm.value.bank_account?.trim() || null,
  }
  try {
    const { message } = editingMethod.value
      ? await salesService.updatePaymentMethod(editingMethod.value.id, payload)
      : await salesService.createPaymentMethod(payload)
    methodDialog.value = false
    notify(message)
    await reloadMethods()
  } catch (error) {
    methodError.value = errorMessage(error, 'No fue posible guardar la forma de pago. Inténtalo de nuevo.')
  } finally {
    savingMethod.value = false
  }
}

/** Swaps the positions of two neighbours: the pickers offer the methods in this order. */
const moveMethod = async (index: number, delta: -1 | 1) => {
  const method = paymentMethods.value[index]
  const neighbour = paymentMethods.value[index + delta]
  if (!method || !neighbour) return
  reordering.value = true
  try {
    await salesService.updatePaymentMethod(method.id, { position: neighbour.position })
    await salesService.updatePaymentMethod(neighbour.id, { position: method.position })
  } catch (error) {
    notify(errorMessage(error, 'No fue posible cambiar el orden. Inténtalo de nuevo.'), 'error')
  } finally {
    await reloadMethods()
    reordering.value = false
  }
}

const deleteMethod = async (method: PaymentMethodRow) => {
  if (!window.confirm(`¿Seguro que quieres eliminar la forma de pago «${method.name}»?`)) return
  try {
    notify(await salesService.deletePaymentMethod(method.id))
    await reloadMethods()
  } catch (error) {
    notify(errorMessage(error, 'No fue posible eliminar la forma de pago. Inténtalo de nuevo.'), 'error')
  }
}

onMounted(load)
</script>
