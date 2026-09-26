# Tarea 156 — feedback unificado, parte mobile (`mobile/src`)

Sin tocar `packages/ui`, `web/`, `trabajo_list.json`, `progress/current.md`,
`verificar.sh` ni `features/hoy/`. Sin commits ni builds.

## Resultado

- `Alert.alert` en `mobile/src` fuera de `features/hoy`: **183 → 24**
  (sin contar tests). Los 24 que quedan tienen `// alerta-nativa: <motivo>`
  en la línea anterior (verificado con un script).
- Reemplazos (líneas agregadas; algunos Alert se partieron en 2 toasts
  `enLinea ? exito : info`):
  - `toast(..., { tono: "error" })`: ~109 (errores de red/guardado y
    validaciones de formulario; ningún formulario migrado tenía errores
    inline, así que la regla 4 cae en toast "error").
  - `toast(..., { tono: "exito" })`: ~20.
  - `toast(..., { tono: "info" })`: ~14 ("guardado sin conexión", "se
    reintentará solo", "sin ubicación", "sin OS", "olvidaste tu contraseña").
  - `useConfirmar`: 15.
  - `useDeshacer`: 3 (foto de viaje, foto de mantención, documento de vehículo).
- Formato del toast: `"Título: detalle"` para errores
  (`No se pudo guardar: ${r.error}`), `"Título. Detalle."` para éxito/info;
  si el detalle era solo "Listo." queda el título solo.
- Donde el OK del Alert navegaba (`goBack`, `navigate`, `replace`), ahora se
  navega directo después del toast (el ToastProvider está en la raíz, el
  toast sobrevive a la navegación).

## Archivos

Pantallas/componentes migrados:
`features/gastos/NuevoGastoScreen.tsx`, `features/viajes/ViajeFormScreen.tsx`,
`features/viajes/ViajeDetalleScreen.tsx` (Deshacer foto + confirmar rechazo;
`abrirEnMapa` recibe un callback de error en vez de llamar Alert),
`features/trabajos/TrabajoFormScreen.tsx`, `features/trabajos/TrabajoDetalleScreen.tsx`,
`features/trabajos/components/{FotosSection,CierreFirma,CamposDinamicos}.tsx`,
`features/equipos/{EquipoDetalleScreen,DocumentoFormScreen,EquipoFormScreen,PlanMantencionFormScreen}.tsx`,
`features/clientes/{ClienteDetalleScreen,ClienteFormScreen}.tsx`,
`features/agenda/{NuevaCitaScreen,TareaDetalleScreen,NuevaReservaCosmetologia}.tsx`,
`features/perfil/PerfilScreen.tsx`, `features/gestion/{CobroFormScreen,CobroDetalleScreen}.tsx`,
`features/ventas/RegistrarVentaScreen.tsx`,
`features/mantencion/{ChecklistMantencionScreen,MantencionDetalleScreen,EventosFlotaScreen}.tsx`,
`features/levantamientos/LevantamientoDetalleScreen.tsx`,
`features/rendiciones/{RendicionDetalleScreen,RendicionFormScreen}.tsx`,
`features/superadmin/{SuperAdminEmpresaDetalleScreen,SuperAdminNuevaEmpresaScreen}.tsx`,
`features/auth/LoginScreen.tsx`, `features/asistente/AsistenteScreen.tsx`,
`features/mas/MasScreen.tsx` (solo comentario), `services/sync/NetworkProvider.tsx`
(es componente, dentro del ToastProvider → `useToast`),
`lib/imagen.ts` (ver abajo), `features/trabajos/TrabajosMapa.tsx` (carga).
Solo comentario `alerta-nativa`: `components/{HojaCrearCliente,LienzoFirma,SelectorResponsable}.tsx`,
`features/clientes/AsignarPackModal.tsx`, `features/agenda/{NuevoServicioModal,TipoPackModal}.tsx`.

Tests:
- `features/trabajos/TrabajoFormScreen.test.tsx`: ya no espía `Alert.alert`;
  mockea `useToast` y verifica el toast de validación ("Falta el cliente…",
  error), el de éxito ("Trabajo creado", exito) + `goBack`, y el "info" del
  reintento.
- `features/viajes/ViajeDetalleScreen.test.tsx` (nuevo, providers reales):
  rechazar pide confirmación y cancelar no llama a la API; confirmar llama y
  vuelve; eliminar foto se oculta al instante, "Deshacer" la devuelve y la API
  nunca se llama; sin deshacer la API se llama a los 5 s; si la API falla la
  foto vuelve y se ve el toast rojo.
- `features/equipos/EquipoDetalleScreen.test.tsx`: nuevo caso de Deshacer al
  borrar un documento del vehículo (entrando por el menú nativo).
- Nota de test: con `useConfirmar`, el handler queda esperando el diálogo, así
  que el `fireEvent.press` que lo abre va sin `await`
  (`void fireEvent.press(...)`) o el test se cuelga.

## Alertas que quedaron (24) y por qué

1. **Menús de opciones** (8) — Alert con 2-3 acciones que no son
   confirmación; no hay hoja de acciones en `@bitacora/ui`:
   `EquipoDetalleScreen` (opciones del documento, opciones del plan, tipo de
   registro de mantención), `DocumentoFormScreen` (foto o PDF),
   `FotosSection` y `CamposDinamicos` (cámara o galería), `MasScreen`
   (Nuevo gasto / Rendiciones), `lib/imagen.ts` (`elegirFotos`, cámara o galería).
2. **Dentro de un `<Modal>` de RN** (15) — el toast vive en la raíz y un Modal
   nativo lo tapa, así que el aviso no se vería: `TipoPackModal` (4),
   `NuevoServicioModal` (3), `AsignarPackModal` (2), `HojaCrearCliente` (2),
   `SelectorResponsable` (2), `LienzoFirma` (2). Son validaciones y errores
   de guardado de esas hojas. (El diálogo de confirmación sí funciona encima
   de un Modal porque también es un Modal.)
3. **Respaldo en util sin hooks** (1) — `lib/imagen.ts#avisarPermiso`:
   `elegirFotos` ahora acepta `avisar?: MostrarToast`; los 8 que la llaman
   le pasan `toast` y el permiso denegado sale como toast "error". El
   `Alert.alert` queda solo como respaldo si alguien no lo pasa.

## Carga (regla 6)

- `TrabajosMapa`: `LoadingScreen` (spinner centrado) → `LoadingState`.
- Las demás listas/detalles ya usaban `LoadingState`/`Skeleton`. No se tocaron
  los spinners de botones, el "Pensando…" del asistente, los de miniaturas de
  fotos subiendo, ni `RootNavigator` (arranque de la app, no una lista).
  `NuevaReservaCosmetologia` "Cargando servicios…" es una línea dentro del
  formulario; la dejé.

## Casos dudosos (para el revisor/humano)

- **Foto de OS** (`FotosSection` / `CamposDinamicos`): quedó con
  `useConfirmar`, no Deshacer. La API es un borrado simple, pero la foto
  tiene análisis de IA y la OS tiene reglas de inmutabilidad; además
  `FotosSection` borra desde el visor (Modal) con `onEliminar` como prop.
  Si se quiere Deshacer, habría que ocultarla en `TrabajoDetalleScreen`.
- **Plan de mantención** (`EquipoDetalleScreen`): `useConfirmar`, no Deshacer
  (es configuración, no un adjunto simple).
- **Cliente con historial**: si está activo → `useConfirmar` "No se puede
  eliminar" con acción "Desactivar"/"Cerrar"; si ya está inactivo (no había
  decisión) → toast "error" con el resumen en una línea
  (`… tiene historial (3 OS, 2 cobros).`).
- **SuperAdmin cambiar estado/plan**: `useConfirmar` sin `destructivo`
  (el Alert original tampoco era destructivo), aunque suspender una empresa
  podría serlo.
- **Olvidé mi contraseña** (Login): toast "info" de 6 s en vez de Alert. Es
  texto largo; si se prefiere algo que no desaparezca, podría ir inline.
- **Permisos de cámara/galería**: no ofrecían ir a Ajustes, así que pasaron a
  toast "error" (no aplica la excepción).
- `NetworkProvider.sincronizarAhora`: el mensaje perdió el "\n\nHubo un error
  inesperado al reintentar" y queda `No se pudo sincronizar: <error>`.
- Se quitaron estados que solo servían para la opacidad "eliminando" de las
  fotos de viaje y mantención (con Deshacer la foto desaparece al instante).

## Verificación

- `npx tsc --noEmit` (mobile): sin errores.
- `npx jest` (mobile): 15 suites, 51 tests, todos verdes.
- `node scripts/check-accesibilidad-mobile.mjs`: `[OK] botones de mobile con nombre accesible`.
- `node scripts/check-contraste.mjs`: `[OK] texto secundario con token sólido`.
- Reglas de hooks (`eslint-hooks.config.mjs` sobre mobile/src): sin hallazgos.
- `node scripts/check-colores.mjs`: 3 (baseline), ningún literal nuevo.
- Script ad hoc: 24 `Alert.alert` fuera de `features/hoy`, todos con
  `// alerta-nativa:` en la línea anterior.
- No corrí `./verificar.sh` completo (toca web/packages que están en manos de
  otra parte de la tarea).
