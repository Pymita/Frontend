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
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-plus</v-icon>
            Nueva Receta
          </v-btn>
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
            :items="recetas"
            :loading="loading"
            class="elevation-0"
          >
            <template #item.producto="{ item }">
              <div>
                <div class="font-weight-bold">{{ item.producto?.name }}</div>
                <div class="text-caption text-grey">{{ item.nombre }}</div>
              </div>
            </template>
            <template #item.tipo="{ item }">
              <v-chip v-if="item.tipo" size="small" variant="tonal">{{ item.tipo.nombre }}</v-chip>
              <span v-else class="text-grey">Base</span>
            </template>
            <template #item.rendimiento="{ item }">
              {{ item.cantidad_producida }} {{ item.unidad_producida }}
            </template>
            <template #item.items="{ item }">
              <v-chip size="small" color="primary">
                {{ item.items?.length || 0 }} ingredientes
              </v-chip>
            </template>
            <template #item.costo_total="{ item }">
              <span v-if="item.costo_total" class="font-weight-bold text-success">
                ${{ Number(item.costo_total).toFixed(2) }}
              </span>
              <span v-else class="text-grey">-</span>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" @click="openDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" @click="deleteReceta(item)">
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
                  v-model="formData.producto_id"
                  :items="productosDisponibles"
                  item-title="name"
                  item-value="id"
                  label="Producto"
                  :rules="[v => !!v || 'Producto requerido']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6" v-if="requiereTipoReceta">
                <v-autocomplete
                  v-model="formData.tipo_id"
                  :items="tiposPorProductoSeleccionado"
                  item-title="nombre"
                  item-value="id"
                  label="Variante / Tipo *"
                  :rules="[v => !!v || 'Tipo requerido para este producto']"
                  required
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="formData.nombre"
                  label="Nombre de la receta"
                  :rules="[v => !!v || 'Nombre requerido']"
                  required
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="formData.descripcion"
              label="Descripción"
              rows="2"
            />

            <v-row>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="formData.cantidad_producida"
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
                  v-model="formData.unidad_producida"
                  label="Unidad producida"
                  hint="Ej: unidad, litro, kg, pizza"
                  persistent-hint
                  :rules="[v => !!v || 'Unidad requerida']"
                  required
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model.number="formData.tiempo_preparacion"
                  label="Tiempo prep. (horas)"
                  type="number"
                  step="0.1"
                  min="0"
                />
              </v-col>
            </v-row>

            <v-textarea
              v-model="formData.instrucciones"
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

            <v-list v-else class="pa-0">
              <v-list-item
                v-for="(ing, index) in ingredientes"
                :key="index"
                class="border mb-2 rounded"
              >
                <v-row align="center">
                  <v-col cols="12" md="4">
                    <v-autocomplete
                      v-model="ing.producto_id"
                      :items="materiasPrimas"
                      item-title="name"
                      item-value="id"
                      label="Ingrediente"
                      density="compact"
                      hide-details
                      @update:model-value="updateIngredienteCosto(ing)"
                    >
                      <template #item="{ props, item }">
                        <v-list-item v-bind="props">
                          <template #append>
                            <span class="text-caption text-grey">
                              {{ item.raw.unidad }}
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
                      v-model.number="ing.cantidad"
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
                      v-model="ing.unidad"
                      label="Unidad ingrediente"
                      hint="Debe coincidir con el inventario"
                      persistent-hint
                      density="compact"
                    />
                  </v-col>
                  <v-col v-if="ing.entry_mode === 'per_yield'" cols="12" md="3">
                    <v-text-field
                      v-model.number="ing.rinde_cantidad"
                      :label="`Rinde cuantas ${formData.unidad_producida || 'unidades'}`"
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
                      {{ getBatchQuantity(ing).toFixed(4) }} {{ ing.unidad || 'unid.' }}
                    </div>
                    <div class="text-caption text-grey">
                      Por cada {{ formData.unidad_producida || 'unidad' }}:
                      {{ getQuantityPerProducedUnit(ing).toFixed(4) }} {{ ing.unidad || 'unid.' }}
                    </div>
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model.number="ing.desperdicio_porcentaje"
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
                      ${{ calcularCostoIngrediente(ing).toFixed(2) }}
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
                    <div class="text-h4 text-success">${{ Number(costoTotal).toFixed(2) }}</div>
                  </v-col>
                  <v-col cols="6">
                    <div class="text-h6">Costo por Unidad</div>
                    <div class="text-h4 text-primary">
                      ${{ Number(costoPorUnidad).toFixed(2) }}/{{ formData.unidad_producida || 'unidad' }}
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

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { recetasService, type Receta, type RecetaItemPayload, type RecetaPayload } from '@/services/recetasService';
import { productosService, type Product } from '@/services/productosService';
import { itemsMenuService, type ItemMenu } from '@/services/menuService';

const route = useRoute();

type IngredientEntryMode = 'batch' | 'per_yield';
interface RecipeIngredientForm {
  id?: number;
  producto_id: number | null;
  cantidad: number;
  unidad: string;
  costo_unitario?: number;
  desperdicio_porcentaje: number;
  entry_mode: IngredientEntryMode;
  rinde_cantidad?: number | null;
}

const recetas = ref<Receta[]>([]);
const productos = ref<Product[]>([]);
const itemsMenu = ref<ItemMenu[]>([]);
const loading = ref(true);
const saving = ref(false);

const dialog = ref(false);
const editing = ref<Receta | null>(null);

const formData = ref({
  producto_id: null as number | null,
  tipo_id: null as number | null,
  nombre: '',
  descripcion: '',
  cantidad_producida: 1,
  unidad_producida: '',
  tiempo_preparacion: null as number | null,
  instrucciones: '',
});

const ingredientes = ref<RecipeIngredientForm[]>([]);

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const headers = [
  { title: 'Producto', key: 'producto' },
  { title: 'Variante', key: 'tipo' },
  { title: 'Rendimiento', key: 'rendimiento' },
  { title: 'Ingredientes', key: 'items' },
  { title: 'Costo Total', key: 'costo_total' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const ingredientEntryModes = [
  { title: 'Cantidad para este lote', value: 'batch' },
  { title: 'Esta cantidad rinde varias unidades', value: 'per_yield' },
];

const productosDisponibles = computed(() => {
  return productos.value.filter(p => p.tipo === 'intermedio' || p.tipo === 'final');
});

const tiposPorProductoSeleccionado = computed(() => {
  if (!formData.value.producto_id) return [];

  const unique = new Map<number, { id: number; nombre: string }>();
  itemsMenu.value
    .filter((i) => i.producto_final_id === formData.value.producto_id && i.tipo_id && i.tipo)
    .forEach((i) => {
      unique.set(i.tipo!.id, { id: i.tipo!.id, nombre: i.tipo!.nombre });
    });

  return Array.from(unique.values());
});

const requiereTipoReceta = computed(() => tiposPorProductoSeleccionado.value.length > 0);

const materiasPrimas = computed(() => {
  return productos.value.filter(p => p.tipo === 'materia_prima' || p.tipo === 'intermedio');
});

const selectedRecipeProductUnit = computed(() => {
  return productos.value.find((product) => product.id === formData.value.producto_id)?.unidad || 'unit';
});

const costoTotal = computed(() => {
  return ingredientes.value.reduce((sum, ing) => sum + calcularCostoIngrediente(ing), 0);
});

const costoPorUnidad = computed(() => {
  if (!formData.value.cantidad_producida || formData.value.cantidad_producida === 0) return 0;
  return costoTotal.value / formData.value.cantidad_producida;
});

const getBatchQuantity = (ing: RecipeIngredientForm) => {
  const quantity = Number(ing.cantidad || 0);

  if (ing.entry_mode !== 'per_yield') {
    return quantity;
  }

  const recipeYield = Number(formData.value.cantidad_producida || 0);
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
  const wasteMultiplier = 1 + Number(ing.desperdicio_porcentaje || 0) / 100;
  return getBatchQuantity(ing) * wasteMultiplier;
};

const getQuantityPerProducedUnit = (ing: RecipeIngredientForm) => {
  const recipeYield = Number(formData.value.cantidad_producida || 0);
  if (recipeYield <= 0) return 0;

  return getQuantityWithWaste(ing) / recipeYield;
};

const calcularCostoIngrediente = (ing: RecipeIngredientForm) => {
  if (!ing.producto_id || !ing.cantidad) return 0;
  
  const producto = productos.value.find(p => p.id === ing.producto_id);
  if (!producto || !producto.costo_unitario) return 0;
  
  return Number(producto.costo_unitario) * getQuantityWithWaste(ing);
};

const updateIngredienteCosto = (ing: RecipeIngredientForm) => {
  const producto = productos.value.find(p => p.id === ing.producto_id);
  if (producto) {
    ing.unidad = producto.unidad;
    ing.costo_unitario = producto.costo_unitario;
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
    const [recetasData, productosData, itemsMenuData] = await Promise.all([
      recetasService.getAll(),
      productosService.getAll(),
      itemsMenuService.getAll(),
    ]);
    console.log('[Recetas] Recetas cargadas:', recetasData.length);
    console.log('[Recetas] Productos cargados:', productosData.length);
    recetas.value = recetasData;
    productos.value = productosData;
    itemsMenu.value = itemsMenuData;

    // Si viene un producto en la query, abrir dialog
    if (route.query.producto) {
      const productoId = parseInt(route.query.producto as string);
      const tipoId = route.query.tipo ? parseInt(route.query.tipo as string) : null;
      const receta = recetasData.find(r =>
        r.producto_id === productoId && (tipoId ? r.tipo_id === tipoId : true)
      );
      if (receta) {
        openDialog(receta);
      } else {
        const producto = productosData.find(p => p.id === productoId);
        if (producto) {
          openDialog();
          formData.value.producto_id = productoId;
          if (tipoId) {
            formData.value.tipo_id = tipoId;
          }
          formData.value.nombre = `Receta de ${producto.name}`;
          formData.value.unidad_producida = producto.unidad;
        }
      }
    }
  } catch (error: any) {
    console.error('[Recetas] Error al cargar datos:', error);
    console.error('[Recetas] Error response:', error.response);
    showMessage('Error al cargar datos: ' + (error.response?.data?.message || error.message), 'error');
  } finally {
    loading.value = false;
  }
};

const openDialog = (receta?: Receta) => {
  editing.value = receta || null;
  
  if (receta) {
    formData.value = {
      producto_id: receta.producto_id,
      tipo_id: receta.tipo_id || null,
      nombre: receta.nombre,
      descripcion: receta.descripcion || '',
      cantidad_producida: receta.cantidad_producida,
      unidad_producida: receta.unidad_producida,
      tiempo_preparacion: receta.tiempo_preparacion || null,
      instrucciones: receta.instrucciones || '',
    };
    ingredientes.value = (receta.items || []).map(item => ({
      id: item.id,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      unidad: item.unidad,
      costo_unitario: item.costo_unitario,
      desperdicio_porcentaje: item.desperdicio_porcentaje || 0,
      entry_mode: 'batch',
      rinde_cantidad: null,
    }));
  } else {
    formData.value = {
      producto_id: null,
      tipo_id: null,
      nombre: '',
      descripcion: '',
      cantidad_producida: 1,
      unidad_producida: '',
      tiempo_preparacion: null,
      instrucciones: '',
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
    producto_id: null,
    cantidad: 1,
    unidad: '',
    costo_unitario: 0,
    desperdicio_porcentaje: 0,
    entry_mode: 'batch',
    rinde_cantidad: null,
  });
};

const removeIngrediente = (index: number) => {
  ingredientes.value.splice(index, 1);
};

const save = async () => {
  if (!formData.value.producto_id || !formData.value.nombre || ingredientes.value.length === 0) {
    showMessage('Completa todos los campos requeridos y agrega al menos un ingrediente', 'error');
    return;
  }

  if (requiereTipoReceta.value && !formData.value.tipo_id) {
    showMessage('Este producto tiene variantes. Selecciona el tipo para la receta.', 'error');
    return;
  }
  
  saving.value = true;
  try {
    const items: RecetaItemPayload[] = ingredientes.value
      .filter((ingredient) => ingredient.producto_id)
      .map((ingredient) => {
      return {
        id: ingredient.id,
        producto_id: ingredient.producto_id!,
        unidad: ingredient.unidad,
        costo_unitario: ingredient.costo_unitario,
        cantidad: getBatchQuantity(ingredient),
        desperdicio_porcentaje: Number(ingredient.desperdicio_porcentaje || 0),
      };
    });

    const data: RecetaPayload = {
      producto_id: formData.value.producto_id,
      tipo_id: formData.value.tipo_id,
      nombre: formData.value.nombre,
      descripcion: formData.value.descripcion,
      cantidad_producida: formData.value.cantidad_producida || 1,
      unidad_producida: formData.value.unidad_producida || selectedRecipeProductUnit.value,
      tiempo_preparacion: formData.value.tiempo_preparacion || undefined,
      instrucciones: formData.value.instrucciones,
      items,
    };
    
    if (editing.value) {
      await recetasService.update(editing.value.id, data);
      showMessage('Receta actualizada');
    } else {
      await recetasService.create(data);
      showMessage('Receta creada');
    }
    
    closeDialog();
    loadData();
  } catch (error) {
    showMessage('Error al guardar', 'error');
  } finally {
    saving.value = false;
  }
};

const deleteReceta = async (receta: Receta) => {
  if (!confirm(`¿Eliminar la receta "${receta.nombre}"?`)) return;
  try {
    await recetasService.delete(receta.id);
    showMessage('Receta eliminada');
    loadData();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

watch(
  () => formData.value.producto_id,
  (productId) => {
    formData.value.tipo_id = null;
    const selectedProduct = productos.value.find((product) => product.id === productId);
    if (selectedProduct && !formData.value.unidad_producida) {
      formData.value.unidad_producida = selectedProduct.unidad;
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
