import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import { es } from 'vuetify/locale'
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
  // Sin esto las tablas dicen "No data available" / "Items per page" y el
  // calendario sale en inglés.
  locale: {
    locale: 'es',
    fallback: 'es',
    messages: { es },
  },
  date: {
    locale: { es: 'es-CO' },
  },
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
  // The page renders after the browser's own jump to #section, so a link
  // such as /privacidad#eliminacion needs the router to scroll there.
  scrollBehavior: to => (to.hash ? { el: to.hash, top: 16 } : undefined),
})

setupRouterGuards(router)

// Usar plugins
app.use(pinia)
app.use(vuetify)
app.use(router)

app.mount('#app')
