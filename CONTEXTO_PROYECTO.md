# Contexto del proyecto — Bitácora

> Generado analizando el repositorio real (código, esquema de base de datos en vivo,
> `package.json`, migraciones). Este documento es para darle contexto completo a otro
> asistente de IA sin acceso al código. El "prompt maestro original" referenciado abajo
> es `ENCARGO-claude-code.txt`, en la raíz del repo.
>
> **Actualizado 11-sep-2026.** La app **ya está publicada en internet** (Vercel + Render +
> Supabase de producción + Resend + Cloudflare) bajo `https://app.transportesitineris.cl`.
> Todo lo relativo al despliegue, el estado de configuración de cada proveedor, los
> secretos a rotar y los pasos que faltan para tener la primera empresa operativa está en
> `docs/PUESTA_EN_PRODUCCION.md` — leerlo junto con este archivo.
> **100 migraciones locales; prod tiene 1-99 aplicadas y trackeadas** (la 100 —módulo
> Levantamientos, nuevo, ver más abajo— aplicada en dev, pendiente en prod). App móvil en
> **1.9.8 / versionCode 25**.
>
> ---
>
> **Novedades del 9-11 sep (sistema de diseño completo + Mantención de flota + fixes
> reales de terreno — todo empujado a producción el 11-sep tras 37 commits acumulados
> sin desplegar):**
>
> - **Sistema de diseño "crema" — reemplazo completo de "Faena" (Pasos 0-6 cerrados,
>   solo falta el Paso 7).** Se descartó la paleta navy/IBM Plex por una nueva: fondo
>   `#f5ead8`, superficie `#ebddc5`, texto `#201e1d`, acento cálido `#c67139` + acento
>   secundario oliva `#7a8a5e`, tipografía **Caprasimo** (headings) + **Figtree** (cuerpo),
>   forma "pill" en vez de esquina corta. Implementado en `packages/design-tokens`
>   (`tokens.json` → genera `tokens.css` + `generated.ts`, un solo lugar para todo color/
>   tamaño/radio/sombra/espaciado) y consumido con prefijo Tailwind **`ds-`** en la web
>   (`bg-ds-bg`, `text-ds-h1`, etc. — el prefijo se quita cuando Faena termine de
>   desaparecer del todo) y `useTema().ds` en mobile. **Marca por tenant**: `--ds-brand` =
>   `empresas.color_primario`, con `hover`/`pressed` derivados automáticamente (OKLCH en
>   web, `oscurecerOklch()` en mobile). Las **7 pantallas del sidebar completo** (Hoy,
>   Operación, Clientes, Dinero, Recursos, Equipo, Informes, Configuración — incluida la
>   shell/sidebar misma) están migradas y verificadas, ~40 commits. **Paso 7 pendiente**
>   (regla ESLint anti-hex/px, Storybook, check de CI) — tarea aparte del backlog, sin
>   fecha. Detalle completo en `docs/design-system.md` y `docs/design-audit.md`.
> - **Mantención de flota** (migraciones 96/97, nueva desde el último regen). Módulo
>   nuevo, separado de `trabajos`/`ordenes_servicio` a propósito (no es una OS: no
>   requiere cliente ni dispara facturación automática). Dos tipos de registro sobre un
>   equipo `categoria='Vehículo'`: **"diario"** (chequeo del chofer antes de salir a
>   ruta, checklist con secciones/preguntas de una plantilla fija, siempre interno) y
>   **"programa"** (Programa de Mantención cada 250h/6 meses, en taller externo o
>   interno). Folio correlativo por empresa. El registro en sí (checklist/km/horas/
>   firma) es **inmutable** una vez creado — mismo criterio que las fotos de una OS
>   firmada — pero las **fotos de respaldo sí se pueden agregar/eliminar después**
>   (excepción acotada, a pedido de la usuaria): `POST`/`DELETE
>   /api/equipos/:equipoId/registros-mantencion/:id/fotos/:fotoId`. Regla opcional
>   (`MANTENCION_EXIGE_FOTO_EN_NO`, shared): marcar un ítem del checklist en "No" exige
>   adjuntarle una foto antes de guardar. Web: tab "Mantención" en la ficha del equipo +
>   modal de detalle (checklist agrupado + galería). Mobile: `ChecklistMantencionScreen`
>   (crear) + `MantencionDetalleScreen` (ver/agregar/eliminar fotos, nueva).
> - **PDF de OS — Fase 2** (migración 98, `docs/pdf-os-fase2.md`): galería de fotos
>   agrupada por **categoría** (`analisis_fotos.categoria`: equipo / **Inicio** / durante /
>   **Término** — relabeleado desde antes/después a pedido de la usuaria, sin migración,
>   solo texto de UI) con pie de foto, y **dos bloques de firma separados** (técnico +
>   cliente, cada uno con nombre y documento) en vez de uno solo.
> - **Edición de Viajes confirmados** (Admin/Supervisor): el botón de editar ya no
>   aparece solo para `borrador` — un viaje `confirmado` (no facturado) también se puede
>   editar: reasignar chofer, comentarios/incidentes (reutiliza el campo `comentarios`
>   existente, no hay tabla nueva), subir/eliminar fotos. Nuevo `POST`/`DELETE
>   /api/viajes/:id/fotos/:fotoId` (viajesRouter, admin/web) y `DELETE
>   /api/mis-viajes/:id/fotos/:fotoId` (mobile, con guard "solo tus propios viajes" para
>   colaborador) — antes solo existía el POST desde mobile.
> - **App móvil — elegir foto de galería + eliminar, en TODAS las pantallas que suben
>   fotos** (pedido real de la usuaria tras un bug reportado en Mantención). Antes solo
>   una pantalla (fotos de OS) ofrecía cámara+galería; ahora las 6 lo hacen, con un
>   selector único (`elegirFotos()` en `mobile/src/lib/imagen.ts`) — y las que no tenían
>   forma de eliminar una foto ya adjunta/subida (checklist de mantención, fotos de un
>   viaje, foto de un gasto) la ganaron.
> - **Dos bugs reales de sincronización offline encontrados probando en producción** (no
>   en un simulador): (1) un `fetch` de `FormData` en React Native no se puede abortar de
>   verdad — cuando el timeout manual "ganaba", el fetch original seguía viajando en
>   segundo plano y un reintento automático apilaba una subida concurrente de la MISMA
>   foto, sin que ninguna terminara nunca ("se quedó sincronizando"); (2) el primer fix
>   (un guard anti-apilamiento) tenía una regresión: bloqueaba el botón "Reintentar ahora"
>   durante 90s después de **cualquier** fallo, no solo uno que pudiera seguir en vuelo —
>   se sentía como "sincronizar no hace nada". Ambos corregidos en `services/sync/
>   queue.ts` (campos `ultimoIntentoEn` + `intentoEnVuelo`, `TIMEOUT_MULTIPART_MS=90s`
>   compartido).
> - **Aislamiento multi-tenant: los 6 hallazgos baseline de `audit:tenant` se revisaron y
>   cerraron** (todos legítimos — ya acotados por el usuario autenticado o un guard
>   previo, marcados `// tenant-ok: <razón>`). El chequeo pasó a **baseline 0** — ya no
>   tolera ningún `.from(<tabla-empresa>)` sin `empresa_id` nuevo.
> - **73 índices de cobertura para FKs sin índice** (migración 99, Supabase Performance
>   Advisor) — aplicada en prod el 11-sep. Con el volumen de datos actual (tablas chicas)
>   `EXPLAIN ANALYZE` muestra a Postgres eligiendo Seq Scan en varios casos, correctamente
>   (más rápido que un índice con 2-3 filas) — es preparación para cuando haya volumen
>   real, no algo que debiera cambiar el plan hoy.
>
> **Novedades del 12-sep — Módulo Levantamientos** (migración 100, opt-in por
> `empresa_modulos`, apagado por defecto; aplicada en dev, **pendiente en prod**):
> Admin crea una Orden de Levantamiento (cliente + técnico + qué evaluar) → el técnico
> asignado (mobile, ve la sección solo si `usuarios.funcion ∈ {tecnico, chofer}` —
> primer uso real de ese campo para gating, antes era solo texto informativo) completa
> en terreno: descripción observada + materiales del Catálogo con cantidad (sin tocar
> stock) + fotos → el Admin cotiza **fuera de Bitácora** (ERP externo tipo Defontana,
> `referencia_externa` es texto libre, sin integración real) → al aprobar, nace
> automáticamente una Orden de Servicio que hereda los materiales como `os_items` — el
> descuento de stock ocurre ahí, sin ningún gancho nuevo: la OS se crea igual que una
> manual y `aplicarDescuentoInventarioSiCorresponde` se dispara solo, por transición de
> `estado_os`, exactamente como cualquier otra OS. Rechazar no crea nada. Deliberadamente
> separado de Cotizaciones (ese módulo sigue igual, otras empresas lo usan tal cual) y
> del punto de descuento de stock existente (reutilizado, no duplicado). Tablas nuevas:
> `levantamientos`, `levantamiento_materiales`, `levantamiento_fotos`. Web:
> `/dashboard/levantamientos`. Mobile: sección nueva en "Más" → Terreno.
>
> ---
>
> **Novedades del 4-6 sep (reestructuración de navegación + fixes de terreno — todo en
> producción):**
>
> Prompt de 7 pasos ("reestructuración de navegación e integridad de datos", basado en
> una auditoría externa). Regla: un commit por paso, pasos 0-2 tocan datos.
> - **PASO 0 — Puente OS firmada → Cobro** (migración 91). Antes, finalizar/firmar una OS
>   no generaba ningún documento por cobrar. Ahora: `ordenes_servicio.cobro_id` (FK a
>   `facturas`, nullable) + `empresas.cobro_automatico_al_firmar` (boolean, default true).
>   Al `POST /api/trabajos/:id/finalizar` (estado_os → "firmada"), si la empresa tiene el
>   flag y el trabajo tiene monto > 0 y la OS no tiene cobro, se crea una factura
>   "pendiente" por ese trabajo (vencimiento a 30 días) y se guarda su id en `cobro_id`.
>   No bloqueante (falla → log, no rompe la firma). `POST /api/cobros/desde-trabajos`
>   ahora devuelve 409 si algún trabajo de la selección ya tiene cobro.
> - **PASO 1 — Un solo vocabulario de estados** (migración 92). `Trabajo` y `OrdenServicio`
>   son dos capas del mismo registro pero había dos juegos de estados: `EstadoTrabajo`
>   (en_curso/completado/cancelado, 3) y `EstadoOS` (pendiente/enviada/en_proceso/
>   completada/firmada, 5). El badge del historial mezclaba "completado"/"completada"
>   según si había documento. Ahora **`EstadoOS` es el único vocabulario visible** y suma
>   `cancelada`. La columna `trabajos.estado` sigue existiendo (marcada `@internal` en
>   `types.ts`: no usar para UI ni informes) — el backend la sincroniza a
>   `ordenes_servicio.estado_os` desde los 3 write-paths de trabajo (POST, PATCH,
>   cancelación) y todos los badges (web + móvil) leen `orden.estado_os` con fallback
>   `estadoOsDeTrabajo(trabajo.estado)` (helper nuevo en shared: en_curso≈en_proceso,
>   completado≈completada, cancelado≈cancelada). El check de `estado_os` se amplió con
>   `cancelada`. Conteo prod antes/después: sin cambios (0 cancelados).
> - **PASO 2 — Personas: una ficha, no tres.** La misma persona se administraba desde
>   Flota → Colaboradores, Administración → Grupo y usuario, y Remuneraciones → Datos del
>   equipo — todas sobre la fila `usuarios` (+ su extensión 1:1 `datos_laborales`). Ahora
>   `/dashboard/personas` (grupo EQUIPO del sidebar) es la lista única + las acciones que
>   no son de una persona (invitar, correos/dominios autorizados). `/dashboard/personas/
>   [id]` es la ficha con **pestañas**, cada una con el MISMO gate de módulo que tenía su
>   pantalla vieja: Identidad (`flota`, edita vía `PATCH /api/usuarios/:id/zona`), Acceso
>   y permisos (`gestion_control`: rol, activo, reset de contraseña, auditoría de esa
>   persona), Datos laborales (`remuneraciones`), Documentos (`flota`). **Backend intacto**
>   — no se tocó ningún endpoint, gate ni migración; la matriz de permisos quedó igual.
>   Las 4 rutas viejas son redirect. Links internos actualizados (OS, Configuración,
>   Remuneraciones, campana, avisos de documentos).
> - **PASO 3 — Móvil: 4 pestañas fijas para todos los roles.** `tabsPara()` armaba una
>   barra de hasta 6 destinos que variaba por rol/función/rubro. Ahora la barra es
>   **idéntica para todos: `Hoy · Agenda · Clientes · Más`** — el rol cambia el CONTENIDO,
>   no las pestañas. **Hoy** (pantalla nueva): una sola lista cronológica del día
>   (trabajos + citas + viajes juntos, ordenados por hora), interruptor Lista/Ruta (el
>   mapa de Ruta deja de ser pestaña), toggle Míos/Equipo para gestión (ve el día de toda
>   la empresa), botón "Asistente IA" fijo en la cabecera. **Clientes**: visible para
>   todos; terreno (colaborador) ve la ficha para contactar al cliente pero sin crear/
>   editar ni asignar packs. **Más**: absorbe la vieja pestaña Gestión (Cobros, Gasto,
>   Informes, Asistente) + Perfil/cola de sync + las listas COMPLETAS de Trabajos y
>   Viajes (el histórico; lo del día vive en Hoy). `GestionStack` → `MasStack`; se borran
>   `tabsPara.ts` y `GestionInicioScreen`. La cola offline queda igual.
> - **PASO 4 — Web: sidebar por frecuencia de uso.** De 6 grupos / 22 destinos a **7
>   grupos / 16**, desplegables → listas planas. Estructura nueva: **Hoy** (Visión
>   general, ex-"Dashboard"), **OPERACIÓN** (Agenda, Órdenes de servicio, Rutas, Viajes),
>   **CLIENTES** (Clientes, Packs de sesiones —venía de Operación—, Portal del cliente —
>   destino nuevo, ver PASO 5), **DINERO** (ex-"Financiero": Cotizaciones, Cobros, Gastos,
>   Liquidaciones), **RECURSOS** (Equipos, Inventario, Catálogo, Proveedores), **EQUIPO**
>   (el grupo "Flota" se disuelve: Personas —PASO 2— + Documentos), luego **Informes**
>   (fusiona "Generar con IA") y **Configuración** (suelto). **"Órdenes de servicio" es
>   UNA sola lista** (`/dashboard/ordenes`) con filtro "con documento / sin documento /
>   todas" — trabajos y OS son la misma fila; `/dashboard/trabajos` pasó a redirect.
>   Remuneraciones deja de ser grupo de primer nivel: Liquidaciones va a DINERO,
>   Parámetros de remuneración a un submenú de Configuración. Se borraron **10 archivos
>   de redirect muertos** (clientes, facturas, presupuestos, ajustes y 6× `cadastros/*`
>   en portugués). `NAV_GROUPS` en `DashboardShell.tsx` ganó soporte de `modulos?: []`
>   (ítem visible si el rol ve CUALQUIERA de la lista) para "Personas".
> - **PASO 5 — Portal del cliente visible + configurable** (migración 93). El portal ya
>   existía (`/portal/*`, login por RUT + código de 6 dígitos) pero ningún link del
>   dashboard llevaba a él y no había forma de elegir qué ve el cliente. Ahora:
>   `empresas.portal_muestra_{ordenes,citas,cotizaciones,cobros}` (4 booleanos, default
>   true). `/dashboard/portal-cliente` (grupo CLIENTES): link para compartir copiable
>   (`<web>/portal/login`, genérico — el cliente se identifica por RUT), 4 interruptores
>   de secciones (`PATCH /api/empresa`, optimista), y previsualización en iframe.
>   **Backend del portal**: middleware `requiereSeccion(seccion)` que devuelve **403** en
>   las rutas `/api/portal/datos/*` de una sección apagada; nuevo `GET /api/portal/config`
>   con los 4 flags (sin gate, solo `requierePortal`). `PortalShell` oculta del tab bar
>   las secciones apagadas; el inicio filtra las tarjetas y esconde "Próximas visitas" si
>   Órdenes está apagado; cada página de sección redirige a `/portal` ante un 403.
> - **PASO 6 — Dos huecos de flujo.** (a) **Saldo en la ficha del cliente**: arriba de la
>   lista de cobros, "Por cobrar" (suma de facturas no pagadas) y "Vencido" (no pagadas
>   con vencimiento pasado, en rojo). (b) **"Renovar pack"** cuando el saldo de un pack
>   llega a 0: botón en la ficha del cliente y en la lista de Paquetes de sesiones — abre
>   `AsignarPackForm` (prop nueva `inicial`) precargado con el mismo tipo/nombre/cantidad
>   y precio del pack agotado.
>
> **Fixes de la app móvil de terreno (mismo lote, 5-6 sep):**
> - **"Foto de la guía" no sincronizaba (fallaba hace 24h+).** Diagnóstico: las fotos
>   vivían solo en `cache/` (donde caen las de cámara y las que produce
>   `expo-image-manipulator`), que el SO limpia; una foto encolada por horas terminaba
>   con su archivo ya borrado y ningún reintento la recuperaba; el `catch` la marcaba
>   "Sin conexión" (sin contar como intento) → reintento infinito → a las 24h el escape
>   hatch la marcaba fallida; y `reintentar()` no reiniciaba `creadoEn`, así que el
>   reintento manual la re-marcaba fallida al instante. Fix: se agregó **`expo-file-
>   system`**; `comprimirImagen()` mueve el resultado a `document/fotos-cola/`
>   (persistente); la cola detecta el archivo ausente y falla al toque con mensaje claro,
>   borra el archivo al subir OK; `reintentar()` reinicia `creadoEn`; el `catch` guarda
>   el error real (guardrail); timeout de subida de foto 45s → 60s.
> - **Listado de usuarios mostraba 1 de N.** Colisión de clave de caché: `catalogoParaTrabajo()`
>   guardaba la lista de USUARIOS bajo `"trabajos:equipo"`, la misma clave que
>   `listarTrabajos()` usa para la lista de TRABAJOS del equipo → renombrada a
>   `"trabajos:usuarios"`. Además `cerrarSesion()` no limpiaba la caché de lecturas → una
>   caché vieja (equipo de la empresa cuando tenía 1 usuario) sobrevivía al logout/login;
>   se agregó `limpiarCacheLecturas()` (borra `cache:*`, no toca `sync:*`).
> - **Catálogo de Agenda Pro editable desde la app** ("Servicios y packs", pestaña Más,
>   gate `agenda_pro`): crear y **editar** servicios (precio, nombre, duración, activo) y
>   tipos de pack (precio, sesiones, servicio asociado, vigencia) — antes solo web. Los
>   endpoints `PATCH /api/servicios/:id` y `POST/PATCH /api/tipos-pack` ya existían.
> - **Adicionales por reserva** (migración 94). `tareas.adicionales jsonb not null default
>   '[]'` — lista `[{concepto, monto}]`, "valor agregado" que se suma al precio del
>   servicio (el `precio` de la tarea NO cambia de significado; el total de la reserva =
>   precio + Σ montos). Backend `tareas` POST/PATCH: `sanearAdicionales()` valida
>   (concepto no vacío, monto ≥ 0, máx 20 ítems). UI en "Nueva reserva" (cosmetología) y
>   en el detalle de la reserva.
>
> **Sobre el build de la app móvil:** se agotó la cuota de builds Android del plan **Free
> de EAS** este mes (reset el 1-oct). Se armó el toolchain de Android local en la Mac de
> la usuaria (JDK 17 + Android SDK + NDK 27.1 vía Homebrew, sin sudo) y el APK se compila
> con `expo prebuild` + `./gradlew assembleRelease` — firmado con el **keystore de debug**
> estándar (SHA1 `5E:8F:16:…`), no con el keystore de EAS. Consecuencia: un APK local **no
> puede actualizar** encima de uno instalado desde EAS (firmas distintas) — hay que
> desinstalar primero. **Gotcha del build local**: usa `mobile/.env` (que apunta a
> `localhost` — dev); para un APK de prod hay que sobrescribir `.env` con los valores de
> `eas.json > build.preview.env` antes del `gradlew` y restaurarlo después.
>
> **Tracking de la migración 94 en prod:** la columna `tareas.adicionales` está aplicada
> en prod y en dev, pero la fila `94` no quedó en `supabase_migrations.schema_migrations`
> de prod (el `migration repair --status applied 94` está pendiente) — el CI
> `check-migraciones-prod.yml` va a quedar rojo hasta que se corra. No afecta el
> funcionamiento.
>
> ---
>
> **Novedades del 3-sep (todo en producción salvo lo del móvil, que espera build EAS):**
> - **Perfiles por empresa** (migración 75, tabla `empresa_rol_modulos`). El Admin de
>   cada empresa activa/desactiva módulos **por rol dentro de su empresa** desde
>   Configuración → "Perfiles y permisos", sin tocar la plantilla global (que sigue
>   siendo solo del Super-Admin). Delegables todos los módulos menos `configuracion` y
>   `gestion_control`. El rol `colaborador` ahora trae `agenda` por defecto.
> - **App móvil — pieza grande**: build EAS del APK Android probado en dispositivo;
>   pestaña **Agenda** (ver + agendar citas/tareas); **login resiliente** (reintentos
>   ante el arranque en frío de Render) + `keep-warm.yml`; **bloqueo con huella / Face
>   ID** (opt-in en Perfil); código de **login con Google en el móvil** (detrás de un
>   flag, requiere config); se **quitó `expo-maps`** (crasheaba en Android sin API key).
> - **Sentry en el backend** (opt-in por `SENTRY_DSN`). En el móvil se intentó pero el
>   plugin no compila con Expo SDK 57 — pendiente.
> - **Fix**: crear trabajo/OS fallaba con `null value in column "datos"` — la columna es
>   `jsonb not null default '{}'`, el insert mandaba `null`.
> - **OS**: reasignar el colaborador asignado desde el detalle de la OS (admin/supervisor).
>
> **Novedades del 1-2 sep (todo en producción):**
> - **Roles editables desde el Panel de Super-Admin** (migración 71). Los 4 roles
>   (admin/supervisor/contador/colaborador) dejaron de estar hardcodeados: son filas de
>   la tabla `roles`, con sus módulos, sus "acciones sensibles" delegables y su
>   exigencia de 2FA editables; se pueden crear roles nuevos y restringir un rol a
>   empresas puntuales.
> - **Acceso por correo/dominio autorizado** (migración 72). Un admin (o el Super-Admin)
>   pre-autoriza correos exactos o dominios enteros por empresa; ese correo entra sin
>   invitación. Un correo desconocido que no se autorregistró queda **denegado** (antes
>   caía siempre en "crear tu empresa").
> - **Módulo Remuneraciones** (liquidaciones de sueldo, legislación chilena — migraciones
>   67-70). Opt-in por empresa, lo enciende el Super-Admin.
> - **Fix de seguridad** (migración 73): 19 tablas "solo backend" (`super_admins`,
>   `roles`, `mfa_totp_secretos`, `empresa_accesos_autorizados`, etc.) estaban abiertas
>   a la anon key vía PostgREST; ahora tienen RLS activo (deny-all) + grants revocados.

## 1. Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend web | Next.js (App Router) | 16.3.2 |
| Frontend web | React | 19.2.8 |
| Frontend web | TypeScript | ^5 |
| Estilos | Tailwind CSS | v4 (`@theme inline`, sin `tailwind.config.js` separado) |
| Componentes UI | Sistema propio (`web/src/components/ui.tsx`) — **no** hay shadcn/Radix/MUI | — |
| Gráficos | Recharts | ^3.10 |
| Mapas | Leaflet | ^1.9 |
| Backend | Node.js + Express | Express ^4.19, TS ^5.5, ejecutado con `tsx` en dev. **Node ≥ 22 requerido** (`engines` en `backend/package.json`) — `@supabase/supabase-js` v2.112 necesita `WebSocket` global nativo, que existe sin flags recién desde Node 22 |
| Base de datos | PostgreSQL, gestionado por Supabase | — |
| ORM | **Ninguno** — cliente `@supabase/supabase-js` (PostgREST) directo, tipado a mano en `packages/shared/src/types.ts` | ^2.45 |
| Gestor de estado | **Ninguno global** (sin Redux/Zustand/Jotai) — `useState`/`useEffect` + Context puntual (`ConfiguracionContext`, `InformesContext`) + fetch directo vía `web/src/lib/api.ts` | — |
| Autenticación | Supabase Auth (JWT) + **login propio en dos pasos** (ver más abajo, ya no es `signInWithPassword` directo del cliente para email/contraseña). Backend valida el token con `supabase.auth.getUser(token)` en cada request (`backend/src/auth.ts`) | — |
| Multi-tenant | **RLS + filtrado manual por `empresa_id` son complementarios, no alternativos — no son la misma barrera.** El backend consulta Supabase con la **service role key** (`backend/src/supabase.ts`), que **bypassea RLS por completo**, así que para el tráfico real (100% de las requests, todas pasan por el backend) la barrera efectiva es la disciplina de `.eq("empresa_id", ...)` en cada ruta (`backend/src/empresa.ts` resuelve el `empresaId` del usuario logueado en un middleware), reforzada por un script de auditoría heurístico (`backend/scripts/auditar-aislamiento.ts`, `npm run audit:tenant` — **baseline en 0 hallazgos desde sept-2026**, los 6 sitios marcados de la primera pasada ya se revisaron uno por uno y quedaron con `// tenant-ok: <razón>`) y por `backend/src/tenant.ts` (helpers tipados `seleccionarDeEmpresa`/`actualizarEnEmpresa`/`eliminarDeEmpresa`/`insertarEnEmpresa`). **Pero RLS SÍ está activo y cumple un rol real, distinto**: defensa en profundidad si algún día se expone un cliente con anon key (o contra un bug futuro), y — el caso ya ocurrido — cerrojo real para las tablas que solo debe tocar el backend. Estado verificado en vivo (11-sep-2026): **84/84 tablas del schema `public` tienen RLS activo**; 61 tienen policy de tenant real (`empresa_id = empresa_actual()` — código vivo si algún día un cliente consulta con anon key, hoy no lo hace); las 23 restantes (`super_admins`, `roles`, `rol_empresas`, `empresa_modulos`, `empresa_feature_flags`, `empresa_accesos_autorizados`, `mfa_*`, `login_2fa_pendiente`, `errores_backend`, `ia_uso`, `whatsapp_*`, parámetros previsionales, etc.) son deny-all sin políticas + `revoke` de los grants de `anon`/`authenticated` (migración 73 cerró una exposición real: Supabase otorga grants automáticos a esos roles en toda tabla nueva del schema `public`, así que sin RLS quedaban leíbles/escribibles con la anon key del bundle del front vía PostgREST). **Regla para tablas nuevas:** siempre `enable row level security`; si es solo-backend, sin políticas (deny-all); si el front la lee directo (hoy: nunca, pero la regla es a prueba de futuro), agregar además la política de tenant | — |
| Autenticación Super-Admin | Identidad totalmente separada de Supabase Auth y de `usuarios`/`Rol` — tabla propia `super_admins`, password con `scrypt` (Node `crypto` nativo), TOTP (RFC 6238) implementado a mano, sesión propia con token HMAC-SHA256. Sin auto-registro: la única forma de **crear** una cuenta es un script offline (`backend/scripts/crear-superadmin.ts`), nunca un endpoint HTTP. **Gestionar** las propias credenciales sí se puede desde el panel (nuevo, ver módulo Super-Admin en la sección 4): página `/superadmin/cuenta` con cambio de contraseña y regeneración del propio TOTP, cada mutación exige reautenticarse en el momento (contraseña actual + código TOTP). El secreto TOTP se cifra en reposo con `SUPERADMIN_ENCRYPTION_KEY` — si esa env var difiere entre el entorno donde se creó el super-admin y el que valida el login, el login falla al descifrar | — |
| Roles y permisos | **Editable desde el Panel de Super-Admin (migración 71).** Los roles son filas de la tabla `roles` (`slug`, `nombre`, `modulos[]`, `acciones[]`, `requiere_2fa`, `es_sistema`, `orden`). Los 4 de sistema (admin/supervisor/contador/colaborador) se siembran en el primer arranque del backend desde `@bitacora/shared` (`backend/src/roles.ts`, con caché en memoria TTL 60 s), no se borran y no se renombra su `slug`; **`admin` tiene acceso total y no es editable**. Se pueden crear roles custom y **restringir un rol a empresas puntuales** (`rol_empresas`). Además de los módulos, un rol tiene "**acciones sensibles**" delegables (`ACCIONES` en `packages/shared/src/permisos.ts`: `facturar`, `gestionar_plan`, `config_agenda_pro`, `ver_dashboard`) — el backend las exige con `requiereAccion()`. `PERMISOS_POR_ROL` / `ACCIONES_POR_ROL` / `ROL_EXIGE_2FA` en shared quedaron como **semilla**, no como fuente de verdad en runtime. El backend resuelve permisos contra la tabla (`rolPuedeVerModulo`/`rolTieneAccion`/`rolExigeMfa`); el frontend, contra `modulos_visibles` / `acciones` que devuelve `GET /api/me`. `usuarios.rol` sigue siendo texto libre (nunca tuvo CHECK); un rol borrado deja a sus usuarios apuntando a un slug inexistente = sin acceso | — |
| Autenticación en dos pasos (2FA) para usuarios normales | TOTP (app de autenticación) o código por correo, **opcional para todos; la exigencia por rol la define `roles.requiere_2fa`** (editable desde el Panel; sembrado como obligatorio para admin/supervisor, opcional para contador/colaborador). `backend/src/totp.ts` (RFC 6238, reusa la misma implementación a mano que ya existía para Super-Admin), secreto cifrado en tabla propia `mfa_totp_secretos` (nunca en `usuarios`, que sí se expone completa vía `GET /api/usuarios`). Login por contraseña ya **no** es `signInWithPassword` directo del cliente — pasa por `POST /api/auth/login` (`backend/src/routes/authLogin.ts`): si el usuario tiene 2FA activo, responde `requiere_codigo` en vez de tokens, y el segundo paso (`POST /api/auth/login/verificar`) recién entrega la sesión real (tokens de Supabase cifrados en tránsito en la tabla `login_2fa_pendiente`, de un solo uso). El gate de obligatoriedad vive en `backend/src/empresa.ts` (middleware `requiereEmpresa`, responde `403 { code: "MFA_REQUERIDA" }`, con excepción explícita de path para `/api/usuarios/me/*`). Login con Google (ver más abajo) es un camino aparte, no pasa por este endpoint | — |
| Login con Google | **Web**: `supabase.auth.signInWithOAuth({ provider: "google" })` desde `web/src/app/login/page.tsx`, callback en `web/src/app/auth/callback/page.tsx`. Tras autenticar, `web/src/lib/accesoPostLogin.ts` consulta `GET /api/me`, que resuelve el acceso (ver fila siguiente). **Móvil (nuevo, detrás de flag)**: `mobile/src/features/auth/googleAuth.ts` — `signInWithOAuth({ skipBrowserRedirect })` → `WebBrowser.openAuthSessionAsync` → `exchangeCodeForSession` (flujo PKCE, `flowType: "pkce"` en `mobile/src/lib/supabase.ts`), deep link `bitacora://auth-callback`. El botón "Continuar con Google" aparece solo con `EXPO_PUBLIC_GOOGLE_LOGIN="true"` (eas.json). **Pendiente manual del usuario**: crear el/los clientes OAuth en Google Cloud Console (web para Supabase con redirect `https://<ref>.supabase.co/auth/v1/callback` prod y dev), habilitar el proveedor Google en Supabase Auth (Client ID/Secret) en los dos proyectos, y agregar el scheme `bitacora://` a las Redirect URLs de Supabase. Sin costo | — |
| Acceso por correo/dominio (migración 72) | Cuando una cuenta autenticada **no tiene fila en `usuarios`**, `GET /api/me` resuelve qué hacer (`backend/src/accesosAutorizados.ts`): si su correo o su dominio está en `empresa_accesos_autorizados` de **1 empresa** → le crea la fila en `usuarios` con el rol indicado (default `colaborador`) y entra; si está en **varias** → denegado (una persona = una empresa); si en **ninguna** pero se autorregistró en `/registro` (`user_metadata.self_signup = true`) → `/onboarding` (crea su empresa, trial); si en ninguna y no se autorregistró → **acceso denegado** (cierra la sesión). La lista se gestiona desde el Panel de Super-Admin (ficha de empresa) y desde el admin de cada empresa (Configuración → Grupo y usuario). Invitar sigue funcionando aparte (crea la fila en `usuarios` directo) | — |
| Seguridad HTTP | **Nuevo.** `helmet()` (cabeceras estándar), CORS restringido a una lista de orígenes vía `ALLOWED_ORIGINS` (env; sin configurar en dev local solo permite `http://localhost:3000`, nunca `*`), rate limiting (`express-rate-limit`) en login, invitaciones y la encuesta pública (`backend/src/rateLimiters.ts`) | — |
| Mobile | Expo + React Native | Expo ~57.0.19, RN 0.86.3, React 19.2.3. **Versión actual: 1.9.8 / versionCode 25.** Nav: `@react-navigation` v7. Auth extra: `expo-local-authentication` (bloqueo con huella/Face ID), `expo-auth-session` + `expo-web-browser` + `expo-crypto` (login con Google, PKCE). `expo-file-system` (persiste las fotos de la cola de sync en `document/fotos-cola/`, no `cache/`). `expo-image-picker` (cámara **y galería**, unificado en `elegirFotos()` — ver Novedades 9-11 sep) + `expo-image-manipulator` (compresión). Sin `expo-maps` (se quitó — ver App móvil en sección 4). Build normal vía **EAS** (`mobile/eas.json`, perfiles development/preview/production; `preview`/`production` apuntan a producción); mientras la cuota EAS Free está agotada (reset 1-oct), **build local** (`expo prebuild` + `./gradlew assembleRelease`, JDK 17 + Android SDK/NDK vía Homebrew — SDK root real: `/opt/homebrew/share/android-commandlinetools`, cask de brew) — firmado con keystore de debug |
| IA | Anthropic Claude API (`@anthropic-ai/sdk`), modelo `claude-sonnet-5` | ^0.68 |
| Observabilidad de errores | **Backend**: Sentry (`@sentry/node`, `backend/src/instrument.ts` importado primero en `server.ts`), opt-in por `SENTRY_DSN` — sin DSN el SDK es no-op. El handler de errores global manda los 5xx a Sentry además de a la tabla `errores_backend` (Panel de Super-Admin), que sigue igual. **Móvil**: se intentó `@sentry/react-native` pero su plugin de Gradle no compila con Expo SDK 57 en EAS — pendiente encontrar versión/config compatible | — |
| Storage de archivos | Capa propia S3-compatible (`backend/src/storage.ts`, sobre `@aws-sdk/client-s3`) apuntando al endpoint S3 de Supabase Storage | — |
| PDF | `pdfkit` (generación programática, sin plantillas HTML) | ^0.20 |
| Email | Resend (`backend/src/email.ts`, `fetch` directo a la API, sin SDK). **Ya NO es "opcional con skip silencioso":** si `RESEND_API_KEY`/`RESEND_FROM_EMAIL` faltan, en **producción** (`NODE_ENV=production`) cualquier envío **lanza** y el flujo que lo disparó falla con rollback (crear empresa desde superadmin, invitar usuarios, reset de contraseña, 2FA por correo); **fuera de producción** escribe el correo (destinatario, asunto, enlaces) en la consola del backend y sigue como si se hubiera enviado. En producción está configurado con dominio propio verificado | — |
| Hosting | **Publicado.** Web en **Vercel** (`app.transportesitineris.cl`, Root Directory `web`, build command en `web/vercel.json` que compila `packages/shared` antes de `next build`), backend en **Render** (`bitacora-cgt7.onrender.com`, imagen Docker `backend/Dockerfile` con build context = raíz del monorepo, base `node:22-slim`), DB/Auth/Storage en un **Supabase de producción** separado del de desarrollo, DNS/WAF en **Cloudflare**. Detalle completo, env vars y pendientes en `docs/PUESTA_EN_PRODUCCION.md` | — |
| CI/CD | **Mínimo.** Dos GitHub Actions: `check-migraciones-prod.yml` (falla si hay migración local sin aplicar/trackear en el Supabase de prod — existe por un incidente real de tracking desincronizado; hoy en rojo por la fila de la migración 94 pendiente) y `keep-warm.yml` (cron cada 10 min a `/health`). Deploy: **Vercel auto-despliega por push a `main`**; **Render no siempre** — se usa su Deploy Hook. Sin lint/typecheck/test previo. Sin Terraform activo | — |

**Nota sobre Fase 2 (GCP):** el prompt original definía una migración futura a Google Cloud (Cloud SQL, Firebase Auth, Cloud Storage, Cloud Run, RLS portable, Terraform, GitHub Actions). Esos artefactos existen **como referencia, sin activar**, en `supabase/fase2-referencia/` (`main.tf`, `seguridad-gcp.sql`, `github-workflows-deploy.yml`). No se ha empezado ningún trabajo real de migración.

**Realtime de Supabase:** mencionado en el stack del prompt original, pero **no se usa en ningún lado** del código actual (no hay `.channel()` ni suscripciones `postgres_changes`). Todo el refresco de datos es fetch manual.

## 2. Estructura del proyecto

Monorepo con **npm workspaces**: `web`, `backend`, `mobile`, `packages/*`.

```
bitacora/
├── ENCARGO-claude-code.txt   ← prompt maestro original del proyecto
├── web/                       Next.js — panel de administración (usuarios de la empresa)
│   └── src/
│       ├── app/
│       │   ├── dashboard/     ~16 destinos, organizados en 7 grupos de sidebar (PASO 4,
│       │   │                  6-sep): Hoy, OPERACIÓN, CLIENTES, DINERO, RECURSOS, EQUIPO,
│       │   │                  + Informes y Configuración sueltos. "Órdenes de servicio"
│       │   │                  es una sola lista (trabajos+OS) con filtro con/sin
│       │   │                  documento. "Personas" (ex Flota→Colaboradores + Grupo y
│       │   │                  usuario + Datos del equipo) con ficha en pestañas.
│       │   ├── portal/        Portal de Cliente — identidad externa sin cuenta de Bitácora,
│       │   │                  layout propio (PortalShell), nav de pestañas: Inicio, OS,
│       │   │                  Citas, Cotizaciones, Cobros
│       │   ├── superadmin/    Panel de Super-Administrador — reservado para el dueño del
│       │   │                  producto, layout propio (SuperAdminShell), fuera del dashboard.
│       │   │                  Nav: Resumen, Empresas, Roles (CRUD de roles + disponibilidad
│       │   │                  por empresa)
│       │   ├── login/, registro/, invitacion/, onboarding/, auth/callback/   auth previo al
│       │   │                  dashboard (login por contraseña en dos pasos si hay 2FA, o
│       │   │                  Google OAuth vía auth/callback)
│       │   └── encuesta/, agendar/[empresaId]/   rutas públicas (sin auth) —
│       │                  encuesta post-servicio y reserva online de Agenda Pro
│       ├── components/        DashboardShell, SuperAdminShell, PortalShell, ui.tsx (design
│       │                      system), AsistenteChat, NotificacionesBell, PanelAcciones
│       │                      (drawer de acciones reutilizable), Combobox/ComboboxCliente/
│       │                      ComboboxResponsable (buscar+crear, reemplazó selects nativos
│       │                      en varios formularios), charts/
│       └── lib/                api.ts (fetch wrapper), superadminApi.ts, portalApi.ts,
│                                formatMoneda.ts, periodo.ts, etc.
├── backend/                   Express + TypeScript — API REST
│   └── src/
│       ├── routes/             54 archivos, un router por recurso (incluye registrosMantencion.ts
│       │                       y ventas.ts, nuevos; accesos.ts —
│       │                       lista de correos/dominios autorizados de la propia empresa,
│       │                       remuneraciones.ts, misViajes.ts). portal.ts tiene ahora
│       │                       el middleware requiereSeccion() + GET /config (PASO 5)
│       ├── superadmin/         módulo aparte del Panel de Super-Admin: auth.ts (sesión
│       │                       HMAC propia), passwords.ts (scrypt), routes.ts (totp.ts se
│       │                       movió a backend/src/totp.ts, compartido con el 2FA normal;
│       │                       routes.ts también gestiona 2FA/password de usuarios de
│       │                       cualquier empresa, ver sección 4)
│       ├── server.ts           monta todas las rutas + middlewares globales (helmet, cors
│       │                       restringido, rate limiting) + logging de errores a
│       │                       errores_backend
│       ├── auth.ts, empresa.ts, permisos.ts, roles.ts  middlewares y motor de permisos:
│       │                       valida JWT (auth.ts expone req.userEmail/req.userMetadata),
│       │                       resuelve empresa_id, gate de 2FA por rol, gate de trial
│       │                       vencido (ver sección 4). roles.ts resuelve rol→módulos/
│       │                       acciones/2FA contra la tabla `roles` con caché en memoria;
│       │                       permisos.ts expone requiereModulo()/requiereAccion()
│       ├── accesosAutorizados.ts  resuelve el acceso de una cuenta sin fila en `usuarios`
│       │                       (correo/dominio autorizado → aprovisiona, o deniega)
│       ├── totp.ts             TOTP (RFC 6238) a mano, compartido entre 2FA de usuario
│       │                       normal y Super-Admin
│       ├── tenant.ts           helpers tipados para queries scopeadas por empresa_id
│       ├── limites.ts          enforcement real de los topes de uso por plan (ver sección 4)
│       ├── concurrencia.ts     semáforo propio en memoria (sin dependencia externa) —
│       │                       capa cuántas llamadas simultáneas a Claude salen a la vez
│       ├── pdfWorkerPool.ts, workers/pdfWorker.ts   los 3 generadores de PDF corren en un
│       │                       worker_thread, no en el proceso principal
│       ├── inventario.ts       descuento/reversión de stock configurable por empresa
│       ├── cumpleanosClientes.ts   felicitación de cumpleaños al cliente (ver sección 4)
│       ├── scripts/auditar-aislamiento.ts   auditoría heurística de aislamiento multi-tenant
│       ├── claude.ts           cliente Anthropic + prompts de IA + instrumentación de uso
│       │                       (tabla ia_uso, por feature) + límite de concurrencia
│       ├── whatsapp.ts, routes/whatsapp.ts   bot de WhatsApp (webhook Meta Cloud API)
│       ├── notificar.ts, notificarCliente.ts   feed interno del equipo vs. correo real al
│       │                       cliente externo — sistemas distintos, no confundir
│       ├── storage.ts          capa S3 (fotos, firmas, comprobantes, anexos) + medición de
│       │                       uso de storage por empresa (exacta, para Super-Admin) +
│       │                       contador aproximado incremental (para el límite de plan)
│       ├── remuneraciones/     parametros.ts (indicadores UF/UTM desde mindicador.cl + AFP),
│       │                       calcular.ts, archivoPrevired.ts, resumenPrevisional.ts,
│       │                       libroRemuneracionesDT.ts — módulo de liquidaciones (ver sección 4)
│       └── generarPdfOS.ts, generarPdfCotizacion.ts, generarPdfInforme.ts,
│                                generarPdfLiquidacion.ts   PDFs con pdfkit
├── mobile/                     Expo — app para choferes/técnicos/estilistas en terreno.
│   │                           4 pestañas fijas para todos los roles (PASO 3, 6-sep):
│   │                           Hoy · Agenda · Clientes · Más. v1.9.8/vc25. Build por APK
│   │                           local (`./gradlew assembleRelease`) mientras la cuota EAS
│   │                           Free está agotada.
│   └── src/                     shell/navigation/ (HoyStack, MasStack, AppTabs sin
│                                tabsPara), features/ (hoy/, mas/, agenda/CatalogoScreen…,
│                                mantencion/ — ChecklistMantencionScreen +
│                                MantencionDetalleScreen, nuevo—, ventas/
│                                RegistrarVentaScreen), services/ (cola de sync offline
│                                con guard anti-apilamiento; fotoCola.ts persiste las
│                                fotos), lib/imagen.ts (elegirFotos(): cámara o galería,
│                                un solo selector reutilizado en toda la app)
├── packages/shared/            tipos TypeScript compartidos entre los 3 apps
│   └── src/
│       ├── types.ts             única fuente de verdad de cada tabla (Row types)
│       ├── permisos.ts          SEMILLA de la matriz rol × módulo + ACCIONES + módulos
│       │                        opt-in (en runtime manda la tabla `roles`, ver sección 1)
│       ├── limites.ts           topes de uso por plan
│       ├── liquidacionChile.ts  cálculo puro de una liquidación de sueldo (+ tests)
│       ├── supabase.ts          factory del cliente supabase-js tipado
│       └── rut.ts               validación/formato de RUT chileno
└── supabase/
    ├── migrations/              99 archivos SQL numerados, se aplican en orden — las
    │                            99 aplicadas y trackeadas en prod
    └── fase2-referencia/        Terraform + RLS portable + CI — diseñados, no activados
```

**Convenciones ya establecidas:**
- Todo el código (variables, comentarios, nombres de tabla/columna) está en **español**.
- Los tipos "Row" en `types.ts` son `type`, nunca `interface` (requisito del tipado genérico de supabase-js).
- Cada router de backend sigue el mismo patrón: `ah<RequestConEmpresa>(async (req, res) => {...})` (wrapper que evita que un error async tumbe el proceso) y se monta en `server.ts` con `requiereAuth, requiereEmpresa`.
- Cada página del dashboard (`"use client"`) sigue el mismo patrón de carga: `supabase.auth.getSession()` → si no hay sesión, redirect a `/login` → `apiFetch("/api/...")`.
- Gotcha recurrente ya resuelto varias veces: `.update(objeto)` de supabase-js rechaza `Record<string, unknown>` — siempre se tipa como `Partial<TheRowType>`.
- Módulos viejos renombrados (Cadastros→Registros, Facturas→Cobros, Trabajos→Órdenes de servicio) dejaron **redirect shims** en la URL vieja (`useEffect` + `router.replace`), no duplican lógica. En el PASO 4 (6-sep) se **borraron 10 redirects muertos ya sin links entrantes** (clientes, facturas, presupuestos, ajustes, 6× `cadastros/*`); antes se verificó que ninguna otra pantalla los enlazara. Mismo criterio al fusionar Vehículos→Equipos: no quedó redirect porque la ruta vieja se borró junto con la pantalla.
- Cada empresa puede tener módulos contratados distintos (tabla `empresa_modulos`) — es un eje independiente del rol: el rol (tabla `roles`, editable — ver sección 1) decide qué ve cada persona *dentro* de su empresa, `empresa_modulos` decide qué está *contratado* por esa empresa en primer lugar. `requiereModulo()` en el backend valida ambos; el frontend oculta del sidebar lo que cualquiera de los dos ejes bloquea, usando `modulos_visibles` de `GET /api/me` (ya cruzado rol ∩ contratado ∩ no-deshabilitado). Desde la autogestión de plan (sección 4), el plan Pro activa automáticamente todos los módulos opcionales (`MODULOS_OPCIONALES`: `agenda_pro`, `informe_ia`, `asistente`, `remuneraciones`) — es la única regla de negocio que conecta `empresas.plan` con algo real.
- **Roles editables (migración 71):** al agregar un módulo o una acción nuevos, sumarlos a `MODULOS` / `ACCIONES` en `packages/shared/src/permisos.ts` (semilla) y, si un rol de sistema debe tenerlo por defecto, a `PERMISOS_POR_ROL` / `ACCIONES_POR_ROL`. En una base ya sembrada eso NO actualiza las filas existentes de `roles` — hay que editarlas desde el Panel (o con un `update`). El backend cachea los roles 60 s; toda escritura desde el Panel llama `invalidarCacheRoles()`.
- **Tracking de migraciones:** el proyecto de **producción** tiene `supabase_migrations.schema_migrations` completo (se usa `supabase db push --linked`). El de **desarrollo** (`pruwvpnlvrvgtmpetlsr`) durante meses tuvo el tracking vacío porque las migraciones se aplicaban por Management API — se reparó en sept-2026 (ahora 73/73). Para aplicar a dev sin el CLI linkeado se usa `supabase db query --linked --project-ref pruwvpnlvrvgtmpetlsr -f <archivo>` + `notify pgrst, 'reload schema'`.
- Patrón para agregar un tipo de notificación al cliente nuevo (ya usado varias veces): sumarlo a `TipoNotificacionCliente`, y a los 4 mapas de `backend/src/notificarCliente.ts` (`ASUNTOS_DEFAULT`, `CUERPOS_DEFAULT`, `TIPO_MENSAJE`, `ENTIDAD_PORTAL`), más el check constraint correspondiente en la migración.
- Patrón "sin cron real" ya usado varias veces (no hay infraestructura de jobs programados en el proyecto): un chequeo perezoso disparado por una ruta que igual se llama seguido — `revisarCotizacionesPorVencer`, `marcarCotizacionesExpiradas`, verificación de estado de Flow, `revisarCumpleanosClientes` (este último enganchado en `GET /api/me`, el endpoint más universal posible, en vez de una pantalla puntual — para maximizar la chance de correr el día exacto). Al agregar lógica similar, seguir este patrón en vez de asumir que existe algo tipo cron/worker.
- `Combobox` (`web/src/components/Combobox.tsx`) es el primitivo genérico de buscar+seleccionar con teclado; `ComboboxCliente`/`ComboboxResponsable` le agregan "si no existe, crear uno nuevo inline" para esa entidad puntual — no se duplica el primitivo por cada entidad.

## 3. Sistema de diseño ("crema" — reemplazó a "Faena")

Migración completa (Pasos 0-6 cerrados, ~40 commits, 9-11 sep) de la dirección visual
original ("Faena": azul tinta `#1e4e8c` / IBM Plex / esquina corta) a una nueva, aplicada
a **toda la web** (las 7 pantallas del sidebar + la shell) y a mobile. Solo queda el
**Paso 7** (regla ESLint anti-hex/px, Storybook, check de CI — tarea de backlog aparte).

- **Fuente de verdad única:** `packages/design-tokens/tokens.json` — color, tipografía,
  tamaños, espaciado, radios, sombras. Todo lo demás se genera: `npm run gen:tokens` →
  `tokens.css` (web) + `generated.ts` (mobile/TS). `verificar.sh` falla si los generados
  quedan desincronizados del `tokens.json`, y también audita que no aparezcan colores
  literales nuevos (`scripts/check-colores.mjs`, con un baseline de literales
  preexistentes que solo puede bajar, nunca subir).
- **Paleta:** fondo `#f5ead8` · superficie `#ebddc5` · texto `#201e1d` · **acento
  `#c67139`** (cálido, reemplaza al azul de marca) · acento secundario `#7a8a5e` (oliva) ·
  divisor `rgba(32,30,29,.16)`. Tres rampas de 9 pasos (`neutral`, `accentRamp`,
  `accent2Ramp`) — 100-300 rellenos tenues, 500 base del rol, 700-900 texto sobre esos
  rellenos y estados presionados.
- **Tipografía:** **Caprasimo** (headings, weight 400, self-hosted) + **Figtree**
  (cuerpo) — reemplazan a IBM Plex. Precargadas en el splash de mobile.
- **Forma:** pill (`radius.pill = 999`) en vez de esquina corta; radios `sm/md/lg` =
  8/16/28.
- **Consumo:**
  | Plataforma | Cómo |
  |---|---|
  | Web (Next + Tailwind v4) | `@import "@bitacora/design-tokens/tokens.css"`. Clases con prefijo **`ds-`** (`bg-ds-bg`, `text-ds-h1`, `rounded-ds-pill`, `shadow-ds-md`…) — el prefijo existe para convivir con los últimos restos de Faena durante la migración; se retira en el Paso 7. |
  | Expo / RN / TS | `import { tokens, oscurecerOklch } from "@bitacora/design-tokens"`; en mobile, `useTema().ds`. |
- **Componentes compartidos:** `packages/ui` — API única (`Button`, `Input`, `Card`,
  `Tag`, `StatusBadge`, `Table`, `Dialog/Sheet`, `EmptyState/LoadingState/ErrorState`,
  `Toast`) consumida por web (`@bitacora/ui/web`) y mobile (`@bitacora/ui/native`) con la
  **misma API en español** (`onPress`/`variante`/`tamano`/`cargando`/`deshabilitado`/
  `iconoIzq`). Mobile además conserva sus propios primitivos más viejos en
  `components/ui` (API algo distinta, `titulo` en vez de children) para pantallas que
  todavía no migraron a `packages/ui`.
- **Marca por tenant (reactivada):** `--ds-brand` = `empresas.color_primario`, con
  `hover`/`pressed` derivados automáticamente (`oklch(from var(--ds-brand) ...)` en la
  web; `oscurecerOklch()` — OKLab puro en JS, con tests — en mobile). Fallback (login,
  sin tenant todavía): el acento por defecto. Nota de arquitectura: la web no tiene
  resolución de tenant en el servidor (sin SSR de sesión), así que el override se
  inyecta en el shell **cliente** (`DashboardShell.tsx`) — no genera FOUC porque nada se
  pinta antes de tener la empresa cargada.
- **Iconografía:** Lucide (`lucide-react-native` en mobile, `lucide-react` en web) en
  todo lo migrado — reemplaza a Ionicons/emoji sueltos de Faena.
- **PDFs — sí existen, ya generan branding real (sin tocar por esta migración, siguen con `pdfkit` puro):**
  - `backend/src/generarPdfOS.ts` — orden de servicio cerrada y firmada.
  - `backend/src/generarPdfCotizacion.ts` — cotización (también accesible desde el Portal de Cliente).
  - `backend/src/generarPdfInforme.ts` — informe con IA (estructurado o personalizado).
  - `backend/src/generarPdfLiquidacion.ts` — liquidación de sueldo (módulo Remuneraciones).
  - Todos usan `pdfkit` puro (no hay plantilla HTML→PDF) y reciben `empresaNombre`, `empresaLogoUrl`, `colorPrimario` como parámetros — el PDF hereda el logo y color de cada empresa, no un tema fijo.

## 4. Módulos implementados (estado real)

| Módulo | Estado | Notas |
|---|---|---|
| Layout / Shell | ✅ Implementado | **Sidebar reordenado por frecuencia de uso (PASO 4, 6-sep): 7 grupos, listas planas** (Hoy, OPERACIÓN, CLIENTES, DINERO, RECURSOS, EQUIPO, + Informes y Configuración sueltos). Se pasó de desplegables a links directos; "Órdenes de servicio" es una sola lista con filtro con/sin documento; Remuneraciones dejó de ser grupo (Liquidaciones→DINERO, Parámetros→Configuración); 10 redirects muertos borrados. `NAV_GROUPS` en `DashboardShell.tsx` acepta `modulos?: Modulo[]` (visible si el rol ve cualquiera) para "Personas". + drawer móvil, dropdown de usuario, campana de notificaciones internas, chat flotante del Asistente. La navegación se filtra con `modulos_visibles` de `GET /api/me`. **App móvil**: 4 pestañas fijas iguales para todos los roles — Hoy · Agenda · Clientes · Más (PASO 3) |
| Personas (ex Flota→Colaboradores + Grupo y usuario + Datos del equipo) | ✅ Implementado (PASO 2, 6-sep) — **solo reorganización de UI, backend sin tocar** | `/dashboard/personas` (grupo EQUIPO): lista única del equipo + invitar + correos/dominios autorizados (gate `gestion_control`). `/dashboard/personas/[id]`: ficha con pestañas, cada una con su gate original — Identidad (`flota`, `PATCH /api/usuarios/:id/zona`), Acceso y permisos (`gestion_control`), Datos laborales (`remuneraciones`, `PUT /api/remuneraciones/datos-laborales/:id`), Documentos (`flota`, `<DocumentoForm entidadTipo="colaborador">`). La misma fila `usuarios` (+ `datos_laborales` 1:1) que antes se editaba desde 3 pantallas. Las 3 rutas viejas + `flota/colaboradores/[id]` son redirect. Matriz de permisos idéntica (confirmado) |
| Login y 2FA | ✅ Implementado | Contraseña (en dos pasos si el usuario tiene 2FA activo, exigencia definida por `roles.requiere_2fa`) o Google OAuth. Configuración del segundo factor (TOTP o código por correo) desde Configuración → Seguridad. En la **app móvil**: mismo login por contraseña + 2FA; login con Google en el código detrás de un flag (falta config); **bloqueo con huella / Face ID** opt-in (no reemplaza el login, es la llave para reabrir la app). Ver detalle completo en la sección 1 |
| Roles y permisos | ✅ Implementado (migraciones 71, 75) | Panel de Super-Admin → **Roles**: editar módulos / acciones sensibles / exigencia de 2FA de cada rol de sistema (salvo `admin`, no editable), crear roles custom, y marcar un rol como disponible solo para empresas puntuales. Los selectores de rol del dashboard (invitar, editar miembro, Nueva OS) leen los roles disponibles de la empresa vía `GET /api/usuarios/roles`. **Perfiles por empresa** (migración 75): Configuración → **Perfiles y permisos** (lo ve quien tiene `gestion_control`, de fábrica el Admin) — el Admin de cada empresa activa/desactiva módulos por rol **solo dentro de su empresa** (tabla `empresa_rol_modulos`, override sobre la plantilla global; no afecta a otras empresas). Delegables todos los módulos menos `configuracion` y `gestion_control`. El gating de plan sigue aplicando después. `roles.ts` resuelve con `modulosDeRol(slug, empresaId?)`. **El rol `colaborador` ahora trae `agenda` por defecto** (antes no veía nada en la web). Ver sección 1 |
| Acceso por correo/dominio | ✅ Implementado (migración 72) | Configuración → Grupo y usuario (admin de la empresa) y ficha de empresa en el Panel de Super-Admin: tarjeta "Correos y dominios autorizados" (agregar correo exacto o dominio + rol, quitar). Un correo autorizado entra sin invitación; uno desconocido que no se autorregistró queda denegado. Ver sección 1 |
| Remuneraciones (liquidaciones de sueldo — Chile) | ✅ Implementado — **opt-in por empresa** (`empresa_modulos` / Pro), lo enciende el Super-Admin | Migraciones 67-70. Cálculo de liquidaciones con legislación chilena: leyes sociales (AFP, salud Fonasa/Isapre, AFC), gratificación Art. 50 configurable, colación/movilización, impuesto único (tabla en UTM), asignación familiar opcional por empresa. Indicadores UF/UTM automáticos desde `mindicador.cl` (`backend/src/remuneraciones/parametros.ts`). Contratos indefinido y plazo fijo. Por período mensual y por colaborador (`datos_laborales` + `liquidaciones`, con snapshot del cálculo en `detalle` jsonb), historial y PDF (`generarPdfLiquidacion.ts`). Genera además el **archivo plano de Previred** y el **Libro de Remuneraciones Electrónico de la DT** para carga manual (borradores — `archivoPrevired.ts`, `libroRemuneracionesDT.ts`; **no** hay integración en tiempo real con Previred, no existe API sin convenio comercial). Pago de sueldos manual. Pantallas: `/dashboard/remuneraciones` (lista + generar), `/[id]` (detalle), `/datos-laborales`, `/parametros` |
| Agenda | ✅ Implementado (web + móvil) | Web: `/dashboard/agenda` — calendario mensual/día/semana que combina OS y `tareas` (eventos sin OS: recordatorios, visitas técnicas) en una sola vista; selector de Cliente/Responsable ahora vía `ComboboxCliente`/`ComboboxResponsable`. **App móvil**: pestaña "Agenda" (aparece si el rol ve el módulo `agenda` — se resuelve con `modulos_visibles` de `/api/me`); el colaborador ve **solo sus** tareas/citas agrupadas por día, puede **agendar una cita nueva** (`NuevaCitaScreen`: título, fecha con chips de los próximos 30 días —sin date-picker nativo—, hora, cliente, prioridad, notas; admin/supervisor además asignan responsable, el colaborador agenda siempre para sí mismo) y Confirmar / Marcar completada / Cancelar (por la cola offline; crear va directo, necesita el id). Backend: `GET /api/tareas/:id` nuevo; el colaborador en `POST /api/tareas` solo agenda para sí mismo, y en `PATCH /api/tareas/:id` y `POST /:id/cancelar` queda acotado a sus tareas y solo cambia el estado |
| Agenda Pro | ✅ Implementado — **opt-in por empresa** (`empresa_modulos`, desactivado por defecto, o incluido automático en plan Pro) | Catálogo de **servicios** (`servicios`: nombre, precio de lista, duración sugerida) y **tipos de pack** (`tipos_pack`: plantilla nombre + N sesiones + precio + vigencia + servicio asociado) — se administran desde la web (Configuración → Agenda Pro) **y desde la app** ("Servicios y packs" en la pestaña Más, crea y edita ambos; 6-sep). Paquetes de sesiones (`paquetes_sesiones` — un cliente compra un pack de N sesiones; el saldo restante **se calcula** a partir de las tareas del paquete, nunca se guarda como contador aparte) + citas que el cliente confirma o cancela desde el Portal. **Adicionales por reserva** (migración 94): `tareas.adicionales` jsonb `[{concepto, monto}]` — "valor agregado" que se suma al precio del servicio (el `precio` de la tarea no cambia de significado; total = precio + Σ montos). **Ventana de cancelación configurable** (`agenda_pro_config.ventana_cancelacion_horas`, default 24h): cancelar con tiempo suficiente marca `cancelada_anticipada` (no descuenta la sesión del paquete); cancelar tarde o no asistir marca `no_asistio` (sí descuenta) — antes ambos casos caían en el mismo `cancelada` genérico sin distinguir. **Reserva online pública** (`/agendar/[empresaId]`, sin cuenta ni login): el cliente elige horario disponible y queda una tarea con `origen = 'reserva_publica'`; horario único por empresa (`agenda_pro_horarios`) + `agenda_pro_config` (duración de slot, anticipación mínima/máxima, ventana de cancelación) |
| **Ventas — venta rápida** (nuevo, migración 95) | ✅ Implementado — **mobile únicamente**, sin pantalla de creación en la web | Una venta **siempre** nace de una cita o de una OS (hereda cliente y servicio, `origen_tipo`/`origen_id`) y queda **pagada al instante** — no genera un documento pendiente en `facturas`; el historial de dinero del cliente es la unión de `facturas` + `ventas` pagadas. Líneas mixtas por venta (`venta_lineas`, tabla `ventas`): tipo `servicio` / `producto` (descuenta stock de `catalogo_items` + `inventario_movimientos`) / `pack` (crea la fila en `paquetes_sesiones`, se cobra completo y después solo se consume). Precio de catálogo, de solo lectura salvo para perfiles con la acción `facturar`. Mobile: `RegistrarVentaScreen`; se ve también desde la ficha del cliente y desde Informes → Ventas (web, solo lectura/analítica) |
| Configuración | ✅ Implementado — ~14 submódulos | cuenta, empresa, plan, plantillas de documentos, checklists, tipos de OS, tipos de trabajo, integraciones, categorías de gasto, centros de costo, inventario (configurable), notificaciones, seguridad (alta de 2FA). "Grupo y usuario" (equipo): invitar/editar miembros con roles dinámicos, historial de cambios, y la lista de **correos/dominios autorizados** de la empresa |
| Registros (ex-"Cadastros") | ✅ Implementado | Clientes (ficha 360° con pestañas Historial/Equipos/Financiero, timeline único cronológico; `fecha_nacimiento` opcional para la felicitación de cumpleaños, ver Notificaciones más abajo), Equipos (incluye la categoría "Vehículo", ver nota de fusión abajo; ficha de detalle propia con plan de mantención e histórico; dashboard de métricas agregadas), Catálogo (con kits, etiquetado por tipo de equipo, sugerencias por rubro de la empresa), Inventario (**configurable por empresa**: en qué estado de la OS se descuenta, si se permite stock negativo, si se descuenta una sola vez por OS; dashboard de resumen; distingue movimientos manuales de automáticos), Proveedores |
| **Vehículos → Equipos (fusión)** | ✅ Completado | Vehículos dejó de ser módulo/tabla de primera clase — es una categoría dentro de Equipos (`equipos.categoria = 'Vehículo'`), con campos propios opcionales (`patente`, `anio`, `tipo_vehiculo`, `capacidad_carga`, visibles solo con esa categoría) y `equipos.cliente_id` ahora nullable (null = activo propio de la empresa, ej. flota). Los datos se migraron preservando el mismo `id` (migración 52) para que `documentos.entidad_id`, `vehiculo_asignaciones.equipo_id` y `viajes.equipo_id` (ambas columnas renombradas desde `vehiculo_id`) sigan resolviendo sin reescritura. La tabla `vehiculos` **sigue existiendo en la base de datos pero sin ningún código que la use** — se dejó a propósito por si hace falta rollback, se puede eliminar en una migración futura una vez confirmado en producción. Las pantallas `web/dashboard/flota/vehiculos/*` fueron borradas |
| Gestión de Colaboradores / Flota | ✅ Implementado | Colaboradores, Documentos con vencimiento (licencias, permisos de circulación, etc. — tipos de documento configurables por empresa, con sugerencias por rubro; alerta de "por vencer"). Vehículos ya no vive acá (ver fila de arriba) |
| **Mantención de flota** (nuevo, 9-sep) | ✅ Implementado | Tab "Mantención" en la ficha de un equipo `categoria='Vehículo'` (migraciones 96/97). Dos tipos: **"diario"** (chequeo del chofer antes de salir a ruta, checklist con secciones/preguntas de una plantilla fija) y **"programa"** (cada 250h/6 meses, taller externo o interno). Folio correlativo por empresa. **Registro inmutable una vez creado** (checklist/km/horas/firma — sin `UPDATE`/`DELETE` desde el backend, mismo criterio que las fotos de una OS firmada) salvo una excepción acotada: **las fotos de respaldo sí se pueden agregar/eliminar después** (`POST`/`DELETE /api/equipos/:equipoId/registros-mantencion/:id/fotos/:fotoId`). Regla opcional `MANTENCION_EXIGE_FOTO_EN_NO` (shared): un ítem en "No" exige foto para poder guardar. Deliberadamente **separado de `trabajos`/`ordenes_servicio`**: no requiere cliente y no dispara `cobro_automatico_al_firmar`. Web: tab + modal de detalle (checklist agrupado + galería). Mobile: `ChecklistMantencionScreen` (crear) + `MantencionDetalleScreen` (ver/agregar/eliminar fotos) |
| Órdenes de Servicio digitales | ✅ Implementado | Checklist, fotos (con análisis de IA por foto), firma del cliente, folio correlativo, PDF, selector de Equipo del cliente, descuento de inventario configurable. **Un solo vocabulario de estados (PASO 1, 6-sep)**: `EstadoOS` (pendiente/enviada/en_proceso/completada/firmada/**cancelada**) es lo único que se pinta en UI e informes; `trabajos.estado` quedó `@internal` y el backend lo sincroniza a `estado_os`. **Puente OS→Cobro (PASO 0)**: al finalizar/firmar, si `empresas.cobro_automatico_al_firmar` (default true) y el trabajo tiene monto, se crea una factura "pendiente" y se guarda en `ordenes_servicio.cobro_id`. **"Órdenes de servicio" en la web es una sola lista** (trabajos + OS) con filtro con/sin documento; `/dashboard/trabajos` es redirect. **PDF Fase 2 (migración 98, 9-11 sep)**: la galería de fotos del PDF se agrupa por **categoría** (`analisis_fotos.categoria`: equipo / Inicio / durante / Término — relabel de "antes/después", sin migración) con pie de foto, y hay **dos bloques de firma separados** (técnico + cliente, cada uno con nombre/documento). Solo desde mobile se puede hacer check-in/subir fotos/firmar — no existe ninguna vista web equivalente para el técnico (el admin/web solo crea la OS, ve el detalle, genera el Informe con IA y descarga el PDF) |
| Financiero | ✅ Implementado | Cotizaciones (ítems, IVA, "Convertir a OS", aprobar/rechazar por el cliente desde el Portal, estado "Expirado" ahora calculado y persistido de verdad —antes solo visual—, `ComboboxCliente`, Panel de Acciones reutilizable para estado/compartir/eliminar), Gastos (categoría/centro de costo/proveedor real, vínculo opcional a una OS, "Fecha de pago" condicional a Estado=Pagado, ficha de detalle propia), Cobros (ex-"Facturas": cliente real vía `ComboboxCliente`, ficha de detalle propia nueva con "Registrar Pago" —valor recibido, fecha, medio de pago, observaciones, sin pasarela real detrás—, Panel de Acciones compartido con Cotizaciones, medio de pago, link de pago **simulado**) |
| Informes | ✅ Implementado | 7 pestañas de analítica (Visión General, Financiero, Ventas, Operaciones, Servicios, Clientes, Gastos —unificada, con selector interno de agrupación: por categoría / centro de costo / orden de servicio—) + selector de período compartido + export CSV/PDF |
| Informe IA | ✅ Implementado | 3 modos: estructurado (tipo fijo), libre (texto+fotos), personalizado (secciones a elección + plantillas guardables) |
| Asistente conversacional | ✅ Implementado | Chat flotante (o panel fijo) con tool-use de Claude sobre datos reales del negocio, historial persistente por usuario. Además de las métricas agregadas por sección/período, tiene herramientas de **lectura** de agenda y de registros (`agenda`, `consultar_registros`) para responder consultas puntuales de la empresa |
| Viajes (transporte) | ✅ Implementado | Guías, km, IVA por viaje, resumen semanal/mensual, agrupar en factura; vinculado a `equipos` (antes `vehiculos`). **Fotos del viaje** (`viaje_fotos`, migración 95): el chofer sube fotos extra desde mobile (además de la foto de la guía); admin/supervisor puede editar un viaje **ya `confirmado`** (no solo `borrador`) — reasignar chofer, comentarios/incidentes (campo `comentarios` reutilizado), subir/eliminar esas fotos (`POST`/`DELETE /api/viajes/:id/fotos/:fotoId` desde la web, `.../mis-viajes/...` desde mobile) — bloqueado solo si el viaje ya está `facturado` |
| Notificaciones al Cliente + Portal de Cliente | ✅ Implementado | Avisos automáticos al cliente (cotización enviada/por vencer, técnico en camino, OS completada, cobro pendiente/vencido, cita agendada, **cumpleaños del cliente** — nuevo, ver abajo) por **correo** (mensaje y asunto personalizables por tipo, switch on/off por tipo, con indicador de progreso "N de M completados" sobre los 3 campos editables de cada una de las 6 categorías de mensaje) y por **WhatsApp** (segundo canal genérico, interruptor maestro único `whatsapp_activado` para los 8 tipos), historial de envíos con reintento manual. El correo incluye un link temporal (`portal_accesos`) a un Portal de Cliente propio (`/portal/*`, sin cuenta de Bitácora, login recurrente por código de 6 dígitos) donde el cliente ve/descarga OS y cotizaciones en PDF, aprueba/rechaza cotizaciones, confirma/cancela citas de Agenda Pro y revisa sus cobros. **Configurable desde el dashboard (PASO 5, 6-sep)**: `/dashboard/portal-cliente` (grupo CLIENTES) — link para compartir (`<web>/portal/login`, genérico: el cliente entra por RUT + código), previsualización en iframe, y 4 interruptores de secciones (`empresas.portal_muestra_{ordenes,citas,cotizaciones,cobros}`, default true). El backend del portal aplica un middleware `requiereSeccion()` que devuelve 403 en las rutas `/api/portal/datos/*` de una sección apagada; `GET /api/portal/config` (solo `requierePortal`) expone los flags; `PortalShell` oculta las pestañas y las páginas redirigen a `/portal` ante 403. **Cumpleaños del cliente** (nuevo): `clientes.fecha_nacimiento` opcional; sin cron en el proyecto, se revisa con un chequeo perezoso enganchado en `GET /api/me` (`backend/src/cumpleanosClientes.ts`) en vez de una pantalla puntual — cualquier navegación del dashboard, de cualquier rol, lo dispara, para maximizar la chance de que corra el día justo aunque nadie abra Clientes ese día; dedupe contra `notificaciones_cliente_log` (no reenvía si ya hubo un envío exitoso en los últimos 350 días). Incluye un % de descuento opcional (10/15/20 o ninguno, `notificaciones_config.cliente_cumpleanos_descuento_pct`) mencionado como texto informativo en el correo — **nunca se calcula ni se aplica ningún descuento en la app**, la empresa lo honra a mano cuando el cliente vuelve; no existe ningún sistema de cupones/descuentos real en el proyecto |
| Sugerencias iniciales por rubro | ✅ Implementado — mecanismo genérico, contenido parcial | Tabla de referencia `sugerencias_rubro` (sin `empresa_id`, global) mapea `empresas.rubro` a sugerencias de categorías de gasto/catálogo, tipos de OS y tipos de documento — reemplaza 4 listas hardcodeadas que vivían repetidas en otras tantas pantallas. **Solo hay contenido cargado para `rubro='transporte'`** (2-3 sugerencias por tipo); para `servicio_tecnico`/`otro` la tabla no tiene filas todavía — decisión de producto pendiente, no técnica. Las pantallas anteponen las sugerencias del rubro a su lista genérica anterior sin ocultarla, así que una empresa sin contenido cargado no pierde nada |
| Suscripción y autogestión de plan (Bitácora cobrándole a sus empresas clientes) | ✅ Implementado — probado en **sandbox real de Flow**, no en producción | Configuración → Plan: registro de tarjeta vía Flow/Webpay Oneclick (nunca pasa por el backend propio), 21 días de trial, suscripción mensual automática, historial de cobros, cancelación self-service. **Autogestión de tier**: Trial/Básico/Pro elegibles desde la misma pantalla — Pro = Básico + todos los módulos opcionales (`MODULOS_OPCIONALES`), cobra distinto vía dos Planes de Flow separados (`FLOW_PLAN_ID_BASICO`/`FLOW_PLAN_ID_PRO`); cada cambio de plan queda en `empresa_plan_historial`. El Plan Pro de Flow todavía no está creado en el panel de Flow — el botón de pasar a Pro queda bloqueado con aviso. **Los tres planes ahora difieren de verdad** (antes eran casi idénticos salvo Agenda Pro), en tres ejes: (1) **Informe con IA y Asistente pasaron a ser módulos exclusivos de Pro** (se sumaron a `MODULOS_OPCIONALES`, con backfill para empresas existentes); (2) **límites de uso reales por plan** — usuarios, OS/mes, storage (GB), tokens de IA/mes (`LIMITES_POR_PLAN` en `packages/shared/src/limites.ts`, enforcement en `backend/src/limites.ts` vía `LimiteAlcanzadoError` 403; storage usa un contador aproximado incremental, no un escaneo de S3 en cada request); (3) **trial vencido bloquea la app entera** salvo `/api/plan*`/`/api/suscripcion*` hasta elegir un plan pago (`empresas.plan` sigue en `'trial'` si nunca se confirmó una tarjeta), con redirect proactivo del frontend. Los números de `LIMITES_POR_PLAN` son una propuesta inicial (freno anti-abuso, no de costo — el costo real de IA/storage es marginal frente al precio del plan) fácil de ajustar en un solo lugar. Panel de Super-Admin ve estado de suscripción por empresa. Gotcha real encontrado y corregido probando contra el sandbox: Flow **no** agrega `?token=` a la URL de retorno tras registrar la tarjeta — el backend revisa de forma perezosa (`GET /api/suscripcion`) si hay un customer de Flow sin tarjeta confirmada todavía. Ver sección 8 para lo que falta antes de producción |
| Panel de Super-Administrador | ✅ Implementado — reservado al dueño del producto, fuera del alcance de cualquier usuario de empresa | `/superadmin/*`, identidad y auth 100% separadas (ver sección 1). Por empresa: activar/suspender/dar de baja (bloquea el acceso completo salvo `/api/me`, para poder mostrar el motivo), cambiar plan (queda en `empresa_plan_historial` con origen `super_admin`), crear empresas y editar nombre/RUT, exportar todos sus datos como descarga de archivo (nunca se renderiza en el panel), eliminar permanentemente (confirmación por nombre exacto), activar/desactivar módulos contratados. **Roles** (nav propia `/superadmin/roles`): CRUD de la tabla `roles` — editar módulos/acciones/2FA de cada rol, crear roles custom, restringir un rol a empresas puntuales (ver sección 1). **Correos y dominios autorizados** (tarjeta en la ficha de empresa): agregar/quitar correos exactos o dominios con su rol (ver sección 1). **Gestión de acceso de usuarios de una empresa** (tarjeta "Equipo" en la ficha): **invitar un usuario nuevo** a esa empresa (rol validado contra los disponibles de la empresa; **no** aplica el límite de usuarios del plan porque es acción de plataforma; auditado como `invitar_usuario_empresa`), restablecer la contraseña de un usuario (clave temporal random, se muestra una sola vez, vía `supabase.auth.admin.updateUserById`), y activar/desactivar/regenerar su 2FA por TOTP (genera un secreto nuevo y lo entrega una sola vez — mismo mecanismo que el alta normal en `backend/src/routes/mfa.ts`, pero disparado por el Super-Admin; sirve también para re-asociar la app de autenticación de alguien que ya tenía 2FA activo y perdió el celular). **"Mi cuenta"** (`/superadmin/cuenta`, nuevo): el propio super-admin cambia su contraseña o regenera su TOTP (secreto mostrado una sola vez); toda mutación exige reautenticarse en el momento con contraseña actual + código TOTP (endpoints `GET /api/superadmin/me`, `POST /me/cambiar-password`, `POST /me/regenerar-totp`; auditado). Salud por empresa: última actividad, usuarios activos del mes, OS creadas del mes, uso de storage, consumo de Claude del mes por feature, últimos errores de backend. **Gotcha conocido al crear empresa/invitar:** `supabase.auth.admin.generateLink({ type: "invite" })` falla si el correo ya existe en `auth.users`, y el panel muestra un mensaje engañoso ("Verifica que el correo sea válido") — workaround: usar un correo que no exista todavía |
| Bot de WhatsApp | ⚠️ Código completo, probado en dev, **no activo en producción** | Falta que el cliente conecte una cuenta real de Meta Business (`WHATSAPP_ACCESS_TOKEN` y afines sin configurar). Además del canal de notificaciones al cliente, tiene un **flujo conversacional para que un chofer registre un Viaje** ("nuevo viaje" / "hola" dispara el paso a paso; incluye subir la foto de la guía, que se guarda con el número de guía como nombre — **sin OCR**; el código de OCR quedó pero apagado tras `WHATSAPP_OCR_GUIA_ACTIVO`; opción de re-subir la foto). El chofer se identifica por su teléfono (`usuarios.telefono`, match tolerante por los últimos 8 dígitos). El viaje queda en estado `borrador` para que la oficina lo revise |
| App móvil (Expo) | ⚠️ Arquitectura completa + auditoría aplicada + 4 pestañas fijas (PASO 3) + APK 1.9.8/vc25 probado en dispositivo real, contra producción; **falta piloto real** | **Elegir foto de galería + eliminar, en TODAS las pantallas que suben fotos** (9-11 sep, pedido real de la usuaria): selector único `elegirFotos()` (`lib/imagen.ts`, Alert "Tomar foto / Elegir de galería / Cancelar") — antes solo la pantalla de fotos de OS ofrecía galería, las otras 5 (mantención ×2, viajes ×2, gastos) eran cámara-only; las que no tenían forma de eliminar una foto ya adjunta la ganaron (miniaturas reales en el checklist de mantención, que antes solo mostraba un chip de texto). **Dos bugs reales de sync corregidos probando en prod** (no en simulador): un `fetch` de `FormData` no se puede abortar de verdad en RN — el timeout manual "ganaba" pero el fetch original seguía viajando, y un reintento automático apilaba una subida concurrente de la MISMA foto ("se quedó sincronizando" sin crear el registro); el primer fix tenía una regresión (bloqueaba "Reintentar ahora" 90s tras cualquier fallo, no solo uno realmente en vuelo) — corregido con dos campos en `AccionPendiente` (`ultimoIntentoEn`/`intentoEnVuelo`) y `TIMEOUT_MULTIPART_MS=90s` compartido. `mobile/src/`: React Navigation v7. **4 pestañas IGUALES para todos los roles (PASO 3, 6-sep): Hoy · Agenda · Clientes · Más** — se eliminó `tabsPara()`. **Hoy** (nueva): lista cronológica del día (trabajos+citas+viajes), interruptor Lista/Ruta, toggle Míos/Equipo para gestión, botón Asistente en la cabecera. **Clientes** visible a todos (colaborador en solo lectura). **Más** absorbe Gestión (Cobros/Gasto/Informes/Asistente) + Perfil/cola de sync + las listas completas de Trabajos/Viajes + "Servicios y packs" (catálogo Agenda Pro editable). Cola de sync offline, check-in geolocalizado. **Auditoría de producto pre-piloto aplicada (sept-2026)**: identidad real (nombre "Bitácora", `package`/`bundleIdentifier` `cl.transportesitineris.bitacora`, íconos desde el LogoMark de la web, splash de marca); español chileno neutro; cola offline que ya **no descarta acciones en silencio** (quedan "fallidas", se reintentan/descartan desde Perfil); feedback real en "Finalizar trabajo" y fotos optimistas; selector con búsqueda en modal; paleta alineada a `globals.css`; targets ≥44px; roles dinámicos (`rol_exige_2fa` de `/api/me`); firma en modal a pantalla completa; "Cómo llegar" + "Llamar". **EAS**: proyecto `@cpquiroz/bitacora`, `mobile/eas.json` con 3 perfiles; `preview` = APK interno apuntando a **producción**. Android no requiere cuenta paga; iOS sí (Apple Developer). **Resiliencia login**: `apiJson` reintenta 2× ante red/timeout/5xx (Render plan gratis se duerme a los ~15 min), aviso "puede tardar" a los 4s, y `.github/workflows/keep-warm.yml` le pega a `/health` cada 10 min. **Agenda** (ver + agendar citas, sección Agenda arriba). **Bloqueo con huella / Face ID** (`expo-local-authentication`): opt-in desde Perfil; `BloqueoBiometrico` tapa la app al arrancar en frío y al volver de segundo plano tras 60s; sin sesión nunca bloquea; la sesión sigue guardada, la biometría es solo la llave. **Login con Google** en el código (PKCE, ver sección 1) detrás de `EXPO_PUBLIC_GOOGLE_LOGIN`. **`expo-maps` se quitó** — en Android crasheaba nativamente sin Google Maps API key y el crash tumbaba la app al iniciar sesión (un colaborador de empresa de rubro transporte sin módulo Viajes caía por defecto en la pestaña Ruta = el mapa); `MapaRuta` ahora es un panel simple, la lista de paradas y "abrir navegación" siguen. **Fix "Foto de la guía" (5-6 sep)**: las fotos vivían solo en `cache/` y el SO las borraba antes de que la cola de sync las subiera → nunca llegaban y los reintentos manuales no servían. Se agregó `expo-file-system`; `comprimirImagen()` mueve el resultado a `document/fotos-cola/` (persistente); la cola detecta el archivo ausente y falla con mensaje claro; `reintentar()` reinicia `creadoEn`; el `catch` guarda el error real. **Fix caché**: colisión de clave `trabajos:equipo` (usuarios vs trabajos) → `trabajos:usuarios`; `cerrarSesion()` ahora limpia `cache:*`. **Build**: se agotó la cuota de EAS Free (reset 1-oct); el APK se compila **local** (`expo prebuild` + `./gradlew assembleRelease`, toolchain Android en la Mac vía Homebrew) firmado con el keystore de **debug** — no actualiza encima de un APK de EAS (firmas distintas, hay que desinstalar). Gotcha: el build local usa `mobile/.env` (localhost); para un APK de prod hay que sobrescribir `.env` con los valores de `eas.json` antes del `gradlew`, y el SDK de Android vive en `/opt/homebrew/share/android-commandlinetools` (cask de brew, no `~/Library/Android/sdk`). Versión actual: **1.9.8 / vc25**. **Pendiente**: piloto con choferes reales; Sentry en el móvil (plugin incompatible con SDK 57); build de producción/`.aab` para Play Store; que el usuario configure el login con Google |
| Integraciones de pago para Cobros del cliente final (Webpay/Flow/Mercado Pago) | ⚠️ Solo simulado | La UI permite "conectar" y guarda un toggle `conectado`, pero el link de pago generado es **`linkSimulado`** — no hay integración real con ninguna pasarela. **No confundir con la Suscripción/Plan B2B de arriba**: son dos integraciones de Flow completamente distintas |
| Google Document AI | ❌ No implementado | Existe como opción seleccionable en Configuración → Integraciones (nombre, descripción, campos) pero **ningún código del backend la usa** — es un placeholder en la UI |
| Anthropic como "integración" | ⚠️ Ya no aparece en la UI de Integraciones (se ocultó esa card) | El backend **siempre** usa la key global `ANTHROPIC_API_KEY` del `.env` — no es configurable por empresa. Sí queda instrumentado por-empresa a nivel de *medición* (tabla `ia_uso`, visible en la salud del Panel de Super-Admin) |

## 5. Modelo de datos

Esquema real (consultado en vivo, dev, 12-sep-2026: **87 tablas** —84 + `levantamientos`/
`levantamiento_materiales`/`levantamiento_fotos`—, **100 migraciones** —prod tiene 1-99
aplicadas y trackeadas, la 100 pendiente—).
**Las 84 tienen RLS activo** — 61 con policy de tenant real (`empresa_id =
empresa_actual()`, código vivo si algún día un cliente consulta con anon key), 23 como
cerrojo deny-all (ver la fila "Multi-tenant" de la sección 1). No son tablas de tenant
(estas 23 + `empresas` misma):
- `empresas` misma,
- `whatsapp_mensajes_procesados`, `whatsapp_conversaciones` (estado del bot / dedup, sin `empresa_id`),
- `notificaciones_preferencias` (se acota por `usuario_id`),
- `super_admins`, `super_admin_auditoria`, `superadmin_metricas_cache` (plataforma, fuera de tenancy),
- `roles`, `rol_empresas` (catálogo global de roles + su disponibilidad por empresa — migración 71),
- `empresa_accesos_autorizados`, `empresa_feature_flags`, `empresa_modulos`, `empresa_rol_modulos` (config por empresa, la escribe solo el backend / el Super-Admin / el Admin de la empresa),
- `mfa_totp_secretos`, `mfa_codigo_pendiente`, `login_2fa_pendiente` (2FA de usuario, acotadas por `usuario_id`),
- `parametros_previsionales`, `afp_parametros`, `asignacion_familiar_tramos` (parámetros de Remuneraciones, referencia),
- `sugerencias_rubro` (data de referencia global por rubro),
- `errores_backend`, `ia_uso` (observabilidad).

**Todas esas tablas "no-tenant" ahora tienen RLS activo como cerrojo (deny-all, sin políticas) + grants de `anon`/`authenticated` revocados** (migración 73; `empresa_rol_modulos` lo trae de fábrica en la 75) — antes quedaban expuestas a la anon key vía PostgREST. Solo la service role del backend las alcanza.

`super_admin_auditoria` sí tiene `empresa_id`, pero **nullable** con `on delete set null` — una acción de auditoría sobre una empresa que después se elimina no debe desaparecer, solo perder la referencia (el nombre de la empresa queda igual en el texto del detalle).

| Dominio | Tablas | Relaciones clave |
|---|---|---|
| Núcleo / tenancy | `empresas`, `usuarios` | `usuarios.empresa_id → empresas`; `usuarios.id → auth.users` (Supabase Auth). `empresas.storage_bytes_usado` — contador aproximado incremental para el límite de plan. **Nuevos flags booleanos en `empresas`** (6-sep): `cobro_automatico_al_firmar` (default true, migración 91 — puente OS→Cobro); `portal_muestra_ordenes` / `_citas` / `_cotizaciones` / `_cobros` (default true, migración 93 — qué secciones ve el cliente en el portal) |
| 2FA de usuario | `mfa_totp_secretos`, `mfa_codigo_pendiente`, `login_2fa_pendiente` | Todas `usuario_id → usuarios`, sin `empresa_id`; RLS deny-all desde migración 73. `login_2fa_pendiente` guarda los tokens de Supabase ya válidos, cifrados, hasta confirmar el segundo factor |
| Auditoría de cuenta y accesos | `accesos_usuario`, `auditoria_usuarios` | `accesos_usuario` (ip, user_agent por login); `auditoria_usuarios` (campo/valor_anterior/valor_nuevo, quién lo hizo) — ambas con `empresa_id` |
| Clientes y activos | `clientes`, `equipos` | `equipos.cliente_id → clientes`, **ahora nullable** (null = activo propio de la empresa, ej. flota de vehículos — ver sección 4). `equipos` también absorbe los campos de vehículo (`patente`, `anio`, `tipo_vehiculo`, `capacidad_carga`) cuando `categoria='Vehículo'`. `clientes.fecha_nacimiento` (nuevo, opcional) — felicitación de cumpleaños, ver sección 4 |
| Trabajo genérico (OS/OT) | `trabajos`, `tipos_trabajo`, `tipos_os`, `ordenes_servicio`, `os_items`, `checklist_templates`, `analisis_fotos`, `planes_mantencion` | `trabajos.tipo_trabajo_id/tipo_os_id/responsable_id/ruta_id/cliente_id/equipo_id`; `ordenes_servicio.trabajo_id`; `analisis_fotos.orden_servicio_id`; `os_items.catalogo_item_id → catalogo_items` (nullable); `planes_mantencion.equipo_id → equipos` (plan de mantención preventiva). `ordenes_servicio.pdf_url` — caché del PDF, se llena recién al quedar firmada. `ordenes_servicio.cobro_id → facturas` (nullable, `on delete set null`, migración 91 — puente OS→Cobro). `ordenes_servicio.estado_os` ahora incluye `cancelada` (migración 92); `trabajos.estado` (`EstadoTrabajo`) quedó marcado `@internal` en `types.ts` — el backend lo sincroniza a `estado_os` y toda la UI/informes miran `estado_os` |
| Agenda | `servicios`, `tipos_pack`, `tareas`, `paquetes_sesiones`, `agenda_pro_config`, `agenda_pro_horarios` | `servicios` (catálogo Agenda Pro: nombre, precio, duración sugerida, activo) y `tipos_pack` (plantilla: nombre, cantidad_sesiones, precio, `servicio_id` nullable, `vigencia_dias` nullable) — editables desde web y app. `tareas.cliente_id → clientes`, `.responsable_id → usuarios`, `.servicio_id → servicios` (nullable), `.paquete_id → paquetes_sesiones` (nullable), `.origen` ('manual'\|'reserva_publica'), `.estado` incluye `no_asistio`/`cancelada_anticipada`, `.precio` (nullable), **`.adicionales` jsonb `not null default '[]'` (migración 94)** = `[{concepto, monto}]`, "valor agregado" que se suma al precio; `paquetes_sesiones.cliente_id → clientes` — saldo de sesiones siempre calculado; `agenda_pro_config` (incluye `ventana_cancelacion_horas`) / `agenda_pro_horarios` — reserva online pública |
| Transporte | `viajes`, `viaje_fotos` | `viajes.cliente_id`, `.chofer_id → usuarios`, `.equipo_id → equipos` (antes `.vehiculo_id → vehiculos`), `.factura_id → facturas`. `viaje_fotos.viaje_id → viajes` (migración 95) — fotos extra subidas por el chofer, además de `viajes.foto_guia_url` |
| **Mantención de flota** (nuevo) | `registros_mantencion_equipo`, `registro_mantencion_fotos` | `registros_mantencion_equipo.equipo_id → equipos`, `.proveedor_id → proveedores` (nullable, solo externo), `.realizado_por → usuarios` (nullable); `checklist` jsonb (`[{seccion,item,respuesta}]`); `folio` correlativo por empresa (`empresas.siguiente_folio_mantencion`); **inmutable tras crear** salvo sus fotos. `registro_mantencion_fotos.registro_id → registros_mantencion_equipo`, `.item` (nullable — a qué pregunta del checklist corresponde, si aplica) |
| **Ventas — venta rápida** (nuevo) | `ventas`, `venta_lineas` | `ventas.cliente_id → clientes`; `.origen_tipo` (`cita`\|`os`) + `.origen_id` (polimórfico, sin FK — apunta a `tareas.id` o `trabajos.id` según el tipo); `.medio_pago`, `.estado` (`pagada`\|`anulada`). `venta_lineas.venta_id → ventas`; `.tipo` (`servicio`\|`producto`\|`pack`) + `.referencia_id` (polimórfico: `servicios.id` \| `catalogo_items.id` \| `tipos_pack.id`, sin FK) |
| Catálogo / inventario | `catalogo_items`, `catalogo_item_tipos_equipo`, `catalogo_kit_items`, `unidades_medida`, `inventario` (legacy, sin uso), `inventario_movimientos` | `catalogo_kit_items` relaciona kit↔item (self-referencia); `catalogo_item_tipos_equipo` (m2m, texto libre) etiqueta ítems por tipo de equipo; `inventario_movimientos.origen` ('manual'\|'automatico') distingue ajustes manuales de descuentos automáticos por OS; `unidades_medida` — catálogo de unidades por empresa |
| Financiero | `presupuestos` (cotizaciones), `presupuesto_items`, `facturas` (Cobros, incluye `valor_recibido`/`observaciones_pago` de "Registrar Pago"), `gastos` (incluye `trabajo_id` opcional y `fecha_pago`), `gastos_fijos`, `categorias_gasto`, `centros_costo`, `proveedores` | `presupuestos.trabajo_id` (conversión a OS), `.estado` incluye `expirado` (ahora calculado, no solo visual); `facturas.viaje_ids`/`trabajo_ids` (arrays, agrupan varios en una factura) |
| Rutas | `rutas_planificadas` | `.responsable_id → usuarios` |
| Flota | `documentos`, `tipos_documento`, `vehiculo_asignaciones`, `vehiculos` (huérfana, ver sección 4) | `documentos.entidad_tipo` ('colaborador'\|'vehiculo') + `entidad_id` (polimórfico, sigue apuntando a `equipos.id` cuando es 'vehiculo'); `vehiculo_asignaciones.equipo_id → equipos` (antes `.vehiculo_id → vehiculos`); `vehiculos` sigue en la base pero sin ningún código que la use |
| IA / informes | `informes_generados`, `informes_personalizados`, `asistente_mensajes`, `ia_uso` | `informes_generados.personalizado_id → informes_personalizados`; `ia_uso` registra tokens por feature para la salud del Super-Admin |
| Notificaciones internas | `notificaciones`, `notificaciones_preferencias` | Feed de campana en el dashboard — distinto del correo al cliente |
| Notificaciones al cliente + Portal | `notificaciones_config`, `mensajes_personalizados`, `notificaciones_cliente_log`, `portal_accesos`, `portal_codigos` | `portal_accesos` genera el link temporal (7 días) que llega en el correo; `portal_codigos` es el login recurrente de 6 dígitos, hasheado, 10 min. `notificaciones_config.cliente_cumpleanos`/`cliente_cumpleanos_descuento_pct` (nuevos) — toggle del aviso de cumpleaños y el % informativo a mencionar (10/15/20/ninguno) |
| Sugerencias por rubro | `sugerencias_rubro` | Sin `empresa_id` — data de referencia global filtrada por `empresas.rubro` en el backend; RLS deny-all desde migración 73 (ver sección 4) |
| Config / personalización | `integraciones`, `plantillas_documento`, `empresa_modulos`, `empresa_feature_flags` | `empresa_modulos` (empresa_id, modulo, activado) — qué módulos están contratados; `empresa_feature_flags` — features en beta prendidas por empresa desde el Panel |
| Roles y acceso | `roles`, `rol_empresas`, `empresa_rol_modulos`, `empresa_accesos_autorizados` | `roles` (slug PK, `nombre`, `modulos[]`, `acciones[]`, `requiere_2fa`, `es_sistema`, `orden`) — catálogo editable global; `rol_empresas` (rol_slug, empresa_id) — un rol con filas acá solo está disponible para esas empresas; `empresa_rol_modulos` (empresa_id, rol_slug, modulo, activado) — override por empresa de qué módulos ve un rol dentro de esa empresa (migración 75), lo edita el Admin en Configuración → Perfiles; `empresa_accesos_autorizados` (empresa_id, tipo `correo`\|`dominio`, valor, rol) — correos/dominios que entran sin invitación. `usuarios.rol` = el `slug` (texto libre, sin FK) |
| Remuneraciones (Chile) | `parametros_previsionales`, `afp_parametros`, `asignacion_familiar_tramos`, `datos_laborales`, `liquidaciones` | `parametros_previsionales` (por período: UF, UTM, topes, tramos de impuesto, gratificación); `afp_parametros` (tasa + comisión por AFP); `datos_laborales.usuario_id → usuarios` (sueldo base, tipo de contrato, AFP, Fonasa/Isapre, RUT, apellidos, cargas); `liquidaciones` (por período+colaborador, con `detalle` jsonb = snapshot completo del cálculo, estado borrador/emitida) |
| Suscripción y plan B2B (Bitácora → empresa cliente) | `suscripciones`, `suscripcion_cobros`, `empresa_plan_historial` | `suscripciones` (PK `empresa_id`) guarda `flow_customer_id`/`flow_subscription_id`/últimos 4 dígitos y estado (`trial`\|`activa`\|`pago_pendiente`\|`suspendida_por_pago`\|`cancelada`); `suscripcion_cobros.empresa_id → empresas`; `empresa_plan_historial` — cada cambio de plan (trial/básico/pro), quién lo hizo y si tenía cobro conectado |
| Super-Admin | `super_admins`, `super_admin_auditoria` | Identidad y auditoría fuera del modelo de tenancy normal — ver nota arriba |
| Observabilidad | `errores_backend` | Todo error no controlado de cualquier ruta cae acá vía el handler global de `server.ts` |
| Bot WhatsApp | `whatsapp_mensajes_procesados` | Sin `empresa_id` — solo dedup de mensajes por `id` de Meta |

## 6. Integraciones configuradas

| Servicio | Estado | Dónde vive | Notas |
|---|---|---|---|
| Anthropic Claude API | ✅ Real, funcionando | `backend/src/claude.ts`, key en `ANTHROPIC_API_KEY` (env) | Global para todo el backend, no por empresa; ya no aparece como card en la UI de Integraciones (se ocultó) |
| Supabase (DB + Auth + Storage) | ✅ Real, funcionando | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (env) | Proyectos separados prod (`yjbskbskyadxjooxngjv`) y dev (`pruwvpnlvrvgtmpetlsr`). Login con Google requiere crear el cliente OAuth en Google Cloud + habilitar el proveedor en Supabase Auth de **ambos** proyectos (paso manual, sin costo, ver sección 1) |
| mindicador.cl (indicadores económicos CL) | ✅ Real, funcionando | `backend/src/remuneraciones/parametros.ts` — `GET https://mindicador.cl/api` | API pública gratuita sin key. Trae UF y UTM del día para el cálculo de liquidaciones. No entrega sueldo mínimo (ese va como constante/seed) |
| Storage S3-compatible | ✅ Real, funcionando | `STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` (env) — apunta al S3 de Supabase Storage | Diseñado para portar a Cloud Storage cambiando solo env vars |
| WhatsApp Cloud API (bot de choferes) | ⚠️ Código listo, sin credenciales reales | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (env, todas `[SIN_CONFIGURAR]` hoy) | Requiere que el cliente cree una cuenta de Meta Business |
| Resend (email) | ✅ Real en producción (dominio propio verificado) | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (env) | En **producción** un envío fallido lanza y hace rollback del flujo (crear empresa, invitar, reset de contraseña, 2FA por correo); **fuera de producción** escribe el correo en la consola del backend y sigue |
| Webpay / Flow / Mercado Pago (Cobros a cliente final) | ❌ Simulado | Tabla `integraciones` + `backend/src/routes/cobros.ts` | Genera un link de pago falso (`linkSimulado`), sin conexión real a ninguna pasarela — **distinto** de la fila de abajo |
| Flow (Suscripción/Plan B2B — Bitácora cobra a la empresa cliente) | ✅ Real, probado en **sandbox**, sin credenciales de producción | `backend/src/flow.ts` (cliente HTTP delgado, firma HMAC-SHA256 propia), `FLOW_API_KEY`/`FLOW_SECRET_KEY`/`FLOW_API_URL`/`FLOW_PLAN_ID_BASICO`/`FLOW_PLAN_ID_PRO` (env) | Dos Planes separados ahora (antes uno solo) porque Básico y Pro cobran distinto — se crean a mano en el panel web de Flow, no existe `plan/create` en su API. El Plan Pro **todavía no está creado** en el panel de Flow (ni en sandbox ni en producción) — el botón de pasar a Pro queda bloqueado con aviso. Falta: crear ambos Planes en el panel de **producción** (hoy solo existen en sandbox) y confirmar un ciclo de cobro real de principio a fin tras el trial de 21 días |
| Google Document AI | ❌ No implementado | Solo definido en `backend/src/routes/integraciones.ts` | Placeholder de UI, cero lógica de backend |
| Sentry (reporte de errores) | ⚠️ Código listo en el backend, sin DSN configurado | `backend/src/instrument.ts` (importado primero en `server.ts`), `SENTRY_DSN`/`SENTRY_ENVIRONMENT` (env) | Sin `SENTRY_DSN` el SDK es no-op. Los 5xx del handler global van a Sentry además de a `errores_backend`. En el móvil el plugin no compila con Expo SDK 57 (pendiente) |

*(Ningún valor real de credencial está en este documento — todos son nombres de variable de entorno.)*

## 7. Decisiones técnicas ya tomadas (no estaban en el prompt original)

- **Sin ORM:** el prompt original no especificaba uno; se optó por `supabase-js` directo + tipado manual centralizado en `packages/shared/src/types.ts`, en vez de Prisma/Drizzle.
- **Sin librería de componentes UI:** design system propio sobre Tailwind v4 (`ui.tsx`) en vez de shadcn/Radix — decisión tomada para tener control total del theming por-empresa.
- **PDF con `pdfkit` puro**, no un motor de plantillas HTML→PDF (Puppeteer, react-pdf) — más liviano, sin dependencia de un navegador headless en el backend.
- **Recharts** para gráficos, **Leaflet** para mapas de rutas (no elegidos en el prompt original; Leaflet evita costo de API key de mapas).
- **`viajes` volvió a existir** (migración 25) después de haber sido generalizada a `trabajos` en la migración 04 original — ahora con un propósito distinto y acotado (guías de despacho de transporte), coexistiendo con `trabajos` para el resto de rubros.
- **Bot de WhatsApp construido sobre la Cloud API de Meta directa** (no un BSP como Twilio/360dialog) — sin costo de intermediario, pero requiere que el cliente gestione su propia cuenta de Meta Business.
- **Terminología "Órdenes de Trabajo/Servicio"** (en vez de solo "Órdenes de Servicio") en toda la UI — para cubrir que distintas empresas usan uno u otro término.
- **Panel de Super-Administrador no estaba en el prompt original** — se sumó como necesidad real de operar el negocio. Identidad separada de Supabase Auth en vez de "un rol admin más alto" — para que ni un bug de permisos ni una fuga de un token de usuario normal puedan escalar a control total de la plataforma.
- **RLS y el filtrado manual por `empresa_id` son complementarios, no una alternativa al otro** — no es que se haya "evaluado RLS y descartado": las **84 tablas del schema `public` tienen RLS activo** (verificado en vivo, 11-sep-2026), 61 con policy de tenant real. Lo que sí es cierto es que, **para el tráfico real de hoy**, esa policy de tenant es código en espera (no vivo) porque el backend consulta con la service role key, que bypassea RLS — la barrera efectiva hoy es la disciplina de `.eq("empresa_id", ...)` + el script de auditoría (ver sección 1). RLS igual se mantiene activo en todas las tablas como defensa en profundidad a futuro (si algún día un cliente consulta con anon key) y, para las tablas **solo-backend**, como cerrojo real ya usado en un incidente concreto (migración 73 — ver abajo).
- **Módulos opt-in por empresa** (`empresa_modulos`) en vez de una tabla de "planes con features fijas" — permite prender una funcionalidad puntual sin definir un plan comercial nuevo. Ahora conectado a la autogestión de plan: Pro = Básico + todos los opcionales, derivado de lo que ya existía en vez de inventar una tabla nueva de reglas.
- **Saldo de paquetes de sesiones (Agenda Pro) es siempre calculado, nunca una columna con contador** — mismo criterio ya usado para "estado de documento" en Flota.
- **Confirmar/cancelar cita desde el Portal reutiliza el mecanismo de aprobar/rechazar cotización tal cual** — no se construyó un sistema nuevo. La ventana de cancelación (nueva) se apoya en el mismo camino, solo agrega el chequeo de `ventana_cancelacion_horas` para decidir entre `no_asistio`/`cancelada_anticipada`.
- **2FA con secreto/tokens en tablas separadas de `usuarios`, nunca como columna** — porque `GET /api/usuarios` (y otras rutas) devuelven `usuarios.*` completo a cualquier miembro de la empresa; un secreto ahí (aunque cifrado) quedaría expuesto en esa respuesta. Mismo criterio que ya se usaba para separar `super_admins` del resto del modelo.
- **Login por contraseña dejó de ser `signInWithPassword` directo del cliente** — pasa por un endpoint propio (`POST /api/auth/login`) para poder interponer el segundo factor antes de entregar una sesión válida; Google OAuth es la excepción, es un flujo de Supabase directo porque Supabase MFA nativo no soporta un factor "email" y forzar TOTP-only para Google hubiera sido inconsistente con el resto.
- **Fusión Vehículos→Equipos preservando los mismos `id`** (en vez de crear equipos nuevos y reapuntar todas las FKs fila por fila) — más simple y menos riesgoso, la tabla vieja se dejó existiendo sin uso por si hace falta rollback en vez de borrarla en el mismo cambio.
- **Sugerencias por rubro como tabla de referencia genérica** (`sugerencias_rubro`, sin `empresa_id`) en vez de 4 listas hardcodeadas repetidas por pantalla — permite cargar contenido nuevo por rubro sin tocar código, aunque hoy solo "transporte" tiene contenido real.
- **`PanelAcciones` como drawer genérico de secciones opcionales** (no una API de lista de acciones) — Cotización y Cobro tienen capacidades reales distintas (compartir por PDF/WhatsApp/Email vs. no), forzar paridad hubiera significado botones sin funcionalidad real detrás en Cobro.
- **Selector de Catálogo unificado** (`CatalogoSelectorModal`): un solo componente para elegir ítems del Catálogo, usado en Órdenes de Servicio y Cotizaciones.
- **Verificación de estado de Flow y de vencimiento de Cotización por "lazy check"** en vez de depender de un parámetro de retorno en la URL o de un cron — mismo patrón ya extendido a "Cotización expirada" en esta última tanda.
- **Las 3 pestañas de Gastos en Informes se unificaron en una sola** con un selector interno de agrupación (categoría / centro de costo / orden de servicio).
- **Semáforo propio en memoria en vez de sumar `p-limit`** (`backend/src/concurrencia.ts`, ~30 líneas) para limitar la concurrencia de llamadas a Claude — mismo criterio ya usado en el proyecto de preferir código propio chico antes que una dependencia externa para algo simple (sin ORM, sin librería de componentes UI).
- **Generación de PDF movida a `worker_thread`** (los 3 generadores) en vez de dejarla en el proceso principal — `pdfkit` es síncrono/CPU-bound, bloqueaba el event loop del resto del tráfico mientras generaba. En dev (`tsx watch`) el worker necesita registrar su propio loader de TypeScript (`execArgv: ["--require", "tsx/cjs"]`) porque no lo hereda del proceso principal; en producción (compilado a `.js`) no hace falta nada extra.
- **PDF de OS cacheado recién al quedar firmada** (no desde el primer pedido, como el de cotización) — antes de la firma el contenido todavía puede cambiar (checklist, fotos); firmada, la orden ya queda inmutable (guard existente de "OS finalizada"), así que no hace falta invalidación.
- **Límites de uso por plan como freno anti-abuso, no de costo** — un análisis de costos real (pricing en vivo de Claude API y Supabase) mostró que el costo marginal por cliente (IA + storage) es de centavos de dólar incluso en los topes más generosos; el costo real de la plataforma es el piso fijo compartido de infraestructura, no el uso por empresa. Los números de `LIMITES_POR_PLAN` se fijaron generosos a propósito.
- **Storage del límite de plan como contador aproximado incremental**, no un total exacto recalculado — escanear los buckets S3 en cada subida (lo que sí hace `medirUsoStorage()` para el Super-Admin) sería demasiado lento en el camino caliente de cada subida de archivo.
- **% de descuento de cumpleaños puramente informativo** (texto en el correo, un conjunto fijo de valores 10/15/20) — se descartó construir cualquier sistema de cupones/descuentos real (generación de código, aplicación, redención) por ser una feature bastante más grande y no pedida; la empresa lo aplica a mano.
- **Roles como filas de una tabla, no como enum hardcodeado** (migración 71) — permite al Super-Admin ajustar qué ve cada rol sin redeploy y crear roles a medida. `admin` se dejó explícitamente NO editable (acceso total garantizado, así siempre hay un rol que lo puede todo). `usuarios.rol` se dejó como texto libre sin FK: un rol borrado deja a sus usuarios "sin acceso" de forma visible en vez de bloquear el borrado o cascadear. El backend cachea 60 s para no pegarle a la DB en cada request (el middleware de empresa corre en todas las rutas).
- **"Acciones sensibles" como eje separado de los módulos** (migración 71) — facturar / gestionar plan / configurar Agenda Pro / ver dashboard son capacidades que no calzan 1:1 con "ver un módulo"; se modelaron como una lista `acciones[]` por rol y un guard `requiereAccion()`, en vez de meterlas como pseudo-módulos.
- **Acceso por correo/dominio en `/api/me`, no un endpoint nuevo** — `/api/me` ya lo llama toda navegación; ahí mismo se resuelve y se aprovisiona la fila en `usuarios` la primera vez. El autorregistro se distingue con `user_metadata.self_signup` (lo pone `/registro`), así un login de Google sin invitación ni autorización no puede colarse a `/onboarding`.
- **Sistema cerrado por defecto** — un correo desconocido que no se autorregistró queda denegado (antes cualquiera que se autenticara podía crear una empresa nueva). El autorregistro se mantiene solo como demo/trial.
- **Fix de RLS de tablas solo-backend (migración 73)** — se descubrió que Supabase auto-otorga grants a `anon`/`authenticated` en toda tabla nueva y varias tablas sensibles (`super_admins`, `roles`, `empresa_accesos_autorizados`, `mfa_*`) se habían creado sin `enable row level security`, quedando abiertas a la anon key. Se cerró con RLS deny-all + revoke. Distinto del debate de "RLS de verdad" para las tablas de tenant (sección 7 más arriba): acá RLS SÍ se usa como barrera real porque estas tablas nunca las toca un cliente, solo la service role.
- **Previred / DT: archivo plano para carga manual, no API** — se analizó integrar Previred en tiempo real y no existe API pública sin convenio comercial; se optó por generar el archivo de 105 campos de Previred y el Libro de Remuneraciones Electrónico de la DT como descargas para subir a mano. Pago de sueldos también manual.
- **Gratificación Art. 50 configurable por empresa** (25% del imponible con tope de 4,75 IMM anuales) — es la forma más común pero no la única; se dejó como parámetro en vez de hardcodearla.
- **`EstadoTrabajo` no se borró, se marcó `@internal`** (PASO 1) — `trabajos.estado` sigue existiendo como columna (para no romper nada que la lea/escriba directo) pero deja de ser vocabulario visible; el backend la sincroniza a `estado_os` desde los 3 write-paths y toda la UI/informes miran `estado_os`. Se prefirió esto a un rename/drop de columna riesgoso en una tabla central.
- **Puente OS→Cobro no bloqueante** (PASO 0) — si la creación de la factura al firmar falla, se loguea y la firma sigue (mismo criterio que el PDF/notificaciones). El flag `cobro_automatico_al_firmar` por empresa default true; la empresa que factura por fuera (ej. contra guía semanal) lo apaga.
- **"Personas" es solo reorganización de UI, cero cambio de backend** (PASO 2) — las 3 pantallas viejas ya editaban la misma fila `usuarios` (+ `datos_laborales` 1:1); se juntaron en una ficha con pestañas, cada pestaña conserva su gate de módulo original. Los endpoints, gates y la matriz de permisos quedaron idénticos — se descartó tocar permisos.
- **Config del portal por columnas booleanas en `empresas`, con default true** (PASO 5) — aditivo, 0 empresas afectadas al migrar. El backend degrada a "visible" si la columna falta (`?? true`), así el deploy del backend nuevo contra una DB sin la migración no rompe el portal (aunque los toggles del dashboard sí darían 500).
- **Adicionales de reserva en un jsonb, no una tabla `tarea_items`** (migración 94) — para una lista corta de `{concepto, monto}` por reserva, una columna jsonb con default `'[]'` es más simple; el `precio` de la tarea NO cambia de significado (sigue siendo el del servicio), el total se calcula donde hace falta.
- **Fotos de la cola de sync en `document/`, no `cache/`** — `expo-image-manipulator` y `expo-image-picker` dejan las fotos en `cache/`, que el SO limpia; una foto encolada por horas perdía su archivo. `comprimirImagen()` ahora las mueve a `document/fotos-cola/` (persistente) y la cola las borra al subirlas o descartarlas.
- **Build de APK local con keystore de debug** mientras la cuota EAS Free está agotada — genera un APK instalable por sideload pero **no actualizable encima de uno de EAS** (firmas distintas). Aceptado como parche temporal; el camino real sigue siendo EAS (o pagar el plan Starter).
- **Sistema de diseño en dos paquetes separados** (`design-tokens` para valores puros, `ui` para componentes) en vez de uno solo — permite que mobile consuma solo los tokens (vía `useTema().ds`) sin arrastrar dependencias de componentes web, y que la migración pantalla-por-pantalla conviva con los primitivos viejos de mobile (`components/ui`) sin romperlos, con un prefijo Tailwind (`ds-`) que marca lo migrado y se retira al final.
- **Mantención de flota en tabla propia, no como una OS más** — no requiere cliente, y una OS dispara `cobro_automatico_al_firmar` por default; forzar eso para un chequeo interno del vehículo hubiera significado un flag de excepción sobre un flujo pensado para facturar. El registro es **inmutable tras crearse** (mismo criterio que las fotos de una OS firmada) con una única excepción deliberada — las fotos de respaldo se pueden agregar/eliminar después — para no debilitar el registro como evidencia auditable de qué se revisó, mientras se permite corregir "me equivoqué de foto" o "salió borrosa" sin reabrir todo el registro.
- **Ventas con `origen`/`referencia` polimórficos sin FK** (`origen_tipo`/`origen_id`, `tipo`/`referencia_id`) — una venta puede originarse en una cita o una OS, y una línea puede ser un servicio/producto/pack; una FK por combinación hubiera significado 2×3 columnas nullable. Se aceptó el mismo trade-off que ya existe en `documentos.entidad_tipo`/`entidad_id` (polimórfico ya usado en Flota).

## 8. Pendientes y TODOs

- **No hay comentarios `TODO`/`FIXME` genéricos en el código** — los pendientes explícitos que sí existen están comentados en el archivo puntual donde aplican (ej. contenido de rubros en `backend/src/routes/sugerenciasRubro.ts`).
- **Backlog activo (`trabajo_list.json` en la raíz del repo — fuente de verdad del día a día, más granular que esta lista):**
  1. **Eslint de `web` roto** en el monorepo con Next 16 (`eslint-config-next` no resuelve `next/dist/compiled/babel/eslint-parser`) — `verificar.sh` lo marca WARN, no bloquea.
  2. **Falta un workflow de CI que corra `./verificar.sh`** (tsc de los 4 paquetes + tests + `audit:tenant`) en cada push/PR — hoy CI es solo `keep-warm.yml` + `check-migraciones-prod.yml`.
  3. **Rotar la key del Deploy Hook de Render** (quedó en historial/notas) — `api.render.com/deploy/srv-daatkjf10e5c73cnrb30?key=…`.
  4. **Backend sin tests** — falta un smoke mínimo (arranque real + `/health` + una ruta protegida + una feliz).
  5. **E2E de Mantención de flota + PDF Fase 2 en prod — parcialmente hecho (11-sep):** verificado en vivo que un registro de mantención con foto se crea y genera PDF sin error, y que el Informe con IA funciona (RAG real, sin fotos/checklist responde honestamente que no hay datos en vez de inventar). **Bloqueado**: cerrar una OS con fotos por categoría + 2 firmas requiere check-in/fotos/firma del técnico, que **solo existe en mobile** — no hay ninguna vista web equivalente, así que ese último tramo lo tiene que hacer alguien con el APK en un teléfono real.
  6. **Sistema de diseño — Paso 7** (único paso que falta de los 8): regla ESLint anti-hex/px, Storybook, check de CI, `docs/design-system.md` enlazado desde `CLAUDE.md`.
- **Estado del despliegue (11-sep-2026):** la app **ya está en producción** (Vercel + Render + Supabase prod + Resend + Cloudflare, ver `docs/PUESTA_EN_PRODUCCION.md`). **Prod tiene las migraciones 1-99 aplicadas y trackeadas; la 100 (módulo Levantamientos) está aplicada en dev y pendiente en prod** (la 99 —73 índices de cobertura de FK— corrida y validada el 11-sep). **Gap de tracking en dev** (`pruwvpnlvrvgtmpetlsr`, detectado 11-sep): el *esquema* de dev está al día (todas las tablas/columnas hasta la 100 existen, verificado en vivo — se construyó y probó encima sin problema), pero `supabase_migrations.schema_migrations` de dev solo llega a la **74** — las migraciones 75+ se aplicaron con `supabase db query --linked -f <archivo>` en vez de `db push`, que no deja fila de tracking. No es urgente (dev funciona bien) pero un `migration repair` prolijo en algún momento evitaría confusión. Workflow `keep-warm.yml` mitiga el arranque en frío de Render. Empresa "Transportes Itineris" (`rubro='cosmetologia'` en la fila de `empresas` — el nombre de la empresa no define el rubro, verificado en vivo 11-sep; sigue siendo la misma empresa de prueba/piloto real de siempre, con Agenda Pro/reservas Y los módulos `agenda`/`viajes`/`ordenes_servicio`/Mantención de flota activos y usados de verdad) tiene datos de prueba mezclados con los reales — cliente interno **"Itineris Spa"** ya se usa como convención establecida para pruebas que no deben generar notificaciones a clientes de verdad (visto en varias OS y mantenciones de prueba existentes). **Auto-deploy**: Vercel se dispara solo por push a `main`; Render también (confirmado 11-sep, el Deploy Hook existe como respaldo pero no siempre hizo falta). **Clasificador de Claude Code**: permite consultas READ-ONLY a la DB de prod (`supabase db query --linked`) pero BLOQUEA writes/DDL — las migraciones a prod las corre la usuaria; **push a `main` (deploy de código) sí lo puede hacer el asistente**, con la usuaria al tanto dado el alcance (11-sep: 37 commits acumulados sin desplegar, incluido todo el rediseño visual, se empujaron juntos tras confirmarlo explícitamente). Lo que falta para estar 100% operativa:
  - Dar de alta la primera empresa cliente de punta a punta (crear empresa → invitación por correo → activar cuenta del admin → entrar al dashboard).
  - **Rotar secretos que se expusieron en texto plano durante la puesta en marcha:** la primera Resend API key, un GitHub PAT, la `SUPABASE_SERVICE_ROLE_KEY` de producción (implica rotar el JWT secret del proyecto Supabase), y **la key del Deploy Hook de Render** (ítem 3 del backlog arriba).
  - Confirmar en Supabase (prod) → Authentication → URL Configuration: Site URL y Redirect URLs con el dominio real.
  - Verificar que Supabase tiene backups de la DB de prod habilitados y probar una restauración.
  - **Sentry (opcional):** crear cuenta gratis en sentry.io, poner el DSN del proyecto Node en `SENTRY_DSN` (Render) — sin eso el SDK del backend está inerte. Para el móvil, `EXPO_PUBLIC_SENTRY_DSN` en eas.json cuando se resuelva la incompatibilidad del plugin.
  - **Login con Google (paso manual, sin costo)** — en Google Cloud Console: pantalla de consentimiento OAuth (scopes `openid`/`email`/`profile`) + cliente OAuth "Aplicación web" con redirect URIs `https://yjbskbskyadxjooxngjv.supabase.co/auth/v1/callback` (prod) y `https://pruwvpnlvrvgtmpetlsr.supabase.co/auth/v1/callback` (dev). En Supabase (los 2 proyectos): Authentication → Providers → Google (pegar Client ID/Secret) + URL Configuration (Site URL + `/auth/callback`). El código ya está desplegado; sin esto el botón falla.
  - **Remuneraciones:** validar con un contador el formato del archivo Previred y del Libro de Remuneraciones DT antes de usarlos con datos reales (hoy están marcados como borrador).
- **Del prompt original, no iniciado o incompleto:**
  - CI/CD (GitHub Actions) — mínimo: `check-migraciones-prod.yml` y `keep-warm.yml`. Los deploys son automáticos por push a `main` pero **sin lint/typecheck/test previo** (ítem 2 del backlog arriba).
  - Supabase Realtime — mencionado en el stack original, nunca usado.
  - Migración/preparación activa hacia Fase 2 (GCP) — los artefactos existen como referencia pero no se ha tocado nada para activarlos.
  - App móvil: arquitectura + auditoría + PASO 3 (4 pestañas) + fixes de terreno + galería/eliminar fotos + fixes de sync + APK 1.9.8/vc25 probado en dispositivo real contra producción. **Falta**: piloto con estilistas/choferes reales; build de producción/`.aab` para Play Store; que el usuario configure el login con Google; **Sentry en el móvil** (plugin incompatible con SDK 57); **resolver la cuota de EAS** (agotada hasta 1-oct — hoy se compila local con keystore de debug, que no actualiza encima de un APK de EAS).
- **Fuera del prompt original, flagged durante el desarrollo como fuera de alcance/pendiente:**
  - Integración real de pasarela de pago para **Cobros al cliente final** (hoy simulada) — no confundir con la Suscripción/Plan B2B, que sí es real.
  - **Suscripción/Plan B2B (Flow) — falta antes de producción:** crear los Planes Básico y Pro en el panel de **producción** de Flow (hoy solo existen en sandbox, y el de Pro ni siquiera existe en sandbox todavía); confirmar de principio a fin un ciclo real de cobro tras el trial de 21 días; credenciales de producción (`FLOW_API_KEY`/`FLOW_SECRET_KEY` de prod).
  - **Sugerencias por rubro solo tienen contenido para "transporte"** — falta definir y cargar sugerencias para `servicio_tecnico` y `otro` (decisión de producto, la estructura de datos ya soporta cualquier rubro).
  - **Login con Google**: pendiente el setup de Google Cloud + Supabase (detallado en la sección "Estado del despliegue" arriba).
  - **Invitado que luego entra con Google con el MISMO correo, si nunca confirmó la invitación**: Supabase puede crear un usuario nuevo en vez de linkear, y quedaría con otro `id` sin fila en `usuarios`. El resolver de acceso (migración 72) lo cubre solo si además su correo está en `empresa_accesos_autorizados`; si no, queda denegado. Gap conocido y menor.
  - Emisión de guía de despacho / factura electrónica ante el SII (el módulo Viajes es solo un capturador interno, no un emisor de DTE — requiere certificación aparte). Remuneraciones tampoco emite ante Previred/DT: genera archivos para carga manual.
  - Bot de WhatsApp sin activar en producción (falta setup de Meta Business, no es un tema de código).
  - Asistente conversacional: tiene herramientas de lectura de agenda y registros además de las métricas agregadas, pero no cubre todos los dominios ni acciones de escritura.
  - **Aislamiento multi-tenant real a nivel de base de datos** — hoy es disciplina de código + auditoría, no una barrera que la propia base de datos haga cumplir (ver sección 1).
  - Suspender una empresa desde el Panel de Super-Admin hoy solo bloquea el dashboard normal — **no se extendió al Portal de Cliente ni al bot de WhatsApp**, queda como gap conocido y explícito, no silencioso.
  - **Tabla `vehiculos` huérfana** — sigue en la base de datos sin ningún código que la use tras la fusión con Equipos; candidata a eliminarse en una migración futura una vez confirmado en producción que nadie la necesita para rollback.
  - **Los números de `LIMITES_POR_PLAN` (usuarios/OS-mes/storage/IA por plan) son una propuesta inicial**, no una decisión de negocio final — quedan fáciles de ajustar en un solo lugar (`packages/shared/src/limites.ts`) si no calzan con la realidad una vez en uso.
  - **Incidente de login "Credenciales inválidas" (flagged 4-sep, no reproducido desde)** — se reportó un rechazo de `signInWithPassword` en prod; se descartó que fuera un bug de frontend o algo que hubiera tocado el auth. En sesiones posteriores el login funcionó sin problema (posible rate-limiting de Supabase o contraseñas mal tipeadas en su momento). Sin acción pendiente salvo que reaparezca.
  - **Tracking de migraciones en dev desincronizado desde la 75** — el esquema de dev está al día (tablas/columnas hasta la 100 existen y funcionan), pero `schema_migrations` solo tiene hasta la 74 registrada (se aplicaron con `db query` en vez de `db push`). No es un problema funcional, es prolijidad de tracking.
  - **Migración 100 (módulo Levantamientos) pendiente en prod** — tablas nuevas (`levantamientos`, `levantamiento_materiales`, `levantamiento_fotos`), aplicada y probada en dev. El módulo además necesita activarse por empresa desde el Panel de Super-Admin (`empresa_modulos`, apagado por defecto) antes de que cualquier empresa lo vea.
