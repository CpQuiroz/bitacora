# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 6 en curso: bucket 1 web hecho)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x3) = continuar sin pausar por grupo/paso.
- 2026-09-10: contraste del accent default — aceptado el fallback tal cual.
- 2026-09-10: "sigue derecho con el paso 5" y luego arranqué Paso 6 solo.

## Estado por paso

- Paso 0-5: ✅ (ver commits `28c7f49`..`1a96ee5`, todos pusheados)
- **Paso 6 — migración pantalla por pantalla: 🔶 en curso**
  - **Bucket 1 (Login y selección de empresa, WEB): ✅**
    - `AuthLayout.tsx` (shell compartido) + `login/registro/invitacion/
      onboarding` — las 4 migradas juntas porque comparten `AuthLayout`
      (migrar solo Login hubiera dejado las otras 3 con el Card nuevo por
      fuera y los campos Faena por dentro).
    - **Bug real encontrado corriendo `next dev` de verdad:** faltaba el
      `@source` de Tailwind para `packages/ui` en `globals.css` (Tailwind
      no escanea fuera de `web/` por defecto) — sin eso, las clases de
      `@bitacora/ui` compilaban sin error pero no generaban CSS (fondo
      transparente, texto heredado). Ni tsc ni el CLI de Tailwind de los
      Pasos 1-5 lo agarraron porque yo pasaba el `@source` a mano en cada
      prueba manual.
    - **Segundo bug real:** `campo.ts` tenía `outline-none` + `focus-
      visible:outline-2` — Tailwind v4 usa la misma variable CSS
      (`--tw-outline-style`) para ambos; `outline-none` la fija a "none"
      incondicionalmente y `outline-2` no la toca, así que el foco nunca
      mostraba el anillo. Sacado el `outline-none`.
    - Verificado con `next dev` real + screenshots (Chrome vía MCP):
      `/login` y `/registro` se ven bien (Caprasimo, pill, foco con
      anillo de marca, card con sombra). `/onboarding`/`/invitacion`
      verificados por tsc (necesitan sesión, no se pudieron capturar
      en vivo).
    - Primitivas extendidas (huecos reales, no inventados de antemano):
      `Input.tipo="codigo"` (OTP), `maxLongitud`, `minLongitud`, `requerido`.
  - **Pendiente del bucket 1:** Login de **mobile** (`LoginScreen.tsx`).
  - Sin commitear todavía — falta este commit.

## Próximo paso

1. Commitear el bucket 1 (web) de Paso 6.
2. Migrar `mobile/src/features/auth/LoginScreen.tsx` (+ pantallas
   relacionadas: `SinEmpresaScreen`, `MfaRequeridoScreen`, `Verify2faScreen`)
   para cerrar el bucket 1 completo.
3. Bucket 2: Hoy/dashboard.

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- `MAPA_ESTADO_TONO`: completar por pantalla es trabajo del Paso 6, según
  vayan apareciendo estados reales en las pantallas migradas.
- Cada bucket nuevo: levantar el servidor real (`next dev` / Expo) y
  tomar captura ANTES de tocar código — esta vez no tuve un "antes" real
  porque ya había reescrito el archivo cuando levanté el navegador.
