# Sesión actual

- **Tarea en curso:** 8 — sistema_diseno (Paso 6: bucket 3 en curso —
  web listado+ficha y mobile listado hechos, falta mobile ficha)
- **Inicio:** 2026-09-09
- **Agente:** Claude Sonnet 5 (directo)

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x3), "sigue con mobile login", "sigue con el bucket 2 y
  arregla el problema", "sigue con el bucket 3, no toques el shell todavía".
- 2026-09-10: contraste del accent default — aceptado el fallback tal cual.

## Estado por paso

- Paso 0-5 + bucket 1 + bucket 2: ✅ pusheados.
- **Bucket 3 — Órdenes de servicio: 🔶 en curso (este commit)**
  - **Web listado + ficha: ✅.** `ordenes/page.tsx` +
    `ordenes/[id]/page.tsx`. `Table` extendido (`encabezado: ReactNode`,
    `onFilaClick`). `Input.tipo="hora"` nuevo. Retokenizados
    `Combobox.tsx`/`ComboboxResponsable.tsx`/`InputMonto.tsx` (widgets
    atómicos compartidos, no shells — bajo riesgo). Seam: `CatalogoSelectorModal`
    (5 pantallas) sigue Faena.
  - **Mobile listado: ✅.** `TrabajosScreen.tsx` + header de
    `TrabajosStack.tsx`. Botón "Continuar" Faena `acento`→ nuevo `primario`
    (ya no hay separación marca/acento-de-terreno). Seam: `TrabajosMapa.tsx`.
  - **Mobile ficha: ⬜ pendiente.** `TrabajoDetalleScreen.tsx` (356 líneas,
    fotos/firma/checklist/campos dinámicos) — no llegué a esta en el turno,
    queda para la próxima.
  - `check-colores.mjs`: BASELINE 19→18 (bajó solo).
  - `./verificar.sh` verde: tsc x6, 27 tests, 18 literales.

## Próximo paso

Terminar bucket 3: `mobile/src/features/trabajos/TrabajoDetalleScreen.tsx`
(+ sus componentes `FotosSection.tsx`/`CierreFirma.tsx` si hace falta).
Después: bucket 4 (Clientes).

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Seams acumulados (Faena, migran cuando les toque su bucket o si se pide
  el shell explícitamente): `DashboardShell`, `Screen.tsx`, `HoyStack`
  (parcial), `LogoMark`/`Logo`, charts Recharts de Informes,
  `CatalogoSelectorModal`, `TrabajosMapa.tsx`.
- `MAPA_ESTADO_TONO`: completar por pantalla según vayan apareciendo
  estados reales (ya tiene en_curso→en_progreso, completada/firmada/
  confirmado→completado, cancelada/cancelada_anticipada/no_asistio→cancelado).
