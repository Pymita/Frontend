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
      Si un producto tiene variantes (tipos/tamanos), registra una receta por cada variante.
      Asi se descuentan ingredientes reales por tipo al preparar pedidos.
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
                  label="Cantidad que produce"
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
                  label="Unidad"
                  hint="Ej: kg, litros, unidades"
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
              <h3>Ingredientes</h3>
              <v-btn color="success" size="small" @click="addIngrediente">
                <v-icon start>mdi-plus</v-icon>
                Agregar Ingrediente
              </v-btn>
            </div>

            <v-alert v-if="ingredientes.length === 0" type="info" density="compact" class="mb-3">
              Agrega al menos un ingrediente a la receta
            </v-alert>

            <v-list v-else class="pa-0">
              <v-list-item
                v-for="(ing, index) in ingredientes"
                :key="index"
                class="border mb-2 rounded"
              >
                <v-row align="center">
                  <v-col cols="12" md="5">
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
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model.number="ing.cantidad"
                      label="Cantidad"
                      type="number"
                      step="0.01"
                      min="0"
                      density="compact"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="6" md="2">
                    <v-text-field
                      v-model="ing.unidad"
                      label="Unidad"
                      density="compact"
                      hide-details
                    />
                  </v-col>
                  <v-col cols="8" md="2">
                    <div class="text-caption text-grey">Costo</div>
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
import { recetasService, type Receta, type RecetaItem } from '@/services/recetasService';
import { productosService, type Product } from '@/services/productosService';
import { itemsMenuService, type ItemMenu } from '@/services/menuService';

const route = useRoute();

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

const ingredientes = ref<Partial<RecetaItem>[]>([]);

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

const costoTotal = computed(() => {
  return ingredientes.value.reduce((sum, ing) => sum + calcularCostoIngrediente(ing), 0);
});

const costoPorUnidad = computed(() => {
  if (!formData.value.cantidad_producida || formData.value.cantidad_producida === 0) return 0;
  return costoTotal.value / formData.value.cantidad_producida;
});

const calcularCostoIngrediente = (ing: Partial<RecetaItem>) => {
  if (!ing.producto_id || !ing.cantidad) return 0;
  
  const producto = productos.value.find(p => p.id === ing.producto_id);
  if (!producto || !producto.costo_unitario) return 0;
  
  return Number(producto.costo_unitario) * Number(ing.cantidad);
};

const updateIngredienteCosto = (ing: Partial<RecetaItem>) => {
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
    producto_id: null as any,
    cantidad: 1,
    unidad: '',
    costo_unitario: 0,
    desperdicio_porcentaje: 0,
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
    const data = {
      ...formData.value,
      items: ingredientes.value,
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
  () => {
    formData.value.tipo_id = null;
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
