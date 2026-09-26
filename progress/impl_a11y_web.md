# impl — Tarea 155, parte web: hallazgos jsx-a11y en `web/src`

## Resultado

Medición con las 5 reglas jsx-a11y (comando del líder): **111 → 0 hallazgos**.
- `npx tsc --noEmit -p .` (web): sin errores.
- `npx eslint src` (config normal): 0 errores. Quedan 10 warnings que ya existían (imports sin uso, `window.location.href`, directivas `eslint-disable` sin uso); ninguno viene de este cambio.
- `npx vitest run` (web): 10 archivos, 28 tests en verde (incluye el nuevo).
- `node scripts/check-colores.mjs`: sin literales nuevos.
- No toqué `packages/ui`, `web/eslint.config.mjs`, `trabajo_list.json` ni `progress/current.md`. Tampoco hice commits.

## Componentes compartidos (`web/src/components`)

- `Combobox.tsx`: nueva prop opcional `id`, que se pasa al `<input role="combobox">`. Además `aria-controls` apunta a un id del listbox generado con `useId()`, lo que corrige role-has-required-aria-props.
- `ComboboxCliente.tsx`, `ComboboxResponsable.tsx`, `ComboboxEquipo.tsx`, `SelectCrear.tsx`: prop opcional `id`, que se pasa al `Combobox`.
- `InputMonto.tsx`: sin cambios, porque ya pasaba `id` al `<input>` vía `...rest`.
- `AsignarPackForm.tsx`, `CampoViatico.tsx`: `useId()` con sufijos (`-cliente`, `-precio`, `-monto`), porque se reutilizan.
- `DashboardShell.tsx`: el fondo del drawer móvil lleva `role="presentation"` y ahora **Escape cierra el drawer** (un `useEffect` que escucha `keydown` solo mientras está abierto).
- Test nuevo: `CamposPropiosAccesibles.test.tsx`. Verifica que el Combobox se encuentra por su label, que `aria-controls` coincide con el id del listbox, que dos combobox no comparten id de listbox y que InputMonto se encuentra por su label.

## Pantallas (`web/src/app/dashboard`)

Patrón general: `<label htmlFor>` + `id` en el control (InputMonto, Combobox*, SelectCrear, `<input type=color|file>`, `<textarea>`). En páginas únicas uso ids fijos con prefijo (`gasto-monto`, `viaje-origen`, `filtro-os-cliente`…). En filas repetidas uso sufijo por fila: `linea-${idx}-costo` en cotizaciones y `viaje-${v.id}-origen` en la edición de viajes. En `RegistrosMantencion` (modal) uso `useId()`.

Archivos: agenda, configuracion/{agenda-pro, categorias-gastos, centros-costo, cuenta, empresa, inventario, notificaciones, plantillas, tipos-os-trabajo, viajes}, financiero/cobros (lista y [id]), financiero/cotizaciones (lista, [id], nueva), gastos, levantamientos, ordenes (lista y [id]), personas/[id], registros/{catalogo, equipos, equipos/[id]/RegistrosMantencion, proveedores}, rendiciones (lista y [id]), viajes (lista, rutas/nueva, tarifas).

Casos especiales:
- **Títulos de grupo** (no rotulan un solo control) pasan de `<label>` a `<span>` con las mismas clases. Como `<label>` también es inline, el aspecto no cambia. Aplica a: chips de centros-costo, "Texto de encabezado" en plantillas (editor compuesto), "Campos personalizados" en tipos-os, "Órdenes a incluir" en cobros (cada checkbox ya tiene su label), "Ítems / materiales" en OS, "Aplica a tipo(s) de equipo" en catálogo y "Jornada de trabajo (días)" en rutas.
- **Radios de inventario**: el título es `<span id>` y el contenedor lleva `role="radiogroup" aria-labelledby`.
- **Switches** (`role="switch"` sin texto): `aria-label` con el título visible de al lado. Son 2 en empresa, 3 en inventario y 2 en notificaciones.
- **Zona de logo** (empresa): el div clicable/arrastrable queda como `role="button" tabIndex={0}` y abre el selector con Enter o Espacio. No lo convertí a `<button>` porque contiene `<p>`, que no es válido dentro de un botón, y cambiar esos `<p>` cambiaría el marcado.
- **Foto de perfil** (cuenta): antes eran dos `<label onClick>`. El avatar pasa a `<button type="button" aria-label="Cambiar foto de perfil">`. El botón "Cambiar imagen" ahora usa `onPress` directo; antes estaba dentro de un label con `pointer-events-none`. Efecto secundario menor: mientras sube la foto el botón queda realmente deshabilitado (antes el label seguía clicable).
- **Select de etapa** en la tabla de cotizaciones: el div que hace `stopPropagation` lleva `role="presentation"`. El Enter de la fila no se ve afectado, porque `Table` solo reacciona si `e.target === e.currentTarget`.
- **Categoría** (catálogo) y **Punto base** (rutas/nueva): pasan a `<Input etiqueta=…>` de `@bitacora/ui/web`, que ya asocia su label. La clase del label del primitivo (`LABEL`) es la misma que tenían.

## Casos dudosos, para decidir el líder

El `Input` de `@bitacora/ui/web` **no acepta `id` ni `aria-label`**, y no toqué `packages/ui`. Donde el rótulo lleva algo que `etiqueta` (string) no soporta, o un estilo distinto, lo cambié a `<span>` para pasar la regla. Esos campos siguen **sin nombre accesible**, igual que antes, porque el `<label>` suelto nunca estuvo asociado:
- catálogo: "SKU", "Stock inicial" y "Stock mínimo" (llevan un ícono de ayuda con `title`).
- cotizaciones/[id]: "Enviar por email" (lleva un ícono de sobre).
- proveedores: "Teléfono" (lleva el prefijo "+56 9" al lado del input).
- levantamientos: "Referencia de la cotización externa" (estilo `text-ds-small /80`, distinto de `LABEL`).
- rutas/nueva: "Horario de trabajo" e "Intervalo de almuerzo" (dos `Input` de hora cada uno).

Recomendación: agregar a `Input` (y a `Select`) de `packages/ui/web` una prop opcional `id` (o `etiquetaAccesible` → `aria-label`). Con eso estos 8 casos se cablean con `htmlFor` en un minuto. El Select de etapa en cotizaciones tampoco tiene nombre accesible, por la misma razón.

Otro detalle: en cotizaciones/[id] (edición de líneas) solo la fila 0 muestra labels (así era antes). Las filas 1..n tienen `id` pero no label visible.
