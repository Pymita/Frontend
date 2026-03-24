<template>
  <v-container fluid>
    <!-- Título Principal -->
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="d-flex align-center">
          <v-icon size="40" class="mr-3" color="primary">mdi-cash-multiple</v-icon>
          <div>
            <h1 class="text-h3">Gestión de Gastos</h1>
            <p class="text-body-1 text-grey">Controla y administra todos los gastos del negocio</p>
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
                    <div class="text-h3 font-weight-bold">${{ Number(resumen.total_gastos || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</div>
                    <div class="text-subtitle-1 font-weight-bold mt-2">Total Gastos</div>
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="9">
                <v-row>
                  <v-col
                    v-for="(item, idx) in resumen.por_categoria.slice(0, 6)"
                    :key="`${item.tipo}-${item.categoria}-${idx}`"
                    cols="12"
                    sm="6"
                    md="4">
                    <v-card class="h-100">
                      <v-card-text>
                        <v-chip :color="getCategoryColor(item.tipo)" size="x-small" class="mb-2">
                          {{ getTipoLabel(item.tipo) }}
                        </v-chip>
                        <div class="text-h5 font-weight-bold">${{ Number(item.total || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }}</div>
                        <div class="text-subtitle-2 mt-1">{{ item.categoria }}</div>
                        <div class="text-caption text-grey">
                          {{ item.cantidad }} registro(s)
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
            <v-tab value="gastos">
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
              <v-window-item value="gastos">
                <div class="d-flex justify-space-between align-center mb-4">
                  <v-btn color="success" size="large" @click="openGastoDialog()">
                    <v-icon start>mdi-plus</v-icon>
                    Registrar Gasto
                  </v-btn>
                  <v-btn color="primary" variant="outlined" @click="tab = 'categorias'">
                    <v-icon start>mdi-shape</v-icon>
                    Gestionar Categorías
                  </v-btn>
                </div>

                <v-data-table
                  :headers="gastosHeaders"
                  :items="gastos"
                  :loading="loadingGastos"
                  class="elevation-0">
                  <template #item.fecha_gasto="{ item }">
                    {{ formatDate(item.fecha_gasto) }}
                  </template>

                  <template #item.category="{ item }">
                    <v-chip
                      size="small"
                      :color="getCategoryColor(item.category?.tipo)">
                      {{ item.category?.nombre || 'Sin categoría' }}
                    </v-chip>
                  </template>

                  <template #item.monto="{ item }">
                    <strong class="text-error">
                      ${{ Number(item.monto || 0).toFixed(2) }}
                    </strong>
                  </template>

                  <template #item.numero_factura="{ item }">
                    <span v-if="item.numero_factura">{{ item.numero_factura }}</span>
                    <span v-else class="text-grey">-</span>
                  </template>

                  <template #item.actions="{ item }">
                    <v-btn
                      icon="mdi-pencil"
                      size="small"
                      variant="text"
                      @click="openGastoDialog(item)" />
                    <v-btn
                      icon="mdi-delete"
                      size="small"
                      variant="text"
                      color="error"
                      @click="deleteGasto(item)" />
                  </template>
                </v-data-table>
              </v-window-item>

              <!-- Tab: Categorías -->
              <v-window-item value="categorias">
                <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                  <strong>Gestión de Categorías:</strong> Aquí puedes crear, editar y eliminar las categorías de gastos. 
                  Cada categoría tiene un tipo que determina cómo se clasifica el gasto en los reportes.
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
                  <template #item.tipo="{ item }">
                    <v-chip size="small" :color="getCategoryColor(item.tipo)">
                      {{ getTipoLabel(item.tipo) }}
                    </v-chip>
                  </template>

                  <template #item.activa="{ item }">
                    <v-icon :color="item.activa ? 'success' : 'error'">
                      {{ item.activa ? 'mdi-check-circle' : 'mdi-close-circle' }}
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
    <v-dialog v-model="gastoDialog" max-width="700px" persistent>
      <v-card>
        <v-card-title>
          {{ editingGasto ? 'Editar Gasto' : 'Registrar Nuevo Gasto' }}
        </v-card-title>
        <v-card-text>
          <v-form ref="gastoForm">
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="gastoFormData.expense_category_id"
                  :items="categorias"
                  item-title="nombre"
                  item-value="id"
                  label="Categoría *"
                  variant="outlined"
                  density="comfortable"
                  :rules="[rules.required]">
                  <template #item="{ props, item }">
                    <v-list-item v-bind="props">
                      <template #append>
                        <v-chip :color="getCategoryColor(item.raw.tipo)" size="x-small">
                          {{ getTipoLabel(item.raw.tipo) }}
                        </v-chip>
                      </template>
                    </v-list-item>
                  </template>
                </v-select>
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="gastoFormData.fecha_gasto"
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
                  v-model.number="gastoFormData.monto"
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
                  v-model="gastoFormData.concepto"
                  label="Concepto / Descripción"
                  placeholder="Opcional - Se usará el nombre de la categoría si está vacío"
                  variant="outlined"
                  density="comfortable"
                  hint="Opcional"
                  persistent-hint />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="gastoFormData.proveedor"
                  label="Proveedor"
                  placeholder="Opcional"
                  variant="outlined"
                  density="comfortable" />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model="gastoFormData.numero_factura"
                  label="Número de Factura"
                  placeholder="Opcional"
                  variant="outlined"
                  density="comfortable" />
              </v-col>
            </v-row>

            <v-divider class="my-4" />
            
            <v-alert v-if="esCompraInventario" type="info" density="compact" class="mb-3">
              <strong>💡 Compra de Inventario:</strong> Asocia este gasto a un producto para actualizar su stock automáticamente
            </v-alert>

            <v-row v-if="esCompraInventario">
              <v-col cols="12" md="6">
                <v-autocomplete
                  v-model="gastoFormData.product_id"
                  :items="productos"
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
                  v-if="gastoFormData.product_id"
                  v-model.number="gastoFormData.cantidad_comprada"
                  label="Cantidad Comprada *"
                  type="number"
                  step="0.01"
                  min="0"
                  :suffix="productoSeleccionado?.unidad || ''"
                  variant="outlined"
                  density="comfortable"
                  :rules="gastoFormData.product_id ? [rules.required, rules.positive] : []"
                  hint="Se sumará al stock actual"
                  persistent-hint />
              </v-col>

              <v-col v-if="gastoFormData.product_id && gastoFormData.cantidad_comprada && gastoFormData.monto" cols="12">
                <v-card color="success" variant="tonal" class="pa-3">
                  <div class="text-caption">Costo unitario calculado:</div>
                  <div class="text-h6">
                    ${{ (gastoFormData.monto / gastoFormData.cantidad_comprada).toFixed(2) }} / {{ productoSeleccionado?.unidad }}
                  </div>
                  <div class="text-caption mt-1">
                    Stock actual: {{ productoSeleccionado?.stock_actual || 0 }} → 
                    Nuevo stock: {{ Number(productoSeleccionado?.stock_actual || 0) + Number(gastoFormData.cantidad_comprada) }}
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12">
                <v-textarea
                  v-model="gastoFormData.notas"
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
          <v-btn @click="gastoDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveGasto()">
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
              v-model="categoriaFormData.nombre"
              label="Nombre"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
              class="mb-3" />

            <v-select
              v-model="categoriaFormData.tipo"
              :items="tiposGasto"
              label="Tipo de Gasto"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
              class="mb-3" />

            <v-textarea
              v-model="categoriaFormData.descripcion"
              label="Descripción"
              rows="2"
              variant="outlined"
              density="comfortable"
              class="mb-3" />

            <v-switch
              v-model="categoriaFormData.activa"
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
    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { gastosService, type Expense, type ExpenseCategory } from '@/services/gastosService'
import { productosService, type Product } from '@/services/productosService'

const tab = ref('gastos')
const loading = ref(false)
const loadingGastos = ref(false)
const loadingCategorias = ref(false)
const loadingResumen = ref(false)
const saving = ref(false)

const gastoDialog = ref(false)
const categoriaDialog = ref(false)
const editingGasto = ref<Expense | null>(null)
const editingCategoria = ref<ExpenseCategory | null>(null)

const gastos = ref<Expense[]>([])
const categorias = ref<ExpenseCategory[]>([])
const productos = ref<Product[]>([])
const resumen = ref<any>(null)

const fechaInicio = ref('')
const fechaFin = ref('')

const snackbar = ref(false)
const snackbarText = ref('')
const snackbarColor = ref('success')

const gastoForm = ref<any>(null)
const categoriaForm = ref<any>(null)

const gastosHeaders = [
  { title: 'Fecha', key: 'fecha_gasto', sortable: true },
  { title: 'Categoría', key: 'category', sortable: false },
  { title: 'Concepto', key: 'concepto', sortable: false },
  { title: 'Monto', key: 'monto', sortable: true },
  { title: 'Factura', key: 'numero_factura', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const categoriasHeaders = [
  { title: 'Nombre', key: 'nombre', sortable: true },
  { title: 'Tipo', key: 'tipo', sortable: true },
  { title: 'Descripción', key: 'descripcion', sortable: false },
  { title: 'Activa', key: 'activa', sortable: true },
  { title: 'Acciones', key: 'actions', sortable: false, align: 'end' as const },
]

const tiposGasto = [
  { value: 'compra_inventario', title: 'Compra de Inventario / Materia Prima' },
  { value: 'gasto_variable', title: 'Gasto Variable (ej: empaques, domicilio)' },
  { value: 'gasto_fijo', title: 'Gasto Fijo (ej: arriendo, servicios)' },
  { value: 'gasto_administrativo', title: 'Gasto Administrativo' },
  { value: 'nomina', title: 'Nómina' },
  { value: 'impuestos', title: 'Impuestos' },
]

const toLocalDateInput = (date: Date) => {
  const offsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - offsetMs).toISOString().split('T')[0]
}

const gastoFormData = ref<Partial<Expense>>({
  expense_category_id: undefined,
  concepto: '',
  monto: 0,
  fecha_gasto: toLocalDateInput(new Date()),
  numero_factura: '',
  proveedor: '',
  product_id: undefined,
  cantidad_comprada: undefined,
  notas: '',
})

const categoriaFormData = ref<Partial<ExpenseCategory>>({
  nombre: '',
  descripcion: '',
  tipo: 'gasto_fijo',
  activa: true,
})

const rules = {
  required: (v: any) => !!v || 'Este campo es requerido',
  positive: (v: any) => (v && v > 0) || 'Debe ser mayor a 0',
}

const loadGastos = async () => {
  loadingGastos.value = true
  try {
    gastos.value = await gastosService.getExpenses({
      fecha_inicio: fechaInicio.value || undefined,
      fecha_fin: fechaFin.value || undefined,
    })
  } catch (error) {
    console.error('[Gastos] Error al cargar:', error)
    showMessage('Error al cargar gastos', 'error')
  } finally {
    loadingGastos.value = false
  }
}

const loadCategorias = async () => {
  loadingCategorias.value = true
  try {
    categorias.value = await gastosService.getCategories()
    console.log('[Gastos] Categorías cargadas:', categorias.value)
  } catch (error) {
    console.error('[Gastos] Error al cargar categorías:', error)
    showMessage('Error al cargar categorías', 'error')
  } finally {
    loadingCategorias.value = false
  }
}

const loadProductos = async () => {
  try {
    productos.value = await productosService.getAll()
    console.log('[Gastos] Productos cargados:', productos.value.length)
  } catch (error) {
    console.error('[Gastos] Error al cargar productos:', error)
    showMessage('Error al cargar productos', 'error')
  }
}

const loadResumen = async () => {
  loadingResumen.value = true
  try {
    resumen.value = await gastosService.getResumenGastos({
      fecha_inicio: fechaInicio.value || undefined,
      fecha_fin: fechaFin.value || undefined,
    })
  } catch (error) {
    console.error('[Gastos] Error al cargar resumen:', error)
    showMessage('Error al cargar resumen', 'error')
  } finally {
    loadingResumen.value = false
  }
}

const openGastoDialog = (gasto?: Expense) => {
  editingGasto.value = gasto || null
  if (gasto) {
    gastoFormData.value = { ...gasto }
  } else {
    gastoFormData.value = {
      expense_category_id: undefined,
      concepto: '',
      monto: 0,
      fecha_gasto: toLocalDateInput(new Date()),
      numero_factura: '',
      proveedor: '',
      product_id: undefined,
      cantidad_comprada: undefined,
      notas: '',
    }
  }
  gastoDialog.value = true
}

const saveGasto = async () => {
  const { valid } = await gastoForm.value.validate()
  if (!valid) return

  saving.value = true
  try {
    if (editingGasto.value?.id) {
      await gastosService.updateExpense(editingGasto.value.id, gastoFormData.value)
      showMessage('Gasto actualizado exitosamente', 'success')
    } else {
      await gastosService.createExpense(gastoFormData.value)
      showMessage('Gasto registrado exitosamente', 'success')
    }
    gastoDialog.value = false
    loadGastos()
    loadResumen()
  } catch (error) {
    console.error('[Gastos] Error al guardar:', error)
    showMessage('Error al guardar gasto', 'error')
  } finally {
    saving.value = false
  }
}

const deleteGasto = async (gasto: Expense) => {
  if (!confirm(`¿Está seguro de eliminar el gasto "${gasto.concepto}"?`)) return

  try {
    await gastosService.deleteExpense(gasto.id)
    showMessage('Gasto eliminado exitosamente', 'success')
    loadGastos()
    loadResumen()
  } catch (error) {
    console.error('[Gastos] Error al eliminar:', error)
    showMessage('Error al eliminar gasto', 'error')
  }
}

const openCategoriaDialog = (categoria?: ExpenseCategory) => {
  editingCategoria.value = categoria || null
  if (categoria) {
    categoriaFormData.value = { ...categoria }
  } else {
    categoriaFormData.value = {
      nombre: '',
      descripcion: '',
      tipo: 'gasto_fijo',
      activa: true,
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
      await gastosService.updateCategory(editingCategoria.value.id, categoriaFormData.value)
      showMessage('Categoría actualizada exitosamente', 'success')
    } else {
      await gastosService.createCategory(categoriaFormData.value)
      showMessage('Categoría creada exitosamente', 'success')
    }
    categoriaDialog.value = false
    loadCategorias()
  } catch (error) {
    console.error('[Gastos] Error al guardar categoría:', error)
    showMessage('Error al guardar categoría', 'error')
  } finally {
    saving.value = false
  }
}

const deleteCategoria = async (categoria: ExpenseCategory) => {
  if (!confirm(`¿Está seguro de eliminar la categoría "${categoria.nombre}"?`)) return

  try {
    await gastosService.deleteCategory(categoria.id)
    showMessage('Categoría eliminada exitosamente', 'success')
    loadCategorias()
  } catch (error) {
    console.error('[Gastos] Error al eliminar categoría:', error)
    showMessage('Error al eliminar categoría', 'error')
  }
}

// Computed: Verificar si la categoría seleccionada es de compra de inventario
const esCompraInventario = computed(() => {
  if (!gastoFormData.value.expense_category_id) return false
  const categoria = categorias.value.find(c => c.id === gastoFormData.value.expense_category_id)
  return categoria?.tipo === 'compra_inventario'
})

// Computed: Obtener el producto seleccionado
const productoSeleccionado = computed(() => {
  if (!gastoFormData.value.product_id) return null
  return productos.value.find(p => p.id === gastoFormData.value.product_id)
})

const getCategoryColor = (tipo?: string) => {
  const colors: Record<string, string> = {
    compra_inventario: 'green',
    gasto_variable: 'orange',
    gasto_fijo: 'blue',
    gasto_administrativo: 'purple',
    nomina: 'indigo',
    impuestos: 'red',
  }
  return colors[tipo || ''] || 'grey'
}

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    compra_inventario: 'Compra Inventario',
    gasto_variable: 'Variable',
    gasto_fijo: 'Fijo',
    gasto_administrativo: 'Administrativo',
    nomina: 'Nómina',
    impuestos: 'Impuestos',
  }
  return labels[tipo] || tipo
}

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
  const hoy = new Date()
  const haceUnMes = new Date()
  const finRango = new Date()
  haceUnMes.setMonth(haceUnMes.getMonth() - 1)
  finRango.setDate(finRango.getDate() + 1)
  
  fechaInicio.value = toLocalDateInput(haceUnMes)
  fechaFin.value = toLocalDateInput(finRango)

  loadCategorias()
  loadGastos()
  loadResumen()
  loadProductos()
})
</script>
