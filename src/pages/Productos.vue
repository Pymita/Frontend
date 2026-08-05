<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Productos del Menú</h1>
            <p class="text-body-1 text-grey-darken-1">
              Gestiona los productos disponibles para venta
            </p>
          </div>
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-plus</v-icon>
            Nuevo Producto
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card>
          <v-card-title>
            <v-row align="center">
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="search"
                  prepend-inner-icon="mdi-magnify"
                  label="Buscar producto"
                  single-line
                  hide-details
                  clearable
                  density="compact"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-select
                  v-model="filterCategoria"
                  :items="categorias"
                  item-title="name"
                  item-value="id"
                  label="Filtrar por categoría"
                  clearable
                  hide-details
                  density="compact"
                />
              </v-col>
            </v-row>
          </v-card-title>
          
          <v-data-table
            :headers="headers"
            :items="filteredItems"
            :loading="loading"
            :search="search"
            class="elevation-0"
          >
            <template #item.final_price="{ item }">
              <span class="font-weight-bold text-success">
                ${{ Number(item.final_price || 0).toFixed(2) }}
              </span>
            </template>
            <template #item.category="{ item }">
              <v-chip v-if="item.category" size="small" color="primary" variant="tonal">
                {{ item.category.name }}
              </v-chip>
            </template>
            <template #item.variant="{ item }">
              <v-chip v-if="item.variant" size="small" variant="outlined">
                {{ item.variant.name }}
              </v-chip>
            </template>
            <template #item.available="{ item }">
              <v-switch
                :model-value="item.available"
                color="success"
                hide-details
                density="compact"
                @update:model-value="toggleAvailability(item)"
              />
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" @click="openDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" @click="deleteItem(item)">
                <v-icon size="small">mdi-delete</v-icon>
              </v-btn>
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
          <v-alert type="info" density="compact" class="mb-4" variant="tonal">
            La receta se define una sola vez en el producto base y se ajusta por variante usando el multiplicador del tipo (personal, mediana, familiar, etc.).
          </v-alert>
          <v-form ref="form" @submit.prevent="save">
            <v-select
              v-model="formData.final_product_id"
              :items="menuBaseProducts"
              item-title="name"
              item-value="id"
              label="Producto base para receta *"
              :rules="[v => !!v || 'Producto base requerido']"
              required
              class="mb-2"
            />
            <v-row>
              <v-col cols="12" md="8">
                <v-text-field
                  v-model="formData.name"
                  label="Nombre del producto"
                  :rules="[v => !!v || 'Nombre requerido']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="formData.base_price"
                  label="Precio base"
                  type="number"
                  step="0.01"
                  min="0"
                  prefix="$"
                  :rules="[v => v >= 0 || 'Precio inválido']"
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
                  v-model="formData.category_id"
                  :items="categorias"
                  item-title="name"
                  item-value="id"
                  label="Categoría"
                  :rules="[v => !!v || 'Categoría requerida']"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.variant_group_id"
                  :items="gruposTipo"
                  item-title="name"
                  item-value="id"
                  label="Grupo de tipo (opcional)"
                  clearable
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.variant_id"
                  :items="availableVariants"
                  item-title="name"
                  item-value="id"
                  label="Tipo específico (opcional)"
                  clearable
                  :disabled="!formData.variant_group_id"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="formData.preparation_time"
                  label="Tiempo de preparación (min)"
                  type="number"
                  min="0"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.image_url"
                  label="URL de imagen (opcional)"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-switch
                  v-model="formData.use_automatic_price"
                  label="Calcular precio automáticamente"
                  color="primary"
                  hint="Usa multiplicadores del tipo seleccionado"
                  persistent-hint
                />
              </v-col>
            </v-row>

            <v-text-field
              v-if="!formData.use_automatic_price"
              v-model.number="formData.custom_price"
              label="Precio específico"
              type="number"
              step="0.01"
              min="0"
              prefix="$"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Guardar</v-btn>
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
import { menuItemsService, categoriesService, type MenuItem, type Category } from '@/services/menuService';
import { variantGroupsService, variantsService, type VariantGroup, type Variant } from '@/services/variantsService';
import { productsService, type Product } from '@/services/productsService';

const items = ref<MenuItem[]>([]);
const categorias = ref<Category[]>([]);
const gruposTipo = ref<VariantGroup[]>([]);
const availableVariants = ref<Variant[]>([]);
const baseProducts = ref<Product[]>([]);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const filterCategoria = ref<number | null>(null);

const dialog = ref(false);
const editing = ref<MenuItem | null>(null);

const formData = ref({
  name: '',
  description: '',
  final_product_id: null as number | null,
  base_price: 0,
  custom_price: null as number | null,
  use_automatic_price: true,
  category_id: null as number | null,
  variant_group_id: null as number | null,
  variant_id: null as number | null,
  preparation_time: null as number | null,
  image_url: '',
});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Nombre', key: 'name' },
  { title: 'Precio', key: 'final_price' },
  { title: 'Categoría', key: 'category' },
  { title: 'Tipo', key: 'variant' },
  { title: 'Disponible', key: 'available' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const filteredItems = computed(() => {
  if (!filterCategoria.value) return items.value;
  return items.value.filter(item => item.category_id === filterCategoria.value);
});

const menuBaseProducts = computed(() => {
  return baseProducts.value.filter(p => p.type === 'final' || p.type === 'intermediate');
});

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const loadData = async () => {
  loading.value = true;
  try {
    console.log('[Productos] Cargando datos...');
    const [itemsData, categoriasData, gruposData, baseProductsData] = await Promise.all([
      menuItemsService.getAll(),
      categoriesService.getAll(),
      variantGroupsService.getAll(),
      productsService.getAll(),
    ]);
    console.log('[Productos] Items cargados:', itemsData.length);
    console.log('[Productos] Categorías cargadas:', categoriasData);
    console.log('[Productos] Grupos de tipo cargados:', gruposData.length);
    items.value = itemsData;
    categorias.value = categoriasData;
    gruposTipo.value = gruposData;
    baseProducts.value = baseProductsData;
  } catch (error: any) {
    console.error('[Productos] Error al cargar datos:', error);
    showMessage('Error al cargar datos: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

watch(() => formData.value.variant_group_id, async (grupoId) => {
  try {
    if (grupoId) {
      availableVariants.value = await variantsService.getAll(grupoId);
    } else {
      availableVariants.value = [];
      formData.value.variant_id = null;
    }
  } catch (error) {
    console.error('[Productos] Error al cargar tipos:', error);
    availableVariants.value = [];
  }
});

const openDialog = (item?: MenuItem) => {
  console.log('[Productos] Abriendo diálogo con item:', item);
  console.log('[Productos] Categorías disponibles:', categorias.value);
  
  editing.value = item || null;
  formData.value = item
    ? {
        name: item.name,
        description: item.description || '',
        final_product_id: item.final_product_id || item.final_product?.id || null,
        base_price: item.base_price,
        custom_price: item.custom_price || null,
        use_automatic_price: item.use_automatic_price,
        category_id: item.category_id || (item.category as any)?.id || null,
        variant_group_id: item.variant_group_id || (item.variant_group as any)?.id || null,
        variant_id: item.variant_id || (item.variant as any)?.id || null,
        preparation_time: item.preparation_time || null,
        image_url: item.image_url || '',
      }
    : {
        name: '',
        description: '',
        final_product_id: null,
        base_price: 0,
        custom_price: null,
        use_automatic_price: true,
        category_id: null,
        variant_group_id: null,
        variant_id: null,
        preparation_time: null,
        image_url: '',
      };
  
  console.log('[Productos] FormData después de asignar:', formData.value);
  dialog.value = true;
};

const save = async () => {
  console.log('[Productos] Intentando guardar:', formData.value);
  
  if (!formData.value.name || !formData.value.category_id || !formData.value.final_product_id) {
    console.log('[Productos] Validación fallida:', {
      name: formData.value.name,
      final_product_id: formData.value.final_product_id,
      category_id: formData.value.category_id
    });
    showMessage('Completa producto base, nombre y categoría', 'error');
    return;
  }
  
  saving.value = true;
  try {
    if (editing.value) {
      console.log('[Productos] Actualizando producto:', editing.value.id);
      await menuItemsService.update(editing.value.id, formData.value);
      showMessage('Producto actualizado');
    } else {
      console.log('[Productos] Creando nuevo producto');
      await menuItemsService.create(formData.value);
      showMessage('Producto creado');
    }
    dialog.value = false;
    loadData();
  } catch (error: any) {
    console.error('[Productos] Error al guardar:', error);
    console.error('[Productos] Error response:', error.response?.data);
    showMessage('Error al guardar: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    saving.value = false;
  }
};

const deleteItem = async (item: MenuItem) => {
  if (!confirm(`¿Eliminar "${item.name}"?`)) return;
  try {
    await menuItemsService.delete(item.id);
    showMessage('Producto eliminado');
    loadData();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

const toggleAvailability = async (item: MenuItem) => {
  try {
    await menuItemsService.toggleAvailability(item.id);
    item.available = !item.available;
    showMessage(item.available ? 'Producto disponible' : 'Producto no disponible');
  } catch (error) {
    showMessage('Error al cambiar disponibilidad', 'error');
  }
};

onMounted(() => {
  loadData();
});
</script>


