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
          :subtitle="`$${priceOf(item).toLocaleString('es-CO')}`"
          @click="$emit('add', item)"
        >
          <template #append>
            <v-icon color="success">mdi-plus-circle</v-icon>
          </template>
        </v-list-item>

        <v-list-item v-if="filteredItems.length === 0">
          <v-list-item-title class="text-grey">
            {{ items.length === 0 ? 'No hay productos en el menú' : 'Sin resultados' }}
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-col>

    <!-- Lo que lleva el pedido -->
    <v-col cols="12" md="5">
      <h4 class="mb-2">En el pedido</h4>

      <p v-if="selection.length === 0" class="text-grey text-body-2">
        Todavía no has agregado productos.
      </p>

      <v-list v-else density="compact">
        <v-list-item v-for="line in selection" :key="line.menu_item_id" class="px-0">
          <v-list-item-title class="text-body-2">{{ line.name }}</v-list-item-title>
          <v-list-item-subtitle>
            ${{ (line.unit_price * line.quantity).toLocaleString('es-CO') }}
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex align-center">
              <v-btn
                icon="mdi-minus"
                size="x-small"
                variant="tonal"
                @click="$emit('remove', line.menu_item_id)"
              />
              <span class="mx-2 font-weight-bold">{{ line.quantity }}</span>
              <v-btn
                icon="mdi-plus"
                size="x-small"
                variant="tonal"
                color="success"
                @click="$emit('add', { id: line.menu_item_id, name: line.name, final_price: line.unit_price })"
              />
            </div>
          </template>
        </v-list-item>
      </v-list>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { priceOf, type PickedLine } from '@/utils/orderLines';

const props = defineProps<{
  items: any[];
  loading?: boolean;
  selection: PickedLine[];
}>();

defineEmits<{
  add: [item: any];
  remove: [menuItemId: number];
}>();

const search = ref('');

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
