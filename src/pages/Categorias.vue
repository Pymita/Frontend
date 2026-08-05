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
            <template #item.products_count="{ item }">
              <v-chip size="small" color="primary" variant="tonal">
                {{ getProductCount(item) }} productos
              </v-chip>
            </template>
            <template #item.visible_in_app="{ item }">
              <v-chip :color="item.visible_in_app ? 'success' : 'grey'" size="small">
                {{ item.visible_in_app ? 'Visible' : 'Oculta' }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
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

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { categoriesService, menuItemsService, type Category, type MenuItem } from '@/services/menuService';

const categorias = ref<Category[]>([]);
const itemsMenu = ref<MenuItem[]>([]);
const loading = ref(true);
const saving = ref(false);

const dialog = ref(false);
const editing = ref<Category | null>(null);

const formData = ref({
  name: '',
  description: '',
  visible_in_app: true,
});

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
    showMessage('Error al cargar datos: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

const openDialog = (categoria?: Category) => {
  editing.value = categoria || null;
  formData.value = categoria
    ? {
        name: categoria.name,
        description: categoria.description || '',
        visible_in_app: categoria.visible_in_app ?? true,
      }
    : {
        name: '',
        description: '',
        visible_in_app: true,
      };
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editing.value = null;
  formData.value = {
    name: '',
    description: '',
    visible_in_app: true,
  };
};

const save = async () => {
  if (!formData.value.name) {
    showMessage('Completa el nombre de la categoría', 'error');
    return;
  }
  
  saving.value = true;
  try {
    if (editing.value) {
      await categoriesService.update(editing.value.id, formData.value);
      showMessage('Categoría actualizada');
    } else {
      await categoriesService.create(formData.value);
      showMessage('Categoría creada');
    }
    
    closeDialog();
    loadData();
  } catch (error: any) {
    console.error('[Categorias] Error al guardar:', error);
    showMessage('Error al guardar: ' + (error.response?.data?.message || error.message), 'error');
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
    showMessage('Error al eliminar: ' + (error.response?.data?.message || error.message), 'error');
  }
};

onMounted(() => {
  loadData();
});
</script>
