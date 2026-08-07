# Frontend — Sabores del Trigo

Web app (Vue 3 + TypeScript + Vuetify + Pinia) for the management SaaS.
**Full project guide: `docs/DEVELOPMENT.md` (repo `Docs`).**

## Non-negotiable rules

1. **Hiding is not security:** the sidebar and routes filter by permissions
   (`effectiveFeatures`), but the backend is the authority. Anything that must be
   blocked has to be blocked there too.
2. **Reuse existing services and types** (`src/services`, `src/types`) before
   creating new ones. Rules shared with the backend (passwords, features) live in
   a single place: `src/utils/validation.ts`, `src/types/auth.ts`.
3. **Currency:** Colombian pesos — no decimals, thousand separators
   (`toLocaleString('es-CO')`). Do not use `toFixed(2)` for sale amounts.
4. **UI copy in Spanish**; variable names and comments in English.

## Verify

```bash
npx vue-tsc --noEmit -p tsconfig.app.json     # types
npm run test:e2e                              # Playwright (isolated database)
npm run test:e2e:ui                           # visual mode
npx playwright codegen http://localhost:5173  # record a new test
```

**Anything visual is tested with Playwright**, using the *arrange via API, assert
through the UI* pattern. Never test against the development database.
