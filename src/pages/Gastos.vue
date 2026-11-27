<template>
  <v-container fluid>
    <!-- Título Principal -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="40" class="mr-3" color="primary">mdi-cash-multiple</v-icon>
          <div>
            <h1 class="text-h4">Gastos</h1>
            <p class="text-body-1 text-medium-emphasis">Lo que sale de caja: arriendo, servicios, nómina y compras</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <!-- Resumen de gastos -->
      <v-col cols="14">
        <v-card>
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2">mdi-chart-box</v-icon>
            Resumen financiero
          </v-card-title>
          <v-card-text  class="mt-4" >
            <v-row>
              <v-col md="3">
                <DateField
                  v-model="fechaInicio"
                  label="Fecha inicio"
                  variant="outlined"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col md="3">
                <DateField
                  v-model="fechaFin"
                  label="Fecha fin"
                  variant="outlined"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col md="2">
                <v-btn
                  color="primary"
                  block
                  :loading="loadingResumen"
                  @click="refresh()">
                  <v-icon start>mdi-refresh</v-icon>
                  Actualizar
                </v-btn>
              </v-col>
            </v-row>

            <v-row v-if="resumen" class="mt-2">
              <v-col md="3">
                <v-card class="h-100">
                  <v-card-text class="text-center py-6">
                    <v-icon size="40" class="mb-2 text-medium-emphasis">mdi-cash-remove</v-icon>
                    <div class="text-h3 tabular-nums">{{ money(resumen.total_expenses) }}</div>
                    <div class="text-subtitle-1 font-weight-bold mt-2">Total gastos</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="9">
                <v-row>
                  <v-col
                    v-for="(item, idx) in resumen.by_category.slice(0, 6)"
                    :key="`${item.type}-${item.category}-${idx}`"
                    cols="12"
                    sm="6"
                    md="4">
                    <v-card class="h-100">
                      <v-card-text>
                        <v-chip color="secondary" :prepend-icon="getCategoryIcon(item.type)" size="x-small" class="mb-2">
                          {{ getTipoLabel(item.type) }}
                        </v-chip>
                        <div class="text-h5 font-weight-bold">{{ money(item.total) }}</div>
                        <div class="text-subtitle-2 mt-1">{{ item.category }}</div>
                        <div class="text-caption text-medium-emphasis">
                          {{ item.count }} registro(s)
                        </div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Tabs: Categorías y gastos -->
      <v-col cols="12">
        <v-card>
          <v-tabs v-model="tab" color="primary" class="mb-4">
            <v-tab value="expenses">
              <v-icon start>mdi-receipt</v-icon>
              Registro de gastos
            </v-tab>
            <v-tab value="recurrentes">
              <v-icon start>mdi-calendar-sync</v-icon>
              Gastos recurrentes
              <v-badge
                v-if="recurring?.summary.overdue.count"
                :content="recurring.summary.overdue.count"
                color="error"
                inline
                :aria-label="`${recurring.summary.overdue.count} gastos recurrentes vencidos`"
              />
            </v-tab>
            <v-tab value="categorias">
              <v-icon start>mdi-shape</v-icon>
              Gestión de categorías
            </v-tab>
          </v-tabs>

          <v-card-text>
            <v-window v-model="tab">
              <!-- Tab: Gastos -->
              <v-window-item value="expenses">
                <div class="d-flex justify-space-between align-center flex-wrap ga-2 mb-4">
                  <LockableButton icon="mdi-plus" color="primary" size="large" @click="openExpenseDialog()">
                    Registrar gasto
                  </LockableButton>
                  <v-btn color="primary" variant="outlined" @click="tab = 'categorias'">
                    <v-icon start>mdi-shape</v-icon>
                    Gestionar categorías
                  </v-btn>
                </div>

                <v-row class="mb-2">
                  <v-col cols="12" md="6">
                    <v-text-field
                      v-model="expenseSearch"
                      prepend-inner-icon="mdi-magnify"
                      label="Buscar gasto"
                      placeholder="Concepto, proveedor o factura"
                      variant="outlined"
                      density="compact"
                      hide-details
                      clearable />
                  </v-col>
                </v-row>

                <v-data-table-server
                  v-model:page="expensePage"
                  v-model:items-per-page="expensePerPage"
                  v-model:sort-by="expenseSortBy"
                  :headers="expensesHeaders"
                  :items="expenses"
                  :items-length="expenseTotal"
                  :items-per-page-options="PAGE_SIZE_OPTIONS"
                  :loading="loadingExpenses"
                  class="elevation-0">
                  <template #item.expense_date="{ item }">
                    {{ formatDay(item.expense_date) }}
                  </template>

                  <template #item.concept="{ item }">
                    {{ item.concept }}
                    <v-chip v-if="item.recurring_expense_id" size="x-small" color="secondary" prepend-icon="mdi-calendar-sync" class="ml-1">
                      Recurrente
                    </v-chip>
                  </template>

                  <template #item.category="{ item }">
                    <v-chip
                      size="small"
                      color="secondary"
                      :prepend-icon="getCategoryIcon(item.category?.type)">
                      {{ item.category?.name || 'Sin categoría' }}
                    </v-chip>
                  </template>

                  <template #item.amount="{ item }">
                    <strong class="tabular-nums">{{ money(item.amount) }}</strong>
                  </template>

                  <template #item.invoice_number="{ item }">
                    <span v-if="item.invoice_number">{{ item.invoice_number }}</span>
                    <span v-else class="text-medium-emphasis">-</span>
                  </template>

                  <template #item.actions="{ item }">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      variant="text"
                      :aria-label="`Editar el gasto ${item.concept}`"
                      :disabled="isReadOnly"
                      @click="openExpenseDialog(item)" />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      :aria-label="`Eliminar el gasto ${item.concept}`"
                      :disabled="isReadOnly"
                      @click="deleteExpense(item)" />
                  </template>
                </v-data-table-server>
              </v-window-item>

              <!-- Tab: Gastos recurrentes (schedules are projections; only a registered payment is an expense) -->
              <v-window-item value="recurrentes">
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                  Lo que pagas una y otra vez: el arriendo cada mes, el hosting cada mes, el dominio cada 3 años. Aquí solo se
                  programa: el gasto cuenta en el resumen, la caja y los informes cuando registras el pago.
                </v-alert>

                <v-row v-if="recurring" dense class="mb-2" role="region" aria-label="Costo de los gastos recurrentes">
                  <v-col cols="6" md="3">
                    <v-card variant="tonal" class="h-100">
                      <v-card-text>
                        <div class="text-caption text-medium-emphasis">Costo mensual real</div>
                        <div class="text-h5 tabular-nums">{{ money(recurring.summary.monthly_cost) }}</div>
                        <div class="text-caption text-medium-emphasis">{{ money(recurring.summary.annual_cost) }} al año</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="6" md="3">
                    <v-card variant="tonal" class="h-100">
                      <v-card-text>
                        <div class="text-caption text-medium-emphasis">Vencidos</div>
                        <div class="text-h5 tabular-nums">{{ money(recurring.summary.overdue.amount) }}</div>
                        <div class="text-caption text-medium-emphasis">{{ plural(recurring.summary.overdue.count, 'gasto sin pagar', 'gastos sin pagar') }}</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="6" md="3">
                    <v-card variant="tonal" class="h-100">
                      <v-card-text>
                        <div class="text-caption text-medium-emphasis">Por pagar en 30 días</div>
                        <div class="text-h5 tabular-nums">{{ money(recurring.summary.due_30.amount) }}</div>
                        <div class="text-caption text-medium-emphasis">{{ plural(recurring.summary.due_30.count, 'gasto', 'gastos') }}, vencidos incluidos</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                  <v-col cols="6" md="3">
                    <v-card variant="tonal" class="h-100">
                      <v-card-text>
                        <div class="text-caption text-medium-emphasis">Por pagar en 90 días</div>
                        <div class="text-h5 tabular-nums">{{ money(recurring.summary.due_90.amount) }}</div>
                        <div class="text-caption text-medium-emphasis">{{ plural(recurring.summary.due_90.count, 'gasto', 'gastos') }}, vencidos incluidos</div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>

                <div class="d-flex justify-space-between align-center flex-wrap ga-2 mb-4">
                  <LockableButton icon="mdi-plus" color="primary" @click="openRecurringDialog()">
                    Nuevo gasto recurrente
                  </LockableButton>
                  <v-btn-toggle v-model="recurringView" mandatory color="primary" density="compact" variant="outlined" divided>
                    <v-btn value="all" :aria-pressed="recurringView === 'all'">Todos</v-btn>
                    <v-btn value="overdue" :aria-pressed="recurringView === 'overdue'">Vencidos</v-btn>
                    <v-btn value="30" :aria-pressed="recurringView === '30'">30 días</v-btn>
                    <v-btn value="90" :aria-pressed="recurringView === '90'">90 días</v-btn>
                  </v-btn-toggle>
                </div>

                <v-data-table
                  :headers="recurringHeaders"
                  :items="recurringRows"
                  :loading="loadingRecurring"
                  mobile-breakpoint="sm"
                  :no-data-text="recurringView === 'all' ? 'Todavía no tienes gastos recurrentes.' : 'Nada por pagar en ese periodo.'"
                  class="elevation-0">
                  <template #item.concept="{ item }">
                    <div class="py-1">
                      <div class="font-weight-medium">{{ item.concept }}</div>
                      <div class="d-flex align-center flex-wrap ga-1">
                        <v-chip size="x-small" color="secondary" :prepend-icon="getCategoryIcon(item.category?.type)">
                          {{ item.category?.name || 'Sin categoría' }}
                        </v-chip>
                        <span v-if="item.supplier_name" class="text-caption text-medium-emphasis">{{ item.supplier_name }}</span>
                      </div>
                    </div>
                  </template>
                  <template #item.estimated_amount="{ item }">
                    <span class="tabular-nums">{{ money(item.estimated_amount) }}</span>
                    <div class="text-caption text-medium-emphasis">{{ item.frequency_label }}</div>
                  </template>
                  <template #item.monthly_cost="{ item }">
                    <strong class="tabular-nums">{{ money(item.monthly_cost) }}</strong>
                    <div class="text-caption text-medium-emphasis">al mes</div>
                  </template>
                  <template #item.next_due_on="{ item }">
                    <div class="py-1">
                      <div>{{ item.active ? formatDay(item.next_due_on) : '—' }}</div>
                      <v-chip size="x-small" :color="label(recurringExpenseStatusColors, item.status)" variant="tonal">
                        {{ label(recurringExpenseStatusLabels, item.status) }}
                      </v-chip>
                      <div v-if="item.active" class="text-caption text-medium-emphasis">{{ dueText(item) }}</div>
                    </div>
                  </template>
                  <template #item.last_payment="{ item }">
                    <template v-if="item.last_payment">
                      <div class="tabular-nums">{{ money(item.last_payment.amount) }}</div>
                      <div class="text-caption text-medium-emphasis">{{ formatDay(item.last_payment.expense_date) }}</div>
                    </template>
                    <span v-else class="text-medium-emphasis">Ninguno</span>
                  </template>
                  <template #item.actions="{ item }">
                    <div class="d-flex justify-end align-center ga-1">
                      <LockableButton
                        v-if="item.active"
                        size="small"
                        variant="tonal"
                        color="primary"
                        icon="mdi-cash-check"
                        :aria-label="`Registrar pago de ${item.concept}`"
                        @click="openPayDialog(item)">
                        Registrar pago
                      </LockableButton>
                      <v-btn
                        icon="mdi-pencil"
                        size="small"
                        variant="text"
                        :aria-label="`Editar el gasto recurrente ${item.concept}`"
                        :disabled="isReadOnly"
                        @click="openRecurringDialog(item)" />
                      <v-btn
                        icon="mdi-delete"
                        size="small"
                        variant="text"
                        color="error"
                        :aria-label="`Eliminar el gasto recurrente ${item.concept}`"
                        :disabled="isReadOnly"
                        @click="deleteRecurring(item)" />
                    </div>
                  </template>
                </v-data-table>
              </v-window-item>

              <!-- Tab: Categorías -->
              <v-window-item value="categorias">
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                  Aquí creas, editas y eliminas las categorías de gastos. El tipo de cada una decide cómo
                  se clasifica el gasto en los reportes.
                </v-alert>

                <LockableButton icon="mdi-plus" color="primary" class="mb-4" @click="openCategoriaDialog()">
                  Nueva categoría
                </LockableButton>

                <v-data-table
                  :headers="categoriasHeaders"
                  :items="categorias"
                  :loading="loadingCategorias"
                  class="elevation-0">
                  <template #item.type="{ item }">
                    <v-chip size="small" color="secondary" :prepend-icon="getCategoryIcon(item.type)">
                      {{ getTipoLabel(item.type) }}
                    </v-chip>
                  </template>

                  <template #item.active="{ item }">
                    <v-icon :color="item.active ? 'success' : 'error'">
                      {{ item.active ? 'mdi-check-circle' : 'mdi-close-circle' }}
                    </v-icon>
                  </template>

                  <template #item.actions="{ item }">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      variant="text"
                      :disabled="isReadOnly"
                      :aria-label="`Editar la categoría ${item.name}`" @click="openCategoriaDialog(item)" />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      :aria-label="`Eliminar la categoría ${item.name}`" @click="deleteCategoria(item)" />
                  </template>
                </v-data-table>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog: Gasto -->
    <v-dialog v-model="expenseDialog" max-width="700px" persistent>
      <v-card>
        <v-card-title>
          {{ editingExpense ? 'Editar gasto' : 'Registrar nuevo gasto' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="expenseForm">
            <p class="text-caption text-medium-emphasis mb-3">
              Los campos con
              <span class="text-error font-weight-bold">*</span>
              son obligatorios.
            </p>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="expenseFormData.expense_category_id"
                  :items="categorias"
                  :item-title="(c: any) => c.path || c.name"
                  item-value="id"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]">
                  <template #label>
                    Categoría <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template #append>
                        <v-chip color="secondary" :prepend-icon="getCategoryIcon(item.raw.type)" size="x-small">
                          {{ getTipoLabel(item.raw.type) }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>

              <v-col cols="12" md="6">
                <DateField
                  v-model="expenseFormData.expense_date"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  hint="Requerido"
                  persistent-hint
                >
                  <template #label>
                    Fecha del gasto <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </DateField>
              </v-col>

              <v-col cols="12" md="6">
                <MoneyField
                  v-model="expenseFormData.amount"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required, rules.positive]"
                  hint="Requerido"
                  persistent-hint
                  empty-as-zero
                >
                  <template #label>
                    Monto <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </MoneyField>
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  v-model="expenseFormData.payment_method"
                  :items="methodOptions(undefined, editingExpense?.payment_method, expensePaymentMethodLabels)"
                  label="Forma de pago"
                  variant="outlined"
                  density="comfortable"
                  hint="Si entra al cajón, como el efectivo, se resta del efectivo a entregar al cerrar la caja"
                  persistent-hint />
              </v-col>

              <v-col cols="12">
                <v-text-field
                  v-model="expenseFormData.concept"
                  label="Concepto / Descripción"
                  placeholder="Opcional - Se usará el nombre de la categoría si está vacío"
                  variant="outlined"
                  density="comfortable"
                  hint="Opcional"
                  persistent-hint />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="expenseFormData.supplier_name"
                  label="Proveedor"
                  placeholder="Opcional"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="expenseFormData.invoice_number"
                  label="Número de factura"
                  placeholder="Opcional"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
            </v-row>

            <v-divider class="my-4" />
            
            <v-alert v-if="esCompraInventario" type="info" variant="tonal" density="compact" class="mb-3">
              Este gasto registra el dinero de la compra. Para que las unidades entren al inventario con su costo,
              regístralas en <router-link to="/kardex">Kardex › Registrar movimiento</router-link> como una compra (FC).
            </v-alert>

            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="expenseFormData.notes"
                  label="Notas adicionales"
                  placeholder="Opcional"
                  rows="2"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="expenseDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveExpense()">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: Gasto recurrente -->
    <v-dialog v-model="recurringDialog" max-width="700px" persistent>
      <v-card>
        <v-card-title>{{ editingRecurring ? 'Editar gasto recurrente' : 'Nuevo gasto recurrente' }}</v-card-title>
        <v-card-text>
          <v-form ref="recurringForm">
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="recurringFormData.expense_category_id"
                  :items="categorias"
                  item-title="name"
                  item-value="id"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]">
                  <template #label>
                    Categoría <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </v-select>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="recurringFormData.concept"
                  label="Concepto"
                  placeholder="Ej: Arriendo del local, Hosting, Dominio"
                  hint="Opcional: sin él se usa el nombre de la categoría"
                  persistent-hint
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <MoneyField
                  v-model="recurringFormData.estimated_amount"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required, rules.positive]"
                  :hint="monthlyHint"
                  persistent-hint
                  empty-as-zero>
                  <template #label>
                    Valor de cada pago <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </MoneyField>
              </v-col>
              <v-col cols="12" md="6">
                <div class="d-flex ga-2">
                  <v-select
                    v-model="recurringFrequency"
                    :items="frequencyOptions"
                    label="Se repite"
                    variant="outlined"
                    density="comfortable"
                    class="flex-grow-1" />
                  <v-text-field
                    v-if="recurringFrequency === 'months' || recurringFrequency === 'years'"
                    v-model.number="recurringFormData.interval_count"
                    type="number"
                    min="2"
                    :label="recurringFrequency === 'months' ? 'Cada cuántos meses' : 'Cada cuántos años'"
                    variant="outlined"
                    density="comfortable"
                    max-width="150"
                    :rules="[rules.atLeastOne]" />
                </div>
              </v-col>
              <v-col cols="12" md="4">
                <DateField v-model="recurringFormData.starts_on" variant="outlined" density="comfortable" :rules="[rules.required]">
                  <template #label>
                    Desde <span class="text-error font-weight-bold" title="Campo obligatorio">*</span>
                  </template>
                </DateField>
              </v-col>
              <v-col cols="12" md="4">
                <DateField
                  v-model="recurringFormData.next_due_on"
                  label="Próximo pago"
                  hint="Vacío: la fecha de inicio"
                  persistent-hint
                  :min="recurringFormData.starts_on || undefined"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="4">
                <DateField
                  v-model="recurringFormData.ends_on"
                  label="Termina (opcional)"
                  hint="Vacío: no termina"
                  persistent-hint
                  clearable
                  :min="recurringFormData.starts_on || undefined"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="recurringFormData.supplier_name"
                  label="Proveedor"
                  placeholder="Opcional"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="recurringFormData.payment_method"
                  :items="methodOptions(undefined, editingRecurring?.payment_method ?? undefined, expensePaymentMethodLabels)"
                  label="Forma de pago habitual"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="recurringFormData.notes" label="Notas" rows="2" variant="outlined" density="comfortable" />
              </v-col>
              <v-col v-if="editingRecurring" cols="12">
                <v-switch
                  v-model="recurringFormData.active"
                  color="primary"
                  label="Activo"
                  hint="Apagado queda en pausa: no suma al costo mensual ni aparece por pagar"
                  persistent-hint />
              </v-col>
            </v-row>
          </v-form>
          <v-alert v-if="recurringError" type="error" variant="tonal" density="compact" class="mt-3">{{ recurringError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="recurringDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveRecurring()">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: Registrar pago de un gasto recurrente -->
    <v-dialog v-model="payDialog" max-width="520px" persistent>
      <v-card v-if="payingRecurring">
        <v-card-title class="text-wrap">Registrar pago</v-card-title>
        <v-card-subtitle class="text-wrap">
          {{ payingRecurring.concept }} · vencimiento del {{ formatDay(payingRecurring.next_due_on) }}
        </v-card-subtitle>
        <v-card-text>
          <p class="text-body-2 mb-4">
            Queda como un gasto de {{ payingRecurring.category?.name }} y el próximo pago pasa al {{ formatDay(nextDueAfterPayment) }}.
          </p>
          <v-form ref="payForm">
            <v-row dense>
              <v-col cols="12" sm="6">
                <MoneyField
                  v-model="payFormData.amount"
                  label="Valor pagado"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required, rules.positive]"
                  empty-as-zero />
              </v-col>
              <v-col cols="12" sm="6">
                <DateField v-model="payFormData.expense_date" label="Fecha del pago" variant="outlined" density="comfortable" :rules="[rules.required]" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-select
                  v-model="payFormData.payment_method"
                  :items="methodOptions(undefined, undefined, expensePaymentMethodLabels)"
                  label="Forma de pago"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="payFormData.invoice_number" label="Número de factura" placeholder="Opcional" variant="outlined" density="comfortable" />
              </v-col>
            </v-row>
          </v-form>
          <v-alert v-if="payError" type="error" variant="tonal" density="compact" class="mt-3">{{ payError }}</v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="payDialog = false">Cancelar</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="savePayment()">Registrar pago</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: Categoría -->
    <v-dialog v-model="categoriaDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          {{ editingCategoria ? 'Editar categoría' : 'Nueva categoría' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="categoriaForm">
            <v-text-field
              v-model="categoriaFormData.name"
              label="Nombre"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
              class="mb-3" />

            <v-select
              v-model="categoriaFormData.type"
              :items="expenseTypeOptions"
              label="Tipo de gasto"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
              class="mb-3" />

            <v-textarea
              v-model="categoriaFormData.description"
              label="Descripción"
              rows="2"
              variant="outlined"
              density="comfortable"
              class="mb-3" />

            <v-switch
              v-model="categoriaFormData.active"
              label="Categoría activa"
              color="primary" />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="categoriaDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveCategoria()">
            Guardar
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarColor === 'error' ? 9000 : 3000" closable>
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { formatDay, toIsoDate } from '@/utils/dates'
import { errorMessage } from '@/utils/errors';
import { ref, computed, onMounted, watch } from 'vue'
import {
  expensesService,
  type Expense,
  type ExpenseCategory,
  type ExpenseSummary,
  type RecurringExpense,
  type RecurringExpensePayload,
  type RecurringExpensesOverview,
} from '@/services/expensesService'
import {
  expenseCategoryTypeLabels,
  expensePaymentMethodLabels,
  label,
  recurringExpenseStatusColors,
  recurringExpenseStatusLabels,
} from '@/utils/labels'
import LockableButton from '../components/LockableButton.vue'
import DateField from '../components/DateField.vue'
import MoneyField from '../components/MoneyField.vue'
import { useReadOnly } from '../composables/useReadOnly'
import { PAGE_SIZE_OPTIONS, useServerPage } from '../composables/useServerPage'
import { methodOptions, methodsFor, usePaymentMethods } from '../composables/usePaymentMethods'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()
// An expense is not one of the documents that restrict methods: every active one.
const { ready: methodsReady } = usePaymentMethods({ fresh: true })
const defaultMethod = () => methodsFor()[0]?.key ?? 'cash'

const tab = ref('expenses')
const loadingCategorias = ref(false)
const loadingResumen = ref(false)
const saving = ref(false)

const expenseDialog = ref(false)
const categoriaDialog = ref(false)
const editingExpense = ref<Expense | null>(null)
const editingCategoria = ref<ExpenseCategory | null>(null)

const categorias = ref<ExpenseCategory[]>([])
const resumen = ref<ExpenseSummary | null>(null)

const fechaInicio = ref('')
const fechaFin = ref('')

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const expenseForm = ref<any>(null)
const categoriaForm = ref<any>(null)

const expensesHeaders = [
  { title: 'Fecha', key: 'expense_date', sortable: true },
  { title: 'Categoría', key: 'category', sortable: false },
  { title: 'Concepto', key: 'concept', sortable: true },
  { title: 'Monto', key: 'amount', sortable: true },
  { title: 'Factura', key: 'invoice_number', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const categoriasHeaders = [
  { title: 'Nombre', key: 'name', sortable: true },
  { title: 'Tipo', key: 'type', sortable: true },
  { title: 'Descripción', key: 'description', sortable: false },
  { title: 'Activa', key: 'active', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const expenseTypeOptions = [
  { value: 'inventory_purchase', title: 'Compra de inventario / Materia prima' },
  { value: 'variable_expense', title: 'Gasto variable (ej: empaques, domicilio)' },
  { value: 'fixed_expense', title: 'Gasto fijo (ej: arriendo, servicios)' },
  { value: 'administrative_expense', title: 'Gasto administrativo' },
  { value: 'payroll', title: 'Nómina' },
  { value: 'taxes', title: 'Impuestos' },
]

const expenseFormData = ref<Partial<Expense>>({
  expense_category_id: undefined,
  concept: '',
  amount: 0,
  expense_date: toIsoDate(new Date()),
  invoice_number: '',
  supplier_name: '',
  notes: '',
})

const categoriaFormData = ref<Partial<ExpenseCategory>>({
  name: '',
  description: '',
  type: 'fixed_expense',
  active: true,
})

const rules = {
  required: (v: any) => !!v || 'Este campo es requerido',
  positive: (v: any) => (v && v > 0) || 'Debe ser mayor a 0',
  atLeastOne: (v: any) => (Number(v) >= 1) || 'Escribe 1 o más',
}

// ===== Gastos recurrentes =====
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`

const recurring = ref<RecurringExpensesOverview | null>(null)
const loadingRecurring = ref(false)
const recurringView = ref<'all' | 'overdue' | '30' | '90'>('all')

const recurringHeaders = [
  { title: 'Concepto', key: 'concept', sortable: true },
  { title: 'Cada pago', key: 'estimated_amount', sortable: true, align: 'end' as const },
  { title: 'Costo mensual', key: 'monthly_cost', sortable: true, align: 'end' as const },
  { title: 'Próximo pago', key: 'next_due_on', sortable: true },
  { title: 'Último pago', key: 'last_payment', sortable: false },
  { title: '', key: 'actions', sortable: false, align: 'end' as const },
]

const recurringRows = computed(() => {
  const items = recurring.value?.items ?? []
  if (recurringView.value === 'overdue') return items.filter(item => item.status === 'overdue')
  if (recurringView.value === '30' || recurringView.value === '90') {
    return items.filter(item => item.active && item.due[recurringView.value as '30' | '90'].count > 0)
  }
  return items
})

const dueText = (item: RecurringExpense) => {
  const days = item.days_until_due
  if (days < 0) {
    return item.overdue_count > 1
      ? `${item.overdue_count} pagos atrasados (${money(item.overdue_amount)})`
      : `Hace ${plural(-days, 'día', 'días')}`
  }
  return days === 0 ? 'Vence hoy' : `En ${plural(days, 'día', 'días')}`
}

const loadRecurring = async () => {
  loadingRecurring.value = true
  try {
    recurring.value = await expensesService.getRecurring()
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible cargar los gastos recurrentes. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingRecurring.value = false
  }
}

type Frequency = 'monthly' | 'months' | 'yearly' | 'years'
const frequencyOptions = [
  { value: 'monthly', title: 'Cada mes' },
  { value: 'months', title: 'Cada varios meses' },
  { value: 'yearly', title: 'Cada año' },
  { value: 'years', title: 'Cada varios años' },
]

const recurringDialog = ref(false)
const editingRecurring = ref<RecurringExpense | null>(null)
const recurringForm = ref<any>(null)
const recurringError = ref('')
const recurringFrequency = ref<Frequency>('monthly')
const emptyRecurring = (): RecurringExpensePayload => ({
  expense_category_id: undefined,
  concept: '',
  estimated_amount: 0,
  interval_unit: 'month',
  interval_count: 1,
  starts_on: toIsoDate(new Date()),
  next_due_on: undefined,
  ends_on: null,
  supplier_name: '',
  payment_method: defaultMethod(),
  notes: '',
  active: true,
})
const recurringFormData = ref<RecurringExpensePayload>(emptyRecurring())

const frequencyOf = (unit: string, count: number): Frequency =>
  unit === 'year' ? (count > 1 ? 'years' : 'yearly') : (count > 1 ? 'months' : 'monthly')

// The estimate spread over its months: the domain of $180.000 every 3 years is $5.000 a month.
const monthlyHint = computed(() => {
  const amount = recurringFormData.value.estimated_amount ?? 0
  const count = Math.max(1, Number(recurringFormData.value.interval_count) || 1)
  const months = (recurringFrequency.value === 'yearly' || recurringFrequency.value === 'years' ? 12 : 1)
    * (recurringFrequency.value === 'monthly' || recurringFrequency.value === 'yearly' ? 1 : count)
  return amount > 0 ? `Equivale a ${money(amount / months)} al mes` : 'Un valor aproximado sirve'
})

const openRecurringDialog = async (item?: RecurringExpense) => {
  await methodsReady()
  editingRecurring.value = item ?? null
  recurringError.value = ''
  recurringFormData.value = item
    ? {
        expense_category_id: item.expense_category_id,
        concept: item.concept,
        estimated_amount: item.estimated_amount,
        interval_unit: item.interval_unit,
        interval_count: item.interval_count,
        starts_on: item.starts_on,
        next_due_on: item.next_due_on,
        ends_on: item.ends_on,
        supplier_name: item.supplier_name ?? '',
        payment_method: item.payment_method ?? defaultMethod(),
        notes: item.notes ?? '',
        active: item.active,
      }
    : emptyRecurring()
  recurringFrequency.value = item ? frequencyOf(item.interval_unit, item.interval_count) : 'monthly'
  recurringDialog.value = true
}

watch(recurringFrequency, frequency => {
  recurringFormData.value.interval_unit = frequency === 'yearly' || frequency === 'years' ? 'year' : 'month'
  if (frequency === 'monthly' || frequency === 'yearly') recurringFormData.value.interval_count = 1
  else if ((recurringFormData.value.interval_count ?? 1) < 2) recurringFormData.value.interval_count = frequency === 'years' ? 3 : 2
})

const saveRecurring = async () => {
  const { valid } = await recurringForm.value.validate()
  if (!valid) return
  saving.value = true
  recurringError.value = ''
  try {
    const payload = { ...recurringFormData.value, next_due_on: recurringFormData.value.next_due_on || undefined, ends_on: recurringFormData.value.ends_on || null }
    if (editingRecurring.value) {
      await expensesService.updateRecurring(editingRecurring.value.id, payload)
      showMessage('Gasto recurrente actualizado', 'success')
    } else {
      showMessage((await expensesService.createRecurring(payload)).message, 'success')
    }
    recurringDialog.value = false
    loadRecurring()
  } catch (error) {
    recurringError.value = errorMessage(error, 'No fue posible guardar el gasto recurrente. Inténtalo de nuevo.')
  } finally {
    saving.value = false
  }
}

const deleteRecurring = async (item: RecurringExpense) => {
  if (!confirm(`¿Seguro que quieres eliminar el gasto recurrente "${item.concept}"? Los pagos que ya registraste se quedan en Gastos.`)) return
  try {
    showMessage(await expensesService.deleteRecurring(item.id), 'success')
    loadRecurring()
  } catch (error) {
    showMessage(errorMessage(error, 'No fue posible eliminar el gasto recurrente. Inténtalo de nuevo.'), 'error')
  }
}

const payDialog = ref(false)
const payingRecurring = ref<RecurringExpense | null>(null)
const payForm = ref<any>(null)
const payError = ref('')
const payFormData = ref({ amount: 0, expense_date: toIsoDate(new Date()), payment_method: 'cash', invoice_number: '' })

// One interval after the due date it settles, as the API moves it.
const nextDueAfterPayment = computed(() => {
  const item = payingRecurring.value
  if (!item) return ''
  const [y = 0, m = 1, d = 1] = item.next_due_on.split('-').map(Number)
  const months = item.months
  const target = new Date(y, m - 1 + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(d, lastDay))
  return toIsoDate(target)
})

const openPayDialog = async (item: RecurringExpense) => {
  await methodsReady()
  payingRecurring.value = item
  payError.value = ''
  payFormData.value = {
    amount: item.estimated_amount,
    expense_date: toIsoDate(new Date()),
    payment_method: item.payment_method ?? defaultMethod(),
    invoice_number: '',
  }
  payDialog.value = true
}

const savePayment = async () => {
  if (!payingRecurring.value) return
  const { valid } = await payForm.value.validate()
  if (!valid) return
  saving.value = true
  payError.value = ''
  try {
    const { message } = await expensesService.payRecurring(payingRecurring.value.id, {
      ...payFormData.value,
      invoice_number: payFormData.value.invoice_number || undefined,
    })
    showMessage(message, 'success')
    payDialog.value = false
    loadRecurring()
    refresh()
  } catch (error) {
    payError.value = errorMessage(error, 'No fue posible registrar el pago. Inténtalo de nuevo.')
  } finally {
    saving.value = false
  }
}

// La tabla sigue las mismas fechas del resumen.
const {
  items: expenses,
  total: expenseTotal,
  page: expensePage,
  perPage: expensePerPage,
  sortBy: expenseSortBy,
  search: expenseSearch,
  loading: loadingExpenses,
  load: loadExpenses,
} = useServerPage<Expense>(
  query => expensesService.getExpensesPage({
    ...query,
    start_date: fechaInicio.value || undefined,
    end_date: fechaFin.value || undefined,
  }),
  {
    filters: [fechaInicio, fechaFin],
    onError: error =>
      showMessage(errorMessage(error, 'No fue posible cargar los gastos. Inténtalo de nuevo.'), 'error'),
  },
)

const refresh = () => {
  loadExpenses()
  loadResumen()
}

const loadCategorias = async () => {
  loadingCategorias.value = true
  try {
    categorias.value = await expensesService.getCategories()
    console.log('[Gastos] Categorías cargadas:', categorias.value)
  } catch (error) {
    console.error('[Gastos] Error al cargar categorías:', error)
    showMessage(errorMessage(error, 'No fue posible cargar las categorías. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingCategorias.value = false
  }
}

const loadResumen = async () => {
  loadingResumen.value = true
  try {
    resumen.value = await expensesService.getExpenseSummary({
      start_date: fechaInicio.value || undefined,
      end_date: fechaFin.value || undefined,
    })
  } catch (error) {
    console.error('[Gastos] Error al cargar resumen:', error)
    showMessage(errorMessage(error, 'No fue posible cargar el resumen. Inténtalo de nuevo.'), 'error')
  } finally {
    loadingResumen.value = false
  }
}

const openExpenseDialog = async (expense?: Expense) => {
  await methodsReady()
  editingExpense.value = expense || null
  if (expense) {
    expenseFormData.value = { ...expense }
  } else {
    expenseFormData.value = {
      expense_category_id: undefined,
      concept: '',
      amount: 0,
      expense_date: toIsoDate(new Date()),
      payment_method: defaultMethod(),
      invoice_number: '',
      supplier_name: '',
      notes: '',
    }
  }
  expenseDialog.value = true
}

const saveExpense = async () => {
  const { valid } = await expenseForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingExpense.value?.id) {
      await expensesService.updateExpense(editingExpense.value.id, expenseFormData.value)
      showMessage('Gasto actualizado exitosamente', 'success')
    } else {
      await expensesService.createExpense(expenseFormData.value)
      showMessage('Gasto registrado exitosamente', 'success')
    }
    expenseDialog.value = false
    loadExpenses()
    loadResumen()
  } catch (error) {
    console.error('[Gastos] Error al guardar:', error)
    showMessage(errorMessage(error, 'No fue posible guardar el gasto. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteExpense = async (expense: Expense) => {
  if (!confirm(`¿Seguro que quieres eliminar el gasto "${expense.concept}"?`)) return

  try {
    await expensesService.deleteExpense(expense.id)
    showMessage('Gasto eliminado exitosamente', 'success')
    loadExpenses()
    loadResumen()
    if (expense.recurring_expense_id) loadRecurring()
  } catch (error) {
    console.error('[Gastos] Error al eliminar:', error)
    showMessage(errorMessage(error, 'No fue posible eliminar el gasto. Inténtalo de nuevo.'), 'error')
  }
}

const openCategoriaDialog = (categoria?: ExpenseCategory) => {
  editingCategoria.value = categoria || null
  if (categoria) {
    categoriaFormData.value = { ...categoria }
  } else {
    categoriaFormData.value = {
      name: '',
      description: '',
      type: 'fixed_expense',
      active: true,
    }
  }
  categoriaDialog.value = true
}

const saveCategoria = async () => {
  const { valid } = await categoriaForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingCategoria.value?.id) {
      await expensesService.updateCategory(editingCategoria.value.id, categoriaFormData.value)
      showMessage('Categoría actualizada exitosamente', 'success')
    } else {
      await expensesService.createCategory(categoriaFormData.value)
      showMessage('Categoría creada exitosamente', 'success')
    }
    categoriaDialog.value = false
    loadCategorias()
  } catch (error) {
    console.error('[Gastos] Error al guardar categoría:', error)
    showMessage(errorMessage(error, 'No fue posible guardar la categoría. Inténtalo de nuevo.'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteCategoria = async (categoria: ExpenseCategory) => {
  if (!confirm(`¿Seguro que quieres eliminar la categoría "${categoria.name}"?`)) return

  try {
    await expensesService.deleteCategory(categoria.id)
    showMessage('Categoría eliminada exitosamente', 'success')
    loadCategorias()
  } catch (error) {
    console.error('[Gastos] Error al eliminar categoría:', error)
    showMessage(errorMessage(error, 'No fue posible eliminar la categoría. Inténtalo de nuevo.'), 'error')
  }
}

// Computed: Verificar si la categoría seleccionada es de compra de inventario
const esCompraInventario = computed(() => {
  if (!expenseFormData.value.expense_category_id) return false
  const categoria = categorias.value.find(c => c.id === expenseFormData.value.expense_category_id)
  return categoria?.type === 'inventory_purchase'
})

// Categories are not states: they share one neutral color and differ by icon.
const getCategoryIcon = (tipo?: string) => {
  const icons: Record<string, string> = {
    inventory_purchase: 'mdi-package-variant',
    variable_expense: 'mdi-chart-line-variant',
    fixed_expense: 'mdi-calendar-sync',
    administrative_expense: 'mdi-briefcase-outline',
    payroll: 'mdi-account-cash',
    taxes: 'mdi-bank',
  }
  return icons[tipo || ''] || 'mdi-tag-outline'
}

const getTipoLabel = (tipo: string) => label(expenseCategoryTypeLabels, tipo)


const showMessage = (text: string, color: 'success' | 'error' | 'warning') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

// Cambiar las fechas recarga la tabla (filtro de useServerPage) y el resumen.
watch([fechaInicio, fechaFin], () => loadResumen())

onMounted(() => {
  // Rango por defecto: el último mes. Fijarlo dispara la primera carga.
  const haceUnMes = new Date()
  const finRango = new Date()
  haceUnMes.setMonth(haceUnMes.getMonth() - 1)
  finRango.setDate(finRango.getDate() + 1)

  fechaInicio.value = toIsoDate(haceUnMes)
  fechaFin.value = toIsoDate(finRango)

  loadCategorias()
  loadRecurring()
})
</script>
