# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 5 COMPLETO, Paso 6 siguiente)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x2) = continuar sin pausar por grupo/paso.

## Estado por paso

- Paso 0-4: ✅ (ver commits `28c7f49`..`6750d9f`)
- **Paso 5 — reglas transversales: ✅ COMPLETO** (este commit)
  - Lucide agregado (`lucide-react` + `lucide-react-native`, ya había
    `react-native-svg`). `Dialog` y `Select` (ambas plataformas) migrados
    de glifos a mano a `X`/`ChevronDown`, `strokeWidth={2.75}`.
  - `Cifra` (13ª primitiva): `tabular-nums`.
  - `formatearCLP()` en `packages/shared/src/dinero.ts` (5 tests) — fuente
    única; `web/lib/formatMoneda.ts` y `mobile/lib/plata.ts` delegan ahí
    para CLP (mismo resultado exacto verificado, cero cambio visible).
  - Forma/aire/touch-targets/focus-visible: ya cumplidos por construcción
    en el Paso 4, sin cambios nuevos.
  - **Hallazgo sin resolver, documentado en `docs/design-system.md`:** el
    `accent` (#c67139) como marca default da 3.61:1 con blanco (bajo AA
    4.5:1); texto oscuro empeora al oscurecer el botón. No hay foreground
    único que cumpla en los 3 estados con ese hex exacto. Es señal
    solamente el fallback sin tenant — decisión pendiente de la usuaria.

## Próximo paso — Paso 6: migración pantalla por pantalla

Orden del prompt: 1) Login y selección de empresa, 2) Hoy/dashboard,
3) Órdenes de servicio (listado+ficha), 4) Clientes, 5) Catálogo y stock,
6) Configuración, 7) resto. Un commit por pantalla, screenshot antes/
después (necesito correr la app real — Expo/Next dev — para eso, no solo
tsc). Si una pantalla tiene un caso que las 13 primitivas no cubren:
parar y preguntar, no inventar una variante nueva.

## Pendiente / notas generales

- Falta `next build`/Expo real + verificación visual de Pasos 1-5. Toda la
  verificación hasta ahora es tsc + compilación real de Tailwind (CLI) +
  tests unitarios — nada renderizado de verdad todavía.
- eslint web roto (tarea #1) — bloquea la regla ESLint del Paso 7.
- `MAPA_ESTADO_TONO` de StatusBadge: solo estados no ambiguos. Completar
  por pantalla es trabajo del Paso 6.
- Antes de arrancar el Paso 6 conviene levantar `next dev` / Expo para
  screenshots reales — no lo hice todavía en esta sesión.
