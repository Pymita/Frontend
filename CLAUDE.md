# Frontend — Sabores del Trigo

App web (Vue 3 + TypeScript + Vuetify + Pinia) del SaaS de gestión.
**Guía completa del proyecto: `docs/DESARROLLO.md` (repo `Docs`).**

## Reglas no negociables

1. **Esconder no es seguridad:** el menú y las rutas filtran por permisos
   (`effectiveFeatures`), pero quien decide es el backend. Si algo debe
   bloquearse, se bloquea allá también.
2. **Reusar servicios y tipos existentes** (`src/services`, `src/types`) antes de
   crear nuevos. Las reglas compartidas con el backend (contraseñas, funciones)
   viven en un solo lugar: `src/utils/validation.ts`, `src/types/auth.ts`.
3. **Moneda:** pesos colombianos, sin decimales y con separador de miles
   (`toLocaleString('es-CO')`). No usar `toFixed(2)` para montos de venta.
4. **Textos de UI en español**; nombres de variables y comentarios en inglés.

## Verificar

```bash
npx vue-tsc --noEmit -p tsconfig.app.json   # tipos
npm run test:e2e                            # Playwright (base aislada)
npm run test:e2e:ui                         # modo visual
npx playwright codegen http://localhost:5173  # grabar un test nuevo
```

**Todo lo visual se prueba con Playwright**, con el patrón *preparar por API,
verificar por interfaz*. Nunca se prueba contra la base de desarrollo.
