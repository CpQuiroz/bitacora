# Migración v2: ClienteFormScreen, AsistenteScreen, RegistrarVentaScreen

Parte de la tarea 31 (`migrar_todo_mobile_sistema_v2`). Alcance de este
encargo: solo estas 3 pantallas. Referencia de patrón: `ClienteDetalleScreen`/
`ClientesListaScreen` (push con `ScreenHeader`), `CobroFormScreen` (modal,
solo recoloreado, sin `ScreenHeader`), `ViajesScreen` (banners de cola).

## 1. `mobile/src/features/clientes/ClienteFormScreen.tsx`

Decisión de push/modal: revisado `ClientesStack.tsx` — está registrada SIN
`presentation: "modal"` → es push. Sigue el patrón de `ClienteDetalleScreen`:
`ScreenHeader` propio con `accion` de volver (`ArrowLeft`), header nativo
apagado en `ClientesStack.tsx` (antes `options={{ title: "Cliente" }}`,
ahora `{ headerShown: false }}`, mismo criterio que `ClienteDetalle`).

- `useTema()` + `Button/Input/LoadingScreen` de `components/ui` (viejo) →
  `tokens` + `Button/Input/Textarea/LoadingState/ScreenHeader` de
  `@bitacora/ui/native`.
- El título ("Editar cliente"/"Nuevo cliente") ya no se fija con
  `navigation.setOptions` (eso era para el header nativo, que ahora está
  apagado) — es un `const titulo` calculado que recibe `ScreenHeader`.
- Campo "Notas" (multiline) migrado a `Textarea` (el `Input` v2 es de una
  sola línea, sin prop `multiline`).
- RUT: el `autoCapitalize="characters"` viejo no tiene equivalente en el
  contrato v2 (`autoCapitalizar` es solo booleano); se dejó
  `autoCapitalizar={false}` — no cambia ninguna validación de negocio, solo
  la asistencia de mayúsculas del teclado.
- Lógica 100% preservada: mismas validaciones (nombre/dirección
  obligatorios, guard `enLinea`), mismas llamadas a
  `crearCliente`/`editarCliente`/`obtenerCliente`, misma navegación
  (`goBack` tras guardar).

## 2. `mobile/src/features/asistente/AsistenteScreen.tsx`

Es el DESTINO del `AsistenteButton` de Hoy/Agenda/Clientes/Más (las 4
raíces de tab la registran como `Stack.Screen` con `title: "Asistente"`,
SIN `headerShown: false`) — **no** se le agregó `AsistenteButton` (sería
circular, regla explícita del encargo) y **tampoco se introdujo
`ScreenHeader`**: como es una pantalla genérica montada en 4 Stacks
distintos (tipo `NavConOpciones`, sin `ParamList` propio, sin `goBack`
tipado) y ninguno de esos 4 Stacks apaga hoy su header nativo, se mantuvo
el header nativo (con el botón de borrar historial vía
`navigation.setOptions({ headerRight })`, igual que antes) — mismo criterio
que `CobroFormScreen` (modal: solo se recolorea el contenido, sin
`ScreenHeader` propio). Cambiar esto a `ScreenHeader` habría requerido
tocar 4 archivos de Stack fuera del alcance de este encargo para agregarles
`headerShown:false` + un botón de volver manual — no se hizo.

- `useTema()` + `Ionicons` + `Text`/`EmptyState`/`ErrorState`/`LoadingScreen`
  de `components/ui` (viejo) → `tokens` + `lucide-react-native`
  (`ArrowUp`/`Sparkles`/`Trash2`) + `Texto`/`EmptyState`/`ErrorState`/
  `LoadingState`/`useMarca` de `@bitacora/ui/native`.
- Estructura de layout de chat preservada TAL CUAL (pedido explícito): el
  mismo `FlatList` con scroll manual al final, las mismas burbujas
  usuario/asistente, el mismo input flotante abajo con botón de enviar. Solo
  se recoloreó (fondo, burbujas, sugerencias, input) y se tipificó el texto
  con `Texto` en vez del `Text` viejo.
- Burbuja usuario: antes `t.colores.brand`/`brandForeground` → ahora
  `marca.base`/`marca.foreground`. Burbuja asistente: antes
  `t.colores.surfaceAlt` → ahora `tokens.color.neutral["200"]` (no hay un
  tono "surfaceAlt" separado en el sistema v2).
- Lógica 100% preservada: `cargar`, `enviar` (optimista + reintento tras
  timeout), `limpiar` (confirm + borrar historial), `SUGERENCIAS`, tipo
  `Fila`/`NavConOpciones` sin cambios.

## 3. `mobile/src/features/ventas/RegistrarVentaScreen.tsx`

Revisado: registrada SIN `presentation: "modal"` en `ClientesStack.tsx` Y
`TrabajosStack.tsx` → push. Es una pantalla rica (líneas de venta,
stepper de cantidad, medio de pago, pie fijo con totales) del mismo calibre
que `ClienteDetalleScreen`/`TrabajoDetalleScreen` — se le dio el mismo
tratamiento: `ScreenHeader titulo="Registrar venta"` + `accion` de volver,
header nativo apagado en **ambos** Stacks que la registran (antes
`options={{ title: "Registrar venta" }}`, ahora `{ headerShown: false }}`).
Sin `AsistenteButton` (es un formulario, no una raíz de tab).

- `useTema()` + `Ionicons` + `Button/Text` de `components/ui` (viejo) →
  `tokens` + `lucide-react-native` (`ArrowLeft`/`Minus`/`Plus`/`X`) +
  `Button/ScreenHeader/Tag/Texto/useMarca` de `@bitacora/ui/native`.
- Badge de tipo de línea (SERVICIO/PRODUCTO/PACK): antes un `Text mono
  weight="bold"` a mano coloreado con `t.estado[...]` (un mapa de 3 estados
  de OS que no aplica acá, prestado solo por sus colores) → ahora `<Tag
  tono="accent|neutral|accent2">` (servicio=accent, producto=neutral,
  pack=accent2) — mismo componente que ya usa `ClientesListaScreen` para
  "Con pack". Es un tag de categoría, no un estado de ciclo de vida, así
  que se usó `Tag` y no `StatusBadge`.
- Números (cantidad, precios, totales, el "26" del total grande):
  `style={{ fontVariant: ["tabular-nums"] }}` en vez de la prop `mono` vieja
  (el contrato de `Texto` v2 no tiene variante monoespaciada — regla
  explícita del encargo).
- Avatar circular de iniciales del cliente: antes `t.colores.brandSoft` +
  texto `tono="brand"` (no hay un tono "soft" separado del primario en v2)
  → se usó el par `accent2Ramp["200"]/["800"]`, el mismo idioma "fondo
  suave + texto fuerte" que ya usan `EmptyState` y las tarjetas de packs de
  `ClienteDetalleScreen`.
- Overlay del modal picker: no existe `tokens.color.overlay` en el sistema
  v2 (los 2 modales viejos que sí lo usaban, `AsignarPackModal`/
  `HojaCrearCliente`, están sin migrar todavía — no hay precedente v2 para
  esto). Se compuso `` `${tokens.color.neutral["900"]}66` `` — mismo idioma
  ya usado en todo el código migrado (`` `${tokens.color.text}99` ``, etc.),
  no un literal hex nuevo.
- Lógica 100% preservada: `setCantidad`/`quitar`/`agregarDesdePicker`/
  `confirmar` sin ningún cambio de cuerpo, mismas llamadas a
  `listarServicios`/`listarProductos`/`listarTiposPack`/`crearVenta`,
  mismo cálculo de neto/IVA/total, mismo guard `puedeEditarPrecio`.

## Cambios de soporte (Stacks)

- `mobile/src/shell/navigation/ClientesStack.tsx`: `ClienteForm` y
  `RegistrarVenta` pasan de `options={{ title: "..." }}` a
  `{ headerShown: false }}` (comentario explicando por qué, mismo criterio
  que `ClienteDetalle`).
- `mobile/src/shell/navigation/TrabajosStack.tsx`: `RegistrarVenta` idem;
  comentario de cabecera del archivo actualizado (ya no dice que
  "TrabajoForm/RegistrarVenta siguen Faena", solo `TrabajoForm` sigue
  fuera de alcance).

## Fuera de alcance (no tocado)

- `InputMonto`/`SelectorCliente`/`PickerBuscable` — no aplican a estas 3
  pantallas (no las usan).
- El resto de las 21 pantallas de la tarea 31 (Catálogo, Cobros, Informes,
  Levantamientos, Mantención, Perfil, NuevoGasto, TrabajoForm/
  TrabajosScreen, ViajesStack completo, NuevaCita/TareaDetalle) — fuera del
  encargo puntual de esta sesión. **Nota**: al momento de cerrar esta tarea
  el working tree ya tenía cambios sin commitear en varios de esos archivos
  (y en `scripts/check-colores.mjs`) — no son de esta sesión, no se
  tocaron ni se revirtieron.
- `AsistenteScreen` sigue con header NATIVO (no `ScreenHeader`) — ver
  razonamiento en la sección 2. Si más adelante se decide unificarla,
  hace falta tocar los 4 Stacks que la registran (Hoy/Agenda/Clientes/Más).

## Verificación

- `node --stack-size=8000 ./node_modules/typescript/bin/tsc -p mobile/tsconfig.json --noEmit`
  → limpio, exit 0.
- `node scripts/check-colores.mjs` → reporta 9 literales contra un
  `BASELINE` de 8 en el archivo actual, **pero ninguna de las 9 líneas
  señaladas pertenece a los 3 archivos migrados en esta sesión**
  (`SelectorHora.tsx`, `DetalleReservaCosmetologia.tsx`,
  `NuevaReservaCosmetologia.tsx`, `ChecklistMantencionScreen.tsx` ×2,
  `MantencionDetalleScreen.tsx`, `PerfilScreen.tsx`, `FotosSection.tsx`,
  `ViajeDetalleScreen.tsx`). Confirmado con `git stash` que revirtiendo
  TODO el working tree (mis 3 archivos incluidos) el conteo sigue siendo 9
  contra el `BASELINE=9` ya commiteado — es decir, el desface 9-vs-8 viene
  de un cambio en curso, sin commitear, de `scripts/check-colores.mjs`
  hecho por otro trabajo paralelo sobre la misma tarea 31 (el working tree
  ya traía ~25 archivos modificados de otras pantallas antes de que esta
  sesión tocara nada) — no de esta entrega. No se tocó
  `scripts/check-colores.mjs` (fuera de alcance, y en pleno cambio ajeno).
