<template>
  <v-dialog :model-value="modelValue" max-width="900" scrollable @update:model-value="close">
    <v-card>
      <v-card-title class="bg-primary">
        <v-icon start>mdi-file-excel</v-icon>
        Importar productos desde un archivo
      </v-card-title>

      <v-card-text class="pt-4">
        <!-- Lo primero: sin categorías no hay importación posible -->
        <v-alert type="warning" density="compact" class="mb-4">
          <strong>Antes de importar, crea las categorías</strong> en la pantalla de
          Categorías. El archivo no las crea: si nombra una que no existe, no se
          importa nada y te decimos cuáles faltan.
        </v-alert>

        <div class="d-flex align-center flex-wrap ga-2 mb-4">
          <v-btn color="primary" variant="tonal" :loading="downloading" @click="download">
            <v-icon start>mdi-download</v-icon>
            Descargar Excel de ejemplo
          </v-btn>
          <span class="text-caption text-grey-darken-1">
            Trae los encabezados listos y una fila de muestra.
          </span>
        </div>

        <h4 class="mb-2">Columnas del archivo</h4>
        <p class="text-body-2 text-grey-darken-1 mb-3">
          La primera fila son los nombres de las columnas. El orden no importa y no
          distinguimos mayúsculas ni tildes.
        </p>

        <v-table density="compact" class="mb-4 border rounded">
          <thead>
            <tr>
              <th>Columna</th>
              <th>¿Obligatoria?</th>
              <th>Qué va ahí</th>
              <th>Ejemplo</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="column in format?.columns ?? []" :key="column.key">
              <td class="font-weight-bold text-no-wrap">{{ column.label }}</td>
              <td>
                <v-chip :color="column.required ? 'error' : 'grey'" size="x-small" variant="flat">
                  {{ column.required ? 'Obligatoria' : 'Opcional' }}
                </v-chip>
              </td>
              <td class="text-body-2">{{ column.help }}</td>
              <td class="text-body-2 text-grey-darken-1 text-no-wrap">{{ column.example }}</td>
            </tr>
          </tbody>
        </v-table>

        <ul class="text-body-2 text-grey-darken-1 mb-4 pl-4">
          <li v-for="note in format?.notes ?? []" :key="note">{{ note }}</li>
        </ul>

        <v-file-input
          v-model="file"
          label="Archivo de productos (.xlsx o .csv)"
          accept=".xlsx,.csv"
          prepend-icon="mdi-paperclip"
          density="comfortable"
          show-size
          :disabled="importing"
        />

        <!-- Resultado del intento -->
        <v-alert v-if="missingCategories.length" type="error" class="mt-2">
          <p class="mb-2">
            <strong>Faltan categorías.</strong> Créalas primero y vuelve a subir el archivo:
          </p>
          <v-chip
            v-for="name in missingCategories"
            :key="name"
            size="small"
            class="mr-1 mb-1"
            color="error"
            variant="flat"
          >
            {{ name }}
          </v-chip>
        </v-alert>

        <v-alert v-else-if="rowErrors.length" type="error" class="mt-2">
          <p class="mb-2">
            <strong>El archivo tiene {{ totalErrors }} {{ totalErrors === 1 ? 'error' : 'errores' }}</strong>
            y no se importó nada. Corrígelos y vuelve a subirlo:
          </p>
          <v-table density="compact" class="error-table">
            <tbody>
              <tr v-for="(rowError, index) in rowErrors" :key="index">
                <td class="font-weight-bold text-no-wrap">
                  {{ rowError.fila > 0 ? `Fila ${rowError.fila}` : 'Archivo' }}
                </td>
                <td>{{ rowError.error }}</td>
              </tr>
            </tbody>
          </v-table>
          <p v-if="totalErrors > rowErrors.length" class="text-caption mt-2 mb-0">
            Se muestran los primeros {{ rowErrors.length }}.
          </p>
        </v-alert>

        <v-alert v-else-if="generalError" type="error" class="mt-2">
          {{ generalError }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn :disabled="importing" @click="close(false)">Cerrar</v-btn>
        <v-btn color="primary" :loading="importing" :disabled="!file" @click="upload">
          <v-icon start>mdi-upload</v-icon>
          Importar productos
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  productImportService,
  type ImportFormat,
  type ImportRowError,
} from '@/services/productImportService'
import { errorMessage } from '@/utils/errors'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  imported: [created: number]
}>()

const format = ref<ImportFormat | null>(null)
const file = ref<File | File[] | null>(null)
const importing = ref(false)
const downloading = ref(false)
const rowErrors = ref<ImportRowError[]>([])
const totalErrors = ref(0)
const missingCategories = ref<string[]>([])
const generalError = ref('')

// La guía de columnas la define el backend: así no se desincroniza.
watch(
  () => props.modelValue,
  async (open) => {
    if (!open) return

    clearResult()

    if (!format.value) {
      try {
        format.value = await productImportService.format()
      } catch (error) {
        generalError.value = errorMessage(error, 'No se pudo cargar el formato: ')
      }
    }
  },
)

const clearResult = () => {
  rowErrors.value = []
  totalErrors.value = 0
  missingCategories.value = []
  generalError.value = ''
}

const close = (value: boolean) => {
  if (!value) {
    file.value = null
    clearResult()
  }
  emit('update:modelValue', value)
}

const download = async () => {
  downloading.value = true
  try {
    await productImportService.downloadTemplate()
  } catch (error) {
    generalError.value = errorMessage(error, 'No se pudo descargar la plantilla: ')
  } finally {
    downloading.value = false
  }
}

/** v-file-input devuelve File o File[] según la versión. */
const selectedFile = (): File | null => {
  const value = file.value
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

const upload = async () => {
  const chosen = selectedFile()
  if (!chosen) return

  importing.value = true
  clearResult()

  try {
    const result = await productImportService.upload(chosen)
    emit('imported', result.created)
    file.value = null
    close(false)
  } catch (error: any) {
    const data = error?.response?.data?.data

    if (data) {
      rowErrors.value = data.errors ?? []
      totalErrors.value = data.total_errors ?? data.errors?.length ?? 0
      missingCategories.value = data.missing_categories ?? []
    }

    if (!rowErrors.value.length && !missingCategories.value.length) {
      generalError.value = errorMessage(error, 'No se pudo importar: ')
    }
  } finally {
    importing.value = false
  }
}
</script>

<style scoped>
/* Un archivo con muchos errores no debe estirar el diálogo sin fin. */
.error-table {
  max-height: 240px;
  overflow-y: auto;
}
</style>
