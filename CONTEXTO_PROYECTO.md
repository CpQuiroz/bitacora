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
| Multi-tenant | RLS de Postgres: cada tabla tiene policy `empresa_id = empresa_actual()`. El backend además resuelve `empresaId` del usuario logueado en un middleware (`backend/src/empresa.ts`) y filtra explícito por `empresa_id` en cada query — doble capa | — |
| Mobile | Expo + React Native | Expo ~57, RN 0.86, React 19.2.3 |
| IA | Anthropic Claude API (`@anthropic-ai/sdk`), modelo `claude-sonnet-5` | ^0.68 |
| Storage de archivos | Capa propia S3-compatible (`backend/src/storage.ts`, sobre `@aws-sdk/client-s3`) apuntando al endpoint S3 de Supabase Storage | — |
| PDF | `pdfkit` (generación programática, sin plantillas HTML) | ^0.20 |
| Email | Resend — **opcional**, si falta la API key se omite en silencio | — |
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
│       │   ├── dashboard/     ~20 módulos, cada carpeta = una sección del sidebar
│       │   ├── login/, registro/, invitacion/, onboarding/   auth previo al dashboard
│       │   └── encuesta/      única ruta pública (sin auth) — encuesta post-servicio
│       ├── components/        DashboardShell, ui.tsx (design system), AsistenteChat, charts/
│       └── lib/                api.ts (fetch wrapper), formatMoneda.ts, periodo.ts, etc.
├── backend/                   Express + TypeScript — API REST
│   └── src/
│       ├── routes/             29 archivos, un router por recurso
│       ├── server.ts           monta todas las rutas + middlewares globales
│       ├── auth.ts, empresa.ts  middlewares: valida JWT, resuelve empresa_id
│       ├── claude.ts           cliente Anthropic + prompts de IA
│       ├── whatsapp.ts, routes/whatsapp.ts   bot de WhatsApp (webhook Meta Cloud API)
│       ├── storage.ts          capa S3 (fotos, firmas, comprobantes, anexos)
│       └── generarPdfOS.ts, generarPdfInforme.ts   PDFs con pdfkit
├── mobile/                     Expo — app para choferes/técnicos en terreno (parcial)
│   └── screens/                 solo 4 pantallas (ver más abajo, sección 4)
├── packages/shared/            tipos TypeScript compartidos entre los 3 apps
│   └── src/
│       ├── types.ts             única fuente de verdad de cada tabla (Row types)
│       ├── supabase.ts          factory del cliente supabase-js tipado
│       └── rut.ts               validación/formato de RUT chileno
└── supabase/
    ├── migrations/              26 archivos SQL numerados, se aplican en orden
    └── fase2-referencia/        Terraform + RLS portable + CI — diseñados, no activados
```

**Convenciones ya establecidas:**
- Todo el código (variables, comentarios, nombres de tabla/columna) está en **español**.
- Los tipos "Row" en `types.ts` son `type`, nunca `interface` (requisito del tipado genérico de supabase-js).
- Cada router de backend sigue el mismo patrón: `ah<RequestConEmpresa>(async (req, res) => {...})` (wrapper que evita que un error async tumbe el proceso) y se monta en `server.ts` con `requiereAuth, requiereEmpresa`.
- Cada página del dashboard (`"use client"`) sigue el mismo patrón de carga: `supabase.auth.getSession()` → si no hay sesión, redirect a `/login` → `apiFetch("/api/...")`.
- Gotcha recurrente ya resuelto varias veces: `.update(objeto)` de supabase-js rechaza `Record<string, unknown>` — siempre se tipa como `Partial<TheRowType>`.
- Módulos viejos renombrados (Cadastros→Registros, Facturas→Cobros) dejaron **redirect shims** en la URL vieja (`useEffect` + `router.replace`), no duplican lógica.

## 3. Sistema de theming

- **Fuente de verdad:** `web/src/app/globals.css`. Variables CSS (`--background`, `--brand`, `--brand-soft`, `--accent`, `--success/--warning/--danger` + `-soft`), mapeadas a clases Tailwind vía `@theme inline`. Define paleta clara y oscura (`@media (prefers-color-scheme: dark)`).
- **Personalización por empresa:** la tabla `empresas` tiene `color_primario`, `color_primario_foreground` (calculado por luminancia al guardar), `color_secundario`, `fuente`, `logo_url`, `moneda`. Estos valores se inyectan como **overrides CSS inline** en `DashboardShell.tsx` (vía `style={{...}}` con `--brand`, `--brand-soft` calculado con `color-mix()`, etc.) — cada empresa puede tener su propio color de marca sin tocar CSS global ni redeploy.
- **Tipografía:** Geist (`next/font/google`) por defecto; el helper `web/src/lib/fuentes.ts` permite que una empresa elija otra fuente del sistema.
- **PDFs — sí existen, ya generan branding real:**
  - `backend/src/generarPdfOS.ts` — orden de servicio cerrada y firmada.
  - `backend/src/generarPdfInforme.ts` — informe con IA (estructurado o personalizado).
  - Ambos usan `pdfkit` puro (no hay plantilla HTML→PDF) y reciben `empresaNombre`, `empresaLogoUrl`, `colorPrimario` como parámetros — el PDF hereda el logo y color de cada empresa, no un tema fijo.

## 4. Módulos implementados (estado real)

| Módulo | Estado | Notas |
|---|---|---|
| Layout / Shell | ✅ Implementado | Sidebar colapsable + drawer móvil, dropdown de usuario, chat flotante del Asistente en todas las páginas |
| Agenda | ✅ Implementado | `/dashboard/agenda` |
| Configuración | ✅ Implementado — 12 submódulos | cuenta, empresa, plan, plantillas de documentos, checklists, tipos de OS, integraciones, categorías de gasto, centros de costo, inventario, notificaciones, seguridad |
| Registros (ex-"Cadastros") | ✅ Implementado | Clientes (con ficha/historial), Equipos, Catálogo (con kits), Inventario, Proveedores |
| Órdenes de Servicio digitales | ✅ Implementado | Checklist, fotos (con análisis de IA por foto), firma del cliente, folio correlativo, PDF |
| Financiero | ✅ Implementado | Cotizaciones (con ítems, IVA, "Convertir a OS"), Gastos (con categoría/centro de costo/proveedor real), Cobros (ex-"Facturas": cliente real, medio de pago, link de pago **simulado**) |
| Informes | ✅ Implementado | 9 pestañas de analítica (Visión General, Financiero, Ventas, Operaciones, Servicios, Clientes, Gastos×3) + selector de período compartido + export CSV/PDF |
| Informe IA | ✅ Implementado | 3 modos: estructurado (tipo fijo), libre (texto+fotos), personalizado (secciones a elección + plantillas guardables) |
| Asistente conversacional | ✅ Implementado | Chat flotante con tool-use de Claude sobre datos reales del negocio, historial persistente por usuario |
| Viajes (transporte) | ✅ Implementado | Guías, km, IVA por viaje, resumen semanal/mensual, agrupar en factura |
| Bot de WhatsApp | ⚠️ Código completo, **no activo en producción** | Falta que el cliente conecte una cuenta real de Meta Business (`WHATSAPP_ACCESS_TOKEN` y afines sin configurar) |
| App móvil (Expo) | ⚠️ Parcial | Solo 4 pantallas: Login, Trabajos (lista), TrabajoDetalle (checklist + fotos + firma + campos dinámicos por tipo de trabajo), Ruta. **No implementado:** check-in/out geolocalizado |
| Integraciones de pago (Webpay/Flow/Mercado Pago) | ⚠️ Solo simulado | La UI permite "conectar" y guarda un toggle `conectado`, pero el link de pago generado es **`linkSimulado`** — no hay integración real con ninguna pasarela |
| Google Document AI | ❌ No implementado | Existe como opción seleccionable en Configuración → Integraciones (nombre, descripción, campos) pero **ningún código del backend la usa** — es un placeholder en la UI |
| Anthropic como "integración" | ⚠️ Engañoso en la UI | Aparece en Configuración → Integraciones como si fuera por-empresa, pero el backend **siempre** usa la key global `ANTHROPIC_API_KEY` del `.env` — el toggle de la UI no afecta nada |

## 5. Modelo de datos

Esquema real (consultado en vivo, 33 tablas, 63 foreign keys). Todas tienen `empresa_id` y RLS `empresa_id = empresa_actual()`, salvo `empresas` misma y `whatsapp_mensajes_procesados` (ledger de idempotencia sin dueño).

| Dominio | Tablas | Relaciones clave |
|---|---|---|
| Núcleo / tenancy | `empresas`, `usuarios` | `usuarios.empresa_id → empresas`; `usuarios.id → auth.users` (Supabase Auth) |
| Clientes y activos | `clientes`, `equipos` | `equipos.cliente_id → clientes` |
| Trabajo genérico (OS/OT) | `trabajos`, `tipos_trabajo`, `tipos_os`, `ordenes_servicio`, `os_items`, `checklist_templates`, `analisis_fotos` | `trabajos.tipo_trabajo_id/tipo_os_id/responsable_id/ruta_id/cliente_id`; `ordenes_servicio.trabajo_id`; `analisis_fotos.orden_servicio_id` |
| Transporte | `viajes` | `viajes.cliente_id`, `.chofer_id → usuarios`, `.factura_id → facturas` |
| Catálogo / inventario | `catalogo_items`, `catalogo_kit_items`, `inventario`, `inventario_movimientos` | `catalogo_kit_items` relaciona kit↔item (self-referencia a `catalogo_items`) |
| Financiero | `presupuestos` (cotizaciones), `presupuesto_items`, `facturas` (Cobros), `gastos`, `gastos_fijos`, `categorias_gasto`, `centros_costo`, `proveedores` | `presupuestos.trabajo_id` (conversión a OS); `facturas.viaje_ids`/`trabajo_ids` (arrays, agrupan varios en una factura) |
| Rutas | `rutas_planificadas` | `.responsable_id → usuarios` |
| IA / informes | `informes_generados`, `informes_personalizados`, `asistente_mensajes` | `informes_generados.personalizado_id → informes_personalizados` |
| Config / personalización | `integraciones`, `notificaciones_config`, `mensajes_personalizados`, `plantillas_documento` | — |
| Bot WhatsApp | `whatsapp_mensajes_procesados` | Sin `empresa_id` — solo dedup de mensajes por `id` de Meta |

## 6. Integraciones configuradas

| Servicio | Estado | Dónde vive | Notas |
|---|---|---|---|
| Anthropic Claude API | ✅ Real, funcionando | `backend/src/claude.ts`, key en `ANTHROPIC_API_KEY` (env) | Global para todo el backend, no por empresa (ver tabla de módulos) |
| Supabase (DB + Auth + Storage) | ✅ Real, funcionando | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (env) | — |
| Storage S3-compatible | ✅ Real, funcionando | `STORAGE_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` (env) — apunta al S3 de Supabase Storage | Diseñado para portar a Cloud Storage cambiando solo env vars |
| WhatsApp Cloud API (bot de choferes) | ⚠️ Código listo, sin credenciales reales | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET` (env, todas `[SIN_CONFIGURAR]` hoy) | Requiere que el cliente cree una cuenta de Meta Business |
| Resend (email) | ⚠️ Opcional | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (env) | Si faltan, el envío de encuesta post-servicio se omite en silencio, no rompe nada |
| Webpay / Flow / Mercado Pago | ❌ Simulado | Tabla `integraciones` + `backend/src/routes/cobros.ts` | Genera un link de pago falso (`linkSimulado`), sin conexión real a ninguna pasarela |
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

## 8. Pendientes y TODOs

- **No hay comentarios `TODO`/`FIXME` en el código** (backend, web ni mobile) — el repo no tiene deuda técnica marcada explícitamente.
- **Del prompt original, no iniciado o incompleto:**
  - CI/CD (GitHub Actions) — cero configuración, ni siquiera básica.
  - Deploy real a Vercel/Render — no hay config de ninguno de los dos en el repo.
  - Supabase Realtime — mencionado en el stack original, nunca usado.
  - Migración/preparación activa hacia Fase 2 (GCP) — los artefactos existen como referencia pero no se ha tocado nada para activarlos.
  - App móvil: check-in/out geolocalizado (mencionado explícitamente en el prompt original como parte del flujo de terreno) — no implementado.
- **Fuera del prompt original, flagged durante el desarrollo como fuera de alcance/pendiente:**
  - Integración real de pasarela de pago (hoy simulada).
  - Emisión de guía de despacho / factura electrónica ante el SII (el módulo Viajes es solo un capturador interno, no un emisor de DTE — requiere certificación aparte).
  - Bot de WhatsApp sin activar en producción (falta setup de Meta Business, no es un tema de código).
  - Búsqueda puntual de cliente/OS específica desde el Asistente conversacional (hoy solo responde con datos agregados por sección y período, no con lookups puntuales).
