# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 6: bucket 3 COMPLETO, bucket 4 siguiente)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x3), "sigue con mobile login", "sigue con el bucket 2 y
  arregla el problema", "sigue con el bucket 3, no toques el shell",
  "sigue con TrabajoDetalleScreen ahora".
- 2026-09-10: contraste del accent default — aceptado el fallback tal cual.

## Estado por paso

- Paso 0-5 + bucket 1 + bucket 2: ✅ pusheados.
- **Bucket 3 — Órdenes de servicio: ✅ COMPLETO (este commit)**
  - Web listado + ficha: ✅ (commit `48e0935`, ya pusheado).
  - Mobile listado: ✅ (mismo commit).
  - **Mobile ficha (este commit):** `TrabajoDetalleScreen.tsx` +
    `CamposDinamicos.tsx`/`FotosSection.tsx`/`CierreFirma.tsx` (uso
    exclusivo de esta pantalla, verificado). Bloque de foco (check-in)
    navy→`marca.base`. Banner "finalizado" verde→`accent2Ramp` (no hay
    tono éxito separado del accent2 en el sistema nuevo). Ionicons→Lucide.
    `Textarea` usado donde antes era `Input multiline` (no soportado en
    el contrato nuevo).
  - Verificado: tsc limpio, `expo start --web` carga y monta TODO el
    árbol de navegación sin errores de consola (buena señal de imports
    correctos), sin poder navegar a la ficha en sí sin sesión real.
  - `check-colores.mjs`: BASELINE 18→15 (bajó solo).
  - `./verificar.sh` verde: tsc x6, 27 tests, 15 literales.

## Bug real encontrado y corregido (post bucket 3)

La usuaria reportó texto ilegible en `/dashboard/ordenes` (tabla y
título) y trajo un prompt para abandonar crema y volver a navy único.
Diagnostiqué en vivo antes de tocar nada: no era la dirección crema,
era herencia de color con el dark-mode de Faena (`@media
(prefers-color-scheme: dark)`) filtrándose en elementos sin `color`
propio. Fix: `text-ds-text` explícito en `Card` (cubre `Table`) +
panel propio (`bg-ds-bg`) en las 3 páginas migradas, mismo patrón que
ya usa `AuthLayout`. Verificado en vivo (Chrome MCP) en las 3
pantallas. Detalle completo en `docs/design-system.md` §"Bug real:
contraste roto en dark mode". `DashboardShell` (el seam) sigue sin
migrar — decisión pendiente de la usuaria si corresponde ahora.

## 2026-09-11: la usuaria pidió "migrá la shell y homologá todo"

Decisión de la usuaria (no turno a turno esta vez, autorización amplia):
migrar `DashboardShell` y dejar TODAS las secciones con el mismo
estilo/colores. `DashboardShell.tsx` ✅ migrado (Lucide + tokens ds-,
detalle en docs/design-system.md). Alcance real: 71 páginas bajo
`dashboard/**` sin migrar + `web/src/components/ui.tsx` (Faena, API
inglesa) importado por 87 archivos — cada uno necesita reescritura de
JSX contra la API nueva, no un alias. Sigo bucket por bucket (mismo
orden de siempre: Operación → Clientes → Dinero → Recursos → Equipo →
Informes → Configuración), comiteando y verificando en cada uno, sin
esperar "sigue" (ya está autorizado). Mobile buckets 4-7 quedan
aparte — la usuaria habló de "la shell" en el contexto web.

## Próximo paso

Seguir con el resto de "Operación" (rutas, viajes) y luego el resto
de los grupos de nav en orden.

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Seams acumulados (Faena, migran cuando les toque su bucket o si se pide
  el shell explícitamente): `DashboardShell`, `Screen.tsx`, `HoyStack`
  (parcial), `LogoMark`/`Logo`, charts Recharts de Informes,
  `CatalogoSelectorModal`, `TrabajosMapa.tsx`.
- `MAPA_ESTADO_TONO`: completar por pantalla según vayan apareciendo
  estados reales.
- Ningún bucket verificado con captura de pantalla REAL en mobile todavía
  (sin credenciales de sesión) — solo web (Login/Registro). Si la usuaria
  puede dar credenciales de un usuario dev, se podría verificar visualmente
  el resto también.
