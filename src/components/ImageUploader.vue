<template>
  <div>
    <p v-if="label" class="text-subtitle-2 mb-1">{{ label }}</p>

    <div class="d-flex align-center ga-3">
      <!-- Vista previa -->
      <v-avatar
        v-if="preview"
        :size="size"
        rounded="lg"
        class="border"
      >
        <v-img :src="preview" :alt="label || 'Imagen'" cover />
      </v-avatar>
      <v-sheet
        v-else
        :width="size"
        :height="size"
        rounded="lg"
        color="grey-lighten-3"
        class="d-flex align-center justify-center"
      >
        <v-icon color="grey">mdi-image-outline</v-icon>
      </v-sheet>

      <div class="flex-grow-1">
        <v-file-input
          v-model="file"
          :label="modelValue ? 'Cambiar imagen' : 'Subir imagen'"
          accept="image/jpeg,image/png,image/webp"
          prepend-icon=""
          prepend-inner-icon="mdi-camera"
          density="compact"
          hide-details="auto"
          :loading="uploading"
          :disabled="uploading"
          :error-messages="error"
          @update:model-value="onSelect"
        />
        <div class="d-flex align-center ga-2 mt-1">
          <span class="text-caption text-grey">JPG, PNG o WEBP · máximo 8 MB</span>
          <v-spacer />
          <v-btn
            v-if="modelValue"
            size="x-small"
            variant="text"
            color="error"
            :disabled="uploading"
            @click="clear"
          >
            Quitar
          </v-btn>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { imagesService, type ImageFolder } from '@/services/imagesService'
import { resolveImageUrl } from '@/utils/images'

const props = withDefaults(defineProps<{
  modelValue: string | null | undefined
  folder: ImageFolder
  label?: string
  size?: number
}>(), { size: 72 })

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const file = ref<File | File[] | null>(null)
const uploading = ref(false)
const error = ref<string>('')

const preview = computed(() => resolveImageUrl(props.modelValue))

const onSelect = async (selected: File | File[] | null) => {
  const chosen = Array.isArray(selected) ? selected[0] : selected
  if (!chosen) return

  uploading.value = true
  error.value = ''
  try {
    const url = await imagesService.upload(chosen, props.folder, props.modelValue)
    emit('update:modelValue', url)
  } catch (e: any) {
    error.value = e.response?.data?.message || 'No se pudo subir la imagen'
  } finally {
    uploading.value = false
    file.value = null
  }
}

const clear = () => {
  emit('update:modelValue', null)
  file.value = null
}
</script>
