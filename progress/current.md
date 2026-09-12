# Sesión actual

- **Cerradas esta sesión:** 9 — edicion_viajes_y_fotos_os, 10 — fotos_mantencion_equipo,
  11 — fix_sync_cola_apilamiento (insuficiente, ver tarea 12), 12 — fix_sync_reintentar_bloqueado,
  13 — galeria_y_eliminar_fotos_mobile, 6 — regenerar_contexto_proyecto,
  14 — levantamientos_paso0, 15 — levantamientos_paso1_5, 16 — levantamientos_admin_editar,
  17 — levantamientos_cola_offline, 1 — eslint_web_next16, 2 — ci_verificar,
  4 — smoke_backend, 8 — sistema_diseno (Paso 7), 3 — rotar_deploy_hook_render
- **Nueva, pendiente:** 18 — storybook_packages_ui (separada de la 8
  por decisión de la usuaria)
- **En curso ahora:** tarea 5 (e2e_mantencion_pdf_prod) — esperando que la usuaria
  inicie sesión en prod en el navegador (no toco credenciales); ver política.
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

APK 1.9.8 verificado (`strings` → URLs de prod, sin localhost/dev),
copiado a `~/Desktop/bitacora-builds/bitacora-1.9.8.apk`. `.env`
restaurado a dev, `package.json` revertido (prebuild lo pisa).

## 2026-09-11: pedido "aplica el paso 5" (E2E prod) — bloqueado en login

Al ir a ejecutar la tarea 5 (E2E en prod real), no había ninguna sesión
iniciada en el navegador (`app.transportesitineris.cl` mostró la
landing, no el dashboard). No puedo escribir la contraseña yo mismo
(regla dura del harness, no la salteo aunque se autorice). Pregunté a
la usuaria cómo seguir — eligió "inicia sesión vos en este navegador":
ella entra con su usuario/contraseña en la pestaña que dejé abierta y
después yo sigo operando la app (crear mantención, cerrar OS, generar
PDFs) sin tocar credenciales.

## 2026-09-11: tarea 5 retomada — hallazgo real + resultado parcial

Con la usuaria ya logueada, al abrir "Nuevo registro de mantención" en
prod salió **"No se pudo cargar el checklist"** — el mismo bug de la
tarea 10 (URL con `equipoId` de más), YA CORREGIDO en el código local,
pero **nunca desplegado**: 37 commits sin pushear a `main` (incluía
todo el rediseño visual crema/Caprasimo completo + los fixes de esta
sesión). Como "deploy = push a main" (Vercel+Render auto), prod seguía
corriendo código de antes de esa migración entera.

Confirmé antes de tocar nada: (1) todas las tablas que el código nuevo
necesita ya existían en prod (`viaje_fotos`, `registro_mantencion_
fotos`, etc. — migración 95 ya estaba aplicada, a diferencia de lo que
decía una nota vieja); (2) `./verificar.sh` en verde. Pregunté a la
usuaria si pushear todo junto (dado el tamaño del cambio, visual +
funcional, para un cliente real) — confirmó "pushea todo ahora".
Push hecho (`48e0935..3d42342`, 37 commits). Vercel/Render redesplegaron
solos (confirmado: la web ya mostraba el diseño crema nuevo).

**Verificado en vivo contra PROD** (equipo real "Tracto Camion
International 9200", cliente interno "Itineris Spa" — ya usado así en
varias OS de prueba anteriores, confirma que es la convención correcta):
- Registro de mantención con ítem en "NO" + foto etiquetada: **se creó
  sin error** ("Con novedades", 412.870 km · 6.140 h). Bug de la tarea
  10 confirmado resuelto en prod real.
- Detalle del registro: checklist + 2 fotos (una general, una
  etiquetada al ítem) — correcto.
- PDF del registro: se generó sin error (blob abierto, formato no
  inspeccionable por herramienta pero sin fallo de servidor).
- OS nueva (N° 15, cliente Itineris Spa): creada OK. **Informe con IA**
  generado correctamente — RAG real, honesto (dice explícitamente que
  no hay fotos/checklist en vez de inventar contenido), formato con
  las 4 secciones esperadas.
- PDF de la OS: se generó sin error.

**Bloqueado, no completado**: cerrar la OS con fotos agrupadas por
categoría + 2 bloques de firma requiere check-in/fotos/firma del
técnico — **eso es solo desde el celular** (confirmado: no existe
ninguna vista web para eso, `grep` en `web/src/app` no encontró
ninguna página de tipo "mi-trabajo"/checkin). No tengo acceso a un
dispositivo Android real. Queda para que la usuaria lo haga con el
APK 1.9.8 en su teléfono sobre la OS N° 15 (o una nueva) — reviso el
resultado (PDF final) apenas avise.

## 2026-09-11: tarea 6 — regenerar CONTEXTO_PROYECTO.md

Verificado en vivo contra dev/prod antes de escribir nada (no reusar
contenido viejo sin re-chequear, por regla de la memoria):
- Migraciones: 99 locales; prod trackea 1-98 (la 99 —solo índices—
  pendiente); **dev tiene el esquema al día pero `schema_migrations`
  solo llega a la 74** (75+ se aplicaron con `db query`, sin dejar
  tracking) — hallazgo nuevo, no estaba documentado.
- RLS: 84/84 tablas del schema `public` tienen RLS activo (61 con
  policy de tenant real, 23 deny-all) — subió bastante desde la última
  foto (79 tablas, conteo de RLS no verificado entonces). Aproveché
  para corregir una afirmación falsa que ya venía arrastrando el
  documento ("se evaluó RLS y se descartó" — no es así, están
  complementados, ya corregido en `CLAUDE.md`/`arquitectura.md` esta
  sesión pero se me había pasado acá).
- Rubro de la empresa de prueba: verificado en vivo, `cosmetologia`
  (no `transporte` — el nombre "Transportes Itineris" no define el
  rubro; casi lo doy vuelta mal, lo corregí antes de cerrar).
- Versiones: mobile 1.9.8/vc25 (era 1.7.0/vc14), Next 16.3.2 sin cambio.

**Reescrito**: intro/changelog (nueva sección "Novedades 9-11 sep":
sistema de diseño completo, Mantención de flota, PDF OS Fase 2, edición
de viajes, galería+eliminar fotos, 2 bugs de sync, tenant baseline 0),
sección 3 (theming → sistema de diseño crema/Caprasimo completo,
reemplaza la descripción de Faena), sección 4 (nuevas filas Mantención
de flota y Ventas—venta rápida—, actualizadas OS/Viajes/App móvil),
sección 5 (tablas nuevas: registros_mantencion_equipo+fotos,
viaje_fotos, ventas+venta_lineas), sección 7 (RLS corregido + 3
decisiones nuevas), sección 8 (backlog real de trabajo_list.json en
vez de texto genérico, migración 99 pendiente, gap de tracking en dev).

Pendiente: la usuaria tiene que volver a subir el archivo a su Proyecto
de claude.ai a mano (no se sincroniza solo).

## 2026-09-11/12: tarea 14+15 — Módulo Levantamientos (prompt completo)

Prompt estructurado de la usuaria (Paso 0 auditoría → Paso 1-5
implementación). Paso 0 reportado y 3 decisiones confirmadas antes de
seguir: (1) `usuarios.funcion` (hoy solo texto, no gatea nada en
mobile) se repurpone como el eje real de visibilidad de esta sección
— array `FUNCIONES_LEVANTAMIENTOS` extensible; (2) solo Admin crea/
cotiza/aprueba/rechaza, Supervisor no; (3) cotizar/aprobar es solo web,
el técnico en mobile no ve esos estados/botones.

**Hallazgo clave de la auditoría**: el descuento de stock
(`aplicarDescuentoInventarioSiCorresponde`) se dispara por transición
de `estado_os` configurable por empresa, NO en la creación de la OS —
así que la OS que nace al aprobar un levantamiento **no necesita
ningún gancho nuevo**, se crea igual que una manual y el descuento ya
existente se aplica solo, en el mismo punto de siempre.

**Construido**: migración 100 (`levantamientos`, `levantamiento_
materiales`, `levantamiento_fotos` + índices + seed de "levantamientos"
en el rol admin ya existente — el seed de `roles` solo corre con la
tabla vacía, sumar un módulo a `MODULOS` no le llega solo a las filas
ya sembradas, gotcha ya documentado en `CONTEXTO_PROYECTO.md`).
Backend `routes/levantamientos.ts` (crear, completar, fotos, cotizado,
aprobar, rechazar) — autorización por handler, no `requiereModulo()` a
nivel de router (el técnico es rol=colaborador, `requiereModulo` no
lo dejaría pasar). Web `/dashboard/levantamientos` (lista + crear +
detalle con acciones). Mobile: `LevantamientosListScreen` +
`LevantamientoDetalleScreen`, visibles en "Más" solo si
`funcion ∈ {tecnico, chofer}` — sin cola offline a propósito (se
completa en una sesión con señal, no es un formulario de campo sin
conexión como check-in de OS).

**2 bugs reales encontrados probando en vivo contra dev** (no en
teoría):
1. PostgREST no podía resolver `tecnico:usuarios(...)` porque
   `levantamientos` tiene 2 FK a `usuarios` (`tecnico_id`,
   `creado_por`) — "more than one relationship was found". Fix: hint
   de columna `usuarios!tecnico_id(...)`.
2. `audit:tenant` encontró un hallazgo real, no solo heurístico: al
   validar `tecnico_id` en la creación, `esTecnicoAsignable()`
   consultaba `usuarios` sin `empresa_id` — un Admin podía (por un id
   mal tipeado o adivinado) asignar como técnico a un usuario de OTRA
   empresa. Corregido acotando esa consulta a `req.empresaId!`; las
   otras 3 alertas del audit eran legítimas (ids ya venían de una fila
   de `levantamientos` previamente acotada por empresa) y quedaron
   marcadas `// tenant-ok:`.

**Verificado en vivo de punta a punta** (Chrome MCP + llamadas
directas a la API con el token de sesión, contra dev): crear
levantamiento (cliente + técnico filtrado por función) → técnico
completa (descripción + material del catálogo + cantidad) → Admin
marca cotizado con referencia externa → Admin aprueba → nace la OS
correcta (folio, colaborador, ítem con cantidad/precio) con
`stock_descontado=false` (no se tocó el stock, correcto). Camino de
rechazo probado aparte: no crea ninguna OS ni toca nada. `EXPLAIN
ANALYZE` confirmó Index Scan en `levantamientos (empresa_id,
tecnico_id)`. Datos de prueba limpiados de dev al cerrar.

`./verificar.sh` verde: tsc x6, 27 tests, 12 literales, **100
migraciones**, audit:tenant 0 hallazgos.

Pendiente real: activar el módulo en prod (`empresa_modulos` vía panel
Super-Admin, apagado por defecto) cuando la usuaria quiera probarlo
ahí; correr la migración 100 en prod (ella la corre).

## 2026-09-12: tarea 16 — Admin edita/sube-elimina fotos/elimina levantamiento

Pedido de seguimiento inmediato tras cerrar el módulo. Backend nuevo:
`PATCH /:id` (editar cliente/técnico/descripción — reasignar técnico
notifica y respeta creado→asignado), `DELETE /:id/fotos/:fotoId`
(Admin o el técnico asignado), `DELETE /:id` (Admin, bloqueado solo si
`aprobado` — perdería la trazabilidad de la OS que generó; `rechazado`
sí se puede borrar). `POST /:id/fotos` ya aceptaba Admin desde el
Paso 2 original, solo faltaba la UI web.

**Verificado en vivo contra dev** (crear → editar asignando técnico,
confirmó el paso automático creado→asignado → subir foto → eliminar
foto → eliminar levantamiento). **Encontré un límite real de mis
herramientas de navegador**: "Eliminar foto" y "Eliminar
levantamiento" usan `window.confirm()` (mismo patrón que el resto del
código, ej. Mantención) — un diálogo nativo bloquea el navegador para
la automatización y no lo puedo cerrar yo mismo; tuve que pedirle a la
usuaria que lo aceptara a mano una vez. Terminé de verificar esas dos
acciones llamando la API directo (mismo resultado, sin volver a
disparar el diálogo).

`./verificar.sh` verde. Datos de prueba limpiados de dev.

## 2026-09-12: tarea 17 — Levantamientos gana cola offline

La usuaria cuestionó la decisión de no tener cola ("¿por qué no? ¿la
agregamos o no la ves necesaria?"). Al re-pensarlo en voz alta, la
razón original no aguantaba: un levantamiento se completa exactamente
en el mismo tipo de terreno donde ya falla la señal para OS/viajes/
mantención — no había ninguna base real para tratarlo distinto, fue
una simplificación mía apurada al escribir el Paso 3 original.

Agregado con el mismo patrón ya probado: `encolarCompletarLevantamiento`
(PATCH sin archivo — sin riesgo de duplicar, es un update, no un
alta), `encolarFotoLevantamiento` (multipart, sumada a
`ES_SUBIDA_DE_FOTO` en `queue.ts` para que nunca bloquee otra cosa).
`LevantamientoDetalleScreen` intenta online primero y encola si falla
o no hay señal, mismos mensajes que ya usa Mantención. Fotos en cola
se ven como placeholder (sync/error) hasta que suben de verdad.

`./verificar.sh` verde. No se pudo probar el camino "sin señal" en
vivo (Chrome MCP es para web, no simula mobile offline) — se apoya en
que reutiliza exactamente la misma infraestructura de cola ya
verificada esta sesión para Mantención/Viajes/OS, no un mecanismo
nuevo.

## 2026-09-12: tarea 1 — eslint web (Next 16) arreglado

Causa raíz real, no solo config: bug de hoisting de npm workspaces.
`next` quedaba anidado en `web/node_modules/next` mientras
`eslint-config-next` se hoisteaba a la raíz — su parser
(`eslint-config-next/dist/parser.js` → `require('next/dist/compiled/
babel/eslint-parser')`) resuelve módulos hacia ARRIBA desde su propio
directorio, nunca hacia un `node_modules` hermano (`web/node_modules`).
Verificado en `package-lock.json` que no había conflicto real de
versión (una sola versión de `next`, pedida solo por `web`). Fix:
`"next": "16.3.2"` agregado a `devDependencies` de la raíz + `npm
install` → hoisteó `next` a la raíz, eliminó la copia anidada.

Con el parser resuelto, `npm run lint -w web` corrió por primera vez
de verdad: 79 errores + 20 warnings reales (antes crasheaba antes de
poder mostrar nada). 75 de los 79 errores eran la misma regla nueva
`react-hooks/set-state-in-effect` — marca el patrón "fetch en
`useEffect` + `setState` con el resultado" que es la arquitectura
establecida a propósito en TODO el dashboard (`docs/harness/
arquitectura.md`, "cada página del dashboard sigue el mismo patrón de
carga"), no un bug real. Reescribir ~50 pantallas para evitarla sería
un cambio de arquitectura grande y arriesgado solo para silenciar un
lint. Por la regla explícita de la tarea ("no bajar severidad para
lograrlo, o documentar por qué"): se desactivó ESA regla puntual (no
un `--max-warnings 0` global ni bajar todo a warn) en
`web/eslint.config.mjs`, con comentario explicando la justificación.

Los otros 4 errores eran genuinos y se arreglaron en el código, no
silenciados:
- 2× `react/no-unescaped-entities` (comillas literales) en
  `superadmin/empresas/[id]/page.tsx` → entidades HTML (`&ldquo;`/
  `&rdquo;`).
- 1× "Cannot call impure function during render" (`Date.now()` en el
  cuerpo del render) en el mismo archivo → intenté primero
  `useMemo(() => Date.now(), [])`, pero la regla (`react-hooks/
  purity`) también lo marca porque el callback de `useMemo` sigue
  corriendo en fase de render. Fix real: `useState<number|null>(null)`
  + `useEffect` que lo fija en fase de commit — "hace N días" queda
  `null` en el primer render y se completa solo, sin parpadeo visible.
- 1× `react-hooks/immutability` en `dashboard/agenda/page.tsx:276`
  (`cargarOpcionesFormTarea` referenciada antes de su declaración más
  abajo). Tracé la cadena completa: "arreglarlo bien" implica mover
  `puedeAgendaPro`/`moduloVisible` de después de un guard `if
  (!usuario) return null` (línea ~614) a antes — riesgo real de
  crashear si `usuario` sigue null. Juzgado demasiado riesgoso para un
  solo hallazgo de lint sin prueba dedicada → `eslint-disable-next-line`
  puntual con el razonamiento completo en comentario.

Resultado: `npm run lint -w web` → 0 errores, 20 warnings
(preexistentes: `<img>` sin `next/image`, `window.location.href` en
vez de `router.push()`, unused-vars sueltos, algún `eslint-disable`
ya innecesario — ninguno bloqueaba antes de esta tarea, no se tocaron).
Exit 0 confirmado. `./verificar.sh` paso 6 → `[OK]` sin el WARN
especial. `./verificar.sh` completo verde (tsc x6, tests, audit:tenant
0, 100 migraciones).

## 2026-09-12: tarea 2 — CI corre verificar.sh en push/PR

`.github/workflows/verificar.yml`: checkout + `setup-node@22` (cache
npm) + `npm ci` + `./verificar.sh` (completo, sin `--rapido`), en push
a `main` y en `pull_request`. Sin secrets — a diferencia de
`check-migraciones-prod.yml`, todo lo que corre `verificar.sh` es
local al checkout (nada de Supabase real).

**Antes de escribirlo**, simulé un `npm ci` desde CERO (borré
`node_modules` de raíz/web/mobile y `dist/` de `packages/shared`,
`packages/design-tokens`, `backend`) para no asumir que `main` pasaba
en limpio solo porque mi entorno de trabajo (ya "tibio", con dist/
viejo y node_modules acumulado) daba verde. Encontré 2 problemas
reales que ese entorno tibio venía tapando:

1. **`tsc mobile` revienta** con `RangeError: Maximum call stack size
   exceeded` (stack trace dentro de `getTypeAtFlowNode`/
   `getTypeAtFlowCondition` de TS) con el stack default de V8 en un
   `node_modules` recién instalado. Confirmé que NO es un error de
   tipos real: con `node --stack-size=8000 ./node_modules/typescript/
   bin/tsc -p mobile/tsconfig.json --noEmit` pasa limpio. Causa
   probable: el mapped type `Database.Tables` (packages/shared) creció
   con las 100 migraciones (Levantamientos incluido) y el chequeo de
   flujo de TS sobre mobile ya no entra en el stack default sin
   `.tsbuildinfo`/dist previos que lo "amortiguaran". Fix real (no
   solo para CI) en `verificar.sh`: `tsc_check()` ahora invoca
   `node --stack-size=8000 ./node_modules/typescript/bin/tsc` en vez
   de `npx tsc` — `--stack-size` es flag de V8, no se puede pasar por
   `NODE_OPTIONS`.
2. **Falso positivo de mi propio método de prueba**: al mover
   `node_modules` a `node_modules.bak.<pid>` para simular el estado
   limpio, ESLint linteó esa carpeta igual (no matchea el ignore
   implícito de `node_modules/`, el nombre es distinto) — 11590
   "problemas" que eran código de React/Next de terceros, no del
   repo. Descartado como hallazgo real; limpiado (`rm -rf
   *.bak.<pid>`) antes de seguir.

Con el fix de `--stack-size`, `./verificar.sh` corre verde de punta a
punta desde un `npm ci` 100% limpio (~57s el install + ~25s el
script). `docs/harness/verificacion.md` actualizado (ya no dice
"baseline 6" de `audit:tenant` ni "lint WARN por tarea #1" — ambos
resueltos esta sesión — y menciona el CI nuevo).

No pude correr el workflow en un runner real de GitHub Actions desde
acá (sin pedir push todavía) — la validación es: YAML parseado sin
error, y los mismos 3 pasos (`npm ci` limpio → `./verificar.sh`)
reproducidos a mano en este entorno con resultado verde real, no
asumido.

## 2026-09-12: tarea 4 — smoke test de arranque del backend

`backend/src/server.smoke.test.ts` (node:test + tsx, mismo patrón que
`packages/shared`): importa DINÁMICAMENTE el `server.ts` real — mismo
`app.listen()` de producción, `PORT=0` para que el SO asigne un
puerto libre, no mockea express en ningún punto.

`env.ts` exige ~12 variables con `requerido()` para poder cargar el
módulo (SUPABASE_*, STORAGE_*, ANTHROPIC_API_KEY, 4 llaves de
cifrado/firma) — se fijan como strings dummy claramente falsos ANTES
del import. Tuvo que ser import dinámico, no estático: `tsx` transpila
el backend a CJS (no tiene `"type": "module"`) y ahí no se permite
top-level await; además con `import` estático de ESM el módulo
importado se ejecuta antes que cualquier otro código del archivo sin
importar dónde esté escrito el `import` en el texto — las env vars
dummy nunca llegarían a tiempo.

**Verifiqué leyendo cada handler, no asumiendo**, que ninguna de las 3
rutas cubiertas toca Supabase/S3/Anthropic de verdad con esos valores
dummy:
- `GET /health` — no toca la base (ver `/health/ready` para el que sí).
- `GET /api/me` sin header `Authorization` — `requiereAuth` corta con
  401 ANTES de llamar a `supabase.auth.getUser`.
- `GET /api/whatsapp/webhook` (verificación de Meta) — compara solo
  contra `WHATSAPP_VERIFY_TOKEN` vía `env`, sin DB. Esta es la "ruta
  feliz" (200 + eco del `hub.challenge`), con su contraparte de token
  equivocado (403) al lado.

`medirLatencia` (middleware global) solo escribe en `requests_lentos`
si la respuesta tarda ≥2s — ninguna de estas 4 llamadas locales llega
ni cerca, así que tampoco dispara ahí.

4 tests verdes. Confirmado en el log que la única "conexión a
Supabase" que aparece es el string dummy (`smoke-test.supabase.co`),
nunca un proyecto real.

**Cambios de soporte**: `server.ts` ganó 2 exports (`app`, `httpServer`
— el `Server` real que devuelve `.listen()`), sin otro cambio de
comportamiento. `backend/tsconfig.json` ganó `exclude:
["src/**/*.test.ts"]` (mismo patrón que `packages/shared/tsconfig.json`,
que ya lo tenía) — confirmado con `npm run build -w backend` que el
test NO queda en `dist/` y que el `.listen()` compilado sigue
llamándose una sola vez en el camino real de producción
(`node dist/server.js`). `verificar.sh` paso 5 ahora corre
`test_ws backend` junto a shared/design-tokens — confirmado con
`./verificar.sh` completo en verde (backend — 4 tests verdes).

## 2026-09-12: tarea 3 — deploy hook de Render, hallazgo real + bloqueada en el humano

Antes de tocar nada, auditoría de dónde vive el secreto: el repo (tree
actual Y `git log -p -S` sobre todo el historial) **nunca** tuvo el
valor real de la key — siempre `?key=…` redactado, en `CONTEXTO_
PROYECTO.md` y en 2 memorias del agente. **Pero una tercera memoria
(`migracion-95-ventas-viaje-fotos.md`) sí tenía el valor real en texto
plano** (pegado en una sesión de hace 5 días al documentar el flujo de
deploy manual) — ese es el leak real que motivó la tarea, no el repo.
Esa memoria además ya estaba obsoleta (hablaba de la migración 95 como
pendiente en prod; hoy la 100 ya está aplicada) — la borré entera en
vez de solo redactar el secreto, y saqué su línea de `MEMORY.md`.

`docs/PUESTA_EN_PRODUCCION.md` §3.4 (nuevo): documenta el incidente y
la regla en adelante — la key del deploy hook (y cualquier otra:
Resend, GitHub PAT, `SUPABASE_SERVICE_ROLE_KEY`, ver §3.3) se pide a
la usuaria cuando hace falta, nunca se escribe en repo, docs, ni en la
memoria persistente del agente.

**Lo que sigue bloqueado en la usuaria** (no lo puedo hacer yo): la
key vieja solo se revoca regenerándola en Render → el servicio →
Settings → Deploy Hook — no tengo login ahí. Le pedí que la rote pero
**no** que me pegue el valor nuevo en el chat (repetiría exactamente
este incidente) — que quede en Render o en su gestor de secretos
propio; el agente no necesita conocerlo para nada de lo que hace hoy.
Tarea marcada `blocked` hasta que confirme.

**12-sep, más tarde**: la usuaria confirmó "ya rote la key de render"
— tarea cerrada (`done`). No se le pidió ni se guardó el valor nuevo
en ningún lado (ni chat, ni memoria, ni repo), consistente con la
regla que se documentó en §3.4.

## 2026-09-12: push a main + primera corrida real de CI — falló, hallazgo real

La usuaria pidió "hace un push" de los 6 commits acumulados (tareas
#1/#2/#4/#3/#8). Fast-forward limpio, sin divergencia con
`origin/main`. Dispara auto-deploy (Vercel+Render) y, por primera vez,
la corrida REAL del workflow `verificar.yml` (tarea #2) en GitHub
Actions — hasta ahora solo lo había validado simulando `npm ci` limpio
en mi propia máquina.

**Falló.** Usé la API de GitHub (sin `gh` CLI disponible en esta
sesión) para diagnosticar sin acceso a los logs completos (403, "Must
have admin rights") — los `annotations` del check-run sí estaban
públicos y bastaron: `web/src/app/layout.tsx:40:50 — Cannot find name
'LayoutProps'`.

**Causa real**: `web/tsconfig.json` incluye `.next/types/**/*.ts` —
las rutas tipadas de Next 16 (`LayoutProps<"/">` en `layout.tsx`), que
Next genera solo (`next dev`/`next build`), nunca están versionadas.
Mi simulación de "npm ci limpio" de la tarea #2 borró `node_modules` y
`dist/`, pero **no borré `web/.next`** — ya lo tenía puesto de sesiones
de `next dev` anteriores en esta misma máquina, así que `tsc web`
pasaba igual sin que yo notara que dependía de ese directorio. Es el
mismo tipo de error que el del `--stack-size` de la tarea #2 (artefacto
viejo tapando un gap real) — esta vez se me escapó uno de los
directorios a limpiar.

**Fix**: `verificar.sh` corre `npx next typegen` (comando dedicado de
Next 16 para esto, sin necesidad de un build completo) antes de
`tsc_check web`. Re-verificado localmente borrando `node_modules` +
`dist/` + **`web/.next`** juntos esta vez — verde de punta a punta.
Comiteado y pusheado; quedo mirando la corrida real de CI sobre este
fix para confirmar que también pasa en el runner de Ubuntu (mi
máquina es macOS — otra diferencia que la simulación local no cubre
del todo).

## 2026-09-12: tarea 8 — Paso 7 del sistema de diseño (ESLint + doc, sin Storybook)

Pasos 0-6 ya estaban hechos de sesiones anteriores. De Paso 7 quedaban
4 ítems; le pregunté a la usuaria cómo priorizar (Storybook es la
pieza más pesada — paquetes nuevos, config, historias por componente
— y mobile no tiene ESLint configurado hoy) y eligió "todo salvo
Storybook".

**CI ya estaba cubierto de rebote**: `.github/workflows/verificar.yml`
(tarea #2) corre `./verificar.sh` completo en cada push/PR, que ya
incluye `check-colores.mjs` en su paso 8 — nada nuevo que hacer ahí.

**Regla de ESLint nueva** (`web/eslint-rules/anti-token.mjs`,
`bitacora/no-literal-color-or-px`, registrada en `web/eslint.config.mjs`):
mismo criterio y misma lista de exentos que `check-colores.mjs`
(`scripts/colores-permitidos.json`, una sola fuente de verdad) pero a
nivel de editor/PR — deliberadamente NO es un port 1:1 (opera sobre el
AST, no sobre texto crudo).

**Hallazgo real al probarla, no asumido**: la primera versión también
marcaba CUALQUIER valor arbitrario de Tailwind en px (`[Npx]`) — corrí
`npm run lint -w web` con esa versión antes de darla por buena y
marcó **109 sitios**, casi todos `text-[11px]` (microtipografía) y
`rounded-[32px]` (la forma "pill") — exactamente las convenciones que
el Paso 5 estableció a propósito, no algo que las esté evadiendo.
Acoté la regla a solo utilidades de ESPACIADO arbitrario en px (`m*`,
`p*`, `gap*`, `space-*`, `inset*`, `top/right/bottom/left` — la parte
real de "aire por escala") antes de sumarla al lint real. Verifiqué
con un fixture manual (7 casos que debían marcar: 2 colores hex
sueltos, 1 rgb, 1 hex embebido en Tailwind, 3 espaciados en px; 2 que
NO debían marcar: `text-[11px] rounded-[32px]`, y una mención de texto
"OS #142 desde el celular" que no es un color) — los 7 dispararon, los
2 no, antes de correrla contra el repo real. Contra el repo real: 0
hallazgos (el repo ya usa `p-ds-*`/`gap-ds-*` en vez de espaciado
arbitrario en px). Alcance solo `web` — mobile no tiene ESLint.

**Doc**: `CLAUDE.md` ahora linkea `docs/design-system.md`.
`docs/design-system.md` actualizado (baseline de colores 19→12,
sección de Paso 7 con el detalle de arriba).

**Storybook** separado a la tarea #18 (`pending`) — decisión de la
usuaria, no abandonado.

`./verificar.sh` completo verde (`web` — 0 errores, 20 warnings
preexistentes, igual que antes de esta tarea).
