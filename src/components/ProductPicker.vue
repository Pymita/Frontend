<template>
  <v-row>
    <!-- Catálogo: un clic agrega una unidad -->
    <v-col cols="12" md="7">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        label="Buscar producto"
        density="compact"
        hide-details
        clearable
        class="mb-2"
      />

      <div v-if="loading" class="text-center py-8">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <v-list v-else density="compact" class="picker-list border rounded">
        <v-list-item
          v-for="item in filteredItems"
          :key="item.id"
          :title="item.name"
          :subtitle="money(priceOf(item))"
          @click="$emit('add', item, guest)"
        >
          <template #append>
            <v-icon color="primary">mdi-plus-circle</v-icon>
          </template>
        </v-list-item>

        <v-list-item v-if="filteredItems.length === 0">
          <v-list-item-title class="text-medium-emphasis">
            {{ items.length === 0 ? 'No hay productos en el menú' : 'Sin resultados' }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-col>

    <!-- Lo que lleva el pedido -->
    <v-col cols="12" md="5">
      <h4 class="mb-2">En el pedido</h4>

      <!--
        Cuentas separadas: se elige la persona ANTES de tocar los productos
        y todo lo que se agregue va para ella. Sin separar, todo es
        "compartido" y la mesa paga junta.
      -->
      <div class="d-flex align-center flex-wrap ga-1 mb-2">
        <span class="text-caption text-medium-emphasis mr-1">Para:</span>
        <v-chip
          size="small"
          :color="guest === null ? 'primary' : undefined"
          :variant="guest === null ? 'flat' : 'tonal'"
          @click="setGuest(null)"
        >
          Compartido
        </v-chip>
        <v-chip
          v-for="n in guestCount"
          :key="n"
          size="small"
          :color="guest === n ? 'primary' : undefined"
          :variant="guest === n ? 'flat' : 'tonal'"
          @click="setGuest(n)"
        >
          {{ nameOf(n) }}
          <!-- Lapicito: renombrar la persona (por defecto "Persona N"). -->
          <v-icon size="x-small" class="ml-1" title="Editar nombre" @click.stop="startEdit(n)">
            mdi-pencil
          </v-icon>
        </v-chip>
        <v-chip size="small" variant="outlined" prepend-icon="mdi-account-plus" @click="addGuest">
          Persona
        </v-chip>
      </div>

      <!-- Editor de nombre en línea de la persona seleccionada. -->
      <div v-if="editingGuest !== null" class="d-flex align-center ga-2 mb-2">
        <v-text-field
          v-model="editingName"
          :label="`Nombre de la Persona ${editingGuest}`"
          :placeholder="`Persona ${editingGuest}`"
          density="compact"
          hide-details
          autofocus
          maxlength="40"
          max-width="260"
          @keyup.enter="confirmEdit"
        />
        <v-btn size="small" color="primary" variant="tonal" @click="confirmEdit">Guardar</v-btn>
        <v-btn size="small" variant="text" @click="editingGuest = null">Cancelar</v-btn>
      </div>

      <p v-if="selection.length === 0" class="text-medium-emphasis text-body-2">
        Todavía no has agregado productos.
      </p>

      <v-list v-else density="compact">
        <v-list-item
          v-for="line in selection"
          :key="`${line.menu_item_id}-${line.guest_number ?? 0}`"
          class="px-0"
        >
          <v-list-item-title class="text-body-2">
            <v-chip
              v-if="line.guest_number"
              size="x-small"
              color="primary"
              variant="tonal"
              class="mr-1"
            >
              P{{ line.guest_number }}
            </v-chip>
            {{ line.name }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ money(line.unit_price * line.quantity) }}
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                size="x-small"
                variant="tonal"
                color="secondary"
                :aria-label="`Quitar una unidad de ${line.name}`" @click="$emit('remove', line)"
              />
              <span class="mx-2 font-weight-bold">{{ line.quantity }}</span>
              <v-btn
                icon="mdi-plus"
                size="x-small"
                variant="tonal"
                color="secondary"
                :aria-label="`Agregar una unidad de ${line.name}`" @click="$emit('add', { id: line.menu_item_id, name: line.name, final_price: line.unit_price }, line.guest_number)"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { money } from '@/utils/money'
import { computed, ref, watch } from 'vue';
import { guestsIn, priceOf, type PickedLine } from '@/utils/orderLines';

const props = defineProps<{
  items: any[];
  loading?: boolean;
  selection: PickedLine[];
  /** Personas que ya tiene el pedido abierto (para seguir numerando desde ahí) */
  existingGuests?: number;
  /** Nombres de las personas (número→nombre); sin nombre se muestra "Persona N". */
  guestNames?: Record<number, string>;
}>();

const emit = defineEmits<{
  add: [item: any, guest: number | null];
  remove: [line: PickedLine];
  rename: [guest: number, name: string];
}>();

const search = ref('');

// Nombre visible de una persona: el que le pusieron, o "Persona N".
const nameOf = (n: number): string => props.guestNames?.[n] || `Persona ${n}`;

// Edición del nombre de una persona (lapicito).
const editingGuest = ref<number | null>(null);
const editingName = ref('');
const startEdit = (n: number) => {
  editingGuest.value = n;
  editingName.value = props.guestNames?.[n] ?? '';
};
const confirmEdit = () => {
  if (editingGuest.value === null) return;
  emit('rename', editingGuest.value, editingName.value.trim());
  editingGuest.value = null;
};

// Persona activa: a ella van los productos que se agreguen.
const guest = ref<number | null>(null);
const extraGuests = ref(0);

const guestCount = computed(() =>
  Math.max(props.existingGuests ?? 0, guestsIn(props.selection), extraGuests.value),
);

const setGuest = (value: number | null) => {
  guest.value = value;
};

const addGuest = () => {
  extraGuests.value = guestCount.value + 1;
  guest.value = extraGuests.value;
};

// Al vaciar la selección (diálogo nuevo) se vuelve a "compartido".
watch(() => props.selection.length, (length) => {
  if (length === 0) {
    guest.value = null;
    extraGuests.value = 0;
  }
});

const filteredItems = computed(() => {
  const term = (search.value || '').toLowerCase().trim();
  const available = props.items.filter(item => item.available !== false);

  if (!term) return available;

  return available.filter(item => item.name.toLowerCase().includes(term));
});
</script>

<style scoped>
/* La lista scrollea sola para que el diálogo no crezca sin control. */
.picker-list {
  max-height: 320px;
  overflow-y: auto;
}
</style>
