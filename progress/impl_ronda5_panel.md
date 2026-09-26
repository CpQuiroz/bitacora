# Tarea 157, ronda 5: panel (archivos que usaban el components/ui.tsx antiguo)

## Archivos tocados
- `web/src/app/dashboard/ayuda/page.tsx`
- `web/src/app/dashboard/perfil/page.tsx`
- `web/src/app/dashboard/trabajos/[id]/page.tsx`
- `web/src/app/dashboard/ordenes/nueva/page.tsx`
- `web/src/app/dashboard/informe/page.tsx`
- `web/src/components/estados.tsx`
- `web/src/components/estados.test.tsx` (nuevo)

Ninguno importa `@/components/ui` (grep vacío).

## Qué se cambió
- `Card className=…` pasa a `<div className="my-ds-6|mb-ds-6"><Card>` de `@bitacora/ui/web`.
- `PageHeader` pasa a `@/components/PageHeader`.
- `ErrorText`/`SuccessText` pasan a `<Aviso tono="error"|"exito">`.
- `Badge` (trabajos/[id], estado del trabajo) pasa a `StatusBadge`. Los valores posibles (en_curso/completado/cancelado) están en MAPA_ESTADO_TONO.
- `Button` pasa al primitivo (`onPress`, `variante`, `deshabilitado`, `tipo="submit"`, `iconoIzq`). Los botones que tenían `className="mt-4"`/`self-start` se envolvieron en `<div>`.
- `Label` + campo pasa a la prop `etiqueta`. Para Combobox*/InputMonto (sin `etiqueta`) se usa `<label htmlFor>` + `id` con el mismo look que el LABEL del primitivo. En las filas de ítems (el rótulo solo va en la fila 0), las demás filas llevan `etiquetaAccesible`/`aria-label`.
- Fechas: `<input type="date">` crudos e `Input type="date"` pasan a `DatePicker` con helpers `aFecha`/`aTexto` (hora local, los mismos que `ordenes/page.tsx`). Hora pasa a `Input tipo="hora"`. Selects pasan a `Select` con `opciones`.
- Clases viejas pasan a ds: text-foreground/muted, border-border, divide-border, bg-surface-sunken (→ bg-ds-neutral-100), text-brand/danger, bg-brand-soft (→ bg-ds-brand/[0.08], el mismo patrón de equipos), text-sm/xs (→ text-ds-small/caption), text-[10px]/[11px] (→ text-ds-micro), espaciados a `*-ds-*`.
- trabajos/[id]: el botón crudo "Eliminar" de cada foto pasa a `Button variante="peligro" tamano="sm"`. Los `<label htmlFor>` que envolvían los botones de subir se quitaron: el botón ya llama `inputRef.click()`, y un botón dentro de un label no reenvía el clic, así que el comportamiento es el mismo.
- estados.tsx: la API pública (`EstadoCargando`, `EstadoVacio`, `EstadoError`) no cambia. `EstadoVacio` y `EstadoError` envuelven `EmptyState` y `ErrorState`. `EstadoCargando` conserva el spinner con texto, porque `LoadingState` no tiene `mensaje` y los usos del portal y agendar lo muestran. Ahora usa tokens ds.
- Se mantienen `useDeshacer`, `useOcultos` y `useConfirmar`. No cambian textos, lógica ni API.

## Decisiones y salvedades
- **ordenes/nueva, cantidad (1 `<input>` crudo nuevo, a propósito):** el `Input tipo="numero"` del primitivo no expone `min`/`step`. Sin `step="0.01"` el navegador bloquea el envío con cantidades como 1,5, lo que sería una regresión. Por eso quedó `CampoCantidad`: un input numérico nativo con el look del primitivo. Se puede quitar cuando `PropsInput` tenga paso/mínimo (packages/ui, fuera de mi grupo). En el total del grupo los inputs crudos igual bajan de 10 a 5.
- **`required` que se pierde:** Textarea y DatePicker no tienen `requerido`. En "Descripción" de ordenes/nueva la validación propia de la pantalla ya lo cubre ("Falta la descripción del servicio"). En "Fecha" (viene con hoy por defecto) queda sin el required nativo. Si alguien la vacía, el backend responde el error.
- informe: pestañas, chips de secciones, filas del historial, "Quitar" dentro de una frase y "×" de los adjuntos siguen como `<button>` crudos retokenizados. El `Button` del primitivo no tiene variante de pestaña/chip/link en línea. Los chips ganan `aria-pressed` y su grupo lleva `role="group"` + `aria-labelledby`. El checkbox "Guardar como plantilla" sigue crudo porque no hay primitivo.
- El input oculto de archivos queda crudo, igual que antes (el primitivo no hace file).

## Conteo en mis archivos (antes a después)
- input: 10 a 5 (informe 8 a 2, ordenes/nueva 0 a 1, trabajos 2 a 2)
- button: 9 a 8
- text-[Npx]: 7 a 0

## Verificación
- `grep 'components/ui"'` en mis archivos: vacío
- `node scripts/check-controles-web.mjs`: `[OK] … (button 163, input 85, select/textarea 8, text-[Npx] 72) — bajaron` (el total incluye el trabajo en paralelo de los otros grupos)
- `node scripts/check-colores.mjs`: OK (3 del baseline)
- web `npx tsc --noEmit -p .`: sin errores
- web `npx eslint src`: 0 errores, 11 warnings, ninguno en mis archivos (eslint sobre mis archivos: rc=0)
- web `npx vitest run`: 50/50 pasan (incluye `ordenes/nueva/page.test.tsx` y el nuevo `estados.test.tsx`)
- No se corrió `./verificar.sh` completo porque lo cierra el líder.
