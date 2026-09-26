# Review — tarea 156 feedback_unificado (commit 2ef0e56)

**Veredicto:** CAMBIOS REQUERIDOS

`./verificar.sh` → exit 0 (tsc x7, tests: shared 51, tokens 21, ui 3, backend 36, mobile 51, web 38; eslint, hooks, audit:tenant 0, colores 3 = baseline, check-dialogos-nativos OK).
Casi toda la web está bien. Lo que bloquea es mobile en **iOS**: una parte grande de los toasts nuevos no se ve y una confirmación queda colgada.

## Hallazgos

### A1 — ALTA (bloquea) · iOS: los toasts no se ven en pantallas abiertas con `presentation: "modal"`
- `packages/ui/src/native/Toast.tsx:39-50`: el contenedor de toasts es un `View` absoluto dentro de `ToastProvider`, montado en la raíz (`mobile/src/shell/App.tsx:93`).
- `native-stack` con `presentation: "modal"` en iOS presenta un UIViewController nativo **encima** de la vista raíz. Pasa en `AgendaStack.tsx:34` (NuevaCita), `TrabajosStack.tsx:34` (TrabajoForm) y `MasStack.tsx:68,69,70,76,79,83` (EquipoForm, DocumentoForm, PlanMantencionForm, CobroForm, GastoForm, RendicionForm).
- En esas pantallas hay unos 53 `toast(...)` que no se van a ver: TrabajoForm 10, NuevoGasto 17, NuevaCita 8, CobroForm 5, DocumentoForm 4, EquipoForm 3, PlanMantencion 3, RendicionForm 3. La mayoría son **validaciones y errores de guardado** ("Falta el cliente…", "Falta la foto: un gasto de rendición siempre necesita comprobante", "No se pudo guardar: …"). Antes el `Alert.alert` se veía. Ahora el usuario toca Guardar y no pasa nada visible. Los toasts de éxito no se ven afectados, porque salen después de `goBack()`.
- Android no se ve afectado: ahí el modal de native-stack es una pantalla más dentro de la misma jerarquía.
- El test (`TrabajoFormScreen.test.tsx`) mockea `useToast`, así que no puede detectar esto.
- **Arreglo sugerido:** envolver el contenedor de toasts en `FullWindowOverlay` de `react-native-screens` en iOS (ya es dependencia, `~4.26.0`). Se dibuja en una ventana propia, por encima de las pantallas modales y también de los `<Modal>` de RN. Con eso además se podrían eliminar varias de las 15 `alerta-nativa: dentro de un Modal` en iOS. La otra opción es dejar las validaciones de estas pantallas inline o con `// alerta-nativa:`. Hay que verificarlo en un dispositivo iOS, o como mínimo en el simulador.

### A2 — ALTA (bloquea, confirmar en iOS) · `useConfirmar` llamado desde dentro de un `<Modal>` de RN
- `mobile/src/features/trabajos/components/FotosSection.tsx:73-76`: `confirmarEliminar` se llama desde el visor, que es un `<Modal>` (`:295`).
- El diálogo de confirmación también es un `<Modal>` (`packages/ui/src/native/Dialog.tsx:22`), montado en la raíz. En RN 0.86 con Fabric, `RCTModalHostViewComponentView.mm:150-155` lo presenta desde `[self reactViewController]`, que es el VC raíz. Ese VC ya está presentando el visor, así que iOS rechaza la segunda presentación ("already presenting"). Resultado: la hoja no aparece, la promesa de `confirmar` nunca se resuelve y "Eliminar foto" no hace nada. Además `pedido` queda distinto de null con `visible` fijo en true, por lo que es probable que las confirmaciones siguientes tampoco se presenten.
- El reporte mobile dice "El diálogo de confirmación sí funciona encima de un Modal porque también es un Modal". En iOS eso no es cierto; solo vale para Android.
- **Arreglo sugerido:** en FotosSection, cerrar el visor (`setAbierta(null)`) antes de llamar a `confirmar`. Otras opciones: dejar ese caso con `Alert.alert` + `// alerta-nativa: confirmación dentro del visor (Modal)`, o renderizar el confirm dentro del visor. Revisar si alguna otra llamada a `confirmar` puede pasar con un Modal o una pantalla modal abierta. Hoy son 15 y ninguna más está dentro de un Modal, pero conviene dejar la regla escrita en el comentario de `native/Confirmar.tsx`.

### M1 — MEDIA · Web: Escape cierra el confirm **y** el Modal de abajo
- `packages/ui/src/web/Dialog.tsx:22` y `web/src/components/Modal.tsx:35` registran los dos un `keydown` en `document`. Si se abre `confirmar` desde un Modal abierto, Escape cierra los dos.
- Casos reales: `agenda/page.tsx:747` (cancelar cita con pack, desde el Modal de tarea), `levantamientos/page.tsx:331` y `:377` (eliminar / rechazar, desde el Modal de detalle).
- No se pierden datos (resuelve `false`), pero el usuario pierde el formulario o detalle abierto. Con `window.confirm` esto no pasaba.
- **Arreglo sugerido:** que solo el diálogo de arriba atienda Escape. Por ejemplo, un listener en fase de captura en `Dialog` con `e.stopImmediatePropagation()`, o una pila de diálogos abiertos.

### M2 — MEDIA · Web: recargar en `alTerminar` hace reaparecer otros ítems con borrado pendiente
- Pasa en `viajes/tarifas/page.tsx:145,170`, `rendiciones/[id]/page.tsx:342`, `trabajos/[id]/page.tsx:102` y `RegistrosMantencion.tsx:285`. Si se borran A y B dentro de 5 s, la recarga que viene tras el DELETE de A trae B desde el servidor, porque todavía no se borró. B vuelve a aparecer sin ninguna marca y el usuario puede editarlo, por ejemplo cambiarle el precio a una tarifa, justo antes de que se borre.
- En rendiciones el caso es muy probable: quitar varios gastos seguidos. `trabajos/[id]` además tiene recargas programadas a los 6 y 15 s (`:91-92`), cosa que el implementador ya anotó.
- Mobile resolvió esto bien con una lista de `ocultos` que se aplica sobre la vista (`ViajeDetalleScreen`, `MantencionDetalleScreen`, `EquipoDetalleScreen`).
- **Arreglo sugerido:** usar el mismo patrón en web, un `Set`/estado de ids ocultos que se filtra al renderizar. Eso también resuelve la limitación anotada de `subirFotoViaje` y la de restaurar en una lista con filtros distintos (EventosFlota con otra semana, Agenda con otro mes).

### M3 — MEDIA (decisión del humano) · Viáticos "Marcar pagado" si se cierra la pestaña
- `viaticos/page.tsx:112`. Si se navega dentro de la app antes de 5 s, queda consistente: el timer vive en la closure y el POST sale igual. El error llega por el toast global y no hace falta recargar, porque la pantalla ya no está.
- Si se **cierra o recarga la pestaña**, el pago no se registra, aunque el usuario vio "marcados como pagados". El humano aceptó esto para los borrados. En un pago, el riesgo es pagarle dos veces al chofer.
- Además el toast muestra el monto esperado y no el `pagados/total` real que devuelve el backend, como hacía antes.
- **Arreglo sugerido:** en la primitiva web, llevar la cuenta de Deshacer pendientes y registrar `beforeunload` mientras haya alguno. Si no, excluir Marcar pagado de Deshacer. Hay que consultarlo con el humano.

### B1 — BAJA · Avisos que ahora duran 3 s
- `registros/clientes/page.tsx:115` y `viajes/rutas/nueva/page.tsx:181`: el aviso "no encontramos esa dirección en el mapa — revisa…" pide una acción y antes quedaba fijo. Sugerencia: `duracionMs` de 6-8 s o dejarlo inline.
- Mobile iOS: con el teclado abierto, un toast a `bottom: space8 + 64 + inset` (`native/Toast.tsx:49`) queda debajo del teclado. En Android no, gracias a adjustResize. Sugerencia: desplazarlo con `Keyboard` o usar `KeyboardAvoidingView`.

### B2 — BAJA · Web: el confirm sobrevive a una navegación
- `ConfirmarProvider` está en el layout raíz. Si el usuario va atrás con el navegador mientras el diálogo está abierto, el diálogo sigue arriba en la página nueva. Sugerencia: en `ProveedoresFeedback`, resolver `false` cuando cambia `usePathname()`.

### B3 — BAJA · Mobile: el confirm no lleva la marca de la empresa
- `App.tsx:93-94`: `ToastProvider`/`ConfirmarProvider` quedan por fuera de `ConTema`/`ProveedorMarca` (`App.tsx:20-43`), así que el botón "primario" de las confirmaciones no destructivas sale con la marca por defecto. En web esto se resolvió pasando la marca a `<html>`.
- Sugerencia: mover `ConfirmarProvider` adentro de `ConTema`. SuperAdmin también lo tiene, porque `SuperAdminGate` está por fuera; hay que revisar eso al moverlo.

### B4 — BAJA · Inconsistencia: foto de OS
- Web usa Deshacer (`trabajos/[id]/page.tsx:95-104`) y mobile usa `useConfirmar` (`FotosSection`/`CamposDinamicos`). Las dos son válidas, pero conviene unificar. El caso quedó marcado como dudoso en los dos reportes; lo decide el humano.

## Verificación de los puntos pedidos
1. **Deshacer:** oculta y restaura bien. `reponer` no duplica y vuelve al índice original. La API se llama solo después de la espera y, si falla, restaura y muestra el toast rojo (primitiva `compartido/deshacer.ts`). No se aplicó Deshacer a OS, cobros, cotizaciones, rendiciones completas ni superadmin: todos siguen con `useConfirmar` (`ordenes/[id]:339`, `cobros/[id]:157`, `cotizaciones/[id]:239`, `rendiciones/[id]:265`, `superadmin/empresas/[id]` x4, mobile `CobroDetalle`/`RendicionDetalle`/`SuperAdmin`). Viáticos: ver M3. Recargas: ver M2.
2. **Confirmaciones:** revisé las 21 de web y las 15 de mobile. En todas se conserva el return temprano y el orden de efectos; los chequeos de `enLinea` siguen después de confirmar, como antes. Los handlers async van a `onPress`/`onClick`, que no esperan resultado, y los servicios devuelven `{ok}` sin lanzar excepciones. No encontré promesas rechazadas sin manejar.
3. **Toasts en lugar de Alert/banners:** los errores de formulario web siguen inline (`errorAccion`, `errorEliminar`, `detalleError`). Lo que se pierde está en A1 (iOS) y B1. La navegación directa tras el toast (`TrabajoDetalle` al cerrar la OS, `TareaDetalle`, formularios) no se salta nada necesario.
4. **Las 24 `alerta-nativa`** están justificadas: 8 menús de opciones, 15 dentro de un Modal y 1 respaldo en una util sin hooks, que ninguno de los 8 callers usa porque todos pasan `avisar`. Faltó aplicar el mismo criterio a las pantallas modales de native-stack (A1) y a la confirmación dentro del visor (A2). No hay hooks fuera de componentes: `imagen.ts` recibe el toast por parámetro y `NetworkProvider` es un componente dentro de `ToastProvider`.
5. **Web:** hay un solo layout con `<html>` y `ProveedoresFeedback` envuelve todo, incluidos superadmin, portal y legacy. No hay portales. La marca en `<html>` se limpia en el cleanup del efecto, que corre al cambiar de color, al pasar a una empresa sin color (early return tras el cleanup) y al desmontar el shell (superadmin o fin de impersonación). Está OK.
6. **Tests:** prueban cosas reales. `compartido/deshacer.test.ts` cubre espera, Deshacer y fallo. `Feedback.test.tsx` cubre el confirm con true, cancelar y Escape, el rol alert y Deshacer. En `tarifas/page.test.tsx`, la pantalla real con proveedores confirma que el DELETE nunca sale si se deshace y que sale a los 5 s; el diálogo reemplaza al prompt. `equipos/[id]/page.test.tsx` cubre el confirm del plan. `ViajeDetalleScreen.test.tsx` usa providers reales y cubre confirmar, deshacer, llamada a los 5 s y fallo que restaura. Ninguno cubre iOS (A1/A2) ni varios borrados seguidos (M2).

## Arquitectura / Convenciones / Verificación
- [x] Sin `supabase.from` nuevo en web/mobile; `audit:tenant` en 0.
- [x] Sin dependencias nuevas (`packages/ui` solo agrega el script `test`, que `verificar.sh` corre).
- [x] Check nuevo `scripts/check-dialogos-nativos.mjs` integrado en `verificar.sh` (sección 8); `features/hoy` exenta (congelada, no se tocó).
- [x] Colores: baseline 3, sin literales nuevos.
- [ ] Verificación en dispositivo iOS de toasts y confirmaciones (A1/A2): no se hizo.

## CHECKPOINTS
- C1: [x] arnés completo, verificar.sh exit 0.
- C2: [x] una sola tarea in_progress (156); current.md describe la sesión activa.
- C3: [x] capas, tenant, sin deps nuevas, sin prints de debug (los `console.log` son la salida del script de check).
- C4: [x] verificar verde, tests con asserts concretos contra pantallas reales. [ ] Falta probar en iOS real (A1/A2).
- C5: [x] commit de respaldo hecho. [ ] Falta la entrada en history.md y el cierre de la tarea: queda pendiente hasta resolver esta review. Sin build mobile pedido, así que no aplica bump de app.json.

## Cambios requeridos
1. **A1:** que los toasts se vean en iOS en las pantallas `presentation: "modal"` (`FullWindowOverlay` en `native/Toast.tsx`, o validaciones inline o alerta-nativa en esas 8 pantallas). Verificarlo en el simulador de iOS.
2. **A2:** que la confirmación de "Eliminar foto" del visor de OS funcione en iOS: cerrar el visor antes de `confirmar`, o usar `alerta-nativa`.
3. **M1:** que Escape cierre solo el diálogo de arriba.
4. **M2:** en los Deshacer web con `alTerminar` que recarga, filtrar los ids con borrado pendiente (patrón `ocultos` de mobile).
5. **M3:** preguntarle al humano si pone `beforeunload` mientras haya Deshacer pendiente o si saca "Marcar pagado" de Deshacer.
Opcionales: B1–B4.
