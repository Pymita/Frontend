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
                  <v-tab value="raw_material">Materias Primas</v-tab>
                  <v-tab value="intermediate">Intermedios</v-tab>
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
              <v-col cols="12" md="2">
                <v-select
                  v-model="menuFilter"
                  :items="menuFilterOptions"
                  label="Menú"
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
            <template #item.type="{ item }">
              <v-chip :color="getTipoColor(item.type)" size="small">
                {{ getTipoLabel(item.type) }}
              </v-chip>
            </template>
            <template #item.current_stock="{ item }">
              <span v-if="item.tracks_stock === false" class="text-grey">No aplica</span>
              <div v-else-if="item.current_stock !== null && item.current_stock !== undefined">
                <v-chip 
                  :color="getStockColor(item)" 
                  size="small"
                  @click="openStockDialog(item)"
                  style="cursor: pointer"
                >
                  {{ item.current_stock }} {{ item.unit }}
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
            <template #item.minimum_stock="{ item }">
              <span v-if="item.tracks_stock === false" class="text-grey">No aplica</span>
              <span v-else-if="item.minimum_stock">
                {{ item.minimum_stock }} {{ item.unit }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.unit_cost="{ item }">
              <span v-if="item.unit_cost" class="font-weight-bold">
                ${{ Number(item.unit_cost).toFixed(2) }}/{{ item.unit }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.sale_price="{ item }">
              <span v-if="item.sale_price" class="font-weight-bold text-success">
                ${{ Number(item.sale_price).toLocaleString('es-CO') }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.estimated_cost="{ item }">
              <span v-if="item.estimated_cost" class="text-success">
                ${{ Number(item.estimated_cost).toFixed(2) }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.category="{ item }">
              <v-chip v-if="item.category" size="small" variant="tonal">
                {{ item.category.name }}
              </v-chip>
            </template>
            <template #item.in_menu="{ item }">
              <v-tooltip
                v-if="item.in_menu && item.menu_item"
                :text="item.menu_item.available ? 'Clic para ocultarlo del menú' : 'Clic para mostrarlo en el menú'"
              >
                <template #activator="{ props }">
                  <v-chip
                    v-bind="props"
                    :color="item.menu_item.available ? 'green' : 'grey'"
                    size="small"
                    style="cursor: pointer"
                    @click="toggleMenuAvailability(item)"
                  >
                    {{ item.menu_item.available ? 'En el menú' : 'Oculto' }}
                  </v-chip>
                </template>
              </v-tooltip>
              <v-btn
                v-else-if="item.type === 'final'"
                size="small"
                variant="text"
                color="primary"
                @click="openDialog(item, true)"
              >
                Añadir al menú
              </v-btn>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.actions="{ item }">
              <v-tooltip v-if="item.type !== 'raw_material'" text="Gestionar receta">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    color="info"
                    @click="goToRecipe(item)"
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
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="formData.sku"
                  label="SKU (opcional)"
                  :hint="!formData.sku?.trim() ? `Se generará: ${skuPreview}` : 'Código interno del producto'"
                  persistent-hint
                  placeholder="Automático"
                />
              </v-col>
              <v-col cols="12" md="2">
                <v-text-field
                  v-model="formData.barcode"
                  label="Código de barras"
                  hint="Escanéalo o escríbelo"
                  persistent-hint
                  placeholder="Opcional"
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
                  v-model="formData.type"
                  :items="productTypeOptions"
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
                  v-model="formData.unit"
                  label="Unidad de medida *"
                  hint="Ej: kg, litros, unidad, gramos"
                  persistent-hint
                  :rules="[v => !!v || 'Unidad requerida']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-if="formData.type === 'raw_material'"
                  v-model.number="formData.unit_cost"
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
                  v-if="formData.type === 'final'"
                  v-model.number="formData.sale_price"
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
              v-model="formData.tracks_stock"
              color="primary"
              inset
              label="Este producto maneja stock e inventario"
              hint="Desactívalo para productos de receta bajo demanda (ej: pizza) que no quieres en reportes de stock"
              persistent-hint
              class="mb-2"
            />
            
            <v-row v-if="formData.tracks_stock">
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.current_stock"
                  label="Stock actual"
                  type="text"
                  inputmode="decimal"
                  :suffix="formData.unit || ''"
                  @blur="formatStockField('current_stock')"
                  @keypress="allowDecimalInput"
                  hint="Ej: 10,5 o 10.5"
                  persistent-hint
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.minimum_stock"
                  label="Stock mínimo (alerta)"
                  type="text"
                  inputmode="decimal"
                  :suffix="formData.unit || ''"
                  @blur="formatStockField('minimum_stock')"
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

            <v-alert v-if="formData.type === 'intermediate'" type="info" density="compact" class="mt-2">
              <strong>Producto Intermedio:</strong> El costo de este producto se calculará automáticamente desde su receta
            </v-alert>

            <template v-if="formData.type === 'final'">
              <v-divider class="my-4" />
              <h4 class="mb-3">Menú</h4>

              <v-switch
                v-model="publishToMenu"
                color="primary"
                inset
                label="Publicar en el menú de venta"
                :hint="editing?.in_menu
                  ? 'Este producto está en el menú; apágalo para retirarlo de la venta'
                  : 'Crea el ítem del menú de una vez, visible en la app y en Pedidos'"
                persistent-hint
                class="mb-2"
              />

              <v-row v-if="publishToMenu">
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="menuForm.base_price"
                    label="Precio en el menú"
                    type="number"
                    step="100"
                    min="0"
                    prefix="$"
                    :hint="`Si lo dejas vacío se usa el precio de venta ($${formData.sale_price || 0})`"
                    persistent-hint
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-select
                    v-model="menuForm.variant_group_id"
                    :items="variantGroups"
                    item-title="name"
                    item-value="id"
                    label="Grupo de variantes (opcional)"
                    hint="Ej: tamaños de pizza, tipos de pan"
                    persistent-hint
                    clearable
                  />
                </v-col>
                <v-col cols="12" md="4">
                  <v-text-field
                    v-model.number="menuForm.preparation_time"
                    label="Tiempo de preparación (min)"
                    type="number"
                    min="0"
                  />
                </v-col>
              </v-row>
            </template>
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
            :type="getStockAlertType(stockProduct)"
            density="compact"
            class="mb-4"
          >
            <div class="d-flex justify-space-between align-center">
              <span>Stock actual:</span>
              <span class="text-h6">
                {{ stockProduct.current_stock || 0 }} {{ stockProduct.unit }}
              </span>
            </div>
            <div v-if="stockProduct.minimum_stock" class="d-flex justify-space-between align-center mt-2">
              <span>Stock mínimo:</span>
              <span>{{ stockProduct.minimum_stock }} {{ stockProduct.unit }}</span>
            </div>
          </v-alert>

          <v-row>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="stockAjuste"
                label="Ajuste"
                type="text"
                inputmode="decimal"
                :suffix="stockProduct.unit"
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
                  {{ calcularNuevoStock.toFixed(2) }} {{ stockProduct.unit }}
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
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { productsService, productCategoriesService, type Product, type Category, type ProductPayload } from '@/services/productsService';
import { menuItemsService } from '@/services/menuService';
import { variantGroupsService, type VariantGroup } from '@/services/variantsService';
import { productTypeLabels, label } from '@/utils/labels';

const router = useRouter();

const products = ref<Product[]>([]);
const categorias = ref<Category[]>([]);
const variantGroups = ref<VariantGroup[]>([]);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const tipoFilter = ref('');
const filterCategoria = ref<number | null>(null);
const menuFilter = ref<'in_menu' | 'not_in_menu' | null>(null);

const menuFilterOptions = [
  { title: 'En el menú', value: 'in_menu' },
  { title: 'Sin publicar', value: 'not_in_menu' },
];

const dialog = ref(false);
const editing = ref<Product | null>(null);
const publishToMenu = ref(false);

const menuForm = ref({
  base_price: null as number | null,
  variant_group_id: null as number | null,
  preparation_time: null as number | null,
});

const formData = ref({
  name: '',
  description: '',
  sku: '',
  barcode: '',
  type: 'raw_material' as 'raw_material' | 'intermediate' | 'final',
  unit: '',
  tracks_stock: true,
  unit_cost: 0,
  sale_price: null as number | null,
  category_id: null as number | null,
  current_stock: null as string | number | null,
  minimum_stock: null as string | number | null,
});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const productTypeOptions = [
  { title: 'Materia Prima', value: 'raw_material' },
  { title: 'Producto Intermedio', value: 'intermediate' },
  { title: 'Producto Final', value: 'final' },
];

const headers = [
  { title: 'SKU', key: 'sku' },
  { title: 'Cód. barras', key: 'barcode' },
  { title: 'Nombre', key: 'name' },
  { title: 'Tipo', key: 'type' },
  { title: 'Stock Actual', key: 'current_stock' },
  { title: 'Stock Mínimo', key: 'minimum_stock' },
  { title: 'Unidad', key: 'unit' },
  { title: 'Costo Unitario', key: 'unit_cost' },
  { title: 'Precio Venta', key: 'sale_price' },
  { title: 'Costo Estimado', key: 'estimated_cost' },
  { title: 'Categoría', key: 'category' },
  { title: 'Menú', key: 'in_menu', sortable: false },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const filteredProducts = computed(() => {
  let filtered = products.value;
  
  if (tipoFilter.value) {
    filtered = filtered.filter(p => p.type === tipoFilter.value);
  }
  
  if (filterCategoria.value) {
    filtered = filtered.filter(p => p.category_id === filterCategoria.value);
  }

  if (menuFilter.value === 'in_menu') {
    filtered = filtered.filter(p => p.in_menu);
  } else if (menuFilter.value === 'not_in_menu') {
    filtered = filtered.filter(p => !p.in_menu);
  }

  return filtered;
});

const getTipoColor = (tipo: string) => {
  const colors: Record<string, string> = {
    raw_material: 'blue',
    intermediate: 'orange',
    final: 'green',
  };
  return colors[tipo] || 'grey';
};

const getTipoLabel = (tipo: string) => label(productTypeLabels, tipo);

const getStockAlertType = (product: Product): 'success' | 'error' | 'warning' | 'info' => {
  const color = getStockColor(product);
  return color === 'grey' ? 'info' : color;
};

const getStockColor = (product: Product) => {
  if (product.tracks_stock === false) return 'grey';
  if (!product.current_stock || !product.minimum_stock) return 'grey';
  if (product.current_stock <= product.minimum_stock) return 'error';
  if (product.current_stock <= product.minimum_stock * 1.5) return 'warning';
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
  
  return Number(stockProduct.value.current_stock || 0) + ajusteValido;
});

// Función para generar SKU automáticamente
// El backend genera SKUs secuenciales por empresa (MP-0001, FIN-0001...).
const skuPreview = computed(() => {
  const prefijo =
    formData.value.type === 'raw_material' ? 'MP'
    : formData.value.type === 'intermediate' ? 'INT'
    : 'FIN';
  return `${prefijo}-000N`;
});

const openStockDialog = (product: Product) => {
  if (product.tracks_stock === false) {
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
    
    const nuevoStock = Number(stockProduct.value.current_stock || 0) + ajuste;
    
    if (nuevoStock < 0) {
      showMessage('El stock no puede ser negativo', 'error');
      saving.value = false;
      return;
    }
    
    await productsService.update(stockProduct.value.id, {
      current_stock: nuevoStock,
    });
    showMessage(`Stock actualizado: ${nuevoStock.toFixed(2)} ${stockProduct.value.unit}`);
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
const formatStockField = (field: 'current_stock' | 'minimum_stock') => {
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
    const [productsData, categoriasData, groupsData] = await Promise.all([
      productsService.getAll(),
      productCategoriesService.getAll(),
      variantGroupsService.getAll(),
    ]);
    console.log('[ProductosBase] Productos cargados:', productsData.length);
    console.log('[ProductosBase] Categorías cargadas:', categoriasData.length);
    products.value = productsData;
    categorias.value = categoriasData;
    variantGroups.value = groupsData;
  } catch (error: any) {
    console.error('[ProductosBase] Error al cargar datos:', error);
    console.error('[ProductosBase] Error response:', error.response);
    showMessage('Error al cargar datos: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

const openDialog = (product?: Product, forceMenu = false) => {
  editing.value = product || null;
  publishToMenu.value = forceMenu || !!product?.in_menu;
  menuForm.value = {
    base_price: product?.menu_item?.base_price ?? null,
    variant_group_id: product?.menu_item?.variant_group_id ?? null,
    preparation_time: product?.menu_item?.preparation_time ?? null,
  };
  formData.value = product
    ? {
        name: product.name,
        description: product.description || '',
        sku: product.sku,
        barcode: product.barcode || '',
        type: product.type,
        unit: product.unit,
        tracks_stock: product.tracks_stock ?? true,
        unit_cost: product.unit_cost || 0,
        sale_price: product.sale_price || null,
        category_id: product.category_id || null,
        current_stock: product.current_stock || null,
        minimum_stock: product.minimum_stock || null,
      }
    : {
        name: '',
        description: '',
        sku: '',
        barcode: '',
        type: 'raw_material',
        unit: '',
        tracks_stock: true,
        unit_cost: 0,
        sale_price: null,
        category_id: null,
        current_stock: null,
        minimum_stock: null,
      };
  dialog.value = true;
};

const save = async () => {
  if (!formData.value.name || !formData.value.unit) {
    showMessage('Completa los campos obligatorios', 'error');
    return;
  }
  
  // Validar precio de venta para productos finales
  if (formData.value.type === 'final' && (!formData.value.sale_price || formData.value.sale_price <= 0)) {
    showMessage('El precio de venta es obligatorio para productos finales', 'error');
    return;
  }
  
  saving.value = true;
  try {
    // Preparar datos: convertir comas a puntos y parsear
    const dataToSend: ProductPayload = {
      ...formData.value,
      // Publicación en el menú (solo productos finales, opcional)
      ...(formData.value.type === 'final' && publishToMenu.value
        ? {
            menu: {
              base_price: menuForm.value.base_price ?? formData.value.sale_price,
              variant_group_id: menuForm.value.variant_group_id,
              preparation_time: menuForm.value.preparation_time,
            },
          }
        : {}),
      // SKU vacío: lo genera el backend (secuencial por empresa).
      sku: formData.value.sku?.trim() || undefined,
      barcode: formData.value.barcode?.trim() || null,
      current_stock: formData.value.tracks_stock && formData.value.current_stock
        ? parseFloat(String(formData.value.current_stock).replace(',', '.'))
        : null,
      minimum_stock: formData.value.tracks_stock && formData.value.minimum_stock
        ? parseFloat(String(formData.value.minimum_stock).replace(',', '.'))
        : null,
    };
    
    // Apagar el switch en un producto publicado lo retira del menú.
    const unpublishing =
      editing.value?.in_menu &&
      editing.value.menu_item &&
      formData.value.type === 'final' &&
      !publishToMenu.value;

    if (unpublishing && !confirm(`"${formData.value.name}" saldrá del menú de venta. ¿Continuar?`)) {
      saving.value = false;
      return;
    }

    if (editing.value) {
      await productsService.update(editing.value.id, dataToSend);
      if (unpublishing && editing.value.menu_item) {
        await menuItemsService.delete(editing.value.menu_item.id);
        showMessage('Producto actualizado y retirado del menú');
      } else {
        showMessage('Producto actualizado');
      }
    } else {
      await productsService.create(dataToSend);
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
    await productsService.delete(product.id);
    showMessage('Producto eliminado');
    loadData();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

const goToRecipe = (product: Product) => {
  router.push({ name: 'Recetas', query: { product: product.id } });
};

const toggleMenuAvailability = async (product: Product) => {
  if (!product.menu_item) return;
  try {
    const updated = await menuItemsService.toggleAvailability(product.menu_item.id);
    product.menu_item.available = updated.available;
    showMessage(updated.available ? 'Visible en el menú' : 'Oculto del menú');
  } catch {
    showMessage('No se pudo cambiar la disponibilidad', 'error');
  }
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
