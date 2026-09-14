# Migración visual v2 — Cobros (mobile)

Migradas al sistema v2 (`@bitacora/ui/native` + `tokens` de
`@bitacora/design-tokens`), reemplazando `useTema()`/`../../components/ui`:

- `mobile/src/features/gestion/CobrosListaScreen.tsx` — pantalla push.
  `ScreenHeader` propio con `accion` de volver y los 4 filtros
  (Pendientes/Vencidas/Pagadas/Todas) movidos a `filtros` del header.
  Filas de `Card`+`FlatList` → `ListRow`/`ListRowGrupo` dentro de un
  `ScrollView` con `RefreshControl` (mismo patrón que
  `ClientesListaScreen`). Ícono `Banknote` (lucide) en vez de
  `cash-outline` (Ionicons). `StatusBadge` con el mismo patrón de
  `tonoForzado` que ya usa `ClienteDetalleScreen` para "pendiente"
  (ambiguo → tono `en_progreso`); "vencida" ya cae en tono `cancelado`
  vía `MAPA_ESTADO_TONO`, sin forzar.
- `mobile/src/features/gestion/CobroFormScreen.tsx` — pantalla MODAL:
  sin `ScreenHeader` propio (según lo pedido). Solo recoloreado del
  contenido: fondo `tokens.color.bg`, chips de vencimiento/medio de pago
  con `tokens`/`marca.base`, `Text` → `Texto`, `Button` con `bloque` en
  vez del `fullWidth` por defecto del Button viejo. `InputMonto` y
  `SelectorCliente` (componentes de `mobile/src/components`, fuera del
  alcance de esta tarea) quedaron intactos, tal como estaban.
- `mobile/src/features/gestion/CobroDetalleScreen.tsx` — pantalla push.
  `ScreenHeader` con `accion` de volver, antetítulo = nombre del cliente,
  título = monto (mismo criterio que el bloque de foco de
  `ClienteDetalleScreen`). El bloque de filas etiqueta/valor pasó de
  `Card plano` a `Card` (genérico de `@bitacora/ui/native`) + `Fila`
  local reescrita con `Texto`. El campo "Observaciones" del formulario
  de pago pasó de `Input multiline` (no existe en el sistema nuevo) a
  `Textarea`. Ícono del link de pago: `ExternalLink` (lucide) en vez de
  `open-outline` (Ionicons).

Lógica de negocio, validaciones, llamadas a `services/cobros.ts`,
navegación y cálculos de monto: sin cambios, 1:1 con el original.

No se tocó `mobile/src/shell/navigation/*`, ni ningún otro archivo fuera
de los 3 listados. No se agregó `AsistenteButton` (ninguna es raíz de
tab).

Verificación:
- `npx tsc --noEmit -p mobile` → limpio (exit 0).
- `node scripts/check-colores.mjs` → sin literales nuevos (baseline 9,
  sin cambios).
