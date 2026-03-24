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
            <template #item.precio="{ item }">
              <span class="font-weight-bold text-success">
                ${{ Number(item.precio || 0).toFixed(2) }}
              </span>
            </template>
            <template #item.category="{ item }">
              <v-chip v-if="item.category" size="small" color="primary" variant="tonal">
                {{ item.category.name }}
              </v-chip>
            </template>
            <template #item.tipo="{ item }">
              <v-chip v-if="item.tipo" size="small" variant="outlined">
                {{ item.tipo.nombre }}
              </v-chip>
            </template>
            <template #item.disponible="{ item }">
              <v-switch
                :model-value="item.disponible"
                color="success"
                hide-details
                density="compact"
                @update:model-value="toggleDisponibilidad(item)"
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
              v-model="formData.producto_final_id"
              :items="productosParaMenu"
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
                  v-model="formData.nombre"
                  label="Nombre del producto"
                  :rules="[v => !!v || 'Nombre requerido']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="formData.precio_base"
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
              v-model="formData.descripcion"
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
                  v-model="formData.grupo_tipo_id"
                  :items="gruposTipo"
                  item-title="nombre"
                  item-value="id"
                  label="Grupo de tipo (opcional)"
                  clearable
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-select
                  v-model="formData.tipo_id"
                  :items="tiposDisponibles"
                  item-title="nombre"
                  item-value="id"
                  label="Tipo específico (opcional)"
                  clearable
                  :disabled="!formData.grupo_tipo_id"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="formData.tiempo_preparacion"
                  label="Tiempo de preparación (min)"
                  type="number"
                  min="0"
                />
              </v-col>
            </v-row>

            <v-row>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.imagen_url"
                  label="URL de imagen (opcional)"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-switch
                  v-model="formData.usar_precio_automatico"
                  label="Calcular precio automáticamente"
                  color="primary"
                  hint="Usa multiplicadores del tipo seleccionado"
                  persistent-hint
                />
              </v-col>
            </v-row>

            <v-text-field
              v-if="!formData.usar_precio_automatico"
              v-model.number="formData.precio_especifico"
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
import { itemsMenuService, categoriesService, type ItemMenu, type Category } from '@/services/menuService';
import { grupoTiposService, tiposService, type GrupoTipo, type Tipo } from '@/services/tiposService';
import { productosService, type Product } from '@/services/productosService';

const items = ref<ItemMenu[]>([]);
const categorias = ref<Category[]>([]);
const gruposTipo = ref<GrupoTipo[]>([]);
const tiposDisponibles = ref<Tipo[]>([]);
const productosBase = ref<Product[]>([]);
const loading = ref(true);
const saving = ref(false);
const search = ref('');
const filterCategoria = ref<number | null>(null);

const dialog = ref(false);
const editing = ref<ItemMenu | null>(null);

const formData = ref({
  nombre: '',
  descripcion: '',
  producto_final_id: null as number | null,
  precio_base: 0,
  precio_especifico: null as number | null,
  usar_precio_automatico: true,
  category_id: null as number | null,
  grupo_tipo_id: null as number | null,
  tipo_id: null as number | null,
  tiempo_preparacion: null as number | null,
  imagen_url: '',
});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Nombre', key: 'nombre' },
  { title: 'Precio', key: 'precio' },
  { title: 'Categoría', key: 'category' },
  { title: 'Tipo', key: 'tipo' },
  { title: 'Disponible', key: 'disponible' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const filteredItems = computed(() => {
  if (!filterCategoria.value) return items.value;
  return items.value.filter(item => item.category_id === filterCategoria.value);
});

const productosParaMenu = computed(() => {
  return productosBase.value.filter(p => p.tipo === 'final' || p.tipo === 'intermedio');
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
    const [itemsData, categoriasData, gruposData, productosData] = await Promise.all([
      itemsMenuService.getAll(),
      categoriesService.getAll(),
      grupoTiposService.getAll(),
      productosService.getAll(),
    ]);
    console.log('[Productos] Items cargados:', itemsData.length);
    console.log('[Productos] Categorías cargadas:', categoriasData);
    console.log('[Productos] Grupos de tipo cargados:', gruposData.length);
    items.value = itemsData;
    categorias.value = categoriasData;
    gruposTipo.value = gruposData;
    productosBase.value = productosData;
  } catch (error: any) {
    console.error('[Productos] Error al cargar datos:', error);
    showMessage('Error al cargar datos: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

watch(() => formData.value.grupo_tipo_id, async (grupoId) => {
  try {
    if (grupoId) {
      tiposDisponibles.value = await tiposService.getAll(grupoId);
    } else {
      tiposDisponibles.value = [];
      formData.value.tipo_id = null;
    }
  } catch (error) {
    console.error('[Productos] Error al cargar tipos:', error);
    tiposDisponibles.value = [];
  }
});

const openDialog = (item?: ItemMenu) => {
  console.log('[Productos] Abriendo diálogo con item:', item);
  console.log('[Productos] Categorías disponibles:', categorias.value);
  
  editing.value = item || null;
  formData.value = item
    ? {
        nombre: item.nombre,
        descripcion: item.descripcion || '',
        producto_final_id: item.producto_final_id || item.producto_final?.id || null,
        precio_base: item.precio_base,
        precio_especifico: item.precio_especifico || null,
        usar_precio_automatico: item.usar_precio_automatico,
        category_id: item.category_id || (item.category as any)?.id || null,
        grupo_tipo_id: item.grupo_tipo_id || (item.grupoTipo as any)?.id || null,
        tipo_id: item.tipo_id || (item.tipo as any)?.id || null,
        tiempo_preparacion: item.tiempo_preparacion || null,
        imagen_url: item.imagen_url || '',
      }
    : {
        nombre: '',
        descripcion: '',
        producto_final_id: null,
        precio_base: 0,
        precio_especifico: null,
        usar_precio_automatico: true,
        category_id: null,
        grupo_tipo_id: null,
        tipo_id: null,
        tiempo_preparacion: null,
        imagen_url: '',
      };
  
  console.log('[Productos] FormData después de asignar:', formData.value);
  dialog.value = true;
};

const save = async () => {
  console.log('[Productos] Intentando guardar:', formData.value);
  
  if (!formData.value.nombre || !formData.value.category_id || !formData.value.producto_final_id) {
    console.log('[Productos] Validación fallida:', {
      nombre: formData.value.nombre,
      producto_final_id: formData.value.producto_final_id,
      category_id: formData.value.category_id
    });
    showMessage('Completa producto base, nombre y categoría', 'error');
    return;
  }
  
  saving.value = true;
  try {
    if (editing.value) {
      console.log('[Productos] Actualizando producto:', editing.value.id);
      await itemsMenuService.update(editing.value.id, formData.value);
      showMessage('Producto actualizado');
    } else {
      console.log('[Productos] Creando nuevo producto');
      await itemsMenuService.create(formData.value);
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

const deleteItem = async (item: ItemMenu) => {
  if (!confirm(`¿Eliminar "${item.nombre}"?`)) return;
  try {
    await itemsMenuService.delete(item.id);
    showMessage('Producto eliminado');
    loadData();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

const toggleDisponibilidad = async (item: ItemMenu) => {
  try {
    await itemsMenuService.toggleDisponibilidad(item.id);
    item.disponible = !item.disponible;
    showMessage(item.disponible ? 'Producto disponible' : 'Producto no disponible');
  } catch (error) {
    showMessage('Error al cambiar disponibilidad', 'error');
  }
};

onMounted(() => {
  loadData();
});
</script>


