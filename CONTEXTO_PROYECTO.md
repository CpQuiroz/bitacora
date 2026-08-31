# Contexto del proyecto — Bitácora

> Generado analizando el repositorio real (código, esquema de base de datos en vivo,
> `package.json`, migraciones). Este documento es para darle contexto completo a otro
> asistente de IA sin acceso al código. El "prompt maestro original" referenciado abajo
> es `ENCARGO-claude-code.txt`, en la raíz del repo.

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
| Backend | Node.js + Express | Express ^4.19, TS ^5.5, ejecutado con `tsx` en dev |
| Base de datos | PostgreSQL, gestionado por Supabase | — |
| ORM | **Ninguno** — cliente `@supabase/supabase-js` (PostgREST) directo, tipado a mano en `packages/shared/src/types.ts` | ^2.45 |
| Gestor de estado | **Ninguno global** (sin Redux/Zustand/Jotai) — `useState`/`useEffect` + Context puntual (`ConfiguracionContext`, `InformesContext`) + fetch directo vía `web/src/lib/api.ts` | — |
| Autenticación | Supabase Auth (JWT) + **login propio en dos pasos** (ver más abajo, ya no es `signInWithPassword` directo del cliente para email/contraseña). Backend valida el token con `supabase.auth.getUser(token)` en cada request (`backend/src/auth.ts`) | — |
| Multi-tenant | **Ver nota abajo — es más débil de lo que sugiere "RLS de Postgres".** Cada tabla con `empresa_id` tiene policy `empresa_id = empresa_actual()`, pero el backend consulta Supabase con la **service role key** (`backend/src/supabase.ts`), que **bypassea RLS por completo**. Las policies existen en cada migración pero son código muerto para el 100% del tráfico real. La barrera de aislamiento real hoy es la disciplina de `.eq("empresa_id", ...)` en cada ruta del backend (`backend/src/empresa.ts` resuelve el `empresaId` del usuario logueado en un middleware), reforzada por un script de auditoría heurístico (`backend/scripts/auditar-aislamiento.ts`, `npm run audit:tenant`) y por `backend/src/tenant.ts` (helpers tipados `seleccionarDeEmpresa`/`actualizarEnEmpresa`/`eliminarDeEmpresa`/`insertarEnEmpresa`, recomendados para rutas nuevas) | — |
| Autenticación Super-Admin | Identidad totalmente separada de Supabase Auth y de `usuarios`/`Rol` — tabla propia `super_admins`, password con `scrypt` (Node `crypto` nativo), TOTP (RFC 6238) implementado a mano, sesión propia con token HMAC-SHA256. Sin auto-registro: la única forma de crear una cuenta es un script offline (`backend/scripts/crear-superadmin.ts`), nunca un endpoint HTTP | — |
| Autenticación en dos pasos (2FA) para usuarios normales | **Nuevo.** TOTP (app de autenticación) o código por correo, **opcional para todos pero obligatorio para roles `admin`/`supervisor`**. `backend/src/totp.ts` (RFC 6238, reusa la misma implementación a mano que ya existía para Super-Admin), secreto cifrado en tabla propia `mfa_totp_secretos` (nunca en `usuarios`, que sí se expone completa vía `GET /api/usuarios`). Login por contraseña ya **no** es `signInWithPassword` directo del cliente — pasa por `POST /api/auth/login` (`backend/src/routes/authLogin.ts`): si el usuario tiene 2FA activo, responde `requiere_codigo` en vez de tokens, y el segundo paso (`POST /api/auth/login/verificar`) recién entrega la sesión real (tokens de Supabase cifrados en tránsito en la tabla `login_2fa_pendiente`, de un solo uso). El gate de obligatoriedad por rol vive en `backend/src/empresa.ts` (middleware `requiereEmpresa`, responde `403 { code: "MFA_REQUERIDA" }` si el rol lo exige y no está activo, con excepción explícita de path para `/api/usuarios/me/*` así se puede configurar). Login con Google (ver más abajo) es un camino aparte, no pasa por este endpoint | — |
| Login con Google | **Nuevo.** `supabase.auth.signInWithOAuth({ provider: "google" })` desde `web/src/app/login/page.tsx`, callback en `web/src/app/auth/callback/page.tsx`. Una cuenta nueva por Google sigue el mismo alta de empresa que una por contraseña (`GET /api/me` decide `/dashboard` vs `/onboarding`, agnóstico a cómo se creó la fila en `auth.users`). **Pendiente manual del usuario**: habilitar el proveedor Google en el dashboard de Supabase Auth — sin eso el botón queda visible pero el flujo falla | — |
| Seguridad HTTP | **Nuevo.** `helmet()` (cabeceras estándar), CORS restringido a una lista de orígenes vía `ALLOWED_ORIGINS` (env; sin configurar en dev local solo permite `http://localhost:3000`, nunca `*`), rate limiting (`express-rate-limit`) en login, invitaciones y la encuesta pública (`backend/src/rateLimiters.ts`) | — |
| Mobile | Expo + React Native | Expo ~57, RN 0.86, React 19.2.3 |
| IA | Anthropic Claude API (`@anthropic-ai/sdk`), modelo `claude-sonnet-5` | ^0.68 |
| Storage de archivos | Capa propia S3-compatible (`backend/src/storage.ts`, sobre `@aws-sdk/client-s3`) apuntando al endpoint S3 de Supabase Storage | — |
| PDF | `pdfkit` (generación programática, sin plantillas HTML) | ^0.20 |
| Email | Resend — **opcional**, si falta la API key se omite en silencio (queda registrado como fallido, no rompe el flujo) | — |
| Hosting / CI-CD | **No implementado.** Existe un `Dockerfile` en `backend/`, nada más. Sin GitHub Actions, sin config de Vercel/Render, sin Terraform activo | — |

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
│       │   ├── dashboard/     ~20 módulos, organizados en 5 grupos de sidebar:
│       │   │                  Operación, Datos, Financiero, Análisis, Administración
│       │   ├── portal/        Portal de Cliente — identidad externa sin cuenta de Bitácora,
│       │   │                  layout propio (PortalShell), nav de pestañas: Inicio, OS,
│       │   │                  Citas, Cotizaciones, Cobros
│       │   ├── superadmin/    Panel de Super-Administrador — reservado para el dueño del
│       │   │                  producto, layout propio (SuperAdminShell), fuera del dashboard
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
│       ├── routes/             46 archivos, un router por recurso
│       ├── superadmin/         módulo aparte del Panel de Super-Admin: auth.ts (sesión
│       │                       HMAC propia), passwords.ts (scrypt), routes.ts (totp.ts se
│       │                       movió a backend/src/totp.ts, compartido con el 2FA normal)
│       ├── server.ts           monta todas las rutas + middlewares globales (helmet, cors
│       │                       restringido, rate limiting) + logging de errores a
│       │                       errores_backend
│       ├── auth.ts, empresa.ts, permisos.ts  middlewares: valida JWT, resuelve empresa_id
│       │                       y gate de 2FA obligatorio por rol, gatea por módulo (rol ×
│       │                       empresa_modulos)
│       ├── totp.ts             TOTP (RFC 6238) a mano, compartido entre 2FA de usuario
│       │                       normal y Super-Admin
│       ├── tenant.ts           helpers tipados para queries scopeadas por empresa_id
│       ├── inventario.ts       descuento/reversión de stock configurable por empresa
│       ├── scripts/auditar-aislamiento.ts   auditoría heurística de aislamiento multi-tenant
│       ├── claude.ts           cliente Anthropic + prompts de IA + instrumentación de uso
│       │                       (tabla ia_uso, por feature)
│       ├── whatsapp.ts, routes/whatsapp.ts   bot de WhatsApp (webhook Meta Cloud API)
│       ├── notificar.ts, notificarCliente.ts   feed interno del equipo vs. correo real al
│       │                       cliente externo — sistemas distintos, no confundir
│       ├── storage.ts          capa S3 (fotos, firmas, comprobantes, anexos) + medición de
│       │                       uso de storage por empresa
│       └── generarPdfOS.ts, generarPdfCotizacion.ts, generarPdfInforme.ts   PDFs con pdfkit
├── mobile/                     Expo — app para choferes/técnicos en terreno (parcial)
│   └── screens/                 solo 4 pantallas (ver más abajo, sección 4)
├── packages/shared/            tipos TypeScript compartidos entre los 3 apps
│   └── src/
│       ├── types.ts             única fuente de verdad de cada tabla (Row types)
│       ├── permisos.ts          matriz de permisos por rol × módulo + módulos opt-in
│       ├── supabase.ts          factory del cliente supabase-js tipado
│       └── rut.ts               validación/formato de RUT chileno
└── supabase/
    ├── migrations/              54 archivos SQL numerados, se aplican en orden
    └── fase2-referencia/        Terraform + RLS portable + CI — diseñados, no activados
```

**Convenciones ya establecidas:**
- Todo el código (variables, comentarios, nombres de tabla/columna) está en **español**.
- Los tipos "Row" en `types.ts` son `type`, nunca `interface` (requisito del tipado genérico de supabase-js).
- Cada router de backend sigue el mismo patrón: `ah<RequestConEmpresa>(async (req, res) => {...})` (wrapper que evita que un error async tumbe el proceso) y se monta en `server.ts` con `requiereAuth, requiereEmpresa`.
- Cada página del dashboard (`"use client"`) sigue el mismo patrón de carga: `supabase.auth.getSession()` → si no hay sesión, redirect a `/login` → `apiFetch("/api/...")`.
- Gotcha recurrente ya resuelto varias veces: `.update(objeto)` de supabase-js rechaza `Record<string, unknown>` — siempre se tipa como `Partial<TheRowType>`.
- Módulos viejos renombrados (Cadastros→Registros, Facturas→Cobros) dejaron **redirect shims** en la URL vieja (`useEffect` + `router.replace`), no duplican lógica. Mismo criterio se usó al fusionar Vehículos→Equipos (ver sección 4/5): no quedó redirect porque la ruta vieja se borró junto con la pantalla, no fue un simple rename.
- Cada empresa puede tener módulos contratados distintos (tabla `empresa_modulos`) — es un eje independiente del rol: el rol decide qué ve cada persona *dentro* de su empresa, `empresa_modulos` decide qué está *contratado* por esa empresa en primer lugar. `requiereModulo()` en el backend valida ambos; el frontend oculta del sidebar lo que cualquiera de los dos ejes bloquea. Desde la autogestión de plan (sección 4), el plan Pro activa automáticamente todos los módulos opcionales (`MODULOS_OPCIONALES`, hoy solo `agenda_pro`) — es la única regla de negocio que conecta `empresas.plan` con algo real.
- Patrón para agregar un tipo de notificación al cliente nuevo (ya usado varias veces): sumarlo a `TipoNotificacionCliente`, y a los 4 mapas de `backend/src/notificarCliente.ts` (`ASUNTOS_DEFAULT`, `CUERPOS_DEFAULT`, `TIPO_MENSAJE`, `ENTIDAD_PORTAL`), más el check constraint correspondiente en la migración.
- Patrón "sin cron real" ya usado varias veces (no hay infraestructura de jobs programados en el proyecto): un chequeo perezoso disparado por una ruta que igual se llama seguido — `revisarCotizacionesPorVencer`, `marcarCotizacionesExpiradas`, verificación de estado de Flow. Al agregar lógica similar, seguir este patrón en vez de asumir que existe algo tipo cron/worker.
- `Combobox` (`web/src/components/Combobox.tsx`) es el primitivo genérico de buscar+seleccionar con teclado; `ComboboxCliente`/`ComboboxResponsable` le agregan "si no existe, crear uno nuevo inline" para esa entidad puntual — no se duplica el primitivo por cada entidad.

## 3. Sistema de theming

- **Fuente de verdad:** `web/src/app/globals.css`. Variables CSS (`--background`, `--brand`, `--brand-soft`, `--accent`, `--success/--warning/--danger` + `-soft`), mapeadas a clases Tailwind vía `@theme inline`. Define paleta clara y oscura (`@media (prefers-color-scheme: dark)`).
- **Personalización por empresa:** la tabla `empresas` tiene `color_primario`, `color_primario_foreground` (calculado por luminancia al guardar), `color_secundario`, `fuente`, `logo_url`, `moneda`. Estos valores se inyectan como **overrides CSS inline** en `DashboardShell.tsx` (vía `style={{...}}` con `--brand`, `--brand-soft` calculado con `color-mix()`, etc.) — cada empresa puede tener su propio color de marca sin tocar CSS global ni redeploy.
- **Tipografía:** Geist (`next/font/google`) por defecto; el helper `web/src/lib/fuentes.ts` permite que una empresa elija otra fuente del sistema.
- **PDFs — sí existen, ya generan branding real:**
  - `backend/src/generarPdfOS.ts` — orden de servicio cerrada y firmada.
  - `backend/src/generarPdfCotizacion.ts` — cotización (también accesible desde el Portal de Cliente).
  - `backend/src/generarPdfInforme.ts` — informe con IA (estructurado o personalizado).
  - Los tres usan `pdfkit` puro (no hay plantilla HTML→PDF) y reciben `empresaNombre`, `empresaLogoUrl`, `colorPrimario` como parámetros — el PDF hereda el logo y color de cada empresa, no un tema fijo.

## 4. Módulos implementados (estado real)

| Módulo | Estado | Notas |
|---|---|---|
| Layout / Shell | ✅ Implementado | Sidebar en 5 grupos colapsables (Operación, Datos, Financiero, Análisis, Administración) + drawer móvil, dropdown de usuario, campana de notificaciones internas, chat flotante del Asistente en todas las páginas |
| Login y 2FA | ✅ Implementado | Contraseña (en dos pasos si el usuario tiene 2FA activo, obligatorio para `admin`/`supervisor`) o Google OAuth. Configuración del segundo factor (TOTP o código por correo) desde Configuración → Seguridad. Ver detalle completo en la sección 1 |
| Agenda | ✅ Implementado | `/dashboard/agenda` — calendario mensual/día/semana que combina OS y `tareas` (eventos sin OS: recordatorios, visitas técnicas) en una sola vista; selector de Cliente/Responsable ahora vía `ComboboxCliente`/`ComboboxResponsable` |
| Agenda Pro | ✅ Implementado — **opt-in por empresa** (`empresa_modulos`, desactivado por defecto, o incluido automático en plan Pro) | Paquetes de sesiones (`paquetes_sesiones` — un cliente compra un pack de N sesiones; el saldo restante **se calcula** a partir de las tareas del paquete, nunca se guarda como contador aparte) + citas que el cliente confirma o cancela desde el Portal. **Ventana de cancelación configurable** (`agenda_pro_config.ventana_cancelacion_horas`, default 24h): cancelar con tiempo suficiente marca `cancelada_anticipada` (no descuenta la sesión del paquete); cancelar tarde o no asistir marca `no_asistio` (sí descuenta) — antes ambos casos caían en el mismo `cancelada` genérico sin distinguir. **Reserva online pública** (`/agendar/[empresaId]`, sin cuenta ni login): el cliente elige horario disponible y queda una tarea con `origen = 'reserva_publica'`; horario único por empresa (`agenda_pro_horarios`) + `agenda_pro_config` (duración de slot, anticipación mínima/máxima, ventana de cancelación) |
| Configuración | ✅ Implementado — 13 submódulos | cuenta, empresa, plan, plantillas de documentos, checklists, tipos de OS, integraciones, categorías de gasto, centros de costo, inventario (ahora configurable, ver Registros), notificaciones (con indicador "N de M completados" en Mensajes personalizados), seguridad (incluye alta de 2FA) |
| Registros (ex-"Cadastros") | ✅ Implementado | Clientes (ficha 360° con pestañas Historial/Equipos/Financiero, timeline único cronológico), Equipos (incluye la categoría "Vehículo", ver nota de fusión abajo; ficha de detalle propia con plan de mantención e histórico; dashboard de métricas agregadas), Catálogo (con kits, etiquetado por tipo de equipo, sugerencias por rubro de la empresa), Inventario (**configurable por empresa**: en qué estado de la OS se descuenta, si se permite stock negativo, si se descuenta una sola vez por OS; dashboard de resumen; distingue movimientos manuales de automáticos), Proveedores |
| **Vehículos → Equipos (fusión)** | ✅ Completado | Vehículos dejó de ser módulo/tabla de primera clase — es una categoría dentro de Equipos (`equipos.categoria = 'Vehículo'`), con campos propios opcionales (`patente`, `anio`, `tipo_vehiculo`, `capacidad_carga`, visibles solo con esa categoría) y `equipos.cliente_id` ahora nullable (null = activo propio de la empresa, ej. flota). Los datos se migraron preservando el mismo `id` (migración 52) para que `documentos.entidad_id`, `vehiculo_asignaciones.equipo_id` y `viajes.equipo_id` (ambas columnas renombradas desde `vehiculo_id`) sigan resolviendo sin reescritura. La tabla `vehiculos` **sigue existiendo en la base de datos pero sin ningún código que la use** — se dejó a propósito por si hace falta rollback, se puede eliminar en una migración futura una vez confirmado en producción. Las pantallas `web/dashboard/flota/vehiculos/*` fueron borradas |
| Gestión de Colaboradores / Flota | ✅ Implementado | Colaboradores, Documentos con vencimiento (licencias, permisos de circulación, etc. — tipos de documento configurables por empresa, con sugerencias por rubro; alerta de "por vencer"). Vehículos ya no vive acá (ver fila de arriba) |
| Órdenes de Servicio digitales | ✅ Implementado | Checklist, fotos (con análisis de IA por foto), firma del cliente, folio correlativo, PDF, selector de Equipo del cliente, descuento de inventario configurable al llegar al estado que la empresa eligió como disparador (no fijo a "firmada" como antes) |
| Financiero | ✅ Implementado | Cotizaciones (ítems, IVA, "Convertir a OS", aprobar/rechazar por el cliente desde el Portal, estado "Expirado" ahora calculado y persistido de verdad —antes solo visual—, `ComboboxCliente`, Panel de Acciones reutilizable para estado/compartir/eliminar), Gastos (categoría/centro de costo/proveedor real, vínculo opcional a una OS, "Fecha de pago" condicional a Estado=Pagado, ficha de detalle propia), Cobros (ex-"Facturas": cliente real vía `ComboboxCliente`, ficha de detalle propia nueva con "Registrar Pago" —valor recibido, fecha, medio de pago, observaciones, sin pasarela real detrás—, Panel de Acciones compartido con Cotizaciones, medio de pago, link de pago **simulado**) |
| Informes | ✅ Implementado | 7 pestañas de analítica (Visión General, Financiero, Ventas, Operaciones, Servicios, Clientes, Gastos —unificada, con selector interno de agrupación: por categoría / centro de costo / orden de servicio—) + selector de período compartido + export CSV/PDF |
| Informe IA | ✅ Implementado | 3 modos: estructurado (tipo fijo), libre (texto+fotos), personalizado (secciones a elección + plantillas guardables) |
| Asistente conversacional | ✅ Implementado | Chat flotante (o panel fijo, alternativo a la burbuja) con tool-use de Claude sobre datos reales del negocio, historial persistente por usuario |
| Viajes (transporte) | ✅ Implementado | Guías, km, IVA por viaje, resumen semanal/mensual, agrupar en factura; ahora vinculado a `equipos` (antes `vehiculos`) |
| Notificaciones al Cliente + Portal de Cliente | ✅ Implementado | Avisos automáticos al cliente (cotización enviada/por vencer, técnico en camino, OS completada, cobro pendiente/vencido, cita agendada) por **correo** (mensaje y asunto personalizables por tipo, switch on/off por tipo, con indicador de progreso "N de M completados" sobre los 3 campos editables de cada una de las 5 categorías de mensaje) y por **WhatsApp** (segundo canal genérico, interruptor maestro único `whatsapp_activado` para los 7 tipos), historial de envíos con reintento manual. El correo incluye un link temporal (`portal_accesos`) a un Portal de Cliente propio (`/portal/*`, sin cuenta de Bitácora, login recurrente por código de 6 dígitos) donde el cliente ve/descarga OS y cotizaciones en PDF, aprueba/rechaza cotizaciones, confirma/cancela citas de Agenda Pro y revisa sus cobros |
| Sugerencias iniciales por rubro | ✅ Implementado — mecanismo genérico, contenido parcial | Tabla de referencia `sugerencias_rubro` (sin `empresa_id`, global) mapea `empresas.rubro` a sugerencias de categorías de gasto/catálogo, tipos de OS y tipos de documento — reemplaza 4 listas hardcodeadas que vivían repetidas en otras tantas pantallas. **Solo hay contenido cargado para `rubro='transporte'`** (2-3 sugerencias por tipo); para `servicio_tecnico`/`otro` la tabla no tiene filas todavía — decisión de producto pendiente, no técnica. Las pantallas anteponen las sugerencias del rubro a su lista genérica anterior sin ocultarla, así que una empresa sin contenido cargado no pierde nada |
| Suscripción y autogestión de plan (Bitácora cobrándole a sus empresas clientes) | ✅ Implementado — probado en **sandbox real de Flow**, no en producción | Configuración → Plan: registro de tarjeta vía Flow/Webpay Oneclick (nunca pasa por el backend propio), 21 días de trial, suscripción mensual automática, historial de cobros, cancelación self-service. **Autogestión de tier** (nuevo): Trial/Básico/Pro elegibles desde la misma pantalla — Pro = Básico + todos los módulos opcionales (`MODULOS_OPCIONALES`), cobra distinto vía dos Planes de Flow separados (`FLOW_PLAN_ID_BASICO`/`FLOW_PLAN_ID_PRO`, reemplazó el `FLOW_PLAN_ID` único de antes); cada cambio de plan queda en `empresa_plan_historial` (plan anterior/nuevo, origen empresa o Super-Admin, si tenía cobro conectado). El Plan Pro de Flow todavía no está creado en el panel de Flow — el botón de pasar a Pro queda bloqueado con aviso en vez de activar Feature Flags sin cobro real conectado. Panel de Super-Admin ve estado de suscripción por empresa. Gotcha real encontrado y corregido probando contra el sandbox: Flow **no** agrega `?token=` a la URL de retorno tras registrar la tarjeta — el backend revisa de forma perezosa (`GET /api/suscripcion`) si hay un customer de Flow sin tarjeta confirmada todavía. Ver sección 8 para lo que falta antes de producción |
| Panel de Super-Administrador | ✅ Implementado — reservado al dueño del producto, fuera del alcance de cualquier usuario de empresa | `/superadmin/*`, identidad y auth 100% separadas (ver sección 1). Por empresa: activar/suspender/dar de baja (bloquea el acceso completo salvo `/api/me`, para poder mostrar el motivo), cambiar plan (queda en `empresa_plan_historial` con origen `super_admin`), crear empresas y editar nombre/RUT, exportar todos sus datos como descarga de archivo (nunca se renderiza en el panel), eliminar permanentemente (confirmación por nombre exacto), activar/desactivar módulos contratados. Salud por empresa: última actividad, usuarios activos del mes, OS creadas del mes, uso de storage, consumo de Claude del mes por feature, últimos errores de backend |
| Bot de WhatsApp | ⚠️ Código completo, **no activo en producción** | Falta que el cliente conecte una cuenta real de Meta Business (`WHATSAPP_ACCESS_TOKEN` y afines sin configurar) |
| App móvil (Expo) | ⚠️ Parcial | Solo 4 pantallas: Login, Trabajos (lista), TrabajoDetalle (checklist + fotos + firma + campos dinámicos por tipo de trabajo), Ruta. **No implementado:** check-in/out geolocalizado, ni el login en dos pasos de 2FA/Google (el login del móvil sigue siendo el flujo simple) |
| Integraciones de pago para Cobros del cliente final (Webpay/Flow/Mercado Pago) | ⚠️ Solo simulado | La UI permite "conectar" y guarda un toggle `conectado`, pero el link de pago generado es **`linkSimulado`** — no hay integración real con ninguna pasarela. **No confundir con la Suscripción/Plan B2B de arriba**: son dos integraciones de Flow completamente distintas |
| Google Document AI | ❌ No implementado | Existe como opción seleccionable en Configuración → Integraciones (nombre, descripción, campos) pero **ningún código del backend la usa** — es un placeholder en la UI |
| Anthropic como "integración" | ⚠️ Ya no aparece en la UI de Integraciones (se ocultó esa card) | El backend **siempre** usa la key global `ANTHROPIC_API_KEY` del `.env` — no es configurable por empresa. Sí queda instrumentado por-empresa a nivel de *medición* (tabla `ia_uso`, visible en la salud del Panel de Super-Admin) |

## 5. Modelo de datos

Esquema real (consultado en vivo: **63 tablas, 113 foreign keys, 54 migraciones aplicadas**). Todas tienen `empresa_id` y policy RLS `empresa_id = empresa_actual()` (recordatorio: esa policy no se ejecuta contra el tráfico real — ver la fila "Multi-tenant" de la sección 1), salvo:
- `empresas` misma,
- `whatsapp_mensajes_procesados` (ledger de idempotencia sin dueño, solo `id` de Meta),
- `notificaciones_preferencias` (se acota por `usuario_id`, no por empresa — un usuario ya pertenece a una sola empresa),
- `super_admins` (identidad global, intencionalmente fuera de cualquier empresa — ver sección 1),
- `mfa_totp_secretos`, `mfa_codigo_pendiente`, `login_2fa_pendiente` (2FA de usuario — sin RLS, acotadas por `usuario_id`, nunca tocadas por un `select("*")` que llegue al frontend, mismo criterio que `super_admins`),
- `sugerencias_rubro` (data de referencia global por rubro, sin dueño de empresa — ver sección 4).

`super_admin_auditoria` sí tiene `empresa_id`, pero **nullable** con `on delete set null` — una acción de auditoría sobre una empresa que después se elimina no debe desaparecer, solo perder la referencia (el nombre de la empresa queda igual en el texto del detalle).

| Dominio | Tablas | Relaciones clave |
|---|---|---|
| Núcleo / tenancy | `empresas`, `usuarios` | `usuarios.empresa_id → empresas`; `usuarios.id → auth.users` (Supabase Auth) |
| 2FA de usuario | `mfa_totp_secretos`, `mfa_codigo_pendiente`, `login_2fa_pendiente` | Todas `usuario_id → usuarios`, sin `empresa_id` (ver nota de RLS arriba). `login_2fa_pendiente` guarda los tokens de Supabase ya válidos, cifrados, hasta confirmar el segundo factor |
| Auditoría de cuenta y accesos | `accesos_usuario`, `auditoria_usuarios` | `accesos_usuario` (ip, user_agent por login); `auditoria_usuarios` (campo/valor_anterior/valor_nuevo, quién lo hizo) — ambas con `empresa_id` |
| Clientes y activos | `clientes`, `equipos` | `equipos.cliente_id → clientes`, **ahora nullable** (null = activo propio de la empresa, ej. flota de vehículos — ver sección 4). `equipos` también absorbe los campos de vehículo (`patente`, `anio`, `tipo_vehiculo`, `capacidad_carga`) cuando `categoria='Vehículo'` |
| Trabajo genérico (OS/OT) | `trabajos`, `tipos_trabajo`, `tipos_os`, `ordenes_servicio`, `os_items`, `checklist_templates`, `analisis_fotos`, `planes_mantencion` | `trabajos.tipo_trabajo_id/tipo_os_id/responsable_id/ruta_id/cliente_id/equipo_id`; `ordenes_servicio.trabajo_id`; `analisis_fotos.orden_servicio_id`; `os_items.catalogo_item_id → catalogo_items` (nullable); `planes_mantencion.equipo_id → equipos` (plan de mantención preventiva) |
| Agenda | `tareas`, `paquetes_sesiones`, `agenda_pro_config`, `agenda_pro_horarios` | `tareas.cliente_id → clientes`, `.responsable_id → usuarios`, `.paquete_id → paquetes_sesiones` (nullable), `.origen` ('manual'\|'reserva_publica'), `.estado` ahora incluye `no_asistio`/`cancelada_anticipada` además de `pendiente`/`confirmada`/`completada`/`cancelada`; `paquetes_sesiones.cliente_id → clientes` — saldo de sesiones siempre calculado; `agenda_pro_config` (incluye `ventana_cancelacion_horas`) / `agenda_pro_horarios` — configuración de la reserva online pública |
| Transporte | `viajes` | `viajes.cliente_id`, `.chofer_id → usuarios`, `.equipo_id → equipos` (antes `.vehiculo_id → vehiculos`), `.factura_id → facturas` |
| Catálogo / inventario | `catalogo_items`, `catalogo_item_tipos_equipo`, `catalogo_kit_items`, `unidades_medida`, `inventario` (legacy, sin uso), `inventario_movimientos` | `catalogo_kit_items` relaciona kit↔item (self-referencia); `catalogo_item_tipos_equipo` (m2m, texto libre) etiqueta ítems por tipo de equipo; `inventario_movimientos.origen` ('manual'\|'automatico') distingue ajustes manuales de descuentos automáticos por OS; `unidades_medida` — catálogo de unidades por empresa |
| Financiero | `presupuestos` (cotizaciones), `presupuesto_items`, `facturas` (Cobros, incluye `valor_recibido`/`observaciones_pago` de "Registrar Pago"), `gastos` (incluye `trabajo_id` opcional y `fecha_pago`), `gastos_fijos`, `categorias_gasto`, `centros_costo`, `proveedores` | `presupuestos.trabajo_id` (conversión a OS), `.estado` incluye `expirado` (ahora calculado, no solo visual); `facturas.viaje_ids`/`trabajo_ids` (arrays, agrupan varios en una factura) |
| Rutas | `rutas_planificadas` | `.responsable_id → usuarios` |
| Flota | `documentos`, `tipos_documento`, `vehiculo_asignaciones`, `vehiculos` (huérfana, ver sección 4) | `documentos.entidad_tipo` ('colaborador'\|'vehiculo') + `entidad_id` (polimórfico, sigue apuntando a `equipos.id` cuando es 'vehiculo'); `vehiculo_asignaciones.equipo_id → equipos` (antes `.vehiculo_id → vehiculos`); `vehiculos` sigue en la base pero sin ningún código que la use |
| IA / informes | `informes_generados`, `informes_personalizados`, `asistente_mensajes`, `ia_uso` | `informes_generados.personalizado_id → informes_personalizados`; `ia_uso` registra tokens por feature para la salud del Super-Admin |
| Notificaciones internas | `notificaciones`, `notificaciones_preferencias` | Feed de campana en el dashboard — distinto del correo al cliente |
| Notificaciones al cliente + Portal | `notificaciones_config`, `mensajes_personalizados`, `notificaciones_cliente_log`, `portal_accesos`, `portal_codigos` | `portal_accesos` genera el link temporal (7 días) que llega en el correo; `portal_codigos` es el login recurrente de 6 dígitos, hasheado, 10 min |
| Sugerencias por rubro | `sugerencias_rubro` | Sin `empresa_id`, sin RLS — data de referencia global filtrada por `empresas.rubro` en el backend (ver sección 4) |
| Config / personalización | `integraciones`, `plantillas_documento`, `empresa_modulos` | `empresa_modulos` (empresa_id, modulo, activado) — qué módulos están contratados, eje independiente del rol |
| Suscripción y plan B2B (Bitácora → empresa cliente) | `suscripciones`, `suscripcion_cobros`, `empresa_plan_historial` | `suscripciones` (PK `empresa_id`) guarda `flow_customer_id`/`flow_subscription_id`/últimos 4 dígitos y estado (`trial`\|`activa`\|`pago_pendiente`\|`suspendida_por_pago`\|`cancelada`); `suscripcion_cobros.empresa_id → empresas`; `empresa_plan_historial` — cada cambio de plan (trial/básico/pro), quién lo hizo y si tenía cobro conectado |
| Super-Admin | `super_admins`, `super_admin_auditoria` | Identidad y auditoría fuera del modelo de tenancy normal — ver nota arriba |
| Observabilidad | `errores_backend` | Todo error no controlado de cualquier ruta cae acá vía el handler global de `server.ts` |
| Bot WhatsApp | `whatsapp_mensajes_procesados` | Sin `empresa_id` — solo dedup de mensajes por `id` de Meta |

## 6. Integraciones configuradas

| Servicio | Estado | Dónde vive | Notas |
|---|---|---|---|
| Anthropic Claude API | ✅ Real, funcionando | `backend/src/claude.ts`, key en `ANTHROPIC_API_KEY` (env) | Global para todo el backend, no por empresa; ya no aparece como card en la UI de Integraciones (se ocultó) |
| Supabase (DB + Auth + Storage) | ✅ Real, funcionando | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (env) | Login con Google requiere además habilitar el proveedor en el dashboard de Supabase Auth (paso manual, ver sección 1) |
| Storage S3-compatible | ✅ Real, funcionando | `STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` (env) — apunta al S3 de Supabase Storage | Diseñado para portar a Cloud Storage cambiando solo env vars |
| WhatsApp Cloud API (bot de choferes) | ⚠️ Código listo, sin credenciales reales | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (env, todas `[SIN_CONFIGURAR]` hoy) | Requiere que el cliente cree una cuenta de Meta Business |
| Resend (email) | ⚠️ Opcional | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (env) | Si faltan, cualquier envío (encuesta post-servicio, código de 2FA por correo, invitaciones) se omite en silencio, no rompe nada |
| Webpay / Flow / Mercado Pago (Cobros a cliente final) | ❌ Simulado | Tabla `integraciones` + `backend/src/routes/cobros.ts` | Genera un link de pago falso (`linkSimulado`), sin conexión real a ninguna pasarela — **distinto** de la fila de abajo |
| Flow (Suscripción/Plan B2B — Bitácora cobra a la empresa cliente) | ✅ Real, probado en **sandbox**, sin credenciales de producción | `backend/src/flow.ts` (cliente HTTP delgado, firma HMAC-SHA256 propia), `FLOW_API_KEY`/`FLOW_SECRET_KEY`/`FLOW_API_URL`/`FLOW_PLAN_ID_BASICO`/`FLOW_PLAN_ID_PRO` (env) | Dos Planes separados ahora (antes uno solo) porque Básico y Pro cobran distinto — se crean a mano en el panel web de Flow, no existe `plan/create` en su API. El Plan Pro **todavía no está creado** en el panel de Flow (ni en sandbox ni en producción) — el botón de pasar a Pro queda bloqueado con aviso. Falta: crear ambos Planes en el panel de **producción** (hoy solo existen en sandbox) y confirmar un ciclo de cobro real de principio a fin tras el trial de 21 días |
| Google Document AI | ❌ No implementado | Solo definido en `backend/src/routes/integraciones.ts` | Placeholder de UI, cero lógica de backend |

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
- **Se evaluó migrar a RLS "de verdad" y se descartó por ahora** — implicaría reescribir el acceso a datos de las ~46 rutas existentes contra un modelo de amenaza (todo el tráfico pasa por el propio backend, sin clientes de terceros con anon key) donde el retorno no compensaba el costo. Se optó por el "cinturón" descrito en la sección 1 como mitigación de corto plazo.
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

## 8. Pendientes y TODOs

- **No hay comentarios `TODO`/`FIXME` genéricos en el código** — los pendientes explícitos que sí existen están comentados en el archivo puntual donde aplican (ej. contenido de rubros en `backend/src/routes/sugerenciasRubro.ts`, ambigüedad de invitación pendiente en `web/src/app/auth/callback/page.tsx`).
- **Del prompt original, no iniciado o incompleto:**
  - CI/CD (GitHub Actions) — cero configuración, ni siquiera básica.
  - Deploy real a Vercel/Render — no hay config de ninguno de los dos en el repo.
  - Supabase Realtime — mencionado en el stack original, nunca usado.
  - Migración/preparación activa hacia Fase 2 (GCP) — los artefactos existen como referencia pero no se ha tocado nada para activarlos.
  - App móvil: check-in/out geolocalizado, y el login en dos pasos (2FA/Google) no llegó al móvil — solo a web.
- **Fuera del prompt original, flagged durante el desarrollo como fuera de alcance/pendiente:**
  - Integración real de pasarela de pago para **Cobros al cliente final** (hoy simulada) — no confundir con la Suscripción/Plan B2B, que sí es real.
  - **Suscripción/Plan B2B (Flow) — falta antes de producción:** crear los Planes Básico y Pro en el panel de **producción** de Flow (hoy solo existen en sandbox, y el de Pro ni siquiera existe en sandbox todavía); confirmar de principio a fin un ciclo real de cobro tras el trial de 21 días; credenciales de producción (`FLOW_API_KEY`/`FLOW_SECRET_KEY` de prod).
  - **Sugerencias por rubro solo tienen contenido para "transporte"** — falta definir y cargar sugerencias para `servicio_tecnico` y `otro` (decisión de producto, la estructura de datos ya soporta cualquier rubro).
  - **Login con Google requiere un paso manual pendiente**: habilitar el proveedor en el dashboard de Supabase Auth (Client ID/Secret de Google Cloud) — sin eso el botón no funciona.
  - **Coincidencia de invitación pendiente por correo de Google** no se resuelve automáticamente en el onboarding — limitación preexistente para cualquier método de login, no algo nuevo de Google.
  - Emisión de guía de despacho / factura electrónica ante el SII (el módulo Viajes es solo un capturador interno, no un emisor de DTE — requiere certificación aparte).
  - Bot de WhatsApp sin activar en producción (falta setup de Meta Business, no es un tema de código).
  - Búsqueda puntual de cliente/OS específica desde el Asistente conversacional (hoy solo responde con datos agregados por sección y período, no con lookups puntuales).
  - **Aislamiento multi-tenant real a nivel de base de datos** — hoy es disciplina de código + auditoría, no una barrera que la propia base de datos haga cumplir (ver sección 1).
  - Límites de uso por plan — `empresas.plan` ahora sí controla feature flags reales (módulos opcionales en Pro), pero **nada en el backend hace cumplir topes de uso** (sin límite de OS, usuarios, storage ni consumo de IA por plan).
  - Suspender una empresa desde el Panel de Super-Admin hoy solo bloquea el dashboard normal — **no se extendió al Portal de Cliente ni al bot de WhatsApp**, queda como gap conocido y explícito, no silencioso.
  - **Tabla `vehiculos` huérfana** — sigue en la base de datos sin ningún código que la use tras la fusión con Equipos; candidata a eliminarse en una migración futura una vez confirmado en producción que nadie la necesita para rollback.
