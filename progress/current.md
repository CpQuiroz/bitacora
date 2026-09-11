# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 6: bucket 1 completo y
  verificado visualmente en las 2 plataformas; arrancando bucket 2)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x3), "sigue con mobile login".
- 2026-09-10: contraste del accent default — aceptado el fallback tal cual.
- 2026-09-10: "sigue con el bucket 2 y arregla el problema que encontraste".

## Estado por paso

- Paso 0-5: ✅. Paso 6 bucket 1 (web `970598e` + mobile `da94511`): ✅.
- **`fotoCola.ts` arreglado** (este commit): guard `Platform.OS==="web"`
  alrededor de `Directory`/`File` de `expo-file-system` — no soportado en
  web, crasheaba `expo start --web` en CUALQUIER pantalla porque
  `services/sync/queue.ts` carga el módulo con toda la app. iOS/Android
  sin cambios de comportamiento; en web queda no-op.
  - **`expo start --web` funciona por primera vez** → verificado con
    captura real: Login en mobile (crema/Caprasimo/pill, botón
    deshabilitado al 45% hasta llenar los 2 campos, full-color después).
    Coincide con la versión web.
  - Seam deliberado documentado: `LogoMark`/`Logo` (ambas plataformas)
    sigue en navy Faena — se usa en shells no migrados
    (DashboardShell/SuperAdminShell/PortalShell, mobile
    BloqueoBiometrico). Se migra cuando le toque a esas pantallas.
- `./verificar.sh` verde: tsc x6, 27 tests, 19 literales sin cambios.

## Próximo paso

Bucket 2 del Paso 6: **Hoy/dashboard** (web `dashboard/page.tsx` +
mobile `features/hoy/`). Ahora con `expo start --web` funcionando, puedo
verificar mobile visualmente igual que web.

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- `MAPA_ESTADO_TONO`: completar por pantalla según vayan apareciendo
  estados reales.
- `LogoMark`/`Logo`: pendiente de migrar cuando le toque su shell.
