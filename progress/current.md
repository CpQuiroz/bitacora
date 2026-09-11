# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 6: bucket 2 hecho)
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

- Paso 0-5: ✅. Paso 6 bucket 1 (web+mobile+fix fotoCola): ✅ pusheado.
- **Bucket 2 — Hoy/dashboard: ✅ (este commit)**
  - Mismo criterio de alcance que el bucket 1, a mayor escala: no se
    migró `DashboardShell` (usan ~38 pantallas) ni `HoyStack` completo
    (solo su `screenOptions`, que únicamente afecta a
    `HoyInicio`/`Asistente` — los stacks anidados tienen el suyo propio).
  - Web `dashboard/page.tsx`: Button/Select/DatePicker/Card/Cifra/
    LoadingState/Skeleton. Seam: los 2 charts Recharts (compartidos con
    Informes) siguen Faena, dentro de una Card ya migrada.
  - Mobile `HoyScreen.tsx` + header de `HoyStack.tsx`: Card/StatusBadge/
    EmptyState/ErrorState/LoadingState+Skeleton, Ionicons→Lucide.
    `MAPA_ESTADO_TONO` +`cancelada_anticipada`.
  - Verificado por tsc (ambas plataformas) + Tailwind CLI real para la
    página web. **Sin captura en vivo** — ninguna pantalla es alcanzable
    sin sesión autenticada y no tengo (ni pediría) credenciales para
    loguearme. Mismo criterio que onboarding/invitacion del bucket 1.
  - `./verificar.sh` verde: tsc x6, 27 tests, 19 literales sin cambios.

## Próximo paso

Bucket 3: Órdenes de servicio (listado + ficha), web + mobile.

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Seams conocidos acumulados: `DashboardShell`/`Screen.tsx`/`HoyStack`
  (parcial)/`LogoMark`/`Logo`/charts Recharts de Informes — todos Faena,
  se migran cuando les toque su propio bucket o si la usuaria pide
  migrar el shell entero antes.
- `MAPA_ESTADO_TONO`: completar por pantalla según vayan apareciendo
  estados reales.
