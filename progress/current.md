# Sesión actual

- **Tarea en curso:** 13 — galeria_y_eliminar_fotos_mobile (ver detalle abajo)
- **Cerradas esta sesión:** 9 — edicion_viajes_y_fotos_os, 10 — fotos_mantencion_equipo,
  11 — fix_sync_cola_apilamiento (insuficiente, ver tarea 12), 12 — fix_sync_reintentar_bloqueado
- **Pausada:** 8 — sistema_diseno (pending, no abandonada — retomar cuando la
  usuaria lo pida; ver `docs/design-system.md` §"Seams que quedan fuera de
  este pedido" para el estado exacto donde quedó)
- **Inicio tarea 9:** 2026-09-11
- **Agente:** Claude Sonnet 5 (directo)

## 2026-09-11: tarea 9 — Edición de Viajes (Admin/Supervisor) + fotos inicio/término OS

Paso 0 (auditoría) encontró que la mayor parte del pedido ya existía:
- `PATCH /api/viajes/:id` ya permitía reasignar chofer y editar viajes
  `confirmado` (solo bloqueaba `facturado`) — el gap real era la UI web,
  que solo mostraba "editar" para `borrador`.
- `comentarios` ya existía como campo libre — se reutilizó tal cual para
  incidentes (sin tabla nueva, decisión delegada por la usuaria).
- `analisis_fotos.categoria` (antes/durante/despues/equipo) y su
  agrupación en `generarPdfOS.ts` **ya estaban implementados** desde la
  migración 98 (Fase 2 PDF OS, docs/pdf-os-fase2.md) — incluido el
  selector de categoría en mobile (`FotosSection.tsx`) y el guard de
  inmutabilidad (`trabajoBloqueado`) ya cubriendo upload+delete de forma
  uniforme. Solo se relabeleó "antes"/"despues" → "Inicio"/"Término"
  (`ETIQUETA_CATEGORIA_FOTO_OS`, sin migración ni backfill — el valor en
  DB no cambia).
- Roles: confirmado en `server.ts`/`permisos.ts` que Admin y Supervisor
  ya tienen el mismo acceso a "viajes" — sin split fino por acción hoy.

**Construido de verdad** (lo que no existía):
- `POST /api/viajes/:id/fotos` y `DELETE /api/viajes/:id/fotos/:fotoId`
  en `viajesRouter` (antes solo existían en `mis-viajes.ts`, mobile) —
  mismo patrón (`subirFotoGuiaConNombre`), bloqueado solo si `facturado`.
- `web/viajes/page.tsx`: edición habilitada para `confirmado` (no solo
  `borrador`), con reasignar chofer, comentarios/incidentes, y galería
  de fotos con subir/eliminar (antes era de solo lectura).

**Verificado en vivo** (Chrome MCP contra dev, `pruwvpnlvrvgtmpetlsr`,
sesión real de Transportes Itineris): edité un viaje `confirmado` sin que
bajara de estado, el comentario de incidente quedó guardado, subí una
foto de prueba y la eliminé — los 3 pasos funcionaron de punta a punta.
`EXPLAIN ANALYZE` confirmó Index Scan en `viajes.chofer_id`
(`viajes_chofer_id_idx`) y `viaje_fotos.viaje_id`
(`viaje_fotos_viaje_id_idx`) — ambos índices ya existían (migraciones 82
y 95), no hizo falta ninguno nuevo.

`./verificar.sh` verde: tsc x6, 27 tests, 12 literales, 99 migraciones.

Queda una nota de prueba en dev en el viaje G-4821 (Comercial Andes SpA)
— dato de test, no de producción, no se limpió porque no afecta nada.

## 2026-09-11: tarea 10 — flujo de mantención de equipo + unlock superadmin dev

**Bug real encontrado y corregido** (era la causa de "no funciona subir
imagen"): el modal "Nuevo registro de mantención" (web) pedía el
checklist a `GET /api/equipos/${equipo.id}/registros-mantencion/
plantilla` — con el `equipoId` de más. Esa URL no matcheaba ninguna
ruta registrada tal cual, así que Express la resolvía contra
`GET /:equipoId/registros-mantencion/:id` con `id="plantilla"` — un
uuid inválido, 500 de Postgres. El modal nunca cargaba el checklist,
así que jamás se llegaba a la sección de fotos. La ruta real
(`registrosMantencion.ts`) es `/api/equipos/registros-mantencion/
plantilla` (sin equipoId, registrada antes de las rutas con `:id` a
propósito) — mobile ya la llamaba bien, solo la web tenía el bug.

**Gap real de producto** (no solo bug): no existía ninguna forma de
ver, agregar o eliminar fotos de un registro YA CREADO — ni en web ni
en mobile. El registro core (checklist, km, firma) sigue inmutable a
propósito (decisión de diseño ya existente, para no debilitar el
registro auditable) — se agregó la excepción acotada que pedía la
usuaria: fotos de respaldo editables después, mismo criterio que
`viajes` en la tarea 9.
- Backend: `DELETE /:equipoId/registros-mantencion/:id/fotos/:fotoId`
  nuevo (el POST ya existía). Invalida el PDF cacheado igual que el POST.
- Web: modal "Ver detalle" (ícono ojo, nuevo, junto al de PDF) con
  checklist agrupado por sección + galería de fotos con agregar/eliminar.
- Mobile: `MantencionDetalleScreen.tsx` nueva (ruta `MantencionDetalle`),
  se llega tocando una fila en `MantencionHistorialScreen` (antes no
  navegaba a ningún lado). Mismo patrón de cámara que
  `ChecklistMantencionScreen.tsx`.

**Verificado en vivo** (Chrome MCP, dev, Transportes Itineris): creé un
registro nuevo con checklist + 1 foto (confirmó el fix del bug), abrí
el detalle nuevo, agregué una segunda foto, la eliminé — los 4 pasos
funcionaron de punta a punta contra el backend y S3 reales. Un primer
intento de DELETE dio 503 (coincidió con un reinicio de `tsx watch` por
un guardado de archivo mío) — el reintento inmediato, sin más cambios
de código, funcionó limpio; no es un bug del endpoint.

**Superadmin de dev desbloqueado**: `super_admins` (cquirozit@gmail.com)
tenía `intentos_fallidos=5` y `bloqueado_hasta` en el futuro (423 al
loguear). Reseteado a `intentos_fallidos=0, bloqueado_hasta=null`
directo en la DB de dev (`pruwvpnlvrvgtmpetlsr`) — mismo efecto que
un login exitoso, nada nuevo. No aplica a prod.

`./verificar.sh` verde: tsc x6, 27 tests, 12 literales, 99 migraciones.

## Decisiones confirmadas por la usuaria

- 2026-09-09: reemplazar Faena por crema/Caprasimo. Lucide en ambos.
  Caprasimo solo headings+lg. Storybook web + /dev/ui mobile.
- 2026-09-10: coexistencia web = namespace `ds-`. API de Button en español.
  "sigue derecho" (x3), "sigue con mobile login", "sigue con el bucket 2 y
  arregla el problema", "sigue con el bucket 3, no toques el shell",
  "sigue con TrabajoDetalleScreen ahora".
- 2026-09-10: contraste del accent default — aceptado el fallback tal cual.

## Estado por paso

- Paso 0-5 + bucket 1 + bucket 2: ✅ pusheados.
- **Bucket 3 — Órdenes de servicio: ✅ COMPLETO (este commit)**
  - Web listado + ficha: ✅ (commit `48e0935`, ya pusheado).
  - Mobile listado: ✅ (mismo commit).
  - **Mobile ficha (este commit):** `TrabajoDetalleScreen.tsx` +
    `CamposDinamicos.tsx`/`FotosSection.tsx`/`CierreFirma.tsx` (uso
    exclusivo de esta pantalla, verificado). Bloque de foco (check-in)
    navy→`marca.base`. Banner "finalizado" verde→`accent2Ramp` (no hay
    tono éxito separado del accent2 en el sistema nuevo). Ionicons→Lucide.
    `Textarea` usado donde antes era `Input multiline` (no soportado en
    el contrato nuevo).
  - Verificado: tsc limpio, `expo start --web` carga y monta TODO el
    árbol de navegación sin errores de consola (buena señal de imports
    correctos), sin poder navegar a la ficha en sí sin sesión real.
  - `check-colores.mjs`: BASELINE 18→15 (bajó solo).
  - `./verificar.sh` verde: tsc x6, 27 tests, 15 literales.

## Bug real encontrado y corregido (post bucket 3)

La usuaria reportó texto ilegible en `/dashboard/ordenes` (tabla y
título) y trajo un prompt para abandonar crema y volver a navy único.
Diagnostiqué en vivo antes de tocar nada: no era la dirección crema,
era herencia de color con el dark-mode de Faena (`@media
(prefers-color-scheme: dark)`) filtrándose en elementos sin `color`
propio. Fix: `text-ds-text` explícito en `Card` (cubre `Table`) +
panel propio (`bg-ds-bg`) en las 3 páginas migradas, mismo patrón que
ya usa `AuthLayout`. Verificado en vivo (Chrome MCP) en las 3
pantallas. Detalle completo en `docs/design-system.md` §"Bug real:
contraste roto en dark mode". `DashboardShell` (el seam) sigue sin
migrar — decisión pendiente de la usuaria si corresponde ahora.

## 2026-09-11: la usuaria pidió "migrá la shell y homologá todo"

Decisión de la usuaria (no turno a turno esta vez, autorización amplia):
migrar `DashboardShell` y dejar TODAS las secciones con el mismo
estilo/colores. `DashboardShell.tsx` ✅ migrado (Lucide + tokens ds-,
detalle en docs/design-system.md). Alcance real: 71 páginas bajo
`dashboard/**` sin migrar + `web/src/components/ui.tsx` (Faena, API
inglesa) importado por 87 archivos — cada uno necesita reescritura de
JSX contra la API nueva, no un alias. Sigo bucket por bucket (mismo
orden de siempre: Operación → Clientes → Dinero → Recursos → Equipo →
Informes → Configuración), comiteando y verificando en cada uno, sin
esperar "sigue" (ya está autorizado). Mobile buckets 4-7 quedan
aparte — la usuaria habló de "la shell" en el contexto web.

## 2026-09-11: "Configuración" cierra el pedido "homologá todo"

Los 7 grupos de nav de `DashboardShell` (Operación, Clientes, Dinero,
Recursos, Equipo, Informes, Configuración) están migrados y
comiteados — ~22 commits desde que empezó "homologar todo".
**Configuración** (última pieza, 16 subpáginas + `layout.tsx`) cerró
en 5 commits: layout+perfiles+5 páginas, tipos-trabajo+inventario+
plantillas, cuenta+seguridad, plan+notificaciones, empresa+agenda-pro.
Detalle de gaps/decisiones en `docs/design-system.md` §"Homologar
todo — grupo de nav Configuración".

`./verificar.sh` verde (tsc x6, 12 literales baseline).

## Próximo paso

El pedido explícito de la usuaria ("migrá la shell y homologá todo")
está cerrado. Quedan 2 seams fuera de ese alcance, documentados en
`docs/design-system.md` §"Seams que quedan fuera de este pedido":
**Agenda** (`dashboard/agenda/*`, usa `DataTable`/`EstadoCitaRiel`
propios) y **`/superadmin`** (`roles`, `resumen`, `cuenta`,
`empresas/[id]` — shell ya migrado, contenido sigue en Faena).
Ninguno se toca sin que la usuaria lo pida explícitamente. Mobile
buckets 4-7 (fuera de "la shell" en el sentido que usó la usuaria)
también quedan aparte.

## Pendiente / notas generales

- eslint web roto (tarea #1) — bloquea regla ESLint del Paso 7.
- Seams acumulados (Faena, migran cuando les toque su bucket o si se pide
  el shell explícitamente): `DashboardShell`, `Screen.tsx`, `HoyStack`
  (parcial), `LogoMark`/`Logo`, charts Recharts de Informes,
  `CatalogoSelectorModal`, `TrabajosMapa.tsx`.
- `MAPA_ESTADO_TONO`: completar por pantalla según vayan apareciendo
  estados reales.
- Ningún bucket verificado con captura de pantalla REAL en mobile todavía
  (sin credenciales de sesión) — solo web (Login/Registro). Si la usuaria
  puede dar credenciales de un usuario dev, se podría verificar visualmente
  el resto también.

## 2026-09-11: tarea 11 — bug real de sync encontrado probando en prod

La usuaria probó el APK 1.9.5 contra producción real (siguiendo el plan
de la tarea 5) y el registro de mantención con foto "se quedó
sincronizando" y nunca se creó. Confirmado con una lectura contra prod
(`yjbskbskyadxjooxngjv`, `equipos.patente = 'CFHGJ'`): 0 filas en
`registros_mantencion_equipo` — no quedó nada a medio crear tampoco.

**Causa raíz real** (`mobile/src/services/api.ts`, ya documentada ahí
mismo pero sin mitigación): un `fetch` con body `FormData` en React
Native **no se puede abortar de verdad** — cuando el timeout manual
(`Promise.race`) "gana", la promesa se rechaza pero el `fetch`
original sigue viajando en segundo plano, sin forma de cancelarlo.
`services/sync/queue.ts` no tenía ningún guard contra esto: un
reconectar o volver al foreground disparaba `procesar()` de nuevo
mientras el intento anterior de la MISMA acción (con archivo) todavía
podía estar en camino — apilando subidas concurrentes de la misma
foto/registro que se saturaban entre sí hasta que ninguna llegaba a
terminar. Con cold start de Render (30-60s) + subir 1+ fotos en una
conexión mediocre, 60s de timeout se quedaba corto seguido, disparando
justo este ciclo.

**Fix**:
- `TIMEOUT_MULTIPART_MS = 90000` compartido en `api.ts` (antes 60000
  hardcodeado en 4 sitios: `mantencion.ts` x2, `viajes.ts` x2, y
  `queue.ts`).
- `queue.ts`: nuevo campo `ultimoIntentoEn` por acción — no se relanza
  una acción con archivo(s) mientras su intento anterior pueda seguir
  en vuelo (dentro de la ventana del timeout). Esto es el fix
  estructural real; subir el timeout solo reduce cuán seguido se
  dispara el ciclo, no lo elimina por sí solo.

`./verificar.sh` verde: tsc x6, 27 tests, 12 literales, 99 migraciones.
APK 1.9.6 (versionCode 23) generado igual que el anterior (local,
apuntado a prod) para que la usuaria reintente el E2E de la tarea 5.

## 2026-09-11: tarea 12 — el fix de la 11 no alcanzó, regresión propia real

La usuaria reprobó 1.9.6: "no permite crear mantención si indico algún
valor en NO y subo imagen" (falla igual al intento directo → se
encola), "el chequeo... se envía a la oficina cuando haya señal y eso
nunca ocurre" (el auto-reintento no llega a completar), y
"sincronizar da fallo y no hace nada" (botón "Reintentar ahora" en
Perfil).

**Paso de descarte primero**: reproduje el escenario exacto ("Aceite
de motor" en NO + foto etiquetada a ese ítem, mismo body/shape que
manda mobile — checklist + `fotos_items` + multipart) contra el
backend real vía la web de dev (mismo endpoint `POST
/api/equipos/:id/registros-mantencion` que usa mobile). **Guardó
limpio, sin error** — quedó "Con novedades" en el historial. Esto
descarta un bug de backend para esta combinación puntual: el problema
es del cliente mobile.

**Regresión real encontrada en mi propio fix de la tarea 11**: el
guard `ultimoIntentoEn` que agregué comparaba tiempo transcurrido
contra CUALQUIER intento anterior con archivo(s), sin distinguir "el
fetch anterior puede seguir viajando de verdad" (timeout del cliente,
`AbortError`) de "el fetch anterior YA terminó con una respuesta o un
error de red normal". Consecuencia: después de CUALQUIER intento
fallido (no solo un timeout), el botón "Reintentar ahora" quedaba
bloqueado en silencio hasta 90s después, sin ningún aviso — exactamente
"sincronizar da fallo y no hace nada" que reportó la usuaria.

**Fix**: nuevo campo `intentoEnVuelo` (boolean) — se pone `true` justo
antes de lanzar un intento con archivo(s) y se limpia a `false` en
cuanto llega CUALQUIER desenlace que confirma que el fetch ya terminó
de verdad (respuesta HTTP de cualquier código, o un error de red que
no sea el `AbortError` del timeout manual). El guard de "no relanzar
en paralelo" ahora solo bloquea mientras `intentoEnVuelo` sigue `true`
Y no pasó el margen del timeout — el único caso real donde el fetch
original podría seguir viajando en segundo plano.

**Lo que sigue abierto (no resuelto por este fix)**: el motivo de que
el intento ONLINE DIRECTO (antes de encolar, en
`ChecklistMantencionScreen.guardar()`) esté fallando en el teléfono de
la usuaria en primer lugar — probablemente una subida real lenta
(foto de cámara real + señal de terreno débil, contexto del negocio)
que agota los 90s, no reproducible desde escritorio con buena señal.
Este fix corrige el síntoma más grave y verificable (el botón de
sincronizar bloqueado en silencio); si la falla del primer intento
persiste, la cola ahora al menos puede reintentarse de verdad al
tocar "Reintentar ahora" en vez de parecer congelada.

`./verificar.sh` verde: tsc x6, 27 tests, 12 literales, 99 migraciones.

**Build local**: el toolchain (JDK17 + SDK de Android vía brew,
`docs`/memoria `build-android-local.md`) no estaba en el PATH de esta
sesión — 2 fallos de entorno encontrados y corregidos sobre la marcha:
`JAVA_HOME` sin exportar, y `local.properties` apuntando a una ruta de
SDK equivocada (`~/Library/Android/sdk`, que no existe en esta Mac) en
vez de la real, `/opt/homebrew/share/android-commandlinetools` (cask
de brew, como ya documentaba la memoria). Corregido, build verde en
9m 9s. APK 1.9.7 (versionCode 24) verificado con `strings` — contiene
`bitacora-cgt7.onrender.com` y `yjbskbskyadxjooxngjv` (prod), sin
rastro de `localhost`/dev. Copiado a
`~/Desktop/bitacora-builds/bitacora-1.9.7.apk`. `.env` restaurado a
dev y `mobile/package.json` revertido (prebuild le cambia los scripts
`android`/`ios` — reversión ya conocida, ver memoria).

## 2026-09-11: tarea 13 — galería + eliminar foto en toda la app

Pedido de la usuaria tras probar Mantención: solo se podía sacar foto
con cámara (no elegir de galería) y no había forma de ver/eliminar una
que saliera borrosa o fuera la equivocada. Pidió extender a "todas las
opciones" de la app.

**Auditoría** (`grep ImagePicker` en mobile/src): 6 pantallas suben
fotos. Solo `trabajos/FotosSection.tsx` (OS) ya tenía cámara+galería
(patrón de referencia, con `Alert.alert` de 3 opciones). Las otras 5
(`ChecklistMantencionScreen`, `MantencionDetalleScreen`,
`ViajeFormScreen`, `ViajeDetalleScreen`, `NuevoGastoScreen`) eran solo
cámara. De eliminar: `MantencionDetalleScreen` y las fotos pendientes
de OS ya tenían alguna forma; `ChecklistMantencionScreen` (antes de
crear) solo mostraba un chip de texto sin miniatura real; `Viajes`
(fotos ya subidas) y OS (fotos ya subidas) no tenían ningún botón de
eliminar en absoluto.

**Construido**:
- `mobile/src/lib/imagen.ts`: helper único `elegirFotos()` (Alert
  "Tomar foto / Elegir de galería / Cancelar") — reemplaza las 5
  llamadas directas a `ImagePicker.launchCameraAsync` que solo tenían
  cámara.
- `ChecklistMantencionScreen`: miniaturas reales (antes texto) +
  eliminar por foto, con la etiqueta del ítem superpuesta.
- `MantencionDetalleScreen`, `ViajeFormScreen`, `NuevoGastoScreen`:
  galería agregada; `ViajeFormScreen`/`NuevoGastoScreen` ganaron un
  botón "Quitar" explícito (antes solo "cambiar/volver a tomar").
- `ViajeDetalleScreen`: eliminar una foto YA SUBIDA del viaje — no
  existía el endpoint. Nuevo `DELETE /api/mis-viajes/:id/fotos/:fotoId`
  en `misViajes.ts` (mismo patrón que el ya existente en `viajes.ts`
  para admin/web, con el guard "solo tus propios viajes" para
  colaborador) + `eliminarFotoViaje` en el servicio mobile. La foto de
  guía (`foto_guia_url`) NO se puede borrar por acá a propósito — esa
  se reemplaza, es la guía oficial.
- `trabajos/FotosSection.tsx` + `TrabajoDetalleScreen`: botón
  "Eliminar foto" en el visor (modal) de fotos de la OS — el backend
  (`DELETE /api/trabajos/:id/fotos/:fotoId`) ya existía (bloqueado si
  `trabajoBloqueado`/finalizada), solo faltaba la UI mobile.

`./verificar.sh` verde: tsc x6, 27 tests, **12 literales (sin nuevos)**
— usé `t.colores.overlay`/`t.colores.brandForeground` (tokens ya
existentes) para la etiqueta sobre la miniatura, no hex/rgba nuevos.

APK 1.9.8 en build local para probar en el teléfono.
