<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h1 class="text-h4 mb-4">Tipos de Producto</h1>
        <p class="text-body-1 text-grey-darken-1 mb-6">
          Gestiona los grupos de tipos (ej: Tamaño, Sabor) y sus variantes
        </p>
      </v-col>
    </v-row>

    <v-row>
      <!-- Panel de Grupos -->
      <v-col cols="12" md="4">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Grupos</span>
            <v-btn color="primary" size="small" @click="openGrupoDialog()">
              <v-icon start>mdi-plus</v-icon>
              Nuevo
            </v-btn>
          </v-card-title>
          <v-divider />
          <v-list v-if="grupos.length > 0">
            <v-list-item
              v-for="grupo in grupos"
              :key="grupo.id"
              :active="selectedGrupo?.id === grupo.id"
              @click="selectGrupo(grupo)"
              class="cursor-pointer"
            >
              <v-list-item-title>{{ grupo.name }}</v-list-item-title>
              <v-list-item-subtitle v-if="grupo.description">
                {{ grupo.description }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn icon size="small" variant="text" @click.stop="openGrupoDialog(grupo)">
                  <v-icon size="small">mdi-pencil</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text" color="error" @click.stop="deleteGrupo(grupo)">
                  <v-icon size="small">mdi-delete</v-icon>
                </v-btn>
              </template>
            </v-list-item>
          </v-list>
          <v-card-text v-else class="text-center text-grey">
            No hay grupos creados
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Panel de Tipos -->
      <v-col cols="12" md="8">
        <v-card>
          <v-card-title class="d-flex justify-space-between align-center">
            <span>
              Tipos
              <v-chip v-if="selectedGrupo" class="ml-2" size="small" color="primary">
                {{ selectedGrupo.name }}
              </v-chip>
            </span>
            <v-btn
              color="primary"
              size="small"
              :disabled="!selectedGrupo"
              @click="openTipoDialog()"
            >
              <v-icon start>mdi-plus</v-icon>
              Nuevo Tipo
            </v-btn>
          </v-card-title>
          <v-divider />
          
          <v-data-table
            v-if="selectedGrupo && tipos.length > 0"
            :key="selectedGrupo.id"
            :headers="tipoHeaders"
            :items="tipos"
            :loading="loadingTipos"
            class="elevation-0"
          >
            <template #item.price_difference="{ item }">
              <span :class="Number(item.price_difference || 0) > 0 ? 'text-success' : Number(item.price_difference || 0) < 0 ? 'text-error' : ''">
                {{ Number(item.price_difference || 0) > 0 ? '+' : '' }}${{ Number(item.price_difference || 0).toFixed(2) }}
              </span>
            </template>
            <template #item.price_multiplier="{ item }">
              x{{ Number(item.price_multiplier || 1).toFixed(2) }}
            </template>
            <template #item.active="{ item }">
              <v-chip :color="item.active ? 'success' : 'error'" size="small">
                {{ item.active ? 'Activo' : 'Inactivo' }}
              </v-chip>
            </template>
            <template #item.actions="{ item }">
              <v-btn icon size="small" variant="text" @click="openTipoDialog(item)">
                <v-icon size="small">mdi-pencil</v-icon>
              </v-btn>
              <v-btn icon size="small" variant="text" color="error" @click="deleteTipo(item)">
                <v-icon size="small">mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-data-table>
          
          <v-card-text v-else class="text-center text-grey py-10">
            {{ selectedGrupo ? 'No hay tipos en este grupo' : 'Selecciona un grupo para ver sus tipos' }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Grupo -->
    <v-dialog v-model="grupoDialog" max-width="500">
      <v-card>
        <v-card-title>{{ editingGrupo ? 'Editar Grupo' : 'Nuevo Grupo' }}</v-card-title>
        <v-card-text>
          <v-form ref="grupoForm" @submit.prevent="saveGrupo">
            <v-text-field
              v-model="grupoFormData.name"
              label="Nombre"
              :rules="[v => !!v || 'Nombre requerido']"
              required
            />
            <v-textarea
              v-model="grupoFormData.description"
              label="Descripción"
              rows="2"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="grupoDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveGrupo">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Tipo -->
    <v-dialog v-model="tipoDialog" max-width="600">
      <v-card>
        <v-card-title>{{ editingTipo ? 'Editar Tipo' : 'Nuevo Tipo' }}</v-card-title>
        <v-card-text>
          <v-form ref="tipoForm" @submit.prevent="saveTipo">
            <v-text-field
              v-model="tipoFormData.name"
              label="Nombre"
              :rules="[v => !!v || 'Nombre requerido']"
              required
            />
            <v-textarea
              v-model="tipoFormData.description"
              label="Descripción"
              rows="2"
            />
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model.number="tipoFormData.price_difference"
                  label="Diferencia de precio ($)"
                  type="number"
                  step="0.01"
                  hint="Ej: 5.00 para sumar $5 al precio base"
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="tipoFormData.price_multiplier"
                  label="Multiplicador de precio"
                  type="number"
                  step="0.01"
                  min="0.1"
                  hint="Ej: 1.5 para 50% más"
                />
              </v-col>
            </v-row>
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model.number="tipoFormData.sort_order"
                  label="Orden"
                  type="number"
                  min="0"
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="tipoDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveTipo">Guardar</v-btn>
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
import { ref, onMounted, watch } from 'vue';
import { variantGroupsService, variantsService, type VariantGroup, type Variant } from '@/services/variantsService';

const grupos = ref<VariantGroup[]>([]);
const tipos = ref<Variant[]>([]);
const selectedGrupo = ref<VariantGroup | null>(null);
const loadingTipos = ref(false);
const saving = ref(false);

const grupoDialog = ref(false);
const tipoDialog = ref(false);
const editingGrupo = ref<VariantGroup | null>(null);
const editingTipo = ref<Variant | null>(null);

const grupoFormData = ref({ name: '', description: '' });
const tipoFormData = ref({
  name: '',
  description: '',
  price_difference: 0,
  price_multiplier: 1,
  sort_order: 0,
});

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const tipoHeaders = [
  { title: 'Nombre', key: 'name' },
  { title: 'Diferencia Precio', key: 'price_difference' },
  { title: 'Multiplicador', key: 'price_multiplier' },
  { title: 'Orden', key: 'sort_order' },
  { title: 'Estado', key: 'active' },
  { title: 'Acciones', key: 'actions', sortable: false },
];

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const loadGrupos = async () => {
  try {
    grupos.value = await variantGroupsService.getAll();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al cargar grupos'), 'error');
  }
};

const loadTipos = async () => {
  if (!selectedGrupo.value) return;
  loadingTipos.value = true;
  try {
    tipos.value = await variantsService.getAll(selectedGrupo.value.id);
  } catch (error) {
    showMessage(errorMessage(error, 'Error al cargar tipos'), 'error');
  } finally {
    loadingTipos.value = false;
  }
};

const selectGrupo = (grupo: VariantGroup) => {
  selectedGrupo.value = grupo;
};

watch(selectedGrupo, (newValue) => {
  if (newValue) {
    loadTipos();
  } else {
    tipos.value = [];
  }
});

const openGrupoDialog = (grupo?: VariantGroup) => {
  editingGrupo.value = grupo || null;
  grupoFormData.value = grupo
    ? { name: grupo.name, description: grupo.description || '' }
    : { name: '', description: '' };
  grupoDialog.value = true;
};

const saveGrupo = async () => {
  if (!grupoFormData.value.name) return;
  saving.value = true;
  try {
    if (editingGrupo.value) {
      await variantGroupsService.update(editingGrupo.value.id, grupoFormData.value);
      showMessage('Grupo actualizado');
    } else {
      await variantGroupsService.create(grupoFormData.value);
      showMessage('Grupo creado');
    }
    grupoDialog.value = false;
    loadGrupos();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al guardar'), 'error');
  } finally {
    saving.value = false;
  }
};

const deleteGrupo = async (grupo: VariantGroup) => {
  if (!confirm(`¿Eliminar el grupo "${grupo.name}"?`)) return;
  try {
    await variantGroupsService.delete(grupo.id);
    showMessage('Grupo eliminado');
    if (selectedGrupo.value?.id === grupo.id) {
      selectedGrupo.value = null;
      tipos.value = [];
    }
    loadGrupos();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al eliminar'), 'error');
  }
};

const openTipoDialog = (tipo?: Variant) => {
  editingTipo.value = tipo || null;
  tipoFormData.value = tipo
    ? {
        name: tipo.name,
        description: tipo.description || '',
        price_difference: tipo.price_difference,
        price_multiplier: tipo.price_multiplier,
        sort_order: tipo.sort_order,
      }
    : {
        name: '',
        description: '',
        price_difference: 0,
        price_multiplier: 1,
        sort_order: 0,
      };
  tipoDialog.value = true;
};

const saveTipo = async () => {
  if (!tipoFormData.value.name || !selectedGrupo.value) return;
  saving.value = true;
  try {
    const data = { ...tipoFormData.value, variant_group_id: selectedGrupo.value.id };
    if (editingTipo.value) {
      await variantsService.update(editingTipo.value.id, data);
      showMessage('Tipo actualizado');
    } else {
      await variantsService.create(data);
      showMessage('Tipo creado');
    }
    tipoDialog.value = false;
    loadTipos();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al guardar'), 'error');
  } finally {
    saving.value = false;
  }
};

const deleteTipo = async (tipo: Variant) => {
  if (!confirm(`¿Eliminar el tipo "${tipo.name}"?`)) return;
  try {
    await variantsService.delete(tipo.id);
    showMessage('Tipo eliminado');
    loadTipos();
  } catch (error) {
    showMessage(errorMessage(error, 'Error al eliminar'), 'error');
  }
};

onMounted(() => {
  loadGrupos();
});
</script>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}
</style>


