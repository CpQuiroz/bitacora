# Review — tarea 146 equipos_mobile

**Veredicto:** RECHAZADO (CHANGES_REQUESTED). Sin bloqueantes: 1 mayor y 9 menores. El backend (seguridad y multi-tenant) está bien.
El rechazo se debe solo a que faltan pruebas de pantalla para las pantallas nuevas que cubren el pedido principal (subir y editar
documentos, lista y "Mi vehículo"). Ver M1.

Alcance: `git show 67a8ea1`, revisado contra `docs/harness/{arquitectura,convenciones,verificacion}.md`, `CHECKPOINTS.md`,
`trabajo_list.json` #146 y `progress/current.md` §"Tarea 146".

## Verificación ejecutada por el revisor
- `./verificar.sh` con Node 22 (`~/.npm/_npx/52027bd8fc0022aa/node_modules/node/bin`): **exit 0**. tsc x7; tests: shared 51,
  design-tokens 5, backend 33, mobile 15, web 10; eslint web OK; reglas de hooks OK; audit:tenant 0 (baseline); colores literales 3
  (baseline); 144 migraciones.
- `npm test -w mobile -- EquipoDetalleScreen`: 3/3 PASS.
- `npm run e2e -- equiposDocumentos` contra DEV (backend local en :8080, ref pruwvpnlvrvgtmpetlsr): **19/19 PASS**.
- `git status`: solo `supabase/.temp/*` modificado (entorno, no es de esta tarea). No hay archivos sueltos sin trackear.
- No se tocaron Agenda/Hoy (el commit no toca `features/agenda` ni `features/hoy`). No aparece `supabase` en `mobile/src/features/equipos`
  ni en `mobile/src/services/equipos.ts`.

## Criterios de aceptación
- [x] Documentos de vehículos: el Admin (Flota) en todos → documentos.ts:40. E2E 146-8 y 146-10 (e2e/suites/equiposDocumentos.ts:55, :59).
- [x] El chofer ve, sube y edita solo los de su vehículo asignado → documentos.ts:41-44. E2E 146-1..146-6 (equiposDocumentos.ts:37-50).
      Pierde el acceso al quitarle la asignación → 146-11 (:64).
- [x] El chofer no borra → documentos.ts:41 (`accion !== "borrar"`) y :233. E2E 146-7 (:52), que devuelve 404: es el mismo patrón que
      `documentoAutorizado` para no filtrar si el documento existe.
- [x] La entidad tiene que ser de la empresa → documentos.ts:50-54 y :146. E2E 146-9 (:57). Es débil, ver m7.
- [x] Plan de mantención con permiso de escritura → planesMantencion.ts:27-30, :61, :97, :161. E2E 146-12..146-17 (:68-78).
- [x] Los equipos se ven y se editan, no se crean → EquipoFormScreen.tsx (solo PATCH, services/equipos.ts:55). No hay ruta de creación en
      MasStack. E2E 146-18 y 146-19 (:81, :83).
- [x] UI de la ficha según permisos (chofer, admin, sin Flota) → EquipoDetalleScreen.test.tsx:53, :65, :77.
- [ ] Subir y editar documentos desde la app (formulario con foto, galería o PDF): **sin prueba de pantalla** → M1.
- [ ] Lista de equipos y "Mi vehículo" del chofer (redirige a su ficha o muestra "No tienes un vehículo asignado"): **sin prueba de
      pantalla** → M1.
- [ ] Editar el equipo / crear o editar el plan desde la app: sin prueba de pantalla (el backend sí está cubierto por E2E) → M1.
- [x] Tablero de flota fuera del alcance: no se implementó (correcto).

## Backend: seguridad y multi-tenant
- [x] `autorizado` (documentos.ts:33-46): primero el propio colaborador, después Flota vía `rolPuedeVerModulo` (roles dinámicos) y
      por último el vehículo asignado hoy (`equipoAsignadoAColaborador`, equipos.ts:43-60, filtra `empresa_id`). Borrar nunca pasa por
      la rama del chofer.
- [x] POST valida el permiso (:142) y la entidad de la empresa (:146) **antes** de `subirDocumento` (:162), así que no se sube nada a
      storage si la petición se rechaza. El tipo de documento se filtra por empresa (:154).
- [x] PATCH ahora filtra `empresa_id` también en el update (:221). DELETE conserva `// tenant-ok:` (:238).
- [x] La subida usa `subirDocumento` (storage.ts:387), que aplica `verificarLimiteStorage` (:395), el mismo cupo que `subirAnexo`. Usa
      multipart + multer con límite de 10 MB y mimetypes permitidos (documentos.ts:14-24); el móvil respeta el mismo tope
      (DocumentoFormScreen.tsx:15).
- [x] planesMantencion.ts: `puedeGestionarPlanDe` usa el mismo criterio que editar el equipo (`puedeEscribirEquipo`/`esVehiculo`,
      exportados en equipos.ts:70, :75). PATCH y DELETE resuelven el plan por `empresa_id` antes de chequear (:17-21 del delete).
      También valida el formato de fecha (`FECHA`) y que `activo` sea booleano.
- [x] Status HTTP correctos: 400 validación, 403 sin permiso, 404 no existe.

## Mobile
- [x] Permisos de la UI coherentes con el backend (permisos.ts:9-20 frente a documentos.ts:33-46, equipos.ts:75-79 y
      planesMantencion.ts:27-30). Hay una sola excepción de borde, ver m3.
- [x] Reglas de hooks: en las 5 pantallas todos los hooks van antes de los `return` tempranos (EquipoDetalleScreen.tsx:44-79 frente a :83,
      DocumentoFormScreen.tsx:22-54 frente a :59, EquiposListaScreen.tsx:22-53 frente a :57, EquipoFormScreen.tsx:32-57 frente a :61,
      PlanMantencionFormScreen.tsx:15-35 frente a :40). El lint de hooks pasa.
- [x] Sistema de diseño: `tokens.*` y `@bitacora/ui/native` (ScreenHeader, Card, ListRow, StatusBadge, EmptyState, ErrorState). El
      patrón `${tokens.color.text}80` ya se usa en otras 20 partes de mobile. check-colores está en baseline.
- [x] Sin conexión: la lista usa caché con aviso (services/equipos.ts:27-36, EquiposListaScreen.tsx:111-115). La ficha muestra
      ErrorState con reintento. La subida de documentos avisa que necesita conexión (DocumentoFormScreen.tsx:141-143,
      services/equipos.ts:115-117) y usa `apiFetch` con `TIMEOUT_MULTIPART_MS` (el `Promise.race` de api.ts:123). Las mutaciones directas
      sin la cola son de administración en línea, igual que en eventosFlota/clientes: es aceptable.
- [x] Dependencia nueva `expo-document-picker` (mobile/package.json) justificada en trabajo_list.json #146 ("Requiere
      expo-document-picker (build)"). El build queda pendiente y está anotado en current.md.

## Web
- [x] `DocumentoForm` (web/src/components/DocumentoForm.tsx), perfil (perfil/page.tsx:96), personas (personas/[id]/page.tsx:597) y
      registros/equipos (page.tsx:502) no cambian de contrato. Un colaborador con sus propios documentos sigue entrando por
      documentos.ts:39, y `entidadDeEmpresa` sobre `usuarios` es válido porque la tabla tiene `empresa_id` (01_schema.sql:27).
- [~] registros/equipos/[id]: el plan de mantención de un **vehículo** ahora exige Flota. Ver m1.

## CHECKPOINTS
- C1: [x] arnés completo; [x] verificar.sh exit 0.
- C2: [x] una sola tarea `in_progress` (146; la 144 pasó a `blocked` con su resolución); [x] current.md describe la sesión activa;
  [ ] la entrada de 146 en history.md queda pendiente para el cierre (la tarea sigue abierta, es lo esperado en esta etapa).
- C3: [x] capas; [x] no hay tablas nuevas; [x] audit:tenant 0; [x] no hay RPC nueva; [x] la dependencia nueva está justificada;
  [x] no hay prints de debug ni TODOs.
- C4: [x] verificar verde; [x] E2E contra el sistema real, 19/19; [x] no hay migración; [ ] prueba de pantalla de todas las pantallas
  críticas nuevas → M1.
- C5: [x] no hay temporales; [x] commit de respaldo 67a8ea1; [ ] history.md y la versión en app.json quedan para el cierre y el build
  (anotado en current.md: "Pendiente: revisor; build").

## Hallazgos

### Bloqueantes (B)
Ninguno.

### Mayores (M)
**M1. Faltan pruebas de pantalla para el núcleo del pedido.** verificacion.md §Nivel 2b pide: "Pantalla crítica nueva o cambiada → su
prueba". Solo tiene prueba `EquipoDetalleScreen`. Quedan sin cubrir:
- `DocumentoFormScreen.tsx` (la pantalla de "subir y editar documentos" que pidió la usuaria): falta renderizar alta y edición
  (precarga de tipo, número, fechas y "Tiene un archivo adjunto"), el estado sin tipos de documento (:68-78) y el caso "No se encontró
  el documento" (:37). Tiene `useEffect` y 3 `return` tempranos, justo lo que causó el cierre de la tarea 119.
- `EquiposListaScreen.tsx`: falta cubrir la redirección del chofer a su ficha (:34-38, `navigation.replace`), el estado "No tienes un
  vehículo asignado" (:57-68), el aviso de caché (:111) y la etiqueta de alerta de documentos (:134-136).
- `EquipoFormScreen.tsx` / `PlanMantencionFormScreen.tsx`: al menos que rendericen con datos precargados y que no se caigan.

### Menores (m)
- **m1. Web: pausar o eliminar un plan de un vehículo sin Flota falla en silencio.** planesMantencion.ts:97/:161 devuelven 403 ahora,
  pero `web/src/app/dashboard/registros/equipos/[id]/page.tsx:131-139` solo hace `if (res.ok) cargar();`, sin mostrar el error. Además,
  `puedeGestionar` (:87) solo mira el rol (`ROLES_SUPERVISION`) y no el módulo, así que un Admin o Supervisor de una empresa sin el
  módulo Flota ve botones que ya no funcionan en un equipo de categoría Vehículo. Crear sí muestra el error (:121-124). Hay que mostrar
  el error en esos dos handlers, o bien ocultar los botones sin Flota cuando el equipo es un vehículo.
- **m2. El texto de eliminar documento no es exacto.** EquipoDetalleScreen.tsx:133 dice "Se elimina … y su archivo", pero el DELETE
  (documentos.ts:239) solo borra la fila: el objeto queda en storage y no se descuenta del cupo. Hay que cambiar el texto (o borrar el
  objeto en otra tarea).
- **m3. Chofer con dos vehículos asignados a la vez.** `equipoAsignadoAColaborador` toma solo el más reciente (equipos.ts:56-57), así que
  documentos.ts:42-43 autoriza únicamente ese vehículo. Pero la ficha decide con `asignacion_vigente` del equipo
  (EquipoDetalleScreen.tsx:59, :99). `/asignar` cierra las asignaciones del equipo, no las del chofer (equipos.ts:524-529), así que el
  caso puede darse: la app mostraría "Subir" y el backend respondería 403. La otra opción es autorizar con "existe una asignación
  vigente de (chofer, equipo)" en vez de "el último equipo del chofer".
- **m4. El chofer puede cambiar el tipo de documento por uno de "colaborador".** PATCH (documentos.ts:209-216) y POST (:154) validan
  que el tipo sea de la empresa, pero no `aplica_a`. Ya pasaba antes, pero ahora el chofer también llega a esta ruta. La app filtra bien
  (services/equipos.ts:83).
- **m5. "Mi vehículo" aparece a cualquier usuario sin Flota ni Equipos** (MasScreen.tsx:133-137), incluidos técnicos o instaladores sin
  vehículo (el eje `usuarios.funcion`, arquitectura.md §Roles). No rompe nada (muestra el EmptyState), y "Mantención" (:131) hace lo
  mismo. Conviene condicionarlo a `funcion === "chofer"` o a tener una asignación.
- **m6. PlanMantencionFormScreen sin conexión dice "No se encontró el plan".** `planesDeEquipo` convierte cualquier error en `[]`
  (services/equipos.ts:133-136), y :24-28 lo interpreta como plan inexistente. Tampoco hay `catch` en esa promesa.
- **m7. E2E 146-9 usa un UUID aleatorio** (equiposDocumentos.ts:56-57), no un vehículo real de otra empresa. Prueba "no existe", no el
  aislamiento entre empresas. Hay que crear un equipo en otra empresa (o reutilizar el de la empresa dev) e intentar colgarle un
  documento.
- **m8. La fecha de emisión no se puede quitar una vez puesta.** DocumentoFormScreen.tsx:119: el vencimiento tiene "No vence" (:121-125),
  la emisión no tiene equivalente.
- **m9. Consulta repetida.** planesMantencion.ts:57 (`equipoDeEmpresa`) y luego :61 → `puedeGestionarPlanDe` (:28) leen el mismo equipo
  dos veces en el POST. Es menor: se puede pasar el equipo ya leído.

Nota (no es de esta tarea): `equipoAsignadoAColaborador` calcula "hoy" en UTC (equipos.ts:44). Entre las 20/21 h y medianoche de Chile,
una asignación que empieza o termina "hoy" se evalúa con el día siguiente. Viene de antes.

## Cambios requeridos
1. M1: agregar pruebas de pantalla (Jest + Testing Library, con `await`) para `DocumentoFormScreen` (alta, edición precargada, sin
   tipos), `EquiposListaScreen` (redirección del chofer, sin vehículo, lista con filtro y alerta) y un render básico de `EquipoFormScreen`
   y `PlanMantencionFormScreen`.
2. Recomendado en la misma pasada: m1 (web, errores silenciosos), m2 (texto) y m7 (E2E real entre empresas). El resto puede quedar
   anotado.
