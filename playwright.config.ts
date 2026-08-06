import { defineConfig } from '@playwright/test'

/**
 * E2E: levanta backend (Laravel, puerto 8010) con una base de datos
 * SQLite propia (database/e2e.sqlite, recreada y sembrada en cada
 * arranque) y el frontend (Vite, puerto 5199) apuntando a ese backend.
 * La base de desarrollo nunca se toca.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command:
        "sh -c 'cd ../backend && touch database/e2e.sqlite && " +
        'DB_DATABASE="$PWD/database/e2e.sqlite" php artisan migrate:fresh --seed --force && ' +
        'DB_DATABASE="$PWD/database/e2e.sqlite" php artisan serve --host=127.0.0.1 --port=8010\'',
      url: 'http://127.0.0.1:8010/up',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'VITE_API_BASE_URL=http://127.0.0.1:8010/api npm run dev -- --host 127.0.0.1 --port 5199 --strictPort',
      url: 'http://127.0.0.1:5199',
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
