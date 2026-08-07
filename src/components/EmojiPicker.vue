<template>
  <div>
    <p v-if="label" class="text-subtitle-2 mb-1">{{ label }}</p>

    <v-menu v-model="open" :close-on-content-click="false" location="bottom start">
      <template #activator="{ props: activator }">
        <v-btn v-bind="activator" variant="outlined" class="justify-start" min-width="140">
          <span v-if="modelValue" class="text-h6 mr-2">{{ modelValue }}</span>
          <v-icon v-else start>mdi-emoticon-outline</v-icon>
          {{ modelValue ? 'Cambiar' : 'Elegir emoji' }}
        </v-btn>
      </template>

      <v-card min-width="320" max-width="360">
        <v-card-text class="pb-2">
          <v-text-field
            v-model="search"
            placeholder="Buscar (ej: cerveza, pizza)"
            density="compact"
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
            autofocus
          />
        </v-card-text>

        <v-divider />

        <div class="emoji-scroll pa-2">
          <template v-for="group in filteredGroups" :key="group.name">
            <p class="text-caption text-grey px-1 mb-1">{{ group.name }}</p>
            <div class="d-flex flex-wrap mb-2">
              <v-btn
                v-for="item in group.items"
                :key="item.emoji"
                :title="item.keywords[0]"
                variant="text"
                size="small"
                class="emoji-button"
                @click="select(item.emoji)"
              >
                <span class="text-h6">{{ item.emoji }}</span>
              </v-btn>
            </div>
          </template>

          <p v-if="!filteredGroups.length" class="text-caption text-grey text-center py-4">
            Sin resultados para "{{ search }}"
          </p>
        </div>

        <v-divider />
        <v-card-actions>
          <v-btn v-if="modelValue" size="small" variant="text" color="error" @click="select(null)">
            Quitar emoji
          </v-btn>
          <v-spacer />
          <v-btn size="small" variant="text" @click="open = false">Cerrar</v-btn>
        </v-card-actions>
      </v-card>
    </v-menu>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { EMOJI_GROUPS } from '@/utils/emojis'

defineProps<{ modelValue: string | null | undefined; label?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const open = ref(false)
const search = ref('')

const filteredGroups = computed(() => {
  const query = (search.value || '').trim().toLowerCase()
  if (!query) return EMOJI_GROUPS

  return EMOJI_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => item.keywords.some(k => k.includes(query))),
    }))
    .filter(group => group.items.length > 0)
})

const select = (emoji: string | null) => {
  emit('update:modelValue', emoji)
  open.value = false
  search.value = ''
}
</script>

<style scoped>
.emoji-scroll {
  max-height: 280px;
  overflow-y: auto;
}

.emoji-button {
  min-width: 40px;
  padding: 0 4px;
}
</style>
