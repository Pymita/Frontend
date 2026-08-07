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
          <div class="d-flex ga-2">
            <v-btn variant="tonal" size="large" @click="bulkDialog = true">
              <v-icon start>mdi-table-plus</v-icon>
              Crear varias
            </v-btn>
            <v-btn color="primary" size="large" @click="openDialog()">
              <v-icon start>mdi-plus</v-icon>
              Nueva Mesa
            </v-btn>
          </div>
        </div>
      </v-col>
    </v-row>

    <v-row>
      <v-col
        v-for="table in tables"
        :key="table.id"
        cols="6"
        sm="4"
        md="3"
        lg="2"
      >
        <v-card
          :color="getCardColor(table)"
          :variant="table.status === 'available' ? 'outlined' : 'flat'"
          class="text-center pa-4"
          @click="openDialog(table)"
        >
          <v-card-text>
            <div class="text-h3 font-weight-bold" :class="getTextColor(table)">
              {{ table.number }}
            </div>
            <div class="text-caption" :class="getTextColor(table)">
              {{ table.nickname || `Mesa ${table.number}` }}
            </div>
            <v-chip
              :color="getStatusColor(table.status)"
              size="x-small"
              class="mt-2"
            >
              {{ getStatusLabel(table.status).toUpperCase() }}
            </v-chip>
            <div class="text-caption mt-1" :class="getTextColor(table)">
              <template v-if="table.table_type === 'billiard'">
                🎱 ${{ Number(table.hourly_rate ?? 0).toLocaleString('es-CO') }}/hora
              </template>
              <template v-else>👥 {{ table.capacity }} personas</template>
            </div>
          </v-card-text>
          <v-card-actions class="justify-center">
            <v-btn
              v-if="table.status === 'occupied'"
              size="small"
              variant="text"
              @click.stop="releaseTable(table)"
            >
              Liberar
            </v-btn>
            <v-btn
              icon
              size="small"
              variant="text"
              @click.stop="openDialog(table)"
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
                  v-model.number="formData.number"
                  label="Número de mesa"
                  type="number"
                  min="1"
                  :rules="[v => !!v || 'Número requerido']"
                  required
                />
              </v-col>
              <v-col cols="6">
                <v-text-field
                  v-model.number="formData.capacity"
                  label="Capacidad"
                  type="number"
                  min="1"
                  max="20"
                />
              </v-col>
            </v-row>
            <v-text-field
              v-model="formData.nickname"
              label="Nombre personalizado (opcional)"
              hint="Ej: Terraza 1, VIP, Barra"
            />
            <v-select
              v-if="hasTimeBilling"
              v-model="formData.table_type"
              :items="[
                { value: 'dining', title: 'Mesa normal' },
                { value: 'billiard', title: 'Mesa de billar (cobro por tiempo)' },
              ]"
              item-title="title"
              item-value="value"
              label="Tipo de mesa"
              class="mt-2"
            />
            <v-row v-if="hasTimeBilling && formData.table_type === 'billiard'" dense>
              <v-col cols="6">
                <v-text-field
                  v-model.number="formData.hourly_rate"
                  label="Tarifa por hora"
                  type="number"
                  prefix="$"
                  :rules="[v => (v !== null && v >= 0) || 'Tarifa requerida']"
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model.number="formData.billing_increment_minutes"
                  :items="[
                    { value: 1, title: 'Por minuto' },
                    { value: 15, title: 'Fracción de 15 min' },
                    { value: 30, title: 'Fracción de 30 min' },
                    { value: 60, title: 'Hora completa' },
                  ]"
                  item-title="title"
                  item-value="value"
                  label="Cobro por fracción de"
                />
              </v-col>
            </v-row>
            <v-select
              v-if="editing"
              v-model="formData.status"
              :items="statusOptions"
              item-title="title"
              item-value="value"
              label="Estado"
            />
            <v-switch
              v-if="editing"
              v-model="formData.active"
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
            @click="deleteTable"
          >
            Eliminar
          </v-btn>
          <v-spacer />
          <v-btn @click="dialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="save">Guardar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog: crear varias mesas -->
    <v-dialog v-model="bulkDialog" max-width="480" persistent>
      <v-card>
        <v-card-title>Crear varias mesas</v-card-title>
        <v-card-text>
          <p class="text-body-2 text-grey-darken-1 mb-4">
            Se numeran seguidas a partir de la última que tengas. Después puedes
            renombrar las que quieras.
          </p>
          <v-row dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="bulkData.quantity"
                label="¿Cuántas mesas?"
                type="number"
                min="1"
                max="100"
                autofocus
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="bulkData.capacity"
                label="Capacidad de cada una"
                type="number"
                min="1"
                max="20"
              />
            </v-col>
          </v-row>
          <v-select
            v-if="hasTimeBilling"
            v-model="bulkData.table_type"
            :items="[
              { value: 'dining', title: 'Mesas normales' },
              { value: 'billiard', title: 'Mesas de billar (cobro por tiempo)' },
            ]"
            item-title="title"
            item-value="value"
            label="Tipo de mesa"
          />
          <v-row v-if="hasTimeBilling && bulkData.table_type === 'billiard'" dense>
            <v-col cols="6">
              <v-text-field
                v-model.number="bulkData.hourly_rate"
                label="Tarifa por hora"
                type="number"
                prefix="$"
              />
            </v-col>
            <v-col cols="6">
              <v-select
                v-model.number="bulkData.billing_increment_minutes"
                :items="[
                  { value: 1, title: 'Por minuto' },
                  { value: 15, title: 'Fracción de 15 min' },
                  { value: 30, title: 'Fracción de 30 min' },
                  { value: 60, title: 'Hora completa' },
                ]"
                item-title="title"
                item-value="value"
                label="Cobro por fracción de"
              />
            </v-col>
          </v-row>
          <v-text-field v-model="bulkData.zone" label="Zona (opcional)" hint="Ej: Terraza, Segundo piso" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="bulkDialog = false">Cancelar</v-btn>
          <v-btn color="primary" :loading="saving" @click="saveBulk">
            Crear {{ bulkData.quantity || 0 }} mesas
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar" :color="snackbarColor" timeout="3000">
      {{ snackbarText }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { tablesService, type DiningTable, type DiningTableStatus } from '@/services/tablesService';
import { tableStatusLabels, label } from '@/utils/labels';
import { useAuthStore } from '@/stores/auth';
import { effectiveFeatures } from '@/types/auth';

// El cobro por tiempo es un módulo: un restaurante no ofrece mesas de billar.
const authStore = useAuthStore();
const hasTimeBilling = computed(() => effectiveFeatures(authStore.user).includes('time_billing'));

const tables = ref<DiningTable[]>([]);
const loading = ref(true);
const saving = ref(false);
const dialog = ref(false);
const bulkDialog = ref(false);

const bulkData = ref({
  quantity: 10,
  capacity: 4,
  table_type: 'dining' as 'dining' | 'billiard',
  hourly_rate: null as number | null,
  billing_increment_minutes: 15,
  zone: '',
});
const editing = ref<DiningTable | null>(null);

const formData = ref({
  number: 1,
  nickname: '',
  capacity: 4,
  table_type: 'dining' as 'dining' | 'billiard',
  hourly_rate: null as number | null,
  billing_increment_minutes: 15,
  status: 'available' as DiningTableStatus,
  active: true,
});

const statusOptions = [
  { value: 'available', title: 'Disponible' },
  { value: 'occupied', title: 'Ocupada' },
  { value: 'reserved', title: 'Reservada' },
];

const snackbar = ref(false);
const snackbarText = ref('');
const snackbarColor = ref('success');

const showMessage = (text: string, color = 'success') => {
  snackbarText.value = text;
  snackbarColor.value = color;
  snackbar.value = true;
};

const loadTables = async () => {
  loading.value = true;
  try {
    tables.value = await tablesService.getAll();
  } catch (error) {
    showMessage('Error al cargar mesas', 'error');
  } finally {
    loading.value = false;
  }
};

const getCardColor = (table: DiningTable) => {
  if (table.status === 'occupied') return 'warning';
  if (table.status === 'reserved') return 'info';
  return undefined;
};

const getTextColor = (table: DiningTable) => {
  if (table.status === 'available') return 'text-grey-darken-2';
  return 'text-white';
};

const getStatusColor = (status: string) => {
  if (status === 'occupied') return 'warning';
  if (status === 'reserved') return 'info';
  return 'success';
};

const getStatusLabel = (status: string) => label(tableStatusLabels, status);

const openDialog = (table?: DiningTable) => {
  editing.value = table || null;
  formData.value = table
    ? {
        number: table.number,
        nickname: table.nickname || '',
        capacity: table.capacity,
        table_type: table.table_type ?? 'dining',
        hourly_rate: table.hourly_rate ?? null,
        billing_increment_minutes: table.billing_increment_minutes ?? 15,
        status: table.status,
        active: table.active,
      }
    : {
        number: tables.value.length + 1,
        nickname: '',
        capacity: 4,
        table_type: 'dining',
        hourly_rate: null,
        billing_increment_minutes: 15,
        status: 'available',
        active: true,
      };
  dialog.value = true;
};

const save = async () => {
  if (!formData.value.number) return;
  saving.value = true;
  try {
    if (editing.value) {
      await tablesService.update(editing.value.id, formData.value);
      showMessage('Mesa actualizada');
    } else {
      await tablesService.create(formData.value);
      showMessage('Mesa creada');
    }
    dialog.value = false;
    loadTables();
  } catch (error) {
    showMessage('Error al guardar', 'error');
  } finally {
    saving.value = false;
  }
};

const saveBulk = async () => {
  if (!bulkData.value.quantity || bulkData.value.quantity < 1) {
    showMessage('Indica cuántas mesas quieres crear', 'error');
    return;
  }

  saving.value = true;
  try {
    const created = await tablesService.createBulk({
      ...bulkData.value,
      zone: bulkData.value.zone || null,
      hourly_rate: bulkData.value.table_type === 'billiard' ? bulkData.value.hourly_rate : null,
    });
    showMessage(`${created.length} mesas creadas`);
    bulkDialog.value = false;
    loadTables();
  } catch (error: any) {
    showMessage(error.response?.data?.message || 'Error al crear las mesas', 'error');
  } finally {
    saving.value = false;
  }
};

const deleteTable = async () => {
  if (!editing.value) return;
  if (!confirm(`¿Eliminar mesa ${editing.value.number}?`)) return;
  try {
    await tablesService.delete(editing.value.id);
    showMessage('Mesa eliminada');
    dialog.value = false;
    loadTables();
  } catch (error) {
    showMessage('Error al eliminar', 'error');
  }
};

const releaseTable = async (table: DiningTable) => {
  try {
    await tablesService.release(table.id);
    showMessage('Mesa liberada');
    loadTables();
  } catch (error) {
    showMessage('Error al liberar mesa', 'error');
  }
};

onMounted(() => {
  loadTables();
});
</script>
