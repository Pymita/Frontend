<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Gestión de Productos Base</h1>
            <p class="text-body-1 text-grey-darken-1">
              Materias primas, productos intermedios y finales
            </p>
          </div>
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-plus</v-icon>
            Nuevo Producto
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <!-- Filtros -->
    <v-row>
      <v-col cols="12">
        <v-card class="mb-4">
          <v-card-text>
            <v-row align="center">
              <v-col cols="12" md="3">
                <v-tabs v-model="tipoFilter" color="primary" density="compact">
                  <v-tab value="">Todos</v-tab>
                  <v-tab value="materia_prima">Materias Primas</v-tab>
                  <v-tab value="intermedio">Intermedios</v-tab>
                  <v-tab value="final">Finales</v-tab>
                </v-tabs>
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="search"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="3">
                <v-select
                  v-model="filterCategoria"
                  :items="categorias"
                  item-title="name"
                  item-value="id"
                  label="Categoría"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabla de productos -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="filteredProducts"
            :loading="loading"
            :search="search"
            class="elevation-0"
          >
            <template #item.tipo="{ item }">
              <v-chip :color="getTipoColor(item.tipo)" size="small">
                {{ getTipoLabel(item.tipo) }}
              </v-chip>
            </template>
            <template #item.stock_actual="{ item }">
              <span v-if="item.maneja_stock === false" class="text-grey">No aplica</span>
              <div v-else-if="item.stock_actual !== null && item.stock_actual !== undefined">
                <v-chip 
                  :color="getStockColor(item)" 
                  size="small"
                  @click="openStockDialog(item)"
                  style="cursor: pointer"
                >
                  {{ item.stock_actual }} {{ item.unidad }}
                </v-chip>
              </div>
              <v-btn 
                v-else
                size="small" 
                variant="text" 
                color="primary"
                @click="openStockDialog(item)"
              >
                Definir
              </v-btn>
            </template>
            <template #item.stock_minimo="{ item }">
              <span v-if="item.maneja_stock === false" class="text-grey">No aplica</span>
              <span v-else-if="item.stock_minimo">
                {{ item.stock_minimo }} {{ item.unidad }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.costo_unitario="{ item }">
              <span v-if="item.costo_unitario" class="font-weight-bold">
                ${{ Number(item.costo_unitario).toFixed(2) }}/{{ item.unidad }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.precio_venta="{ item }">
              <span v-if="item.precio_venta" class="font-weight-bold text-success">
                ${{ Number(item.precio_venta).toLocaleString('es-CO') }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.costo_estimado="{ item }">
              <span v-if="item.costo_estimado" class="text-success">
                ${{ Number(item.costo_estimado).toFixed(2) }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.category="{ item }">
              <v-chip v-if="item.category" size="small" variant="tonal">
                {{ item.category.name }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-tooltip v-if="item.tipo !== 'materia_prima'" text="Gestionar receta">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="info"
                    @click="goToReceta(item)"
                  >
                    <v-icon size="small">mdi-food-variant</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>

              <v-tooltip text="Editar producto">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon size="small" variant="text" @click="openDialog(item)">
                    <v-icon size="small">mdi-pencil</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>

              <v-tooltip text="Eliminar producto">
                <template #activator="{ props }">
                  <v-btn v-bind="props" icon size="small" variant="text" color="error" @click="deleteProduct(item)">
                    <v-icon size="small">mdi-delete</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Producto -->
    <v-dialog v-model="dialog" max-width="700" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Editar Producto' : 'Nuevo Producto' }}</v-card-title>
        <v-card-text>
          <v-alert type="info" density="compact" class="mb-4" closable>
            <strong>💡 Consejo:</strong> El <strong>código SKU</strong> se genera automáticamente. Solo necesitas completar el nombre y la unidad de medida.
          </v-alert>

          <v-form ref="form" @submit.prevent="save">
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="formData.name"
                  label="Nombre del producto *"
                  :rules="[v => !!v || 'Nombre requerido']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="formData.sku"
                  label="Código SKU (Opcional)"
                  :hint="!formData.sku?.trim() ? `Se generará: ${skuPreview}` : 'Código interno del producto'"
                  persistent-hint
                  placeholder="Dejar vacío para generar automático"
                />
              </v-col>
            </v-row>
            
            <v-textarea
              v-model="formData.description"
              label="Descripción"
              rows="2"
            />
            
            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.tipo"
                  :items="tiposProducto"
                  label="Tipo de producto"
                  :rules="[v => !!v || 'Tipo requerido']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.category_id"
                  :items="categorias"
                  item-title="name"
                  item-value="id"
                  label="Categoría"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.unidad"
                  label="Unidad de medida *"
                  hint="Ej: kg, litros, unidad, gramos"
                  persistent-hint
                  :rules="[v => !!v || 'Unidad requerida']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-if="formData.tipo === 'materia_prima'"
                  v-model.number="formData.costo_unitario"
                  label="Costo unitario"
                  type="number"
                  step="0.01"
                  min="0"
                  prefix="$"
                  hint="¿Cuánto cuesta comprar una unidad?"
                  persistent-hint
                  :rules="[v => v >= 0 || 'Costo inválido']"
                />
                <v-text-field
                  v-if="formData.tipo === 'final'"
                  v-model.number="formData.precio_venta"
                  label="Precio de venta *"
                  type="number"
                  step="100"
                  min="0"
                  prefix="$"
                  hint="¿A qué precio lo vendes?"
                  persistent-hint
                  :rules="[v => v > 0 || 'Precio de venta requerido']"
                  required
                />
              </v-col>
            </v-row>

            <v-divider class="my-4" />
            <h4 class="mb-3">Control de Inventario</h4>

            <v-switch
              v-model="formData.maneja_stock"
              color="primary"
              inset
              label="Este producto maneja stock e inventario"
              hint="Desactívalo para productos de receta bajo demanda (ej: pizza) que no quieres en reportes de stock"
              persistent-hint
              class="mb-2"
            />
            
            <v-row v-if="formData.maneja_stock">
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.stock_actual"
                  label="Stock actual"
                  type="text"
                  inputmode="decimal"
                  :suffix="formData.unidad || ''"
                  @blur="formatStockField('stock_actual')"
                  @keypress="allowDecimalInput"
                  hint="Ej: 10,5 o 10.5"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.stock_minimo"
                  label="Stock mínimo (alerta)"
                  type="text"
                  inputmode="decimal"
                  :suffix="formData.unidad || ''"
                  @blur="formatStockField('stock_minimo')"
                  @keypress="allowDecimalInput"
                  hint="Se alertará cuando baje de este nivel. Ej: 5,5 o 5.5"
                  persistent-hint
                />
              </v-col>
            </v-row>
            <v-alert
              v-else
              type="info"
              density="compact"
              variant="tonal"
              class="mb-2"
            >
              Este producto no se incluirá en alertas ni reportes de stock.
            </v-alert>

            <v-alert v-if="formData.tipo === 'final'" type="success" density="compact" class="mt-2">
              <strong>✓ Producto Final:</strong> Al definir el precio de venta aquí, este producto estará listo para venderse. El costo se calculará automáticamente desde su receta.
            </v-alert>
            <v-alert v-else-if="formData.tipo === 'intermedio'" type="info" density="compact" class="mt-2">
              <strong>Producto Intermedio:</strong> El costo de este producto se calculará automáticamente desde su receta
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Ajuste Rápido de Stock -->
    <v-dialog v-model="stockDialog" max-width="500">
      <v-card v-if="stockProduct">
        <v-card-title>Ajustar Stock: {{ stockProduct.name }}</v-card-title>
        <v-card-text>
          <v-alert 
            :type="getStockColor(stockProduct)"
            density="compact"
            class="mb-4"
          >
            <div class="d-flex justify-space-between align-center">
              <span>Stock actual:</span>
              <span class="text-h6">
                {{ stockProduct.stock_actual || 0 }} {{ stockProduct.unidad }}
              </span>
            </div>
            <div v-if="stockProduct.stock_minimo" class="d-flex justify-space-between align-center mt-2">
              <span>Stock mínimo:</span>
              <span>{{ stockProduct.stock_minimo }} {{ stockProduct.unidad }}</span>
            </div>
          </v-alert>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="stockAjuste"
                label="Ajuste"
                type="text"
                inputmode="decimal"
                :suffix="stockProduct.unidad"
                hint="Usa negativos para restar. Ej: -2,5 o 3,75"
                persistent-hint
                autofocus
                @keypress="allowDecimalInput"
              />
            </v-col>
            <v-col cols="12" md="6">
              <v-card flat color="grey-lighten-4" class="pa-3">
                <div class="text-caption">Nuevo stock:</div>
                <div class="text-h5" :class="calcularNuevoStock >= 0 ? 'text-success' : 'text-error'">
                  {{ calcularNuevoStock.toFixed(2) }} {{ stockProduct.unidad }}
                </div>
              </v-card>
            </v-col>
          </v-row>

          <v-textarea
            v-model="stockMotivo"
            label="Motivo (opcional)"
            rows="2"
            class="mt-2"
            hint="Ej: Compra, Consumo en producción, Merma, etc."
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="stockDialog = false">Cancelar</v-btn>
          <v-btn 
            color="primary" 
            :loading="saving" 
            :disabled="stockAjuste === 0"
            @click="updateStock"
          >
            Actualizar Stock
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { productosService, categoriesProductosService, type Product, type Category } from '@/services/productosService';

const router = useRouter();

const products = ref<Product[]>([]);
const categorias = ref<Category[]>([]);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const tipoFilter = ref('');
const filterCategoria = ref<number | null>(null);

const dialog = ref(false);
const editing = ref<Product | null>(null);

const formData = ref({
  name: '',
  description: '',
  sku: '',
  tipo: 'materia_prima' as 'materia_prima' | 'intermedio' | 'final',
  unidad: '',
  maneja_stock: true,
  costo_unitario: 0,
  precio_venta: null as number | null,
  category_id: null as number | null,
  stock_actual: null as string | number | null,
  stock_minimo: null as string | number | null,
});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const tiposProducto = [
  { title: 'Materia Prima', value: 'materia_prima' },
  { title: 'Producto Intermedio', value: 'intermedio' },
  { title: 'Producto Final', value: 'final' },
];

const headers = [
  { title: 'SKU', key: 'sku' },
  { title: 'Nombre', key: 'name' },
  { title: 'Tipo', key: 'tipo' },
  { title: 'Stock Actual', key: 'stock_actual' },
  { title: 'Stock Mínimo', key: 'stock_minimo' },
  { title: 'Unidad', key: 'unidad' },
  { title: 'Costo Unitario', key: 'costo_unitario' },
  { title: 'Precio Venta', key: 'precio_venta' },
  { title: 'Costo Estimado', key: 'costo_estimado' },
  { title: 'Categoría', key: 'category' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const filteredProducts = computed(() => {
  let filtered = products.value;
  
  if (tipoFilter.value) {
    filtered = filtered.filter(p => p.tipo === tipoFilter.value);
  }
  
  if (filterCategoria.value) {
    filtered = filtered.filter(p => p.category_id === filterCategoria.value);
  }
  
  return filtered;
});

const getTipoColor = (tipo: string) => {
  const colors: Record<string, string> = {
    materia_prima: 'blue',
    intermedio: 'orange',
    final: 'green',
  };
  return colors[tipo] || 'grey';
};

const getTipoLabel = (tipo: string) => {
  const labels: Record<string, string> = {
    materia_prima: 'Materia Prima',
    intermedio: 'Intermedio',
    final: 'Final',
  };
  return labels[tipo] || tipo;
};

const getStockColor = (product: Product) => {
  if (product.maneja_stock === false) return 'grey';
  if (!product.stock_actual || !product.stock_minimo) return 'grey';
  if (product.stock_actual <= product.stock_minimo) return 'error';
  if (product.stock_actual <= product.stock_minimo * 1.5) return 'warning';
  return 'success';
};

const stockDialog = ref(false);
const stockProduct = ref<Product | null>(null);
const stockAjuste = ref<string | number>(0);
const stockMotivo = ref('');

const calcularNuevoStock = computed(() => {
  if (!stockProduct.value) return 0;
  
  const ajusteStr = String(stockAjuste.value || 0).replace(',', '.');
  const ajuste = parseFloat(ajusteStr);
  const ajusteValido = isNaN(ajuste) ? 0 : ajuste;
  
  return Number(stockProduct.value.stock_actual || 0) + ajusteValido;
});

// Función para generar SKU automáticamente
const generarSKU = (nombre: string, tipo: string): string => {
  // Limpiar nombre: quitar acentos, espacios, caracteres especiales
  const nombreLimpio = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '') // Solo letras y números
    .substring(0, 8); // Máximo 8 caracteres
  
  // Prefijo según tipo
  const prefijo = tipo === 'materia_prima' ? 'MP' : tipo === 'intermedio' ? 'INT' : 'FIN';
  
  // Timestamp corto para garantizar unicidad
  const timestamp = Date.now().toString().slice(-6);
  
  return `${nombreLimpio}-${prefijo}-${timestamp}`;
};

// Vista previa del SKU que se generará
const skuPreview = computed(() => {
  if (!formData.value.name?.trim()) return 'Ingresa un nombre primero';
  return generarSKU(formData.value.name, formData.value.tipo);
});

const openStockDialog = (product: Product) => {
  if (product.maneja_stock === false) {
    showMessage('Este producto no tiene control de stock activo', 'warning');
    return;
  }
  stockProduct.value = product;
  stockAjuste.value = 0;
  stockMotivo.value = '';
  stockDialog.value = true;
};

const updateStock = async () => {
  if (!stockProduct.value) return;
  
  saving.value = true;
  try {
    // Convertir coma a punto y parsear
    const ajusteStr = String(stockAjuste.value).replace(',', '.');
    const ajuste = parseFloat(ajusteStr);
    
    if (isNaN(ajuste)) {
      showMessage('Por favor ingresa un número válido', 'error');
      saving.value = false;
      return;
    }
    
    const nuevoStock = Number(stockProduct.value.stock_actual || 0) + ajuste;
    
    if (nuevoStock < 0) {
      showMessage('El stock no puede ser negativo', 'error');
      saving.value = false;
      return;
    }
    
    await productosService.update(stockProduct.value.id, {
      stock_actual: nuevoStock,
    });
    showMessage(`Stock actualizado: ${nuevoStock.toFixed(2)} ${stockProduct.value.unidad}`);
    stockDialog.value = false;
    stockAjuste.value = 0;
    loadData();
  } catch (error) {
    showMessage('Error al actualizar stock', 'error');
  } finally {
    saving.value = false;
  }
};

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

// Permitir solo números, punto, coma y signo negativo
const allowDecimalInput = (event: KeyboardEvent) => {
  const char = event.key;
  const input = event.target as HTMLInputElement;
  const currentValue = input.value;
  
  // Permitir teclas de control
  if (event.ctrlKey || event.metaKey || char === 'Tab' || char === 'Backspace' || char === 'Delete' || char === 'ArrowLeft' || char === 'ArrowRight') {
    return;
  }
  
  // Permitir números
  if (char >= '0' && char <= '9') {
    return;
  }
  
  // Permitir punto o coma (solo uno)
  if ((char === '.' || char === ',') && !currentValue.includes('.') && !currentValue.includes(',')) {
    return;
  }
  
  // Permitir signo negativo solo al inicio
  if (char === '-' && currentValue.length === 0) {
    return;
  }
  
  // Bloquear cualquier otro carácter
  event.preventDefault();
};

// Formatear campo de stock: convertir coma a punto
const formatStockField = (field: 'stock_actual' | 'stock_minimo') => {
  if (formData.value[field] !== null && formData.value[field] !== undefined) {
    const value = String(formData.value[field]).replace(',', '.');
    const parsed = parseFloat(value);
    formData.value[field] = isNaN(parsed) ? null : parsed;
  }
};

const loadData = async () => {
  loading.value = true;
  try {
    console.log('[ProductosBase] Cargando datos...');
    const [productsData, categoriasData] = await Promise.all([
      productosService.getAll(),
      categoriesProductosService.getAll(),
    ]);
    console.log('[ProductosBase] Productos cargados:', productsData.length);
    console.log('[ProductosBase] Categorías cargadas:', categoriasData.length);
    products.value = productsData;
    categorias.value = categoriasData;
  } catch (error: any) {
    console.error('[ProductosBase] Error al cargar datos:', error);
    console.error('[ProductosBase] Error response:', error.response);
    showMessage('Error al cargar datos: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

const openDialog = (product?: Product) => {
  editing.value = product || null;
  formData.value = product
    ? {
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        tipo: product.tipo,
        unidad: product.unidad,
        maneja_stock: product.maneja_stock ?? true,
        costo_unitario: product.costo_unitario || 0,
        precio_venta: product.precio_venta || null,
        category_id: product.category_id || null,
        stock_actual: product.stock_actual || null,
        stock_minimo: product.stock_minimo || null,
      }
    : {
        name: '',
        description: '',
        sku: '',
        tipo: 'materia_prima',
        unidad: '',
        maneja_stock: true,
        costo_unitario: 0,
        precio_venta: null,
        category_id: null,
        stock_actual: null,
        stock_minimo: null,
      };
  dialog.value = true;
};

const save = async () => {
  if (!formData.value.name || !formData.value.unidad) {
    showMessage('Completa los campos obligatorios', 'error');
    return;
  }
  
  // Validar precio de venta para productos finales
  if (formData.value.tipo === 'final' && (!formData.value.precio_venta || formData.value.precio_venta <= 0)) {
    showMessage('El precio de venta es obligatorio para productos finales', 'error');
    return;
  }
  
  saving.value = true;
  try {
    // Preparar datos: convertir comas a puntos y parsear
    const dataToSend = {
      ...formData.value,
      // Generar SKU automáticamente si está vacío
      sku: formData.value.sku?.trim() 
        ? formData.value.sku 
        : generarSKU(formData.value.name, formData.value.tipo),
      stock_actual: formData.value.maneja_stock && formData.value.stock_actual 
        ? parseFloat(String(formData.value.stock_actual).replace(',', '.'))
        : null,
      stock_minimo: formData.value.maneja_stock && formData.value.stock_minimo
        ? parseFloat(String(formData.value.stock_minimo).replace(',', '.'))
        : null,
    };
    
    if (editing.value) {
      await productosService.update(editing.value.id, dataToSend);
      showMessage('Producto actualizado');
    } else {
      await productosService.create(dataToSend);
      showMessage('Producto creado');
    }
    dialog.value = false;
    loadData();
  } catch (error: any) {
    console.error('[ProductosBase] Error al guardar:', error);
    showMessage(error.response?.data?.message || 'Error al guardar', 'error');
  } finally {
    saving.value = false;
  }
};

const deleteProduct = async (product: Product) => {
  if (!confirm(`¿Eliminar "${product.name}"?`)) return;
  try {
    await productosService.delete(product.id);
    showMessage('Producto eliminado');
    loadData();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

const goToReceta = (product: Product) => {
  router.push({ name: 'Recetas', query: { producto: product.id } });
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.v-tabs {
  width: 100%;
}
</style>
