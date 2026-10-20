import { defineConfig } from '@playwright/test'

// The API runs in America/Bogota (APP_TIMEZONE) and so do the customers. On a
// UTC runner "today" is already tomorrow after 7pm Bogotá, and every screen
// that defaults its date filter to today misses the sales just created. The
// specs (Node) and the browser must share the API's clock.
process.env.TZ = 'America/Bogota'

// Two checkouts (worktrees) can run their suites at the same time on other
// ports; each one already has its own ../backend and e2e.sqlite. The specs read
// the API port from the environment the workers inherit (helpers.ts).
const API_PORT = process.env.E2E_API_PORT ?? '8010'
const WEB_PORT = process.env.E2E_WEB_PORT ?? '5199'
process.env.E2E_API_PORT = API_PORT

/**
 * E2E: levanta backend (Laravel, puerto 8010 por defecto) con una base de datos
 * SQLite propia (database/e2e.sqlite, recreada y sembrada en cada
 * arranque) y el frontend (Vite, puerto 5199 por defecto) apuntando a ese backend.
 * La base de desarrollo nunca se toca.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  // Every spec shares one backend and one e2e.sqlite: parallel workers
  // interfere with each other (tables, open orders, kardex rows).
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    timezoneId: 'America/Bogota',
    // Colombian users run Spanish browsers; the app must read the same.
    locale: 'es-CO',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command:
        "sh -c 'cd ../backend && touch database/e2e.sqlite && " +
        'DB_DATABASE="$PWD/database/e2e.sqlite" php artisan migrate:fresh --seed --force && ' +
        // La cuenta de plataforma de los seeders no tiene segundo factor, y los
        // correos van al log para leer el enlace de restablecer contraseña.
        'SUPER_ADMIN_2FA_REQUIRED=false MAIL_MAILER=log ' +
        `DB_DATABASE="$PWD/database/e2e.sqlite" CORS_ALLOWED_ORIGINS="*" php artisan serve --host=127.0.0.1 --port=${API_PORT}'`,
      url: `http://127.0.0.1:${API_PORT}/up`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `VITE_API_BASE_URL=http://127.0.0.1:${API_PORT}/api npm run dev -- --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
