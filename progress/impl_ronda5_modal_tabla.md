# impl — Tarea 157, ronda 5: Modal → Dialog y DataTable → Table (panel)

## Archivos tocados

### Modal → Dialog (`@bitacora/ui/web`), 9 archivos, 13 instancias
| Archivo | Instancias | tamano |
|---|---|---|
| `web/src/app/dashboard/registros/equipos/[id]/RegistrosMantencion.tsx` | 2 (nuevo registro, detalle) | grande (xl) |
| `web/src/app/dashboard/registros/equipos/page.tsx` | 2 (asignación normal, documentos ancho) | normal / ancho |
| `web/src/app/dashboard/viajes/page.tsx` | 2 (historial de monto normal, fotos ancho) | normal / ancho |
| `web/src/app/dashboard/levantamientos/page.tsx` | 2 (nuevo normal, detalle ancho) | normal / ancho |
| `web/src/app/dashboard/personas/page.tsx` | 1 (invitar) | normal |
| `web/src/app/dashboard/financiero/cobros/[id]/page.tsx` | 1 (registrar pago) | normal |
| `web/src/app/dashboard/agenda/page.tsx` | 1 (form de tarea) | ancho |
| `web/src/components/CatalogoSelectorModal.tsx` | 1 | ancho |
| `web/src/components/ImportarCsvModal.tsx` | 1 | ancho |

Mapeo mecánico `open/onClose/title/wide/xl` → `abierto/onCerrar/titulo/tamano`.
La API pública de `CatalogoSelectorModal` (`open/onClose`) y de
`ImportarCsvModal` (`abierto/onCerrar/titulo`) no cambió.

### DataTable → Table (`@bitacora/ui/web`), 9 archivos
`web/src/app/dashboard/configuracion/{centros-costo,tipos-os-trabajo,notificaciones,cotizacion-etapas,categorias-gastos,checklists,tipos-documento,inventario}/page.tsx`,
`web/src/app/dashboard/flota/documentos-por-vencer/page.tsx`.

Mapeo: `rows/rowKey/columns/actions/loading/error/emptyState` →
`filas/claveFila/columnas/acciones/cargando/error/vacio`; `header/cell/className`
→ `encabezado/celda/clase`; `label/onClick/variant/hidden` →
`etiqueta/onPress/tono/oculta` (`danger` → `peligro`);
`emptyState {icon, message}` → `vacio {titulo, icono: <Icono size={28} strokeWidth={2.75} />}`
(mismo ícono y tamaño que renderizaba DataTable).

### Tests nuevos
- `web/src/app/dashboard/configuracion/cotizacion-etapas/page.test.tsx` — render de
  la tabla, clic en fila abre "Editar etapa" con el valor, menú ⋯ → Eliminar llama
  `DELETE /api/cotizacion-etapas/et1` sin abrir la edición.
- `web/src/components/ImportarCsvModal.test.tsx` — cerrado no renderiza; abierto:
  `role=dialog` con el título como nombre, `max-w-2xl` (tamano "ancho"), foco
  dentro; Escape y botón "Cerrar" llaman a `onCerrar`.

## Decisiones
- **Convención 148/149 en Table**: `onFilaClick` + `accionesEnMenu` donde la fila
  tiene una acción de "abrir": Editar (centros-costo, tipos-os-trabajo,
  cotizacion-etapas, categorias-gastos, tipos-documento, inventario→unidades),
  Ver/Editar (checklists), Ver ficha (documentos-por-vencer, navega con
  `router.push`). La acción sigue también en el menú (como en viajes/tarifas).
- **notificaciones (historial)**: sin `onFilaClick` (un log no abre nada) y
  acciones inline, NO en menú: la única acción "Reenviar" cambia su etiqueta a
  "Reenviando…" mientras corre; dentro de un menú que se cierra al click ese
  feedback se perdería.
- `loading`/`error` → props `cargando`/`error` del propio `Table`, que internamente
  renderizan `<LoadingState />` / `<ErrorState mensaje>` — idéntico a lo que hacía
  DataTable, sin envolver a mano.
- Diferencia visual aceptada: Table no tiene el zebra `even:bg-…` de DataTable.
- Ningún Modal tenía pie de botones propio ni bloqueo de cierre al guardar (el
  Modal viejo no lo soportaba): nada que preservar. Mejora gratis: Escape ahora
  cierra solo el diálogo de arriba (p. ej. `useConfirmar` sobre el detalle de
  levantamiento) y el foco entra/vuelve.
- Limpieza ds solo dentro de lo tocado: `text-[11px]` → `text-ds-micro`
  (tipos-os-trabajo chip de campos; equipos modal de asignación ×2; viajes botón
  de foto; levantamientos detalle ×2) y `text-red-600` → `text-ds-danger`
  (levantamientos, errores de form/detalle ×2). Textos, lógica y hooks de la
  ronda 4 (useToast/useConfirmar/useDeshacer/useOcultos) intactos.

## Dudas / para el líder
- `node scripts/check-controles-web.mjs` da FAIL `input: 92 (tope 90)`, pero NO
  por este grupo: el diff que suma `<input` es de
  `web/src/app/dashboard/ordenes/nueva/page.tsx` (grupo components/ui.tsx). Mis
  archivos no agregan button/input/select y bajan `text-[Npx]` en 6.
- `Modal.tsx` / `DataTable.tsx` quedan sin importadores en `web/src` (grep vacío),
  listos para que el líder los borre.

## Verificación (web, Node 22)
- `grep -rlE 'components/(Modal|DataTable)"|from "\./(Modal|DataTable)"' web/src` → vacío.
- `npx tsc --noEmit -p .` → sin salida (OK).
- `npx eslint src` → `✖ 11 problems (0 errors, 11 warnings)` (warnings preexistentes; los 2 en cobros/[id] y viajes/page son eslint-disable/unused previos, no tocados).
- `npx vitest run` → `Test Files 13 passed (13) · Tests 44 passed (44)` (incluye equipos/[id], viajes/tarifas).
- `node scripts/check-controles-web.mjs` → `[FAIL] input: 92 (tope 90)` — ajeno, ver Dudas.
- `./verificar.sh`: no corrido (el líder lo corre al integrar los grupos; lo tocan otros implementadores en paralelo).
