<template>
  <v-container fluid>
    <!-- Título Principal -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="40" class="mr-3" color="primary">mdi-cash-multiple</v-icon>
          <div>
            <h1 class="text-h3">Gestión de Gastos</h1>
            <p class="text-body-1 text-grey">Controla y administra todos los expenses del negocio</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <!-- Resumen de Gastos -->
      <v-col cols="14">
        <v-card>
          <v-card-title class="bg-primary d-flex align-center">
            <v-icon class="mr-2">mdi-chart-box</v-icon>
            Resumen Financiero
          </v-card-title>
          <v-card-text  class="mt-4" >
            <v-row>
              <v-col md="3">
                <v-text-field
                  v-model="fechaInicio"
                  label="Fecha Inicio"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col md="3">
                <v-text-field
                  v-model="fechaFin"
                  label="Fecha Fin"
                  type="date"
                  variant="outlined"
                  density="compact"
                  hide-details />
              </v-col>
              <v-col md="2">
                <v-btn
                  color="primary"
                  block
                  :loading="loadingResumen"
                  @click="loadResumen()">
                  <v-icon start>mdi-refresh</v-icon>
                  Actualizar
                </v-btn>
              </v-col>
            </v-row>

            <v-row v-if="resumen" class="mt-2">
              <v-col md="3">
                <v-card color="error" variant="tonal" class="h-100">
                  <v-card-text class="text-center py-6">
                    <v-icon size="40" class="mb-2">mdi-cash-remove</v-icon>
                    <div class="text-h3 font-weight-bold">${{ Number(resumen.total_expenses || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</div>
                    <div class="text-subtitle-1 font-weight-bold mt-2">Total Gastos</div>
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
                        <v-chip :color="getCategoryColor(item.type)" size="x-small" class="mb-2">
                          {{ getTipoLabel(item.type) }}
                        </v-chip>
                        <div class="text-h5 font-weight-bold">${{ Number(item.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</div>
                        <div class="text-subtitle-2 mt-1">{{ item.category }}</div>
                        <div class="text-caption text-grey">
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

      <!-- Tabs: Categorías y Gastos -->
      <v-col cols="12">
        <v-card>
          <v-tabs v-model="tab" bg-color="primary" class="mb-4">
            <v-tab value="expenses">
              <v-icon start>mdi-receipt</v-icon>
              Registro de Gastos
            </v-tab>
            <v-tab value="categorias">
              <v-icon start>mdi-shape</v-icon>
              Gestión de Categorías
            </v-tab>
          </v-tabs>

          <v-card-text>
            <v-window v-model="tab">
              <!-- Tab: Gastos -->
              <v-window-item value="expenses">
                <div class="d-flex justify-space-between align-center mb-4">
                  <v-btn color="success" size="large" @click="openExpenseDialog()">
                    <v-icon start>mdi-plus</v-icon>
                    Registrar Gasto
                  </v-btn>
                  <v-btn color="primary" variant="outlined" @click="tab = 'categorias'">
                    <v-icon start>mdi-shape</v-icon>
                    Gestionar Categorías
                  </v-btn>
                </div>

                <v-data-table
                  :headers="expensesHeaders"
                  :items="expenses"
                  :loading="loadingExpenses"
                  class="elevation-0">
                  <template #item.expense_date="{ item }">
                    {{ formatDate(item.expense_date) }}
                  </template>

                  <template #item.category="{ item }">
                    <v-chip
                      size="small"
                      :color="getCategoryColor(item.category?.type)">
                      {{ item.category?.name || 'Sin categoría' }}
                    </v-chip>
                  </template>

                  <template #item.amount="{ item }">
                    <strong class="text-error">
                      ${{ Number(item.amount || 0).toFixed(2) }}
                    </strong>
                  </template>

                  <template #item.invoice_number="{ item }">
                    <span v-if="item.invoice_number">{{ item.invoice_number }}</span>
                    <span v-else class="text-grey">-</span>
                  </template>

                  <template #item.actions="{ item }">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      variant="text"
                      @click="openExpenseDialog(item)" />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      @click="deleteExpense(item)" />
                  </template>
                </v-data-table>
              </v-window-item>

              <!-- Tab: Categorías -->
              <v-window-item value="categorias">
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                  <strong>Gestión de Categorías:</strong> Aquí puedes crear, editar y eliminar las categorías de expenses. 
                  Cada categoría tiene un tipo que determina cómo se clasifica el expense en los reportes.
                </v-alert>

                <v-btn color="primary" class="mb-4" @click="openCategoriaDialog()">
                  <v-icon start>mdi-plus</v-icon>
                  Nueva Categoría
                </v-btn>

                <v-data-table
                  :headers="categoriasHeaders"
                  :items="categorias"
                  :loading="loadingCategorias"
                  class="elevation-0">
                  <template #item.type="{ item }">
                    <v-chip size="small" :color="getCategoryColor(item.type)">
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
                      @click="openCategoriaDialog(item)" />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      @click="deleteCategoria(item)" />
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
          {{ editingExpense ? 'Editar Gasto' : 'Registrar Nuevo Gasto' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="expenseForm">
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="expenseFormData.expense_category_id"
                  :items="categorias"
                  :item-title="(c: any) => c.path || c.name"
                  item-value="id"
                  label="Categoría *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]">
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template #append>
                        <v-chip :color="getCategoryColor(item.raw.type)" size="x-small">
                          {{ getTipoLabel(item.raw.type) }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="expenseFormData.expense_date"
                  label="Fecha del Gasto *"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]"
                  hint="Requerido"
                  persistent-hint />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="expenseFormData.amount"
                  label="Monto *"
                  type="number"
                  prefix="$"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required, rules.positive]"
                  hint="Requerido"
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
                  label="Número de Factura"
                  placeholder="Opcional"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
            </v-row>

            <v-divider class="my-4" />
            
            <v-alert v-if="esCompraInventario" type="info" density="compact" class="mb-3">
              <strong>💡 Compra de Inventario:</strong> Asocia este expense a un producto para actualizar su stock automáticamente
            </v-alert>

            <v-row v-if="esCompraInventario">
              <v-col cols="12" md="6">
                <v-autocomplete
                  v-model="expenseFormData.product_id"
                  :items="products"
                  item-title="name"
                  item-value="id"
                  label="Producto (Opcional)"
                  variant="outlined"
                  density="comfortable"
                  clearable
                  hint="Si es compra de insumo/materia prima, selecciónalo aquí"
                  persistent-hint>
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template #append>
                        <v-chip size="x-small" variant="tonal">
                          {{ item.raw.sku }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </template>
                </v-autocomplete>
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-if="expenseFormData.product_id"
                  v-model.number="expenseFormData.quantity_purchased"
                  label="Cantidad Comprada *"
                  type="number"
                  step="0.01"
                  min="0"
                  :suffix="selectedProduct?.unit || ''"
                  variant="outlined"
                  density="comfortable"
                  :rules="expenseFormData.product_id ? [rules.required, rules.positive] : []"
                  hint="Se sumará al stock actual"
                  persistent-hint />
              </v-col>

              <v-col v-if="expenseFormData.product_id && expenseFormData.quantity_purchased && expenseFormData.amount" cols="12">
                <v-card color="success" variant="tonal" class="pa-3">
                  <div class="text-caption">Costo unitario calculado:</div>
                  <div class="text-h6">
                    ${{ (expenseFormData.amount / expenseFormData.quantity_purchased).toFixed(2) }} / {{ selectedProduct?.unit }}
                  </div>
                  <div class="text-caption mt-1">
                    Stock actual: {{ selectedProduct?.current_stock || 0 }} →
                    Nuevo stock: {{ Number(selectedProduct?.current_stock || 0) + Number(expenseFormData.quantity_purchased) }}
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="expenseFormData.notes"
                  label="Notas Adicionales"
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

    <!-- Dialog: Categoría -->
    <v-dialog v-model="categoriaDialog" max-width="600px" persistent>
      <v-card>
        <v-card-title>
          {{ editingCategoria ? 'Editar Categoría' : 'Nueva Categoría' }}
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
              label="Tipo de Gasto"
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
              label="Categoría Activa"
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
import { errorMessage } from '@/utils/errors';
import { ref, computed, onMounted } from 'vue'
import { expensesService, type Expense, type ExpenseCategory, type ExpenseSummary } from '@/services/expensesService'
import { expenseCategoryTypeLabels, label } from '@/utils/labels'
import { productsService, type Product } from '@/services/productsService'

const tab = ref('expenses')
const loadingExpenses = ref(false)
const loadingCategorias = ref(false)
const loadingResumen = ref(false)
const saving = ref(false)

const expenseDialog = ref(false)
const categoriaDialog = ref(false)
const editingExpense = ref<Expense | null>(null)
const editingCategoria = ref<ExpenseCategory | null>(null)

const expenses = ref<Expense[]>([])
const categorias = ref<ExpenseCategory[]>([])
const products = ref<Product[]>([])
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
  { title: 'Concepto', key: 'concept', sortable: false },
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
  { value: 'inventory_purchase', title: 'Compra de Inventario / Materia Prima' },
  { value: 'variable_expense', title: 'Gasto Variable (ej: empaques, domicilio)' },
  { value: 'fixed_expense', title: 'Gasto Fijo (ej: arriendo, servicios)' },
  { value: 'administrative_expense', title: 'Gasto Administrativo' },
  { value: 'payroll', title: 'Nómina' },
  { value: 'taxes', title: 'Impuestos' },
]

const toLocalDateInput = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0] ?? ''
}

const expenseFormData = ref<Partial<Expense>>({
  expense_category_id: undefined,
  concept: '',
  amount: 0,
  expense_date: toLocalDateInput(new Date()),
  invoice_number: '',
  supplier_name: '',
  product_id: undefined,
  quantity_purchased: undefined,
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
}

const loadExpenses = async () => {
  loadingExpenses.value = true
  try {
    expenses.value = await expensesService.getExpenses({
      start_date: fechaInicio.value || undefined,
      end_date: fechaFin.value || undefined,
    })
  } catch (error) {
    console.error('[Gastos] Error al cargar:', error)
    showMessage(errorMessage(error, 'Error al cargar gastos'), 'error')
  } finally {
    loadingExpenses.value = false
  }
}

const loadCategorias = async () => {
  loadingCategorias.value = true
  try {
    categorias.value = await expensesService.getCategories()
    console.log('[Gastos] Categorías cargadas:', categorias.value)
  } catch (error) {
    console.error('[Gastos] Error al cargar categorías:', error)
    showMessage(errorMessage(error, 'Error al cargar categorías'), 'error')
  } finally {
    loadingCategorias.value = false
  }
}

const loadProducts = async () => {
  try {
    products.value = await productsService.getAll()
    console.log('[Gastos] Productos cargados:', products.value.length)
  } catch (error) {
    console.error('[Gastos] Error al cargar productos:', error)
    showMessage(errorMessage(error, 'Error al cargar productos'), 'error')
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
    showMessage(errorMessage(error, 'Error al cargar resumen'), 'error')
  } finally {
    loadingResumen.value = false
  }
}

const openExpenseDialog = (expense?: Expense) => {
  editingExpense.value = expense || null
  if (expense) {
    expenseFormData.value = { ...expense }
  } else {
    expenseFormData.value = {
      expense_category_id: undefined,
      concept: '',
      amount: 0,
      expense_date: toLocalDateInput(new Date()),
      invoice_number: '',
      supplier_name: '',
      product_id: undefined,
      quantity_purchased: undefined,
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
    showMessage(errorMessage(error, 'Error al guardar gasto'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteExpense = async (expense: Expense) => {
  if (!confirm(`¿Está seguro de eliminar el gasto "${expense.concept}"?`)) return

  try {
    await expensesService.deleteExpense(expense.id)
    showMessage('Gasto eliminado exitosamente', 'success')
    loadExpenses()
    loadResumen()
  } catch (error) {
    console.error('[Gastos] Error al eliminar:', error)
    showMessage(errorMessage(error, 'Error al eliminar gasto'), 'error')
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
    showMessage(errorMessage(error, 'Error al guardar categoría'), 'error')
  } finally {
    saving.value = false
  }
}

const deleteCategoria = async (categoria: ExpenseCategory) => {
  if (!confirm(`¿Está seguro de eliminar la categoría "${categoria.name}"?`)) return

  try {
    await expensesService.deleteCategory(categoria.id)
    showMessage('Categoría eliminada exitosamente', 'success')
    loadCategorias()
  } catch (error) {
    console.error('[Gastos] Error al eliminar categoría:', error)
    showMessage(errorMessage(error, 'Error al eliminar categoría'), 'error')
  }
}

// Computed: Verificar si la categoría seleccionada es de compra de inventario
const esCompraInventario = computed(() => {
  if (!expenseFormData.value.expense_category_id) return false
  const categoria = categorias.value.find(c => c.id === expenseFormData.value.expense_category_id)
  return categoria?.type === 'inventory_purchase'
})

// Computed: Obtener el producto seleccionado
const selectedProduct = computed(() => {
  if (!expenseFormData.value.product_id) return null
  return products.value.find(p => p.id === expenseFormData.value.product_id)
})

const getCategoryColor = (tipo?: string) => {
  const colors: Record<string, string> = {
    inventory_purchase: 'green',
    variable_expense: 'orange',
    fixed_expense: 'blue',
    administrative_expense: 'purple',
    payroll: 'indigo',
    taxes: 'red',
  }
  return colors[tipo || ''] || 'grey'
}

const getTipoLabel = (tipo: string) => label(expenseCategoryTypeLabels, tipo)

const formatDate = (date: string) => {
  if (!date) return '-'
  const normalized = date.includes('T') ? date : `${date}T00:00:00`
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return date
  return parsed.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const showMessage = (text: string, color: 'success' | 'error' | 'warning') => {
  snackbarText.value = text
  snackbarColor.value = color
  snackbar.value = true
}

onMounted(() => {
  // Establecer rango de fechas por defecto (último mes)
  const haceUnMes = new Date()
  const finRango = new Date()
  haceUnMes.setMonth(haceUnMes.getMonth() - 1)
  finRango.setDate(finRango.getDate() + 1)
  
  fechaInicio.value = toLocalDateInput(haceUnMes)
  fechaFin.value = toLocalDateInput(finRango)

  loadCategorias()
  loadExpenses()
  loadResumen()
  loadProducts()
})
</script>
