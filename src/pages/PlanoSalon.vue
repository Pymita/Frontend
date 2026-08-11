<template>
  <v-container fluid>
    <div class="d-flex align-center justify-space-between flex-wrap mb-4">
      <div>
        <h1 class="text-h5 font-weight-bold">Plano del Salón</h1>
        <p class="text-body-2 text-medium-emphasis mb-0">
          {{ editMode ? 'Arrastra las mesas para ubicarlas como están en el local' : 'Estado de las mesas en tiempo real' }}
        </p>
      </div>

      <div class="d-flex align-center ga-3">
        <template v-if="!editMode">
          <v-chip size="small" color="success" variant="flat">Disponible</v-chip>
          <v-chip size="small" color="orange-darken-1" variant="flat">Ocupada</v-chip>
          <v-chip size="small" color="blue" variant="flat">Reservada</v-chip>
        </template>
        <v-btn
          v-if="editMode"
          color="primary"
          :disabled="!dirty"
          :loading="saving"
          prepend-icon="mdi-content-save"
          @click="saveLayout"
        >
          Guardar plano
        </v-btn>
        <!-- Cuenta vencida: el interruptor queda a la vista pero apagado. -->
        <v-tooltip v-if="authStore.isAdmin && authStore.isReadOnly" location="bottom" max-width="320">
          <template #activator="{ props: activator }">
            <span v-bind="activator" class="d-inline-flex">
              <v-switch
                disabled
                label="Editar plano"
                hide-details
                density="compact"
              />
            </span>
          </template>
          <div class="font-weight-medium">Tu suscripción está vencida</div>
          <div class="text-caption">Renueva el pago para volver a editar el plano del salón.</div>
        </v-tooltip>
        <v-switch
          v-else-if="authStore.isAdmin"
          v-model="editMode"
          color="primary"
          label="Editar plano"
          hide-details
          density="compact"
        />
      </div>
    </div>

    <v-alert v-if="editMode && dirty" type="info" variant="tonal" density="compact" class="mb-3">
      Tienes cambios sin guardar en el plano.
    </v-alert>

    <v-alert
      v-if="!editMode && unplacedTables.length"
      type="warning"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ unplacedTables.length === 1 ? 'Hay 1 mesa sin ubicar' : `Hay ${unplacedTables.length} mesas sin ubicar` }}
      ({{ unplacedTables.map(displayName).join(', ') }}).
      <template v-if="authStore.isAdmin"> Activa "Editar plano" para colocarlas.</template>
    </v-alert>

    <v-card :loading="loading">
      <div class="plan-wrapper">
        <svg
          ref="svgRef"
          viewBox="0 0 1000 620"
          class="plan-svg"
          :class="{ editing: editMode }"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointerleave="onPointerUp"
          @pointerdown.self="selectedId = null"
        >
          <defs>
            <pattern id="grid" :width="GRID" :height="GRID" patternUnits="userSpaceOnUse">
              <path :d="`M ${GRID} 0 L 0 0 0 ${GRID}`" fill="none" stroke="#00000014" stroke-width="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width="1000" height="620" :fill="editMode ? 'url(#grid)' : 'transparent'" />

          <g
            v-for="table in placedTables"
            :key="table.id"
            :transform="`translate(${table.pos_x}, ${table.pos_y})`"
            class="table-node"
            :class="{ draggable: editMode, selected: editMode && selectedId === table.id }"
            @pointerdown.stop="onPointerDown(table, $event)"
            @click.stop="onTableClick(table)"
          >
            <circle
              v-if="table.shape === 'round'"
              r="46"
              :fill="fillFor(table)"
              :stroke="strokeFor(table)"
              stroke-width="3"
            />
            <rect
              v-else
              :x="-shapeWidth(table) / 2"
              :y="-shapeHeight(table) / 2"
              :width="shapeWidth(table)"
              :height="shapeHeight(table)"
              rx="10"
              :fill="fillFor(table)"
              :stroke="strokeFor(table)"
              stroke-width="3"
            />
            <text text-anchor="middle" dy="-2" class="table-number">{{ table.table_type === 'billiard' ? '🎱' + table.number : table.number }}</text>
            <text text-anchor="middle" dy="16" class="table-name">
              {{ billiardTimerLabel(table) || table.nickname || (table.table_type === 'billiard' ? 'Billar' : `${table.capacity} pers.`) }}
            </text>
          </g>
        </svg>
      </div>
    </v-card>

    <!-- Panel del editor: mesa seleccionada + mesas sin ubicar -->
    <v-card v-if="editMode" class="mt-4 pa-4">
      <div v-if="selectedTable" class="d-flex align-center flex-wrap ga-4 mb-4">
        <span class="font-weight-bold">{{ displayName(selectedTable) }}</span>
        <v-btn-toggle
          :model-value="selectedTable.shape"
          density="compact"
          mandatory
          @update:model-value="setShape(selectedTable!, $event)"
        >
          <v-btn value="square" icon="mdi-square-outline" size="small" />
          <v-btn value="round" icon="mdi-circle-outline" size="small" />
          <v-btn value="rect" icon="mdi-rectangle-outline" size="small" />
        </v-btn-toggle>
        <v-text-field
          :model-value="selectedTable.zone ?? ''"
          label="Zona (ej. Terraza, Pared derecha)"
          density="compact"
          hide-details
          style="max-width: 280px"
          @update:model-value="setZone(selectedTable!, $event)"
        />
        <v-btn
          variant="text"
          color="error"
          size="small"
          prepend-icon="mdi-map-marker-off"
          @click="removeFromPlan(selectedTable!)"
        >
          Quitar del plano
        </v-btn>
      </div>
      <p v-else class="text-body-2 text-medium-emphasis mb-4">
        Toca una mesa del plano para cambiar su forma o zona.
      </p>

      <template v-if="unplacedTables.length">
        <div class="text-body-2 font-weight-bold mb-2">Mesas sin ubicar (toca para colocarlas):</div>
        <div class="d-flex flex-wrap ga-2">
          <v-chip
            v-for="table in unplacedTables"
            :key="table.id"
            prepend-icon="mdi-plus"
            color="primary"
            variant="tonal"
            @click="placeTable(table)"
          >
            {{ displayName(table) }}
          </v-chip>
        </div>
      </template>
    </v-card>

    <!-- Detalle de mesa en modo operación -->
    <v-dialog v-model="detailOpen" max-width="420">
      <v-card v-if="detailTable">
        <v-card-title class="d-flex align-center justify-space-between">
          {{ displayName(detailTable) }}
          <v-chip :color="statusColor(detailTable.status)" size="small" variant="flat">
            {{ label(tableStatusLabels, detailTable.status) }}
          </v-chip>
        </v-card-title>
        <v-card-text>
          <div class="text-body-2 mb-1">Capacidad: {{ detailTable.capacity }} personas</div>
          <div v-if="detailTable.zone" class="text-body-2 mb-1">Zona: {{ detailTable.zone }}</div>
          <v-divider class="my-3" />
          <template v-if="detailTable.latest_active_order">
            <div class="text-body-2 font-weight-bold mb-1">Pedido activo #{{ detailTable.latest_active_order.id }}</div>
            <div class="text-body-2">Total: ${{ Number(detailTable.latest_active_order.total).toLocaleString() }}</div>
            <div class="text-body-2">
              Pago: {{ label(paymentStatusLabels, detailTable.latest_active_order.payment_status) }}
            </div>
          </template>
          <div v-else class="text-body-2 text-medium-emphasis">Sin pedido activo.</div>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">Cerrar</v-btn>
          <v-btn
            v-if="detailTable.latest_active_order"
            color="primary"
            variant="flat"
            @click="goToOrders"
          >
            Ver pedidos
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-snackbar v-model="snackbar.open" :color="snackbar.color" :timeout="snackbar.color === 'error' ? 9000 : 3000" closable>
      {{ snackbar.text }}
    </v-snackbar>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { tablesService } from '@/services/tablesService';
import type { DiningTable, DiningTableShape, DiningTableStatus } from '@/services/tablesService';
import { label, paymentStatusLabels, tableStatusLabels } from '@/utils/labels';
import { useAuthStore } from '@/stores/auth';

const GRID = 20;
const BOUNDS = { minX: 70, maxX: 930, minY: 60, maxY: 560 };
const POLL_MS = 10000;

const authStore = useAuthStore();
const router = useRouter();

const tables = ref<DiningTable[]>([]);
const loading = ref(false);
const saving = ref(false);
const dirty = ref(false);
const editMode = ref(false);
const selectedId = ref<number | null>(null);
const detailOpen = ref(false);
const detailTable = ref<DiningTable | null>(null);
const svgRef = ref<SVGSVGElement | null>(null);
const snackbar = ref({ open: false, text: '', color: 'success' });

const placedTables = computed(() =>
  tables.value.filter((t) => t.active && t.pos_x !== null && t.pos_y !== null),
);
const unplacedTables = computed(() =>
  tables.value.filter((t) => t.active && (t.pos_x === null || t.pos_y === null)),
);
const selectedTable = computed(() =>
  tables.value.find((t) => t.id === selectedId.value) ?? null,
);

const displayName = (table: DiningTable) => table.nickname || `Mesa ${table.number}`;

// --- Billar: tiempo transcurrido en vivo sobre el plano ---
const nowTick = ref(Date.now());
const tickInterval = setInterval(() => { nowTick.value = Date.now(); }, 15_000);
onUnmounted(() => clearInterval(tickInterval));

const billiardTimerLabel = (table: DiningTable): string | null => {
  const order = table.latest_active_order;
  if (table.table_type !== 'billiard' || !order?.time_started_at || order.time_ended_at) {
    return null;
  }

  const minutes = Math.max(0, Math.floor((nowTick.value - new Date(order.time_started_at).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return `⏱ ${hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`}`;
};
const shapeWidth = (table: DiningTable) => (table.shape === 'rect' ? 132 : 84);
const shapeHeight = (table: DiningTable) => (table.shape === 'rect' ? 76 : 84);

const statusFills: Record<DiningTableStatus, string> = {
  available: '#66BB6A',
  occupied: '#FB8C00',
  reserved: '#42A5F5',
};
const statusStrokes: Record<DiningTableStatus, string> = {
  available: '#2E7D32',
  occupied: '#E65100',
  reserved: '#1565C0',
};

const fillFor = (table: DiningTable) =>
  editMode.value ? '#ECEFF1' : statusFills[table.status];
const strokeFor = (table: DiningTable) => {
  if (editMode.value) {
    return selectedId.value === table.id ? '#1976D2' : '#90A4AE';
  }
  return statusStrokes[table.status];
};
const statusColor = (status: DiningTableStatus) =>
  ({ available: 'success', occupied: 'orange-darken-1', reserved: 'blue' })[status];

// ---- Carga y refresco ----

const load = async () => {
  loading.value = true;
  try {
    tables.value = await tablesService.getAll();
  } catch {
    notify('No se pudieron cargar las mesas', 'error');
  } finally {
    loading.value = false;
  }
};

let pollTimer: ReturnType<typeof setInterval> | null = null;
const startPolling = () => {
  stopPolling();
  pollTimer = setInterval(async () => {
    if (editMode.value || dirty.value) return;
    try {
      tables.value = await tablesService.getAll();
    } catch {
      // silencioso: el próximo tick reintenta
    }
  }, POLL_MS);
};
const stopPolling = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

onMounted(async () => {
  await load();
  startPolling();
});
onBeforeUnmount(stopPolling);

watch(editMode, (editing) => {
  selectedId.value = null;
  if (!editing && dirty.value) {
    // Al salir del modo edición sin guardar, recargar el plano original.
    dirty.value = false;
    load();
  }
});

// ---- Drag & drop ----

interface DragState {
  id: number;
  offsetX: number;
  offsetY: number;
}
let drag: DragState | null = null;

const toSvgPoint = (event: PointerEvent): { x: number; y: number } | null => {
  const svg = svgRef.value;
  if (!svg) return null;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
  return { x: point.x, y: point.y };
};

const onPointerDown = (table: DiningTable, event: PointerEvent) => {
  if (!editMode.value) return;
  selectedId.value = table.id;
  const point = toSvgPoint(event);
  if (!point || table.pos_x === null || table.pos_y === null) return;
  drag = { id: table.id, offsetX: point.x - table.pos_x, offsetY: point.y - table.pos_y };
};

const onPointerMove = (event: PointerEvent) => {
  if (!drag) return;
  const point = toSvgPoint(event);
  const table = tables.value.find((t) => t.id === drag!.id);
  if (!point || !table) return;
  const snap = (value: number) => Math.round(value / GRID) * GRID;
  table.pos_x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, snap(point.x - drag.offsetX)));
  table.pos_y = Math.min(BOUNDS.maxY, Math.max(BOUNDS.minY, snap(point.y - drag.offsetY)));
  dirty.value = true;
};

const onPointerUp = () => {
  drag = null;
};

// ---- Acciones del editor ----

const placeTable = (table: DiningTable) => {
  // Buscar un hueco libre en el centro, desplazándose hacia la derecha.
  let x = 300;
  const y = 300;
  const taken = new Set(placedTables.value.map((t) => `${t.pos_x},${t.pos_y}`));
  while (taken.has(`${x},${y}`) && x < BOUNDS.maxX) {
    x += GRID * 6;
  }
  table.pos_x = x;
  table.pos_y = y;
  selectedId.value = table.id;
  dirty.value = true;
};

const removeFromPlan = (table: DiningTable) => {
  table.pos_x = null;
  table.pos_y = null;
  selectedId.value = null;
  dirty.value = true;
};

const setShape = (table: DiningTable, shape: DiningTableShape) => {
  table.shape = shape;
  dirty.value = true;
};

const setZone = (table: DiningTable, zone: string) => {
  table.zone = zone.trim() === '' ? null : zone;
  dirty.value = true;
};

const saveLayout = async () => {
  saving.value = true;
  try {
    tables.value = await tablesService.saveLayout(
      tables.value.map((t) => ({
        id: t.id,
        pos_x: t.pos_x,
        pos_y: t.pos_y,
        shape: t.shape,
        zone: t.zone,
      })),
    );
    dirty.value = false;
    notify('Plano guardado exitosamente', 'success');
  } catch {
    notify('No se pudo guardar el plano', 'error');
  } finally {
    saving.value = false;
  }
};

// ---- Modo operación ----

const onTableClick = (table: DiningTable) => {
  if (editMode.value) return;
  detailTable.value = table;
  detailOpen.value = true;
};

const goToOrders = () => {
  detailOpen.value = false;
  router.push('/pedidos');
};

const notify = (text: string, color: string) => {
  snackbar.value = { open: true, text, color };
};
</script>

<style scoped>
.plan-wrapper {
  overflow-x: auto;
}

.plan-svg {
  display: block;
  width: 100%;
  min-width: 700px;
  aspect-ratio: 1000 / 620;
  background-color: rgb(var(--v-theme-surface));
  touch-action: none;
}

.table-node {
  cursor: pointer;
  user-select: none;
}

.table-node.draggable {
  cursor: grab;
}

.table-node.selected {
  filter: drop-shadow(0 0 4px rgba(25, 118, 210, 0.7));
}

.table-number {
  font-size: 22px;
  font-weight: 700;
  fill: #263238;
}

.table-name {
  font-size: 11px;
  fill: #37474f;
}
</style>
