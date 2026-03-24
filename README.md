# Sabores del Trigo - Frontend Web

Vue 3 + TypeScript web client for operations and management.

## Stack

- Vue 3
- TypeScript
- Vuetify 3
- Pinia
- Vue Router
- Vite

## Prerequisites

- Node.js 20+
- npm 10+
- Running backend API (`http://localhost:8001`)

## Quick Start (New Computer)

```bash
git clone <FRONTEND_REPOSITORY_URL>
cd frontend
npm install
```

## Environment Configuration

Create `.env` only if you need to override defaults.

```env
VITE_API_BASE_URL=http://localhost:8001/api
VITE_APP_NAME="Sabores del Trigo"
VITE_DEV_MODE=true
```

Current fallback in code also points to `http://localhost:8001/api`, but using `.env` is recommended for consistency across environments.

## Run Locally

```bash
npm run dev
```

Frontend URL: `http://localhost:5173`

## Available Scripts

```bash
npm run dev      # start development server
npm run build    # type-check + production build
npm run preview  # preview production build locally
```

## Backend Dependency

Before testing the UI, ensure backend is up and seeded:

```bash
cd ../backend
composer install
php artisan migrate:fresh --seed
php artisan serve --host=0.0.0.0 --port=8001
```

Test credentials:

- Admin: `admin@saboresdeltrigo.com` / `admin123`
- Employee: `empleado@saboresdeltrigo.com` / `empleado123`

## Manual Test Checklist

1. Login flow:
   - Successful login with valid admin and employee users.
   - Validation errors for empty/invalid fields.
2. Authorization:
   - Employee does not see/administer `Users` module.
   - Admin can access all modules.
3. Session handling:
   - Refresh browser keeps session.
   - Logout clears session and redirects to login.
4. Resilience:
   - Stop backend and confirm UI displays API failure message.

## Build for Production

```bash
npm run build
```

Generated output is in `dist/`.

Suggested production env:

```env
VITE_API_BASE_URL=https://<your-api-domain>/api
VITE_DEV_MODE=false
```

## Troubleshooting

- API errors in browser console:
  - Verify backend URL/port and CORS values in backend `.env`.
- UI starts but login fails:
  - Re-seed backend users with `php artisan migrate:fresh --seed`.
- Build/type errors:
  - Reinstall deps: `rm -rf node_modules package-lock.json && npm install`.
