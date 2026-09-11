# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 6: bucket 1 completo, web+mobile)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x3), "sigue con mobile login".
- 2026-09-10: contraste del accent default — aceptado el fallback tal cual.

## Estado por paso

- Paso 0-5: ✅ (`28c7f49`..`1a96ee5`, pusheados)
- **Paso 6 — bucket 1 (Login y selección de empresa): ✅ completo**
  - Web: `970598e` — AuthLayout + login/registro/invitacion/onboarding.
  - Mobile (este commit): `PantallaAuth.tsx` (análogo a AuthLayout, no
    reusa `Screen.tsx` — evita recolorear las ~50 pantallas de la app) +
    `LoginScreen`/`Verify2faScreen`/`SinEmpresaScreen`/`MfaRequeridoScreen`.
    Íconos Ionicons → Lucide (`UserX`, `ShieldCheck`).
  - Primitivas `Input` extendidas con huecos reales: `autoCapitalizar`,
    `onSubmit` (encadena teclado en RN), `textContentType` por `tipo`.
  - **Intenté verificación visual con `expo start --web`: crasheó por un
    bug PREEXISTENTE** — `mobile/src/lib/fotoCola.ts` usa
    `Directory`/`Paths` de `expo-file-system`, no soportado en web
    (`this.validatePath is not a function`, antes de montar React). No
    lo causaron mis cambios; nadie había podido previsualizar mobile en
    navegador. Verificado solo por `tsc` — confirmación real pendiente en
    device/simulador.
  - `./verificar.sh` verde: tsc x6, 27 tests, 19 literales sin cambios.

## Próximo paso

Bucket 2: Hoy/dashboard (web + mobile).

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- `expo start --web` roto por `fotoCola.ts`/`expo-file-system` — no es
  parte del sistema de diseño, pero si la usuaria alguna vez quiere
  preview de mobile en navegador, hay que arreglarlo aparte (no lo toqué,
  fuera de alcance de hoy).
- `MAPA_ESTADO_TONO`: completar por pantalla según vayan apareciendo
  estados reales.
