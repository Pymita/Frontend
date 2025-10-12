import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import { createRouter, createWebHistory } from 'vue-router'

// Vuetify
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

// Components
import App from './App.vue'

// Configuración de rutas
import { routes } from './router'

// Crear instancias
const app = createApp(App)
const pinia = createPinia()

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#f26916',
          secondary: '#6b7280',
          accent: '#e3530c',
          error: '#ef4444',
          warning: '#f59e0b',
          info: '#3b82f6',
          success: '#10b981',
        },
      },
    },
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
  history: createWebHistory(),
  routes,
})

// Usar plugins
app.use(pinia)
app.use(vuetify)
app.use(router)

app.mount('#app')
