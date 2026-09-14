# Migración v2 — Nueva reserva / Detalle de tarea (Agenda, cosmetología)

Migración visual (Faena → sistema v2, `@bitacora/ui/native`) de las 3 pantallas
pedidas. 100% de la lógica de negocio se preservó tal cual (validaciones,
cálculo de precio/adicionales/pack, llamadas a `services/agenda.ts` y demás
servicios, navegación) — solo cambió la capa visual.

## Archivos migrados

### 1. `mobile/src/features/agenda/NuevaReservaCosmetologia.tsx`
- `useTema()` + `components/ui` (Button/Input/Text) → `tokens` de
  `@bitacora/design-tokens` + `Button/Input/Textarea/LoadingState/ScreenHeader/
  Texto/useMarca` de `@bitacora/ui/native`.
- `Chip` y `Filete` (helpers locales) reescritos con `tokens`/`useMarca`/`Texto`
  en vez de `useTema()`.
- Los dos `Input etiqueta="Nota..." multiline` pasaron a `Textarea` — el
  `Input` v2 no soporta `multiline` (es de una sola línea), a diferencia del
  `Input` viejo.
- Ícono "close-circle" (Ionicons) para quitar una fila de adicional → `X`
  (lucide-react-native), color `${tokens.color.text}99`.
- Toggle "Avisar por WhatsApp": se mantiene construido a mano (no hay
  primitivo `Switch` en `@bitacora/ui/native` todavía) pero retemado —
  encendido usa `tokens.color.accent2Ramp["700"]` (mismo tono que ya usa
  `ClienteDetalleScreen` para el ícono de WhatsApp), apagado `tokens.color.
  divider`, thumb `tokens.color.neutral["100"]` (nunca un hex literal nuevo).
- **`ScreenHeader` con `accion`=volver** (pedido explícito de la tarea: "SIEMPRE
  en estas 3 pantallas"). Como esta pantalla se renderiza DENTRO de la misma
  ruta `NuevaCita` (compartida con el formulario genérico, que sigue con el
  header nativo del stack porque no migró), el header nativo se apaga solo
  para esta instancia con `navigation.setOptions({ headerShown: false })` en
  el mismo `useEffect` que ya ponía el título — no se tocó `NuevaCitaScreen.tsx`
  ni el resto de esa ruta.
- Guard de carga (`clientes === null`) pasó de `return null` a un
  `ScreenHeader` + `LoadingState`, igual que el guard equivalente
  (`cargandoCita`) del formulario genérico hermano.
- Sin cambios: `SelectorCliente`, `InputMonto`, `SelectorHoraCosmetologia`,
  `NuevoServicioModal` (componentes especializados sin equivalente v2).

### 2. `mobile/src/features/agenda/TareaDetalleScreen.tsx`
- Reescrita con `ScreenHeader` (antetítulo = fecha/hora, título =
  `tarea.titulo`, `accion`=volver), `StatusBadge` en vez de `<Badge>`,
  `Card`/`Texto`/`Button` v2, iconos lucide (`MapPin`, `Navigation`, `Phone`,
  `MessageCircle`, `Pencil`, `ArrowLeft`) en vez de `Ionicons`.
- `estado === "pendiente"` no cae en ninguno de los 4 tonos de
  `MAPA_ESTADO_TONO` → `tonoForzado="en_progreso"` (mismo criterio que ya
  usa `AgendaScreen` con `marca.base` para ese estado en el calendario: es
  el que necesita acción). El resto de los estados (confirmada/completada/
  cancelada/no_asistio/cancelada_anticipada) ya caen bien en el mapa default.
- Los 3 banners de color (paquete asociado / cambio sin sincronizar /
  esperando sync) pasaron de `<Card plano style={{backgroundColor:...}}>`
  (el `Card` v2 no acepta override de color) a `View` planas con
  `tokens.color.accent2Ramp/accentRamp/neutral`.
- `EstadoCitaRiel` (sin equivalente v2, no se tocó) sigue recibiendo las
  mismas props (`estado`, `activa`, `cargando`, `onConfirmar/onNoAsistio/
  onCancelar`) — sigue usando `useTema()`/`components/ui` internamente,
  intencional.
- `OfflineBanner` (tampoco migrado, fuera de alcance) se sigue usando tal cual.
- Rama cosmetología: llama a `DetalleReservaCosmetologia` sin cambios de props.

### 3. `mobile/src/features/agenda/DetalleReservaCosmetologia.tsx`
- `ScreenHeader` (antetítulo = fecha larga, título = nombre del cliente o del
  servicio, `accion`=volver) + bloque de foco: el fondo fijo oscuro
  (`t.colores.foreground`) pasó a `marca.base` (mismo criterio que el bloque
  "SALDO POR COBRAR" de `ClienteDetalleScreen`) con `marca.foreground` como
  color de texto.
- Números (hora, hora fin, precios, "quedan N de M") con
  `style={{fontVariant:["tabular-nums"]}}` sobre `Texto`, tal como pide el
  patrón ya usado en `ClienteDetalleScreen`/`CobroDetalleScreen`.
- Botón de WhatsApp: el viejo usaba `variante="acento"` con
  `backgroundColor: t.colores.success` a mano (el `Button` v2 no acepta
  `style`/color de fondo arbitrario) → se resolvió igual que
  `ClienteDetalleScreen`: `variante="secundario"` + ícono `MessageCircle` en
  `tokens.color.accent2Ramp["700"]`.
- `Button disabled` (prop vieja) → `Button deshabilitado` (nombre real de la
  prop en `PropsBoton` v2).
- `EstadoCitaRiel` sin tocar.

## Cambio de wiring (fuera de los 3 archivos, pero necesario)

`mobile/src/shell/navigation/AgendaStack.tsx`: la ruta `TareaDetalle` tenía
`options={({route}) => ({title: route.params.titulo ?? "Cita"})}` (header
nativo) — se cambió a `headerShown: false`, igual que ya hacen
`ClientesStack`/`MasStack` para sus pantallas de detalle migradas, porque
ahora las dos ramas de `TareaDetalleScreen` (genérica y cosmetología) dibujan
su propio `ScreenHeader` con botón de volver. Sin este cambio habría header
duplicado (nativo + `ScreenHeader`). La ruta `NuevaCita` NO se tocó a nivel de
navegador — sigue con su header nativo porque el formulario genérico
(`NuevaCitaScreen`) no migró; solo la variante cosmetología apaga ese header
por instancia (ver arriba).

## Fuera de alcance (deliberado)

- `EstadoCitaRiel.tsx`, `TipoPackModal.tsx`, `NuevoServicioModal.tsx`,
  `SelectorHoraCosmetologia.tsx`, `SelectorCliente.tsx`, `InputMonto.tsx`,
  `SelectorResponsable.tsx`, `OfflineBanner.tsx`: sin equivalente v2 o
  explícitamente marcados "no tocar" en el pedido — se reutilizan tal cual.
- `NuevaCitaScreen.tsx` (el formulario genérico hermano): ya estaba migrado
  antes de esta tarea, no se modificó.

## Verificación

- `npx tsc --noEmit -p mobile` (desde la raíz): limpio, exit 0, sin output.
- `node scripts/check-colores.mjs` (desde la raíz): `3 literales (baseline 8)
  — bajó`, ningún literal nuevo introducido por estos archivos.

Nota: el repo tenía trabajo concurrente de otras tareas de migración en
curso durante esta sesión (mismo directorio de trabajo, sin worktree) — los
números de `check-colores.mjs` reflejan el estado combinado en el momento de
verificar, no solo estos 3 archivos.
