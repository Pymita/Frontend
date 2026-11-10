<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Categorías</h1>
            <p class="text-body-1 text-medium-emphasis">
              Gestiona las categorías del menú (aparecen en la app móvil)
            </p>
          </div>
          <LockableButton icon="mdi-plus" color="primary" size="large" @click="openDialog()">
            Nueva categoría
          </LockableButton>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-card>
          <!--
            The whole tree by default: a new category goes last (the menu's
            order), and pages would hide it and split branches from their parent.
          -->
          <v-data-table
            :headers="headers"
            :items="categorias"
            :loading="loading"
            :items-per-page="-1"
            class="elevation-0"
          >
            <template #item.name="{ item }">
              <span :style="{ paddingLeft: `${((item.depth ?? 1) - 1) * 24}px` }">
                <span v-if="(item.depth ?? 1) > 1" class="text-medium-emphasis mr-1">└</span>
                <v-avatar v-if="item.image_url" size="24" rounded="sm" class="mr-1">
                  <v-img :src="resolveImageUrl(item.image_url)" cover />
                </v-avatar>
                <span v-else-if="item.icon" class="mr-1">{{ item.icon }}</span>
                {{ item.name }}
              </span>
            </template>
            <template #item.products_count="{ item }">
              <v-chip size="small" color="primary" variant="tonal">
                {{ productsLabel(getProductCount(item)) }}
              </v-chip>
            </template>
            <template #item.visible_in_app="{ item }">
              <v-chip :color="item.visible_effective ? 'success' : 'secondary'" size="small">
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
                    aria-label="Agregar subcategoría"
                    size="small"
                    variant="text"
                    :disabled="(item.depth ?? 1) >= 3"
                    @click="openDialog(undefined, item.id)"
                  >
                    <v-icon size="small">mdi-file-tree</v-icon>
                  </v-btn>
                </template>
              </v-tooltip>
              <v-btn icon size="small" variant="text" :disabled="isReadOnly" :aria-label="`Editar la categoría ${item.name}`" @click="openDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" :disabled="isReadOnly" :aria-label="`Eliminar la categoría ${item.name}`" @click="openDelete(item)">
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
        <v-card-title>{{ editing ? 'Editar categoría' : 'Nueva categoría' }}</v-card-title>
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
                  <div class="text-caption text-medium-emphasis">
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

    <!-- Eliminar: lo que la categoría tiene nunca se borra con ella; se mueve
         a otra o queda sin categoría, y eso lo decide quien elimina. -->
    <v-dialog v-model="deleteDialog" max-width="520">
      <v-card v-if="deleting">
        <v-card-title class="text-wrap">Eliminar la categoría {{ deleting.name }}</v-card-title>
        <v-card-text>
          <v-alert v-if="deletingHasChildren" type="warning" variant="tonal" density="compact">
            Tiene subcategorías. Muévelas o elimínalas primero.
          </v-alert>
          <template v-else-if="heldTotal > 0">
            <p class="mb-3">
              Tiene {{ heldLabel }}. Nada se borra con la categoría: elige qué pasa con
              {{ heldTotal === 1 ? 'él' : 'ellos' }}.
            </p>
            <v-radio-group v-model="deleteChoice" hide-details>
              <v-radio value="move" :label="heldTotal === 1 ? 'Moverlo a otra categoría' : 'Moverlos a otra categoría'" />
              <v-radio value="none" :label="heldTotal === 1 ? 'Dejarlo sin categoría' : 'Dejarlos sin categoría'" />
            </v-radio-group>
            <v-select
              v-if="deleteChoice === 'move'"
              v-model="moveTo"
              :items="moveOptions"
              item-title="path"
              item-value="id"
              label="Mover a"
              class="mt-3"
              hide-details
            />
            <v-alert v-else-if="deleteChoice === 'none'" type="warning" variant="tonal" density="compact" class="mt-3">
              Sin categoría no salen en el menú de la app hasta que les asignes una en Productos.
            </v-alert>
          </template>
          <p v-else>¿Seguro que quieres eliminar la categoría {{ deleting.name }}? No tiene productos.</p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="deleteDialog = false">Cancelar</v-btn>
          <v-btn color="error" :disabled="!canDelete" :loading="removing" @click="confirmDelete">Eliminar</v-btn>
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
import { categoriesService, type Category, type CategoryDeleteRefusal } from '@/services/menuService';
import { productsService, type Product } from '@/services/productsService';
import { resolveImageUrl } from '@/utils/images';
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

const categorias = ref<Category[]>([]);
const products = ref<Product[]>([]);
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
  { title: 'App móvil', key: 'visible_in_app' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

// Every product of the category, active or not: all of them block its deletion.
const getProductCount = (categoria: Category): number =>
  products.value.filter(product => product.category_id === categoria.id).length;

const productsLabel = (count: number) => (count === 1 ? '1 producto' : `${count} productos`);

const loadData = async () => {
  loading.value = true;
  try {
    const [categoriasData, productsData] = await Promise.all([
      categoriesService.getAll(),
      productsService.getAll(),
    ]);
    categorias.value = categoriasData;
    products.value = productsData;
  } catch (error: any) {
    console.error('[Categorias] Error al cargar datos:', error);
    showMessage(errorMessage(error, 'No fue posible cargar la información. Inténtalo de nuevo.'), 'error');
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
    showMessage(errorMessage(error, 'No fue posible guardar. Inténtalo de nuevo.'), 'error');
  } finally {
    saving.value = false;
  }
};

const deleteDialog = ref(false);
const deleting = ref<Category | null>(null);
const held = ref({ products: 0, menuItems: 0 });
const deleteChoice = ref<'move' | 'none' | null>(null);
const moveTo = ref<number | null>(null);
const removing = ref(false);

const deletingHasChildren = computed(() =>
  !!deleting.value && categorias.value.some(c => c.parent_id === deleting.value!.id),
);
const heldTotal = computed(() => held.value.products + held.value.menuItems);
const heldLabel = computed(() => [
  held.value.products ? productsLabel(held.value.products) : '',
  held.value.menuItems === 1 ? '1 ítem del menú' : held.value.menuItems ? `${held.value.menuItems} ítems del menú` : '',
].filter(Boolean).join(' y '));
const moveOptions = computed(() => categorias.value.filter(c => c.id !== deleting.value?.id));
const canDelete = computed(() => {
  if (deletingHasChildren.value) return false;
  if (heldTotal.value === 0) return true;
  return deleteChoice.value === 'none' || (deleteChoice.value === 'move' && moveTo.value !== null);
});

const openDelete = (categoria: Category) => {
  deleting.value = categoria;
  held.value = { products: getProductCount(categoria), menuItems: 0 };
  deleteChoice.value = null;
  moveTo.value = null;
  deleteDialog.value = true;
};

const confirmDelete = async () => {
  if (!deleting.value) return;
  removing.value = true;
  try {
    const choice = heldTotal.value === 0 ? undefined : deleteChoice.value === 'move' ? moveTo.value! : 'none';
    showMessage(await categoriesService.delete(deleting.value.id, choice));
    deleteDialog.value = false;
    loadData();
  } catch (error: any) {
    // It holds more than this page knew (menu items, or products added meanwhile): ask where they go.
    const refusal = error?.response?.data as Partial<CategoryDeleteRefusal> | undefined;
    if (error?.response?.status === 422 && refusal?.products_count !== undefined) {
      held.value = { products: refusal.products_count, menuItems: refusal.menu_items_count ?? 0 };
    }
    showMessage(errorMessage(error, 'No fue posible eliminar. Inténtalo de nuevo.'), 'error');
  } finally {
    removing.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>
