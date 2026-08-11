<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Gestión de Recetas</h1>
            <p class="text-body-1 text-grey-darken-1">
              Define los ingredientes y cantidades de cada producto
            </p>
          </div>
          <LockableButton icon="mdi-plus" color="primary" size="large" @click="openDialog()">
            Nueva Receta
          </LockableButton>
        </div>
      </v-col>
    </v-row>

    <v-alert type="info" density="compact" variant="tonal" class="mb-4">
      Define cuanto produce la receta y los ingredientes para ese lote. El sistema calcula
      automaticamente el costo y el descuento proporcional por unidad vendida.
    </v-alert>

    <!-- Lista de recetas -->
    <v-row>
      <v-col cols="12">
        <v-card>
          <v-data-table
            :headers="headers"
            :items="recipes"
            :loading="loading"
            class="elevation-0"
          >
            <template #item.product="{ item }">
              <div>
                <div class="font-weight-bold">{{ item.product?.name }}</div>
                <div class="text-caption text-grey">{{ item.name }}</div>
              </div>
            </template>
            <template #item.variant="{ item }">
              <v-chip v-if="item.variant" size="small" variant="tonal">{{ item.variant.name }}</v-chip>
              <span v-else class="text-grey">Base</span>
            </template>
            <template #item.rendimiento="{ item }">
              {{ item.yield_quantity }} {{ item.yield_unit }}
            </template>
            <template #item.ingredients="{ item }">
              <v-chip size="small" color="primary">
                {{ item.ingredients?.length || 0 }} ingredientes
              </v-chip>
            </template>
            <template #item.total_cost="{ item }">
              <span v-if="item.total_cost" class="font-weight-bold text-success">
                ${{ Number(item.total_cost).toFixed(2) }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" :disabled="isReadOnly" @click="openDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" :disabled="isReadOnly" @click="deleteRecipe(item)">
                <v-icon size="small">mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Receta -->
    <v-dialog v-model="dialog" max-width="900" persistent scrollable>
      <v-card>
        <v-card-title>{{ editing ? 'Editar Receta' : 'Nueva Receta' }}</v-card-title>
        <v-divider />
        <v-card-text style="max-height: 70vh">
          <v-form ref="form">
            <!-- Información básica -->
            <h3 class="mb-3">Información General</h3>
            <v-alert type="info" variant="tonal" density="compact" class="mb-4">
              Primero define cuanto produce esta receta. Si es una receta por unidad, deja
              <strong>1</strong>. Ejemplo: una pizza produce <strong>1 unidad</strong>;
              una salsa puede producir <strong>2 litros</strong>.
            </v-alert>
            <v-row>
              <v-col cols="12" md="6">
                <v-autocomplete
                  v-model="formData.product_id"
                  :items="availableProducts"
                  item-title="name"
                  item-value="id"
                  label="Producto"
                  :rules="[v => !!v || 'Producto requerido']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6" v-if="requiresRecipeVariant">
                <v-autocomplete
                  v-model="formData.variant_id"
                  :items="variantsForSelectedProduct"
                  item-title="name"
                  item-value="id"
                  label="Variante / Tipo *"
                  :rules="[v => !!v || 'Tipo requerido para este producto']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.name"
                  label="Nombre de la receta"
                  :rules="[v => !!v || 'Nombre requerido']"
                  required
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="formData.description"
              label="Descripción"
              rows="2"
            />

            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="formData.yield_quantity"
                  label="Rendimiento de la receta"
                  hint="Ej: 1 pizza, 2 litros de salsa, 50 unidades"
                  persistent-hint
                  type="number"
                  step="0.01"
                  min="0"
                  :rules="[v => v > 0 || 'Cantidad inválida']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="formData.yield_unit"
                  label="Unidad producida"
                  hint="Ej: unidad, litro, kg, pizza"
                  persistent-hint
                  :rules="[v => !!v || 'Unidad requerida']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="formData.preparation_time"
                  label="Tiempo prep. (horas)"
                  type="number"
                  step="0.1"
                  min="0"
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="formData.instructions"
              label="Instrucciones de preparación"
              rows="3"
            />

            <v-divider class="my-4" />

            <!-- Ingredientes -->
            <div class="d-flex justify-space-between align-center mb-3">
              <div>
                <h3>Ingredientes</h3>
                <div class="text-body-2 text-grey-darken-1">
                  Puedes ingresar cantidades de dos formas: lo que usa todo el lote, o una cantidad que rinde varias unidades.
                </div>
              </div>
              <v-btn color="success" size="small" @click="addIngrediente">
                <v-icon start>mdi-plus</v-icon>
                Agregar Ingrediente
              </v-btn>
            </div>

            <v-alert v-if="ingredientes.length === 0" type="info" density="compact" class="mb-3">
              Agrega al menos un ingrediente a la receta
            </v-alert>

            <v-alert v-else type="info" density="compact" variant="tonal" class="mb-3">
              <strong>Ejemplo por unidad:</strong> una pizza usa 10 ml de salsa.
              <strong>Ejemplo por rendimiento:</strong> 1 tarro de salsa rinde 50 pizzas.
              Ambos terminan convertidos al consumo real por unidad.
            </v-alert>

            <v-list v-if="ingredientes.length > 0" class="pa-0">
              <v-list-item
                v-for="(ing, index) in ingredientes"
                :key="index"
                class="border mb-2 rounded"
              >
                <v-row align="center">
                  <v-col cols="12" md="4">
                    <v-autocomplete
                      v-model="ing.product_id"
                      :items="materiasPrimas"
                      item-title="name"
                      item-value="id"
                      label="Ingrediente"
                      density="compact"
                      hide-details
                      @update:model-value="updateIngredientCost(ing)"
                    >
                      <template #item="{ props, item }">
                        <v-list-item v-bind="props">
                          <template #append>
                            <span class="text-caption text-grey">
                              {{ item.raw.unit }}
                            </span>
                          </template>
                        </v-list-item>
                      </template>
                    </v-autocomplete>
                  </v-col>
                  <v-col cols="12" md="3">
                    <v-select
                      v-model="ing.entry_mode"
                      :items="ingredientEntryModes"
                      item-title="title"
                      item-value="value"
                      label="Modo de cantidad"
                      :hint="getEntryModeHint(ing)"
                      persistent-hint
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model.number="ing.quantity"
                      :label="ing.entry_mode === 'per_yield' ? 'Cantidad que rinde' : 'Cantidad para este lote'"
                      :hint="ing.entry_mode === 'per_yield' ? 'Ej: 1 tarro' : 'Ej: 10 ml si la receta produce 1 pizza'"
                      persistent-hint
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model="ing.unit"
                      label="Unidad ingrediente"
                      hint="Debe coincidir con el inventario"
                      persistent-hint
                      density="compact"
                    />
                  </v-col>
                  <v-col v-if="ing.entry_mode === 'per_yield'" cols="12" md="3">
                    <v-text-field
                      v-model.number="ing.rinde_cantidad"
                      :label="`Rinde cuantas ${formData.yield_unit || 'unidades'}`"
                      hint="Ej: 50 pizzas"
                      persistent-hint
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                    />
                  </v-col>
                  <v-col cols="12" md="3">
                    <div class="text-caption text-grey">Consumo calculado para el lote</div>
                    <div class="font-weight-bold">
                      {{ getBatchQuantity(ing).toFixed(4) }} {{ ing.unit || 'unid.' }}
                    </div>
                    <div class="text-caption text-grey">
                      Por cada {{ formData.yield_unit || 'unidad' }}:
                      {{ getQuantityPerProducedUnit(ing).toFixed(4) }} {{ ing.unit || 'unid.' }}
                    </div>
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model.number="ing.waste_percentage"
                      label="Desperdicio %"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      density="compact"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="8" md="2">
                    <div class="text-caption text-grey">Costo lote</div>
                    <div class="font-weight-bold text-success">
                      ${{ calcIngredientCost(ing).toFixed(2) }}
                    </div>
                  </v-col>
                  <v-col cols="4" md="1" class="text-right">
                    <v-btn 
                      icon 
                      size="small" 
                      variant="text" 
                      color="error"
                      @click="removeIngrediente(index)"
                    >
                      <v-icon>mdi-delete</v-icon>
                    </v-btn>
                  </v-col>
                </v-row>
              </v-list-item>
            </v-list>

            <v-divider class="my-3" />

            <v-card color="grey-lighten-4" flat>
              <v-card-text>
                <v-row>
                  <v-col cols="6">
                    <div class="text-h6">Costo Total</div>
                    <div class="text-h4 text-success">${{ Number(totalCost).toFixed(2) }}</div>
                  </v-col>
                  <v-col cols="6">
                    <div class="text-h6">Costo por Unidad</div>
                    <div class="text-h4 text-primary">
                      ${{ Number(costPerUnit).toFixed(2) }}/{{ formData.yield_unit || 'unidad' }}
                    </div>
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </v-form>
        </v-card-text>
        <v-divider />
        <v-card-actions>
          <v-spacer />
          <v-btn @click="closeDialog">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Guardar Receta</v-btn>
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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { recipesService, type Recipe, type RecipeIngredientPayload, type RecipePayload } from '@/services/recipesService';
import { productsService, type Product } from '@/services/productsService';
import { menuItemsService, type MenuItem } from '@/services/menuService';
import LockableButton from '../components/LockableButton.vue'
import { useReadOnly } from '../composables/useReadOnly'

// Suscripción vencida: las acciones que escriben quedan en gris.
const isReadOnly = useReadOnly()

const route = useRoute();

type IngredientEntryMode = 'batch' | 'per_yield';
interface RecipeIngredientForm {
  id?: number;
  product_id: number | null;
  quantity: number;
  unit: string;
  unit_cost?: number;
  waste_percentage: number;
  entry_mode: IngredientEntryMode;
  rinde_cantidad?: number | null;
}

const recipes = ref<Recipe[]>([]);
const products = ref<Product[]>([]);
const itemsMenu = ref<MenuItem[]>([]);
const loading = ref(true);
const saving = ref(false);

const dialog = ref(false);
const editing = ref<Recipe | null>(null);

const formData = ref({
  product_id: null as number | null,
  variant_id: null as number | null,
  name: '',
  description: '',
  yield_quantity: 1,
  yield_unit: '',
  preparation_time: null as number | null,
  instructions: '',
});

const ingredientes = ref<RecipeIngredientForm[]>([]);

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Producto', key: 'product' },
  { title: 'Variante', key: 'variant' },
  { title: 'Rendimiento', key: 'rendimiento' },
  { title: 'Ingredientes', key: 'ingredients' },
  { title: 'Costo Total', key: 'total_cost' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const ingredientEntryModes = [
  { title: 'Cantidad para este lote', value: 'batch' },
  { title: 'Esta cantidad rinde varias unidades', value: 'per_yield' },
];

const availableProducts = computed(() => {
  return products.value.filter(p => p.type === 'intermediate' || p.type === 'final');
});

const variantsForSelectedProduct = computed(() => {
  if (!formData.value.product_id) return [];

  const unique = new Map<number, { id: number; name: string }>();
  itemsMenu.value
    .filter((i) => i.final_product_id === formData.value.product_id && i.variant_id && i.variant)
    .forEach((i) => {
      unique.set(i.variant!.id, { id: i.variant!.id, name: i.variant!.name });
    });

  return Array.from(unique.values());
});

const requiresRecipeVariant = computed(() => variantsForSelectedProduct.value.length > 0);

const materiasPrimas = computed(() => {
  return products.value.filter(p => p.type === 'raw_material' || p.type === 'intermediate');
});

const selectedRecipeProductUnit = computed(() => {
  return products.value.find((product) => product.id === formData.value.product_id)?.unit || 'unit';
});

const totalCost = computed(() => {
  return ingredientes.value.reduce((sum, ing) => sum + calcIngredientCost(ing), 0);
});

const costPerUnit = computed(() => {
  if (!formData.value.yield_quantity || formData.value.yield_quantity === 0) return 0;
  return totalCost.value / formData.value.yield_quantity;
});

const getBatchQuantity = (ing: RecipeIngredientForm) => {
  const quantity = Number(ing.quantity || 0);

  if (ing.entry_mode !== 'per_yield') {
    return quantity;
  }

  const recipeYield = Number(formData.value.yield_quantity || 0);
  const equivalentYield = Number(ing.rinde_cantidad || 0);
  if (recipeYield <= 0 || equivalentYield <= 0) {
    return 0;
  }

  return quantity * (recipeYield / equivalentYield);
};

const getEntryModeHint = (ing: RecipeIngredientForm) => {
  if (ing.entry_mode === 'per_yield') {
    return 'Úsalo para cosas como: 1 tarro de salsa rinde 50 pizzas';
  }

  return 'Úsalo para cosas como: esta pizza usa 10 ml de salsa';
};

const getQuantityWithWaste = (ing: RecipeIngredientForm) => {
  const wasteMultiplier = 1 + Number(ing.waste_percentage || 0) / 100;
  return getBatchQuantity(ing) * wasteMultiplier;
};

const getQuantityPerProducedUnit = (ing: RecipeIngredientForm) => {
  const recipeYield = Number(formData.value.yield_quantity || 0);
  if (recipeYield <= 0) return 0;

  return getQuantityWithWaste(ing) / recipeYield;
};

const calcIngredientCost = (ing: RecipeIngredientForm) => {
  if (!ing.product_id || !ing.quantity) return 0;

  const product = products.value.find(p => p.id === ing.product_id);
  if (!product || !product.unit_cost) return 0;

  return Number(product.unit_cost) * getQuantityWithWaste(ing);
};

const updateIngredientCost = (ing: RecipeIngredientForm) => {
  const product = products.value.find(p => p.id === ing.product_id);
  if (product) {
    ing.unit = product.unit;
    ing.unit_cost = product.unit_cost ?? undefined;
  }
};

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const loadData = async () => {
  loading.value = true;
  try {
    console.log('[Recetas] Cargando datos...');
    const [recipesData, productsData, itemsMenuData] = await Promise.all([
      recipesService.getAll(),
      productsService.getAll(),
      menuItemsService.getAll(),
    ]);
    console.log('[Recetas] Recetas cargadas:', recipesData.length);
    console.log('[Recetas] Productos cargados:', productsData.length);
    recipes.value = recipesData;
    products.value = productsData;
    itemsMenu.value = itemsMenuData;

    // Si viene un producto en la query, abrir dialog
    if (route.query.product) {
      const productId = parseInt(route.query.product as string);
      const variantId = route.query.variant ? parseInt(route.query.variant as string) : null;
      const recipe = recipesData.find(r =>
        r.product_id === productId && (variantId ? r.variant_id === variantId : true)
      );
      if (recipe) {
        openDialog(recipe);
      } else {
        const product = productsData.find(p => p.id === productId);
        if (product) {
          openDialog();
          formData.value.product_id = productId;
          if (variantId) {
            formData.value.variant_id = variantId;
          }
          formData.value.name = `Receta de ${product.name}`;
          formData.value.yield_unit = product.unit;
        }
      }
    }
  } catch (error: any) {
    console.error('[Recetas] Error al cargar datos:', error);
    console.error('[Recetas] Error response:', error.response);
    showMessage(errorMessage(error, 'Error al cargar datos: ') + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

const openDialog = (recipe?: Recipe) => {
  editing.value = recipe || null;
  
  if (recipe) {
    formData.value = {
      product_id: recipe.product_id,
      variant_id: recipe.variant_id || null,
      name: recipe.name,
      description: recipe.description || '',
      yield_quantity: recipe.yield_quantity,
      yield_unit: recipe.yield_unit,
      preparation_time: recipe.preparation_time || null,
      instructions: recipe.instructions || '',
    };
    ingredientes.value = (recipe.ingredients || []).map(item => ({
      id: item.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit: item.unit,
      unit_cost: item.unit_cost,
      waste_percentage: item.waste_percentage || 0,
      entry_mode: 'batch',
      rinde_cantidad: null,
    }));
  } else {
    formData.value = {
      product_id: null,
      variant_id: null,
      name: '',
      description: '',
      yield_quantity: 1,
      yield_unit: '',
      preparation_time: null,
      instructions: '',
    };
    ingredientes.value = [];
  }
  
  dialog.value = true;
};

const closeDialog = () => {
  dialog.value = false;
  editing.value = null;
  ingredientes.value = [];
};

const addIngrediente = () => {
  ingredientes.value.push({
    product_id: null,
    quantity: 1,
    unit: '',
    unit_cost: 0,
    waste_percentage: 0,
    entry_mode: 'batch',
    rinde_cantidad: null,
  });
};

const removeIngrediente = (index: number) => {
  ingredientes.value.splice(index, 1);
};

const save = async () => {
  if (!formData.value.product_id || !formData.value.name || ingredientes.value.length === 0) {
    showMessage('Completa todos los campos requeridos y agrega al menos un ingrediente', 'error');
    return;
  }

  if (requiresRecipeVariant.value && !formData.value.variant_id) {
    showMessage('Este producto tiene variantes. Selecciona el tipo para la receta.', 'error');
    return;
  }
  
  saving.value = true;
  try {
    const ingredients: RecipeIngredientPayload[] = ingredientes.value
      .filter((ingredient) => ingredient.product_id)
      .map((ingredient) => {
      return {
        id: ingredient.id,
        product_id: ingredient.product_id!,
        unit: ingredient.unit,
        unit_cost: ingredient.unit_cost,
        quantity: getBatchQuantity(ingredient),
        waste_percentage: Number(ingredient.waste_percentage || 0),
      };
    });

    const data: RecipePayload = {
      product_id: formData.value.product_id,
      variant_id: formData.value.variant_id,
      name: formData.value.name,
      description: formData.value.description,
      yield_quantity: formData.value.yield_quantity || 1,
      yield_unit: formData.value.yield_unit || selectedRecipeProductUnit.value,
      preparation_time: formData.value.preparation_time || undefined,
      instructions: formData.value.instructions,
      ingredients,
    };
    
    if (editing.value) {
      await recipesService.update(editing.value.id, data);
      showMessage('Receta actualizada');
    } else {
      await recipesService.create(data);
      showMessage('Receta creada');
    }
    
    closeDialog();
    loadData();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al guardar'), 'error');
  } finally {
    saving.value = false;
  }
};

const deleteRecipe = async (recipe: Recipe) => {
  if (!confirm(`¿Eliminar la receta "${recipe.name}"?`)) return;
  try {
    await recipesService.delete(recipe.id);
    showMessage('Receta eliminada');
    loadData();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al eliminar'), 'error');
  }
};

watch(
  () => formData.value.product_id,
  (productId) => {
    formData.value.variant_id = null;
    const selectedProduct = products.value.find((product) => product.id === productId);
    if (selectedProduct && !formData.value.yield_unit) {
      formData.value.yield_unit = selectedProduct.unit;
    }
  }
);

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.border {
  border: 1px solid rgba(0, 0, 0, 0.12);
}
</style>
