# impl — Tarea 156, parte web: feedback unificado en `web/src`

No se tocó `packages/ui`, `mobile/`, `trabajo_list.json`, `progress/current.md` ni `verificar.sh`. Sin commits.

## Resumen
- `grep -rnE "\b(window\.)?(confirm|alert|prompt)\(" web/src` → **0 resultados** (tampoco en tests).
- Se reemplazaron 31 `confirm()` reales (el grep de 32 incluía un comentario en superadmin/empresas/[id]), 2 `alert()` y 1 `prompt()`:
  - **21 → `useConfirmar`**
  - **10 → `useDeshacer`** (sin confirmación)
  - 2 `alert()` → `toast(..., { tono: "error" })`
  - 1 `prompt()` → `Dialog` + `InputMonto` (viajes/tarifas)
- ~53 mensajes de éxito sueltos → `toast(..., { tono: "exito" })` (se borraron sus estados y el JSX que los mostraba). 13 errores de acciones sueltas → `toast(..., { tono: "error" })`.
- 6 cargas que eran solo texto "Cargando…" → `<LoadingState />`.

## Helpers nuevos
- `web/src/lib/api.ts` → `exigirOk(res, mensajePorDefecto)`: si la respuesta no es ok lanza un `Error` con `body.error`. Es el `ejecutar` de todos los Deshacer, así el toast rojo muestra la causa real que manda el backend. Tiene test en `web/src/lib/api.test.ts` (node:test; se corre con `--env-file=web/.env.local`, igual que el resto del archivo).
- `web/src/lib/reponer.ts` → `reponer(lista, item, indice)`: `restaurar` devuelve el ítem a su posición original y no lo duplica.

## Deshacer (10), en vez de confirmar
| Pantalla | Qué | `alTerminar` |
|---|---|---|
| `registros/equipos/[id]/RegistrosMantencion.tsx` | foto de respaldo | `cargar()` + `onCambio()` |
| `trabajos/[id]/page.tsx` | foto del trabajo | `cargar()` |
| `viajes/page.tsx` | foto del viaje (modal) | — (el estado local ya queda bien) |
| `levantamientos/page.tsx` | foto del levantamiento | — |
| `registros/equipos/[id]/EventosFlota.tsx` | evento de flota | — |
| `agenda/page.tsx` | tarea (cierra el modal y la oculta del calendario) | — |
| `viajes/tarifas/page.tsx` | tarifa por tramo | `cargarTarifas()` |
| `viajes/tarifas/page.tsx` | precio por km de cliente | `cargarTarifas()` |
| `rendiciones/[id]/page.tsx` | quitar gasto de la rendición | `cargar()` (recalcula totales) |
| `viaticos/page.tsx` | "Marcar pagado": la fila queda en pendiente 0 / pagado += pendiente; Deshacer vuelve a la fila original | — |

Decisión: donde la función de recarga depende de filtros que el usuario puede cambiar durante los 5 s (semana en EventosFlota, mes/vista en Agenda, rango en Viáticos, detalle abierto en Levantamientos) **no** se pasó `alTerminar`: la closure vieja recargaría otro rango y pisaría la vista. El estado local ya quedó bien al ocultar. En viajes/levantamientos, `ocultar`/`restaurar` revisan que el modal abierto siga siendo el mismo (`fv?.id === viajeId`).

Se quitaron los estados de "eliminando…" por ítem (`eliminandoId`, `borrandoFotoId`, `eliminandoFotoId`, `pagando`) porque el ítem desaparece al instante.

## useConfirmar (21)
Título como pregunta corta, detalle en `mensaje`, verbo en `accion`, `destructivo` en eliminar/desactivar/rechazar/borrar/limpiar:
- `portal/citas/[id]` (cancelar con descuento del pack: "Cancelar cita" / "Volver")
- `agenda/page.tsx` (mismo caso de cancelar con pack)
- `superadmin/roles` (borrar rol)
- `superadmin/empresas/[id]` ×4: activar 2FA (no destructivo), desactivar 2FA, reactivar/desactivar usuario (destructivo solo al desactivar), cambiar estado de la empresa
- `registros/equipos/[id]` (eliminar plan de mantención)
- `viajes/page.tsx` (eliminar viaje)
- `ordenes/[id]` (eliminar OS)
- `levantamientos` (eliminar levantamiento completo, rechazar)
- `configuracion/seguridad` (desactivar 2FA)
- `financiero/cobros/[id]`, `financiero/cotizaciones/[id]` (eliminar)
- `personas/[id]` (generar contraseña nueva, no destructivo)
- `rendiciones/[id]` (enviar a revisión con `accion: "Enviar a revisión"`; eliminar rendición completa)
- `informe` (eliminar plantilla)
- `remuneraciones/[id]` (emitir con licencia médica, `accion: "Emitir"`)
- `components/AsistenteChat.tsx` (limpiar conversación)

## Toasts
- alert → toast error: `EventosFlota` (ahora lo cubre el error del Deshacer) y `registros/clientes/[id]` (forma de cobro).
- prompt → Dialog: `viajes/tarifas`, "Cambiar precio" (clic en la fila o desde el menú) abre un `Dialog` con `InputMonto` (el componente de montos que ya usa la pantalla), con label asociado y botones Guardar/Cancelar. Nota: `InputMonto` solo acepta dígitos; el `prompt` anterior aceptaba decimales con coma. Los precios de tramo se muestran redondeados, así que no debería afectar.
- Éxito → toast en: equipos/[id], clientes/[id] (cliente actualizado/desactivado, pack asignado/renovado), clientes (creado; tono `info` si no se pudo geocodificar), viajes (ajuste de aprobación automática, viaje creado/confirmado/guardado, cobro generado), viajes/rutas/nueva (ruta creada; `info` si falta geocodificar), viajes/tarifas, viáticos, ordenes, ordenes/[id] (PDF enviado), cobros, cobros/[id], cotizaciones/[id], personas (invitación: el modal sigue abierto para invitar a otra persona), personas/[id] ("Sin cambios" como `info`), remuneraciones, remuneraciones/[id], remuneraciones/parametros, inventario, catálogo, proveedores, equipos, gastos, agenda/paquetes, portal-cliente, y en configuración: empresa (×3 secciones), cuenta (datos y contraseña), notificaciones, plantillas, perfiles, inventario, viajes, agenda-pro (×3 tarjetas), seguridad (cerrar otras sesiones); `ComboboxResponsable` (invitación).
- Error de acción suelta → toast: toggle de plan (equipos/[id]), eliminar plan, ajuste de aprobación automática, eliminar viaje, facturar viajes, cambiar tramo, toggles de servicios/tipos de pack (agenda-pro), toggle de portal-cliente, cambiar estado de cobro/cotización (antes fallaba en silencio), desactivar 2FA propio (antes fallaba en silencio).
- Se quedaron inline: validaciones, errores de formularios, `errorAccion` de rendiciones/[id] (incluye la validación "Falta el motivo del rechazo"), `errorEliminar` de OS/cobro/cotización, `detalleError` del modal de levantamientos y errores de carga.

## LoadingState
`viajes/page.tsx` (modales de historial de monto y de fotos), `configuracion/modulos`, `configuracion/viajes`, `components/CatalogoSelectorModal`, `components/DocumentoForm`.

## Casos dudosos / fuera de alcance, sin tocar
- **Archivos legacy** (importan `@/components/ui`): portal/*, superadmin/*, informe, trabajos/[id], agendar. Solo se migraron sus confirm (y el Deshacer de fotos en trabajos/[id], que estaba pedido explícitamente). Quedan sin tocar sus mensajes de éxito (`SuccessText`, `msg`/`okPerfiles`/`avisoInvitar`/`okPass`…), los "Cargando…" de superadmin y el `EstadoCargando` (spinner) del portal y agendar → ronda 5.
- `configuracion/plan`: los avisos ("Tu tarjeta quedó registrada", cambio de plan, cancelación) siguen inline para no tocar nada cerca del flujo de Flow. Si el humano quiere, pasarlos a toast es trivial.
- `configuracion/seguridad` `avisoMfa` ("Te enviamos un código a tu correo"): se dejó inline porque es instrucción del paso de activación, junto al campo del código.
- `configuracion/integraciones` `mensaje` (ok/error del resultado de "probar conexión"): se dejó inline, junto a la tarjeta de la integración.
- `components/PrecioViaje` `aviso` (cálculo km × precio): es info del campo, no un éxito → inline.
- Copiar al portapapeles ("Copiado" en el botón) se dejó igual.
- Viajes: la subida de fotos (`subirFotoViaje`) todavía usa `setFotosViaje({...fotosViaje})` sin forma funcional; si alguien sube una foto dentro de los 5 s de un Deshacer podría reaparecer la borrada hasta que se cierre el modal. No se tocó (fuera de alcance).
- trabajos/[id]: después de subir una foto hay recargas programadas a los 6 y 15 s; si coinciden con la espera de un Deshacer, la foto oculta puede volver a verse hasta que termine el borrado.

## Tests
- `web/src/app/dashboard/viajes/tarifas/page.test.tsx` (+3, pantalla real con `ProveedoresFeedback`):
  - Eliminar tramo desde el menú ⋯ → desaparece al instante; "Deshacer" lo devuelve y la API **nunca** recibe el DELETE.
  - Sin deshacer → el DELETE sale recién a los 5 s.
  - "Cambiar precio" abre el diálogo (reemplaza al prompt) con el monto actual y guarda con PATCH `{"precio":"350000"}`.
  - El mock de `@/lib/api` ahora extiende el módulo real (`importOriginal`) para que `exigirOk` exista.
- `web/src/app/dashboard/registros/equipos/[id]/page.test.tsx` (+1): eliminar plan → diálogo "¿Eliminar este plan de mantención?"; Cancelar no borra y Eliminar hace el DELETE.
  - Nota: en esta pantalla `await act(async () => {})` se cuelga incluso sin los proveedores (ya pasaba antes, no viene de este cambio), por eso el test usa `waitFor`.
- `web/src/lib/api.test.ts` (+1): `exigirOk`.
- Ningún test existente simulaba `window.confirm`, así que no hubo que ajustar ninguno.

## Verificación (última corrida)
```
grep -rnE "\b(window\.)?(confirm|alert|prompt)\(" web/src   → sin resultados
cd web && npx tsc --noEmit -p .                              → OK
cd web && npx eslint src                                     → 0 errors, 11 warnings (todos ya estaban: Input/Table/Parada sin usar, window.location, disable sin uso)
cd web && npx vitest run                                     → 11 files, 38 tests passed
npx tsx --env-file=web/.env.local --test web/src/lib/api.test.ts → 7/7 pass
node scripts/check-colores.mjs                               → ✓ 3 (baseline), ningún literal nuevo
```
No se corrió `./verificar.sh` completo (incluye mobile/packages, que trabajan otros agentes).
