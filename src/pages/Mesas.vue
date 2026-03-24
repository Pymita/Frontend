<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <div class="d-flex justify-space-between align-center mb-4">
          <div>
            <h1 class="text-h4">Mesas</h1>
            <p class="text-body-1 text-grey-darken-1">
              Gestiona las mesas del restaurante
            </p>
          </div>
          <v-btn color="primary" size="large" @click="openDialog()">
            <v-icon start>mdi-plus</v-icon>
            Nueva Mesa
          </v-btn>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col
        v-for="mesa in mesas"
        :key="mesa.id"
        cols="6"
        sm="4"
        md="3"
        lg="2"
      >
        <v-card
          :color="getCardColor(mesa)"
          :variant="mesa.estado === 'disponible' ? 'outlined' : 'flat'"
          class="text-center pa-4"
          @click="openDialog(mesa)"
        >
          <v-card-text>
            <div class="text-h3 font-weight-bold" :class="getTextColor(mesa)">
              {{ mesa.numero }}
            </div>
            <div class="text-caption" :class="getTextColor(mesa)">
              {{ mesa.pseudonimo || `Mesa ${mesa.numero}` }}
            </div>
            <v-chip
              :color="getEstadoColor(mesa.estado)"
              size="x-small"
              class="mt-2"
            >
              {{ mesa.estado.toUpperCase() }}
            </v-chip>
            <div class="text-caption mt-1" :class="getTextColor(mesa)">
              👥 {{ mesa.capacidad }} personas
            </div>
          </v-card-text>
          <v-card-actions class="justify-center">
            <v-btn
              v-if="mesa.estado === 'ocupada'"
              size="small"
              variant="text"
              @click.stop="liberarMesa(mesa)"
            >
              Liberar
            </v-btn>
            <v-btn
              icon
              size="small"
              variant="text"
              @click.stop="openDialog(mesa)"
            >
              <v-icon size="small">mdi-pencil</v-icon>
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Mesa -->
    <v-dialog v-model="dialog" max-width="500" persistent>
      <v-card>
        <v-card-title>{{ editing ? 'Editar Mesa' : 'Nueva Mesa' }}</v-card-title>
        <v-card-text>
          <v-form ref="form" @submit.prevent="save">
            <v-row>
              <v-col cols="6">
                <v-text-field
                  v-model.number="formData.numero"
                  label="Número de mesa"
                  type="number"
                  min="1"
                  :rules="[v => !!v || 'Número requerido']"
                  required
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="formData.capacidad"
                  label="Capacidad"
                  type="number"
                  min="1"
                  max="20"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="formData.pseudonimo"
              label="Nombre personalizado (opcional)"
              hint="Ej: Terraza 1, VIP, Barra"
            />
            <v-select
              v-if="editing"
              v-model="formData.estado"
              :items="estados"
              label="Estado"
            />
            <v-switch
              v-if="editing"
              v-model="formData.activa"
              label="Mesa activa"
              color="success"
            />
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-btn
            v-if="editing"
            color="error"
            variant="text"
            @click="deleteMesa"
          >
            Eliminar
          </v-btn>
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
import { ref, onMounted } from 'vue';
import { mesasService, type Mesa } from '@/services/mesasService';

const mesas = ref<Mesa[]>([]);
const loading = ref(true);
const saving = ref(false);
const dialog = ref(false);
const editing = ref<Mesa | null>(null);

const formData = ref({
  numero: 1,
  pseudonimo: '',
  capacidad: 4,
  estado: 'disponible',
  activa: true,
});

const estados = ['disponible', 'ocupada', 'reservada'];

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const loadMesas = async () => {
  loading.value = true;
  try {
    mesas.value = await mesasService.getAll();
  } catch (error) {
    showMessage('Error al cargar mesas', 'error');
  } finally {
    loading.value = false;
  }
};

const getCardColor = (mesa: Mesa) => {
  if (mesa.estado === 'ocupada') return 'warning';
  if (mesa.estado === 'reservada') return 'info';
  return undefined;
};

const getTextColor = (mesa: Mesa) => {
  if (mesa.estado === 'disponible') return 'text-grey-darken-2';
  return 'text-white';
};

const getEstadoColor = (estado: string) => {
  if (estado === 'ocupada') return 'warning';
  if (estado === 'reservada') return 'info';
  return 'success';
};

const openDialog = (mesa?: Mesa) => {
  editing.value = mesa || null;
  formData.value = mesa
    ? {
        numero: mesa.numero,
        pseudonimo: mesa.pseudonimo || '',
        capacidad: mesa.capacidad,
        estado: mesa.estado,
        activa: mesa.activa,
      }
    : {
        numero: mesas.value.length + 1,
        pseudonimo: '',
        capacidad: 4,
        estado: 'disponible',
        activa: true,
      };
  dialog.value = true;
};

const save = async () => {
  if (!formData.value.numero) return;
  saving.value = true;
  try {
    if (editing.value) {
      await mesasService.update(editing.value.id, formData.value);
      showMessage('Mesa actualizada');
    } else {
      await mesasService.create(formData.value);
      showMessage('Mesa creada');
    }
    dialog.value = false;
    loadMesas();
  } catch (error) {
    showMessage('Error al guardar', 'error');
  } finally {
    saving.value = false;
  }
};

const deleteMesa = async () => {
  if (!editing.value) return;
  if (!confirm(`¿Eliminar mesa ${editing.value.numero}?`)) return;
  try {
    await mesasService.delete(editing.value.id);
    showMessage('Mesa eliminada');
    dialog.value = false;
    loadMesas();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

const liberarMesa = async (mesa: Mesa) => {
  try {
    await mesasService.liberar(mesa.id);
    showMessage('Mesa liberada');
    loadMesas();
  } catch (error) {
    showMessage('Error al liberar mesa', 'error');
  }
};

onMounted(() => {
  loadMesas();
});
</script>

