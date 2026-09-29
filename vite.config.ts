import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages sirve bajo /Frontend/: el workflow exporta VITE_BASE.
  base: process.env.VITE_BASE || '/',
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
      styles: { configFile: 'src/styles/settings.scss' },
    }),
  ],
  // Auto-imported Vuetify components are invisible to Vite's startup scan, so
  // pre-bundling them re-optimizes mid page load ("504 Outdated Optimize Dep")
  // and the first page stays blank. Serving Vuetify as plain ESM avoids it.
  optimizeDeps: {
    exclude: ['vuetify'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
