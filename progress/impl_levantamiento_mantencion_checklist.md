# Migración visual v2 — Levantamiento/Mantención (mobile)

Migradas al sistema v2 (`@bitacora/ui/native` + `tokens` de
`@bitacora/design-tokens`), reemplazando `useTema()`/Ionicons/
`../../components/ui`:

- `mobile/src/features/levantamientos/LevantamientoDetalleScreen.tsx`
  — pantalla push. `ScreenHeader` propio con `accion` de volver
  (antetítulo = `ETIQUETA_ESTADO[detalle.estado]`, título = nombre del
  cliente — mismo criterio que `ClienteDetalleScreen`). `Input
  multiline` → `Textarea` (el contrato nuevo de `Input` no tiene esa
  prop) para "Lo que observaste en terreno". Fila de material con
  stepper de cantidad reescrita con `Pressable`+`Texto`+íconos
  `Minus`/`Plus` (lucide) en vez de `Ionicons`. El Modal a mano del
  picker de catálogo (buscar/elegir ítem) pasó a `Dialog` (bottom
  sheet v2) manteniendo el mismo `FlatList` adentro. Fotos: mismo grid
  88×88 con placeholder de cola (`AlertCircle`/`RefreshCw`, lucide) en
  vez de `Ionicons`.
- `mobile/src/features/mantencion/MantencionDetalleScreen.tsx` —
  pantalla push. `ScreenHeader` con `accion` de volver (título fijo
  "Detalle de mantención", igual al que antes ponía
  `navigation.setOptions`). Cada respuesta del checklist (sí/no/N-A)
  pasó del pill de color a mano a `StatusBadge` real, con el mismo
  mapeo `tonoForzado` que ya usa `MantencionHistorialScreen`
  ("con_novedades"→`en_progreso`, "ok"→`completado`) extendido a un
  tercer caso ("N/A"→`cerrado`, tono neutro). Grid de fotos de
  respaldo: mismo tamaño 96×96, botón eliminar circular con `Trash2`
  (lucide) sobre `accentRamp.700`, ícono en `neutral.100` (no
  `#ffffff` literal — ver nota de colores abajo).
- `mobile/src/features/mantencion/ChecklistMantencionScreen.tsx` —
  pantalla push (la más grande de las 3). `ScreenHeader` con `accion`
  de volver y título dinámico ("Checklist diario"/"Mantención Flota",
  antes fijado vía `navigation.setOptions`). La barra fija superior
  (patente + progreso + chips de fecha) y la barra fija inferior
  (ayuda + botón "Guardar chequeo") no tienen primitivo v2 propio —
  quedaron como `View`+`tokens` planos, mismo criterio ya usado en
  `ViajesScreen` para sus banners de cola. Selector sí/no/N-A por ítem:
  reescrito con tokens (`accent2Ramp.700` sólido para "sí",
  `accentRamp.700` sólido para "no" — mismo par que ya usa el resto
  del sistema para "sin novedades"/"con novedades" — y `marca.base`
  para "N/A"). Grid de fotos general con miniatura+etiqueta+quitar:
  mismo tamaño 84×84, overlay de etiqueta con `neutral.900` semitransparente
  (mismo patrón que `FotosSection.tsx`). `Input etiqueta="Observaciones"
  multiline` → `Textarea`; `Input` de Kilometraje/Horas motor →
  `tipo="numero"`. `PickerBuscable` (taller/lubricentro) y
  `LienzoFirma` (firma) quedaron intactos — sin equivalente v2, mismo
  criterio ya usado en `NuevoGastoScreen`/`NuevaCitaScreen` para
  `InputMonto`/`SelectorCliente`.

Lógica de negocio preservada 1:1 en las 3 pantallas: validaciones
(`bloqueado`, `itemsNoSinFoto`, `faltaProveedor`), llamadas a
`services/mantencion.ts`/`services/levantamientos.ts`, la cola offline
(`encolarRegistroMantencion`, `encolarCompletarLevantamiento`,
`encolarFotoLevantamiento`), navegación, y los mensajes de
Alert/Toast — sin cambios de texto ni de flujo.

Ninguna de las 3 lleva `AsistenteButton` (todas son push/detalle, no
raíces de tab) — regla ya explícita en el pedido.

## Nota de colores (evitó agregar literales nuevos)

Los 3 primeros borradores usaban `"#ffffff"` literal para texto/ícono
claro sobre fondo sólido oscuro (botón "peligro"-like, chip "sí"/"no"
seleccionado). Se reemplazó por `tokens.color.neutral["100"]`
(crema casi blanco), que es el idiom ya establecido en el repo para
ese caso exacto — ver `FotosSection.tsx` (`<X color=
{tokens.color.neutral["100"]} />` sobre `neutral.900` semitransparente).
`node scripts/check-colores.mjs` bajó de 8 a **3** literales totales
en el repo (los 2 que tenía `ChecklistMantencionScreen.tsx` en el
sistema viejo — "#fff" en el ternario de color de texto — desaparecieron
con la migración, y no se agregó ninguno nuevo). No se tocó
`BASELINE` en `scripts/check-colores.mjs` a propósito: hay una edición
concurrente sin commitear en ese mismo archivo (`BASELINE` 9→8, de
otra sesión trabajando en paralelo en este repo) — bajarlo yo también
podría pisar ese trabajo en curso. El script deja igual `exit 0` con
"bajó" (no es un error).

## Bug real encontrado y corregido (fuera del pedido original, pero en
el mismo archivo que ya tocaba)

`mobile/src/shell/navigation/MasStack.tsx` nunca se actualizó cuando
`MantencionVehiculoScreen`, `MantencionHistorialScreen` y
`LevantamientosListScreen` migraron a `ScreenHeader` en sesiones
anteriores — sus rutas seguían con `options={{ title: "..." }}` (sin
`headerShown: false`), lo que significa **doble header** (el nativo
del stack + el `ScreenHeader` propio) ya en producción para esas 3
pantallas. Mismo problema para `CobroDetalleScreen` (migrada en la
tarea de Cobros). Corregido junto con las 3 rutas nuevas de esta
tarea (`MantencionDetalle`, `LevantamientoDetalle`, y
`ChecklistMantencion`, que también ganó `ScreenHeader` en esta
migración): las 6 rutas de Mantención/Levantamientos + `CobroDetalle`
pasan a `headerShown: false`, con comentario explicando el porqué.
Verificado con `tsc mobile` limpio (los tipos de `options` no
reclaman nada raro); no se pudo verificar visualmente (sin sesión
real en el emulador), pero el patrón es idéntico al ya usado y
verificado en `TrabajosStack.tsx`/`ClientesStack.tsx`/`HoyStack.tsx`.

## Fuera de alcance (no tocado)

- `mobile/src/services/mantencion.ts`, `mobile/src/services/
  levantamientos.ts`, `mobile/src/lib/imagen.ts` — sin cambios, solo
  consumidos.
- `mobile/src/components/ui/*` (sistema viejo) y `mobile/src/theme` —
  siguen existiendo, los usan otras pantallas todavía no migradas.
- `PickerBuscable`, `LienzoFirma` — sin equivalente v2, dejados tal
  cual (regla explícita del pedido).
- `scripts/check-colores.mjs` (`BASELINE`) — no se bajó, ver nota de
  colores arriba.

## Verificación

- `npx tsc --noEmit -p mobile` (vía `node --stack-size=8000 .../tsc`,
  como corre `verificar.sh`) → limpio, exit 0.
- `node scripts/check-colores.mjs` → **3** literales totales (bajó de
  8), ningún literal nuevo agregado por esta migración.
- `./verificar.sh` completo → verde (tsc ×6, 22+5+4 tests, audit:tenant
  0, 102 migraciones).
