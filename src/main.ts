import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './style.css'
import { componentDefaults, lightTheme } from './theme'

// Components
import App from './App.vue'

// Configuración de rutas
import { routes, setupRouterGuards } from './router'

// Crear instancias
const app = createApp(App)
const pinia = createPinia()

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: { light: lightTheme },
  },
  defaults: componentDefaults,
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
})

const router = createRouter({
  // BASE_URL sale de `base` en vite: '/' en local y '/Frontend/' en
  // GitHub Pages (la app vive bajo un subdirectorio del dominio).
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

setupRouterGuards(router)

// Usar plugins
app.use(pinia)
app.use(vuetify)
app.use(router)

app.mount('#app')
