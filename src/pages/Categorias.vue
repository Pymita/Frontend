<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Categorías</h1>
            <p class="text-body-1 text-grey-darken-1">
              Gestiona las categorías del menú (aparecen en la app móvil)
            </p>
          </div>
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-plus</v-icon>
            Nueva Categoría
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="categorias"
            :loading="loading"
            class="elevation-0"
          >
            <template #item.name="{ item }">
              <span :style="{ paddingLeft: `${((item.depth ?? 1) - 1) * 24}px` }">
                <span v-if="(item.depth ?? 1) > 1" class="text-grey mr-1">└</span>
                <v-avatar v-if="item.image_url" size="24" rounded="sm" class="mr-1">
                  <v-img :src="resolveImageUrl(item.image_url)" cover />
                </v-avatar>
                <span v-else-if="item.icon" class="mr-1">{{ item.icon }}</span>
                {{ item.name }}
              </span>
            </template>
            <template #item.products_count="{ item }">
              <v-chip size="small" color="primary" variant="tonal">
                {{ getProductCount(item) }} productos
              </v-chip>
            </template>
            <template #item.visible_in_app="{ item }">
              <v-chip :color="item.visible_effective ? 'success' : 'grey'" size="small">
                {{ item.visible_effective ? 'Visible' : 'Oculta' }}
              </v-chip>
              <v-tooltip
                v-if="item.visible_in_app && !item.visible_effective"
                text="Está oculta porque una categoría superior lo está"
              >
                <template #activator="{ props }">
                  <v-icon v-bind="props" size="x-small" class="ml-1">mdi-information-outline</v-icon>
                </template>
              </v-tooltip>
            </template>
            <template #item.actions="{ item }">
              <v-tooltip text="Agregar subcategoría">
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    icon
                    size="small"
                    variant="text"
                    :disabled="(item.depth ?? 1) >= 3"
                    @click="openDialog(undefined, item.id)"
                  >
                    <v-icon size="small">mdi-file-tree</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              <v-btn icon size="small" variant="text" @click="openDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" @click="deleteCategoria(item)">
                <v-icon size="small">mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Categoría -->
    <v-dialog v-model="dialog" max-width="600" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Editar Categoría' : 'Nueva Categoría' }}</v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent="save">
            <v-text-field
              v-model="formData.name"
              label="Nombre de la categoría"
              :rules="[v => !!v || 'Nombre requerido']"
              required
              hint="Ej: Pizzería, Panadería, Bebidas, Postres"
              persistent-hint
            />

            <v-select
              v-model="formData.parent_id"
              :items="parentOptions"
              item-title="path"
              item-value="id"
              label="Categoría superior"
              clearable
              class="mt-4"
              hint="Déjala vacía para una categoría principal, o elígela para anidarla (ej. Cervezas dentro de Bebidas)"
              persistent-hint
            />

            <v-divider class="my-4" />

            <EmojiPicker v-model="formData.icon" label="Emoji de la categoría" />

            <div class="mt-4">
              <ImageUploader
                v-model="formData.image_url"
                folder="categories"
                label="Imagen (opcional, reemplaza al emoji)"
              />
            </div>
            
            <v-textarea
              v-model="formData.description"
              label="Descripción"
              rows="3"
              class="mt-4"
              hint="Descripción opcional que aparecerá en el sistema"
            />

            <v-switch
              v-model="formData.visible_in_app"
              label="Visible en app móvil"
              color="primary"
              class="mt-4"
              :true-value="true"
              :false-value="false"
            >
              <template #label>
                <div>
                  <div class="font-weight-bold">Visible en app móvil</div>
                  <div class="text-caption text-grey">
                    Si está desactivada, esta categoría no aparecerá en la aplicación móvil de pedidos
                  </div>
                </div>
              </template>
            </v-switch>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="snackbarColor === 'error' ? 9000 : 3000" closable>
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { errorMessage } from '@/utils/errors';
import { computed, ref, onMounted } from 'vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import ImageUploader from '@/components/ImageUploader.vue';
import { categoriesService, menuItemsService, type Category, type MenuItem } from '@/services/menuService';
import { resolveImageUrl } from '@/utils/images';

const categorias = ref<Category[]>([]);
const itemsMenu = ref<MenuItem[]>([]);
const loading = ref(true);
const saving = ref(false);

const dialog = ref(false);
const editing = ref<Category | null>(null);

const emptyForm = () => ({
  name: '',
  description: '',
  parent_id: null as number | null,
  icon: null as string | null,
  image_url: null as string | null,
  visible_in_app: true,
});

const formData = ref(emptyForm());

// Opciones de categoría superior: no puede ser ella misma, su propia rama
// ni una del último nivel permitido.
const parentOptions = computed(() =>
  categorias.value.filter((c) => {
    if (editing.value && (c.id === editing.value.id || c.path?.startsWith(`${editing.value.path} ›`))) {
      return false;
    }
    return (c.depth ?? 1) < 3;
  }),
);

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Nombre', key: 'name' },
  { title: 'Descripción', key: 'description' },
  { title: 'Productos', key: 'products_count' },
  { title: 'App Móvil', key: 'visible_in_app' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const getProductCount = (categoria: Category): number => {
  return itemsMenu.value.filter(item => item.category_id === categoria.id).length;
};

const loadData = async () => {
  loading.value = true;
  try {
    console.log('[Categorias] Cargando datos...');
    const [categoriasData, itemsData] = await Promise.all([
      categoriesService.getAll(),
      menuItemsService.getAll(),
    ]);
    console.log('[Categorias] Categorías cargadas:', categoriasData.length);
    categorias.value = categoriasData;
    itemsMenu.value = itemsData;
  } catch (error: any) {
    console.error('[Categorias] Error al cargar datos:', error);
    showMessage(errorMessage(error, 'Error al cargar datos: ') + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

const openDialog = (categoria?: Category, parentId: number | null = null) => {
  editing.value = categoria || null;
  formData.value = categoria
    ? {
        name: categoria.name,
        description: categoria.description || '',
        parent_id: categoria.parent_id ?? null,
        icon: categoria.icon || null,
        image_url: categoria.image_url || null,
        visible_in_app: categoria.visible_in_app ?? true,
      }
    : { ...emptyForm(), parent_id: parentId };
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editing.value = null;
  formData.value = emptyForm();
};

const save = async () => {
  if (!formData.value.name) {
    showMessage('Completa el nombre de la categoría', 'error');
    return;
  }
  
  saving.value = true;
  try {
    const payload = {
      ...formData.value,
      icon: formData.value.icon || null,
      image_url: formData.value.image_url || null,
    };

    if (editing.value) {
      await categoriesService.update(editing.value.id, payload);
      showMessage('Categoría actualizada');
    } else {
      await categoriesService.create(payload);
      showMessage('Categoría creada');
    }
    
    closeDialog();
    loadData();
  } catch (error: any) {
    console.error('[Categorias] Error al guardar:', error);
    showMessage(errorMessage(error, 'Error al guardar: ') + (error.response?.data?.message || error.message), 'error');
  } finally {
    saving.value = false;
  }
};

const deleteCategoria = async (categoria: Category) => {
  const productCount = getProductCount(categoria);
  
  if (productCount > 0) {
    if (!confirm(`Esta categoría tiene ${productCount} producto(s). ¿Estás seguro de eliminarla? Los productos quedarán sin categoría.`)) {
      return;
    }
  } else {
    if (!confirm(`¿Eliminar la categoría "${categoria.name}"?`)) {
      return;
    }
  }
  
  try {
    await categoriesService.delete(categoria.id);
    showMessage('Categoría eliminada');
    loadData();
  } catch (error: any) {
    console.error('[Categorias] Error al eliminar:', error);
    showMessage(errorMessage(error, 'Error al eliminar: ') + (error.response?.data?.message || error.message), 'error');
  }
};

onMounted(() => {
  loadData();
});
</script>
