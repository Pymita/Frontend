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

## Workflow

Full rules: `docs/DEVELOPMENT.md` sections 3.1 (reuse), 3.2 (tests), 3.4
(branches) and 3.8 (cross-layer impact).

- **Never commit to `main`.** Branch (`feat/<slug>`, `fix/<slug>`…, same name
  in every repo a change touches), open a PR, merge only after Valentina
  approves and CI is green (`gh pr merge --squash --delete-branch`).
- **Check the other repos first:** every change may affect backend, frontend
  and mobile. Report which ones change and why the others do not.
- **Extend before creating:** existing endpoints, pages, components and styles
  before new ones.
- Commit once implemented AND tested. **Author: Valentina. Never add a
  `Co-Authored-By` trailer for Claude or any other AI tool.**
- Message in English, conventional-commit style (`feat:`, `fix:`, `docs:`,
  `test:`), explaining *why* when the change is not obvious.

## Verify

```bash
npx vue-tsc --noEmit -p tsconfig.app.json     # types
npm run test:e2e                              # Playwright (isolated database)
npm run test:e2e:ui                           # visual mode
npx playwright codegen http://localhost:5173  # record a new test
```

**Anything visual is tested with Playwright**, using the *arrange via API, assert
through the UI* pattern. Never test against the development database.
