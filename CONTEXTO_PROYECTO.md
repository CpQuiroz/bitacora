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
| Autenticación | Supabase Auth (JWT). Backend valida el token con `supabase.auth.getUser(token)` en cada request (`backend/src/auth.ts`) | — |
| Multi-tenant | **Ver nota abajo — es más débil de lo que sugiere "RLS de Postgres".** Cada tabla con `empresa_id` tiene policy `empresa_id = empresa_actual()`, pero el backend consulta Supabase con la **service role key** (`backend/src/supabase.ts`), que **bypassea RLS por completo**. Las policies existen en cada migración pero son código muerto para el 100% del tráfico real. La barrera de aislamiento real hoy es la disciplina de `.eq("empresa_id", ...)` en cada ruta del backend (`backend/src/empresa.ts` resuelve el `empresaId` del usuario logueado en un middleware), reforzada por un script de auditoría heurístico (`backend/scripts/auditar-aislamiento.ts`, `npm run audit:tenant`) y por `backend/src/tenant.ts` (helpers tipados `seleccionarDeEmpresa`/`actualizarEnEmpresa`/`eliminarDeEmpresa`/`insertarEnEmpresa` sobre las ~43 tablas con `empresa_id`, recomendados para rutas nuevas) | — |
| Autenticación Super-Admin | Identidad totalmente separada de Supabase Auth y de `usuarios`/`Rol` — tabla propia `super_admins`, password con `scrypt` (Node `crypto` nativo), TOTP (RFC 6238) implementado a mano, sesión propia con token HMAC-SHA256. Sin auto-registro: la única forma de crear una cuenta es un script offline (`backend/scripts/crear-superadmin.ts`), nunca un endpoint HTTP | — |
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
│       │   ├── login/, registro/, invitacion/, onboarding/   auth previo al dashboard
│       │   └── encuesta/, agendar/[empresaId]/   rutas públicas (sin auth) —
│       │                  encuesta post-servicio y reserva online de Agenda Pro
│       ├── components/        DashboardShell, SuperAdminShell, PortalShell, ui.tsx (design
│       │                      system), AsistenteChat, NotificacionesBell, charts/
│       └── lib/                api.ts (fetch wrapper), superadminApi.ts, portalApi.ts,
│                                formatMoneda.ts, periodo.ts, etc.
├── backend/                   Express + TypeScript — API REST
│   └── src/
│       ├── routes/             ~38 archivos, un router por recurso
│       ├── superadmin/         módulo aparte del Panel de Super-Admin: auth.ts (sesión
│       │                       HMAC propia), passwords.ts (scrypt), totp.ts (RFC 6238 a
│       │                       mano), routes.ts
│       ├── server.ts           monta todas las rutas + middlewares globales + logging de
│       │                       errores a errores_backend
│       ├── auth.ts, empresa.ts, permisos.ts  middlewares: valida JWT, resuelve empresa_id,
│       │                       gatea por módulo (rol × empresa_modulos)
│       ├── tenant.ts           helpers tipados para queries scopeadas por empresa_id
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
    ├── migrations/              45 archivos SQL numerados, se aplican en orden
    └── fase2-referencia/        Terraform + RLS portable + CI — diseñados, no activados
```

**Convenciones ya establecidas:**
- Todo el código (variables, comentarios, nombres de tabla/columna) está en **español**.
- Los tipos "Row" en `types.ts` son `type`, nunca `interface` (requisito del tipado genérico de supabase-js).
- Cada router de backend sigue el mismo patrón: `ah<RequestConEmpresa>(async (req, res) => {...})` (wrapper que evita que un error async tumbe el proceso) y se monta en `server.ts` con `requiereAuth, requiereEmpresa`.
- Cada página del dashboard (`"use client"`) sigue el mismo patrón de carga: `supabase.auth.getSession()` → si no hay sesión, redirect a `/login` → `apiFetch("/api/...")`.
- Gotcha recurrente ya resuelto varias veces: `.update(objeto)` de supabase-js rechaza `Record<string, unknown>` — siempre se tipa como `Partial<TheRowType>`.
- Módulos viejos renombrados (Cadastros→Registros, Facturas→Cobros) dejaron **redirect shims** en la URL vieja (`useEffect` + `router.replace`), no duplican lógica.
- Cada empresa puede tener módulos contratados distintos (tabla `empresa_modulos`, ver sección 4) — es un eje independiente del rol: el rol decide qué ve cada persona *dentro* de su empresa, `empresa_modulos` decide qué está *contratado* por esa empresa en primer lugar. `requiereModulo()` en el backend valida ambos; el frontend oculta del sidebar lo que cualquiera de los dos ejes bloquea.
- Patrón para agregar un tipo de notificación al cliente nuevo (ya usado varias veces): sumarlo a `TipoNotificacionCliente`, y a los 4 mapas de `backend/src/notificarCliente.ts` (`ASUNTOS_DEFAULT`, `CUERPOS_DEFAULT`, `TIPO_MENSAJE`, `ENTIDAD_PORTAL`), más el check constraint correspondiente en la migración.

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
| Agenda | ✅ Implementado | `/dashboard/agenda` — calendario mensual/día que combina OS y `tareas` (eventos sin OS: recordatorios, visitas técnicas) en una sola vista |
| Agenda Pro | ✅ Implementado — **opt-in por empresa** (`empresa_modulos`, desactivado por defecto) | Paquetes de sesiones (`paquetes_sesiones` — un cliente compra un pack de N sesiones, ej. 5 o 10; el saldo restante **se calcula** a partir de las tareas del paquete, nunca se guarda como contador aparte) + citas que el cliente confirma o cancela desde el Portal, avisado por correo y WhatsApp (mismo canal general de la fila "Notificaciones al Cliente", ver abajo) — mismo mecanismo que aprobar/rechazar una cotización. **Reserva online pública** (`/agendar/[empresaId]`, sin cuenta ni login): el cliente elige horario disponible y queda una tarea con `origen = 'reserva_publica'`; horario único por empresa (`agenda_pro_horarios`, un rango por día de semana, sin turnos partidos en v1) + `agenda_pro_config` (duración de slot, anticipación mínima, días máximos de anticipación) |
| Configuración | ✅ Implementado — 12 submódulos | cuenta, empresa, plan, plantillas de documentos, checklists, tipos de OS, integraciones, categorías de gasto, centros de costo, inventario, notificaciones, seguridad |
| Registros (ex-"Cadastros") | ✅ Implementado | Clientes (con ficha/historial, WhatsApp directo desde el teléfono), Equipos, Catálogo (con kits), Inventario, Proveedores |
| Gestión de Colaboradores / Flota | ✅ Implementado | Colaboradores, Vehículos, Documentos con vencimiento (licencias, permisos de circulación, etc. — tipos de documento configurables por empresa, alerta de "por vencer") |
| Órdenes de Servicio digitales | ✅ Implementado | Checklist, fotos (con análisis de IA por foto), firma del cliente, folio correlativo, PDF |
| Financiero | ✅ Implementado | Cotizaciones (con ítems, IVA, "Convertir a OS", aprobar/rechazar por el cliente desde el Portal), Gastos (con categoría/centro de costo/proveedor real), Cobros (ex-"Facturas": cliente real, medio de pago, link de pago **simulado**) |
| Informes | ✅ Implementado | 7 pestañas de analítica (Visión General, Financiero, Ventas, Operaciones, Servicios, Clientes, **Gastos** — unificada, con selector interno de agrupación: por categoría / centro de costo / orden de servicio, antes eran 3 pestañas separadas) + selector de período compartido + export CSV/PDF |
| Informe IA | ✅ Implementado | 3 modos: estructurado (tipo fijo), libre (texto+fotos), personalizado (secciones a elección + plantillas guardables) |
| Asistente conversacional | ✅ Implementado | Chat flotante con tool-use de Claude sobre datos reales del negocio, historial persistente por usuario |
| Viajes (transporte) | ✅ Implementado | Guías, km, IVA por viaje, resumen semanal/mensual, agrupar en factura |
| Notificaciones al Cliente + Portal de Cliente | ✅ Implementado | Avisos automáticos al cliente (cotización enviada/por vencer, técnico en camino, OS completada, cobro pendiente/vencido, cita agendada) por **correo** (mensaje y asunto personalizables por tipo, switch on/off por tipo) y por **WhatsApp** (segundo canal genérico — mismo texto base editable por tipo vía `mensajes_personalizados.mensaje_whatsapp`, pero con un único interruptor maestro `whatsapp_activado` para los 7 tipos juntos, sin on/off por tipo como sí tiene correo), historial de envíos con reintento manual. El correo incluye un link temporal (`portal_accesos`) a un Portal de Cliente propio (`/portal/*`, sin cuenta de Bitácora, login recurrente por código de 6 dígitos) donde el cliente ve/descarga OS y cotizaciones en PDF, aprueba/rechaza cotizaciones, confirma/cancela citas de Agenda Pro y revisa sus cobros |
| Suscripción y cobro B2B (Bitácora cobrándole a sus empresas clientes) | ✅ Implementado — probado en **sandbox real de Flow**, no en producción | Configuración → Plan: registro de tarjeta vía Flow/Webpay Oneclick (nunca pasa por el backend propio), 21 días de trial, suscripción mensual automática, historial de cobros, cancelación self-service. Panel de Super-Admin ve estado de suscripción por empresa. Gotcha real encontrado y corregido probando contra el sandbox: Flow **no** agrega `?token=` a la URL de retorno tras registrar la tarjeta (a diferencia de lo asumido inicialmente) — el backend revisa de forma perezosa (`GET /api/suscripcion`) si hay un customer de Flow sin tarjeta confirmada todavía, en vez de depender de ese parámetro. Ver sección 8 para lo que falta antes de producción |
| Panel de Super-Administrador | ✅ Implementado — reservado al dueño del producto, fuera del alcance de cualquier usuario de empresa | `/superadmin/*`, identidad y auth 100% separadas (ver sección 1). Por empresa: activar/suspender/dar de baja (bloquea el acceso completo salvo `/api/me`, para poder mostrar el motivo), cambiar plan, exportar todos sus datos como descarga de archivo (nunca se renderiza en el panel — deliberado, para no tener que "ver" datos operativos de un cliente), eliminar permanentemente (mismo patrón de confirmación por nombre exacto que el self-service de la empresa), activar/desactivar módulos contratados. Salud por empresa: última actividad, usuarios activos del mes, OS creadas del mes, uso de storage, consumo de Claude del mes por feature (tokens, sin precio hardcodeado), últimos errores de backend |
| Bot de WhatsApp | ⚠️ Código completo, **no activo en producción** | Falta que el cliente conecte una cuenta real de Meta Business (`WHATSAPP_ACCESS_TOKEN` y afines sin configurar) |
| App móvil (Expo) | ⚠️ Parcial | Solo 4 pantallas: Login, Trabajos (lista), TrabajoDetalle (checklist + fotos + firma + campos dinámicos por tipo de trabajo), Ruta. **No implementado:** check-in/out geolocalizado |
| Integraciones de pago para Cobros del cliente final (Webpay/Flow/Mercado Pago) | ⚠️ Solo simulado | La UI permite "conectar" y guarda un toggle `conectado`, pero el link de pago generado es **`linkSimulado`** — no hay integración real con ninguna pasarela. **No confundir con la Suscripción B2B de arriba**: son dos integraciones de Flow completamente distintas — esta es para que la empresa cliente le cobre a *su propio* cliente final (sin implementar); la otra es Bitácora cobrándole a la empresa cliente su suscripción mensual (sí implementada, en sandbox) |
| Google Document AI | ❌ No implementado | Existe como opción seleccionable en Configuración → Integraciones (nombre, descripción, campos) pero **ningún código del backend la usa** — es un placeholder en la UI |
| Anthropic como "integración" | ⚠️ Engañoso en la UI | Aparece en Configuración → Integraciones como si fuera por-empresa, pero el backend **siempre** usa la key global `ANTHROPIC_API_KEY` del `.env` — el toggle de la UI no afecta nada. Sí queda instrumentado por-empresa a nivel de *medición* (tabla `ia_uso`, visible en la salud del Panel de Super-Admin), aunque la key en sí sigue siendo global |

## 5. Modelo de datos

Esquema real (consultado en vivo, 56 tablas, 102 foreign keys, 45 migraciones aplicadas). Todas tienen `empresa_id` y policy RLS `empresa_id = empresa_actual()` (recordatorio: esa policy no se ejecuta contra el tráfico real — ver la fila "Multi-tenant" de la sección 1), salvo:
- `empresas` misma,
- `whatsapp_mensajes_procesados` (ledger de idempotencia sin dueño, solo `id` de Meta),
- `notificaciones_preferencias` (se acota por `usuario_id`, no por empresa — un usuario ya pertenece a una sola empresa),
- `super_admins` (identidad global, intencionalmente fuera de cualquier empresa — ver sección 1).

`super_admin_auditoria` sí tiene `empresa_id`, pero **nullable** con `on delete set null` — una acción de auditoría sobre una empresa que después se elimina no debe desaparecer, solo perder la referencia (el nombre de la empresa queda igual en el texto del detalle).

| Dominio | Tablas | Relaciones clave |
|---|---|---|
| Núcleo / tenancy | `empresas`, `usuarios` | `usuarios.empresa_id → empresas`; `usuarios.id → auth.users` (Supabase Auth) |
| Clientes y activos | `clientes`, `equipos` | `equipos.cliente_id → clientes` |
| Trabajo genérico (OS/OT) | `trabajos`, `tipos_trabajo`, `tipos_os`, `ordenes_servicio`, `os_items`, `checklist_templates`, `analisis_fotos` | `trabajos.tipo_trabajo_id/tipo_os_id/responsable_id/ruta_id/cliente_id`; `ordenes_servicio.trabajo_id`; `analisis_fotos.orden_servicio_id`; `os_items.catalogo_item_id → catalogo_items` (nullable, `on delete set null` — agregada para que un ítem de OS pueda venir del Catálogo o ser texto libre manual, igual que ya funcionaba `presupuesto_items`) |
| Agenda | `tareas`, `paquetes_sesiones`, `agenda_pro_config`, `agenda_pro_horarios` | `tareas.cliente_id → clientes`, `.responsable_id → usuarios`, `.paquete_id → paquetes_sesiones` (nullable), `.origen` ('manual'\|'reserva_publica'); `paquetes_sesiones.cliente_id → clientes` — saldo de sesiones siempre calculado, nunca columna propia; `agenda_pro_config`/`agenda_pro_horarios` (PK/FK por `empresa_id`) — configuración de la reserva online pública de Agenda Pro |
| Transporte | `viajes` | `viajes.cliente_id`, `.chofer_id → usuarios`, `.factura_id → facturas` |
| Catálogo / inventario | `catalogo_items`, `catalogo_kit_items`, `inventario`, `inventario_movimientos` | `catalogo_kit_items` relaciona kit↔item (self-referencia a `catalogo_items`) |
| Financiero | `presupuestos` (cotizaciones), `presupuesto_items`, `facturas` (Cobros), `gastos`, `gastos_fijos`, `categorias_gasto`, `centros_costo`, `proveedores` | `presupuestos.trabajo_id` (conversión a OS); `facturas.viaje_ids`/`trabajo_ids` (arrays, agrupan varios en una factura) |
| Rutas | `rutas_planificadas` | `.responsable_id → usuarios` |
| Flota | `vehiculos`, `vehiculo_asignaciones`, `documentos`, `tipos_documento` | `documentos.entidad_tipo` ('colaborador'\|'vehiculo') + `entidad_id` (polimórfico); alerta de vencimiento por fecha |
| IA / informes | `informes_generados`, `informes_personalizados`, `asistente_mensajes`, `ia_uso` | `informes_generados.personalizado_id → informes_personalizados`; `ia_uso` registra tokens de entrada/salida por feature (`analisis_foto`, `informe_os`, `extraer_guia`, `informe_libre/estructurado/personalizado`, `asistente`) para la salud del Super-Admin |
| Notificaciones internas | `notificaciones`, `notificaciones_preferencias` | Feed de campana en el dashboard — distinto del correo al cliente |
| Notificaciones al cliente + Portal | `notificaciones_config`, `mensajes_personalizados`, `notificaciones_cliente_log`, `portal_accesos`, `portal_codigos` | `portal_accesos` genera el link temporal (7 días) que llega en el correo; `portal_codigos` es el login recurrente de 6 dígitos, hasheado, 10 min |
| Config / personalización | `integraciones`, `plantillas_documento`, `empresa_modulos` | `empresa_modulos` (empresa_id, modulo, activado) — qué módulos están contratados, eje independiente del rol |
| Suscripción B2B (Bitácora → empresa cliente) | `suscripciones`, `suscripcion_cobros` | `suscripciones` (PK `empresa_id`) guarda `flow_customer_id`/`flow_subscription_id`/últimos 4 dígitos y marca de tarjeta/estado (`trial`\|`activa`\|`pago_pendiente`\|`suspendida_por_pago`\|`cancelada`); `suscripcion_cobros.empresa_id → empresas`, historial de intentos de cobro |
| Super-Admin | `super_admins`, `super_admin_auditoria` | Identidad y auditoría fuera del modelo de tenancy normal — ver nota arriba |
| Observabilidad | `errores_backend` | Todo error no controlado de cualquier ruta cae acá vía el handler global de `server.ts`, sin tocar los ~38 archivos de rutas uno por uno |
| Bot WhatsApp | `whatsapp_mensajes_procesados` | Sin `empresa_id` — solo dedup de mensajes por `id` de Meta |

## 6. Integraciones configuradas

| Servicio | Estado | Dónde vive | Notas |
|---|---|---|---|
| Anthropic Claude API | ✅ Real, funcionando | `backend/src/claude.ts`, key en `ANTHROPIC_API_KEY` (env) | Global para todo el backend, no por empresa (ver tabla de módulos) |
| Supabase (DB + Auth + Storage) | ✅ Real, funcionando | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (env) | — |
| Storage S3-compatible | ✅ Real, funcionando | `STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` (env) — apunta al S3 de Supabase Storage | Diseñado para portar a Cloud Storage cambiando solo env vars |
| WhatsApp Cloud API (bot de choferes) | ⚠️ Código listo, sin credenciales reales | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (env, todas `[SIN_CONFIGURAR]` hoy) | Requiere que el cliente cree una cuenta de Meta Business |
| Resend (email) | ⚠️ Opcional | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (env) | Si faltan, el envío de encuesta post-servicio se omite en silencio, no rompe nada |
| Webpay / Flow / Mercado Pago (Cobros a cliente final) | ❌ Simulado | Tabla `integraciones` + `backend/src/routes/cobros.ts` | Genera un link de pago falso (`linkSimulado`), sin conexión real a ninguna pasarela — **distinto** de la fila de abajo |
| Flow (Suscripción B2B — Bitácora cobra a la empresa cliente) | ✅ Real, probado en **sandbox**, sin credenciales de producción | `backend/src/flow.ts` (cliente HTTP delgado, firma HMAC-SHA256 propia), `FLOW_API_KEY`/`FLOW_SECRET_KEY`/`FLOW_API_URL`/`FLOW_PLAN_ID` (env) | El Plan mensual (monto, moneda, ciclo, días de trial, reintentos) se crea a mano en el panel web de Flow — **no existe** `plan/create` en su API (confirmado contra el sandbox real). Falta: crear el Plan en el panel de **producción** de Flow (hoy solo existe en sandbox) y confirmar un ciclo de cobro real de principio a fin — el trial es de 21 días, así que ese ciclo todavía no se ha podido observar |
| Google Document AI | ❌ No implementado | Solo definido en `backend/src/routes/integraciones.ts` | Placeholder de UI, cero lógica de backend |

*(Ningún valor real de credencial está en este documento — todos son nombres de variable de entorno.)*

## 7. Decisiones técnicas ya tomadas (no estaban en el prompt original)

- **Sin ORM:** el prompt original no especificaba uno; se optó por `supabase-js` directo + tipado manual centralizado en `packages/shared/src/types.ts`, en vez de Prisma/Drizzle.
- **Sin librería de componentes UI:** design system propio sobre Tailwind v4 (`ui.tsx`) en vez de shadcn/Radix — decisión tomada para tener control total del theming por-empresa.
- **PDF con `pdfkit` puro**, no un motor de plantillas HTML→PDF (Puppeteer, react-pdf) — más liviano, sin dependencia de un navegador headless en el backend.
- **Recharts** para gráficos (no elegido en el prompt original).
- **Leaflet** para mapas de rutas (no Google Maps — evita costo de API key de mapas).
- **`viajes` volvió a existir** (migración 25) después de haber sido generalizada a `trabajos` en la migración 04 original — ahora con un propósito distinto y acotado (guías de despacho de transporte), coexistiendo con `trabajos` para el resto de rubros.
- **Bot de WhatsApp construido sobre la Cloud API de Meta directa** (no un BSP como Twilio/360dialog) — sin costo de intermediario, pero requiere que el cliente gestione su propia cuenta de Meta Business.
- **Paleta de color y tipografía rediseñadas** recientemente (azul marino + acento ámbar, sobre la base de Tailwind/Geist que ya existía) — decisión de producto, no estaba en el prompt original.
- **Terminología "Órdenes de Trabajo/Servicio"** (en vez de solo "Órdenes de Servicio") en toda la UI — para cubrir que distintas empresas usan uno u otro término.
- **Panel de Super-Administrador no estaba en el prompt original** — se sumó como necesidad real de operar el negocio (activar/suspender clientes, ver salud, cortar el gasto de IA de una empresa problemática) una vez que hubo empresas de prueba corriendo. Se decidió explícitamente construirlo con identidad separada de Supabase Auth en vez de "un rol admin más alto" — para que ni un bug de permisos ni una fuga de un token de usuario normal puedan escalar a control total de la plataforma.
- **Se evaluó migrar a RLS "de verdad" (que el backend consultara con un cliente que sí la respete) y se descartó por ahora** — implicaría reescribir el acceso a datos de las ~38 rutas existentes, semanas de trabajo, contra un modelo de amenaza (todo el tráfico pasa por el propio backend, no hay clientes de terceros con anon key) donde el retorno no compensaba el costo. Se optó por el "cinturón" descrito en la sección 1 (auditoría + convención + helpers tipados) como mitigación de corto plazo, con la puerta abierta a revisar la decisión si el modelo de amenaza cambia (ej. si se expone un cliente público con anon key).
- **Módulos opt-in por empresa** (`empresa_modulos`) en vez de una tabla de "planes con features fijas" — permite prender una funcionalidad nueva (hoy Agenda Pro) para una empresa puntual sin necesidad de definir un plan comercial nuevo primero.
- **Saldo de paquetes de sesiones (Agenda Pro) es siempre calculado, nunca una columna con contador** — mismo criterio ya usado para "estado de documento" en Flota: evita que un contador aparte se desincronice de la realidad si algo falla a mitad de camino.
- **Confirmar/cancelar cita desde el Portal reutiliza el mecanismo de aprobar/rechazar cotización tal cual** (mismas piezas: `notificarCliente`, `portal_accesos`, patrón `resolverXDelCliente`) — no se construyó un sistema nuevo, se extendió el existente.
- **Reserva online pública de Agenda Pro con horario único por empresa** (no por responsable individual) — decisión explícita para v1, más simple de construir y mantener; el responsable se asigna después, igual que ya pasa con las tareas creadas a mano. Sin turnos partidos.
- **Selector de Catálogo unificado**: un solo componente (`CatalogoSelectorModal`) para elegir ítems del Catálogo, usado tanto en Órdenes de Servicio como en Cotizaciones — reemplazó un `<select>` nativo duplicado (sin buscador ni stock) en Cotizaciones, y le dio a OS integración con Catálogo por primera vez (antes sus ítems eran 100% texto libre).
- **Verificación de estado de Flow por "lazy check" en vez de depender de un parámetro de retorno en la URL** — mismo patrón ya usado para `revisarCotizacionesPorVencer` (chequeo sin cron, disparado por una ruta que igual se llama seguido). Se adoptó tras confirmar contra el sandbox real que Flow no siempre devuelve lo que la integración esperaba.
- **Las 3 pestañas de Gastos en Informes se unificaron en una sola** con un selector interno de agrupación (categoría / centro de costo / orden de servicio) — dos de las tres ya compartían backend y componente antes de unificarlas; la tercera ("Gastos en OS") tenía KPIs y alcance de datos distintos, así que se adoptó el diseño de las otras dos y se mantuvo su filtro original (solo gastos vinculados a una OS), como decisión de producto explícita.

## 8. Pendientes y TODOs

- **No hay comentarios `TODO`/`FIXME` en el código** (backend, web ni mobile) — el repo no tiene deuda técnica marcada explícitamente.
- **Del prompt original, no iniciado o incompleto:**
  - CI/CD (GitHub Actions) — cero configuración, ni siquiera básica.
  - Deploy real a Vercel/Render — no hay config de ninguno de los dos en el repo.
  - Supabase Realtime — mencionado en el stack original, nunca usado.
  - Migración/preparación activa hacia Fase 2 (GCP) — los artefactos existen como referencia pero no se ha tocado nada para activarlos.
  - App móvil: check-in/out geolocalizado (mencionado explícitamente en el prompt original como parte del flujo de terreno) — no implementado.
- **Fuera del prompt original, flagged durante el desarrollo como fuera de alcance/pendiente:**
  - Integración real de pasarela de pago para **Cobros al cliente final** (hoy simulada) — no confundir con la Suscripción B2B, que sí es real (ver abajo).
  - **Suscripción B2B (Flow) — falta antes de producción:** crear el Plan en el panel de **producción** de Flow (hoy solo existe en sandbox, id `orbix-2026`); confirmar de principio a fin un ciclo real de cobro tras el trial de 21 días (el webhook de cobro fallido/exitoso está escrito pero no se ha podido observar un evento real todavía); pedir credenciales de producción (`FLOW_API_KEY`/`FLOW_SECRET_KEY` de prod, distintas a las de sandbox).
  - Emisión de guía de despacho / factura electrónica ante el SII (el módulo Viajes es solo un capturador interno, no un emisor de DTE — requiere certificación aparte).
  - Bot de WhatsApp sin activar en producción (falta setup de Meta Business, no es un tema de código).
  - Búsqueda puntual de cliente/OS específica desde el Asistente conversacional (hoy solo responde con datos agregados por sección y período, no con lookups puntuales).
  - **Aislamiento multi-tenant real a nivel de base de datos** — hoy es disciplina de código + auditoría, no una barrera que la propia base de datos haga cumplir (ver sección 1). Evaluado y descartado por ahora (ver sección 7); revisar si algún día se expone un cliente de terceros con acceso directo a Supabase.
  - Límites de uso por plan — `empresas.plan` existe (`trial`/`basico`/`pro`) y es visible/editable desde el Panel de Super-Admin, pero **nada en el backend lo hace cumplir todavía** (sin tope de OS, usuarios, storage ni consumo de IA por plan).
  - Suspender una empresa desde el Panel de Super-Admin hoy solo bloquea el dashboard normal — **no se extendió al Portal de Cliente ni al bot de WhatsApp**, queda como gap conocido y explícito, no silencioso.
