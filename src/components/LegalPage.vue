<template>
  <div class="bg-background py-4 py-md-10 px-2 px-sm-4">
    <v-sheet tag="article" max-width="760" rounded="lg" border class="legal text-body-1 mx-auto pa-5 pa-md-10">
      <header class="mb-8">
        <router-link to="/login" class="d-inline-flex align-center ga-2 text-decoration-none text-high-emphasis mb-6">
          <img :src="APP_ICON" alt="" width="32" height="32" />
          <span class="text-subtitle-1 font-weight-bold">{{ APP_NAME }}</span>
        </router-link>
        <h1 class="text-h4 mb-1">{{ title }}</h1>
        <p v-if="subtitle" class="text-h6 text-medium-emphasis">{{ subtitle }}</p>
        <p class="text-body-2 text-medium-emphasis">
          Versión {{ version }}. Fecha de entrada en vigencia: {{ effectiveDate }}.
        </p>
      </header>

      <slot />
    </v-sheet>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { APP_ICON, APP_NAME } from '@/utils/branding'

const props = defineProps<{
  title: string
  subtitle?: string
  version: string
  effectiveDate: string
}>()

// Google Play and browser tabs read the document title.
let previousTitle = ''
onMounted(() => {
  previousTitle = document.title
  document.title = `${props.title} · ${APP_NAME}`
})
onUnmounted(() => {
  document.title = previousTitle
})
</script>

<style scoped>
.legal :deep(h2) {
  margin-top: 40px;
  margin-bottom: 12px;
  scroll-margin-top: 16px;
}

.legal :deep(h3) {
  margin-top: 24px;
  margin-bottom: 8px;
}

.legal :deep(p),
.legal :deep(ul),
.legal :deep(ol) {
  margin-bottom: 16px;
}

.legal :deep(ul),
.legal :deep(ol) {
  padding-inline-start: 24px;
}

.legal :deep(li) {
  margin-bottom: 8px;
}

.legal :deep(li > ul),
.legal :deep(li > ol) {
  margin-top: 8px;
  margin-bottom: 8px;
}

.legal :deep(a) {
  color: rgb(var(--v-theme-primary));
}
</style>
