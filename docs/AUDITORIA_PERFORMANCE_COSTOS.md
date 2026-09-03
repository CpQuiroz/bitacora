# Auditoría de Performance y Costos de Infraestructura — Bitácora

> **Fecha:** 3-sep-2026 · **Alcance:** análisis estático de código + proyección de
> costos. **No es un benchmark medido.**
>
> Bitácora está en producción con **un solo cliente piloto** (Transportes Itineris) y
> la base de prod tiene datos de prueba: 2 empresas, 5 OS, 1 foto, 15 MB de DB, 128 KB
> de Storage. **No hay tráfico real para un profiling.** Todo lo de la sección de costos
> es una **estimación** basada en un modelo de "empresa activa típica" (definido en §6)
> multiplicado por N — **no son cifras garantizadas.**
>
> No se modificó código ni configuración de ningún proveedor.

---

## Resumen ejecutivo

**Código — nada urgente hoy, todo es "importa a partir de X empresas":**

- **Sin paginación** en 6 endpoints de listado core (`GET /api/trabajos`,
  `/api/ordenes-servicio`, `/api/clientes`, `/api/viajes`, `/api/cotizaciones`,
  `/api/gastos`). Con 1 empresa nueva, imperceptible. Con una empresa de 2-3 años
  (miles de OS) cada carga de esa pantalla trae todo el historial. **Arreglar antes del
  onboarding masivo, es barato** (agregar `.range()` + scroll infinito o páginas).
- **11 tablas de tenant sin índice en `empresa_id`** — de esas, 4 importan
  (`usuarios`, `inventario_movimientos`, `inventario`, `accesos_usuario`). Las otras 7
  son config chica o se cubren por otro índice vía join. **Arreglar ahora, es 1
  migración de 4 líneas.**
- **Agregaciones del dashboard** traen los sets de filas completos y suman en memoria
  (bien hecho: no es N+1), pero sin cota temporal → una empresa de 3 años carga ~10-20K
  filas por dashboard. **Mover a RPC de Postgres cuando duela** (ya hay precedente:
  `superadmin_metricas_calcular`).
- **PDF workers:** un `new Worker` por request, sin pool ni límite. En Render free
  (512 MB) 10 PDFs concurrentes pueden hacer OOM. **Revisar antes de escalar.**
- **Concurrencia de Claude:** límite hardcodeado en 8, cola sin cota. A fin de mes con
  20+ empresas corriendo informes a la vez, la cola crece sin techo.
- **Frontend:** Recharts (340 KB) y Leaflet (148 KB) sin code-splitting; Recharts se
  carga en el dashboard home. Es UX (first load), no costo de servidor.

**Costos — la única línea peligrosa al escalar es la API de Anthropic:**

| Escenario | Infra/mes (IA **apagada**, como está hoy) | Infra/mes (IA **encendida**) |
|---|---|---|
| 1 empresa | ~US$45 | ~US$54 |
| 5 empresas | ~US$52 | ~US$95 |
| 20 empresas | ~US$72 | ~US$245 |
| 50 empresas | ~US$105 | ~US$537 |

- Con IA apagada, el costo marginal por empresa al escalar cae a **~US$2-4/mes** — muy
  por debajo del plan Básico (~US$53/mes). La premisa de `limites.ts` se sostiene.
- Con IA encendida, a 50 empresas la API de Anthropic sola es **~US$430/mes** (el 80%
  del costo de infra). Si el uso real por empresa fuera 2-3× la estimación (asistente
  intensivo + análisis de fotos en todas las OS), Anthropic solo podría llegar a
  **~50% del margen del plan Básico**. **Es lo que hay que instrumentar y vigilar.**
- **Supabase Free ya no alcanza** ni con 1 empresa activa (el egress mensual estimado,
  ~8 GB, supera los 5 GB del plan Free). Hay que pasar a **Pro (US$25/mes)** apenas
  Transportes Itineris tenga uso real.

---

## 1. Hallazgos de código

| # | Sev. | Tipo | Ubicación | Descripción | Cuándo importa |
|---|---|---|---|---|---|
| 1 | Media | Sin paginación | `backend/src/routes/trabajos.ts:100-127` (`GET /`), `backend/src/routes/ordenesServicio.ts:19-46` (`GET /`), `backend/src/routes/clientes.ts:11-18`, `backend/src/routes/viajes.ts:14-40`, `backend/src/routes/cotizaciones.ts:125-145`, `backend/src/routes/gastos.ts:42-55` | Ningún `.range()` ni `.limit()`. `.order("fecha")` sobre todo el historial de la empresa. `ordenes-servicio` y `gastos` además traen relaciones embebidas (`cliente_info`, `responsable`, `orden`, `categoria_info`…) por cada fila. | Con una empresa de 2-3 años de OS (miles de filas) cada apertura de esa pantalla transfiere y renderiza el historial completo. **Arreglar antes del onboarding masivo.** Verificar también el `max-rows` de PostgREST en Supabase (si está sin límite, un `select` puede traer 50k filas; si está en 1000, hay truncado silencioso — ninguna de las dos es buena). |
| 2 | Media | Índice faltante | Migraciones — tablas `usuarios`, `inventario_movimientos`, `inventario`, `accesos_usuario` (ver §2) | `usuarios` solo tiene índice por `id` (PK). Se filtra por `empresa_id` en decenas de endpoints (listar equipo, resolver nombres, `esUltimoAdminActivo`, `notificarGerencia`). `inventario_movimientos` (log de movimientos, crece rápido) solo tiene índice por `catalogo_item_id`. | `usuarios` queda chico (decenas de filas/empresa) → un seq scan es barato incluso a escala, es más principio que perf. `inventario_movimientos` sí puede doler. **Arreglar ahora — 1 migración.** |
| 3 | Media | Agregación en memoria sin cota | `backend/src/agregacionesDashboard.ts:17-33` (`kpis`), `:84-86` (`ingresosPorMes`), `:265-267`, `:290-292`, `:368-370` | Patrón correcto (no es N+1): `Promise.all` de `select(<columnas>)` + `for...of` sobre los arrays. Pero sin `desde`/`hasta` → traen `facturas`, `trabajos`, `gastos`, `presupuestos` de toda la historia para sumar/contar. | 1 empresa: nada. Empresa de 3 años: ~10-20K filas por carga de dashboard. **Mover la agregación a una función de Postgres (RPC) que devuelva los totales ya calculados** — precedente en `superadmin_metricas_calcular` (migración 60). |
| 4 | Media-Alta | Workers sin pool | `backend/src/pdfWorkerPool.ts:23-27` | `new Worker(...)` por cada request de PDF, sin pool persistente ni límite de concurrencia. Comentario propio: "no hay volumen para justificar un pool todavía". | Cada PDF concurrente = un worker thread (~10-30 MB + arranque). En Render free (512 MB) ~10 PDFs a la vez pueden hacer OOM y tumbar el backend. **Poner un `crearLimitadorConcurrencia(N)` (ya existe el helper) alrededor de `generarPdfEnWorker` antes de escalar.** |
| 5 | Media | Cola de IA sin cota | `backend/src/claude.ts:24` (`crearLimitadorConcurrencia(8)`), `backend/src/concurrencia.ts` | Límite de 8 llamadas simultáneas a Claude, hardcodeado. La cola (`cola: (() => void)[]`) no tiene tamaño máximo ni timeout de espera. Con `TIMEOUT_LARGO_MS = 240s` para los informes. | A fin de mes con 20+ empresas corriendo el cierre a la misma hora: la request Nº 41 espera ~5 min en cola y después su propia llamada puede tardar 90-240s → supera la paciencia del usuario y timeouts intermedios. **Revisar el número 8 y/o poner un `max-wait` que devuelva "reintenta en unos minutos".** El 8 fue elegido pensando en 1 empresa. |
| 6 | Baja | Filtro de texto en memoria | `backend/src/routes/asistente.ts:256`, `:359`, `:411` | Después de traer hasta 50/100 filas con `.limit()`, se filtra por substring del nombre del cliente/descripción en JS (`.filter(r => r.cliente.toLowerCase().includes(t))`). | Acotado por el `.limit()`, impacto real bajo. Ideal: `.ilike("cliente", "%"+t+"%")` en la query. |
| 7 | Baja | Bundle sin code-splitting | `web/src/app/dashboard/page.tsx:24-25` (importa `GraficoDistribucion` + `GraficoIngresos` → Recharts), `web/src/components/MapaRutas.tsx` (Leaflet), `web/src/components/charts/*` | Cero `next/dynamic` en todo el frontend. Recharts (chunk de **340 KB**) se carga en el dashboard home (primera pantalla post-login). Leaflet (**148 KB**) en `/dashboard/rutas`, `/dashboard/ordenes/nueva`, `/dashboard/rutas/nueva`. No hay imports de librería completa (no hay `import _ from "lodash"`). | Es first-load JS del navegador, no costo de servidor. A 1 o a 50 empresas es igual. **Envolver los gráficos y el mapa en `next/dynamic({ ssr: false })` con un skeleton** — mejora el TTI del dashboard, sobre todo en móvil. |
| 8 | Baja | Costo por mensaje del asistente subestimado | `backend/src/routes/asistente.ts:13` (`MAX_ITERACIONES_HERRAMIENTA = 5`), `:621` | Un mensaje del usuario puede disparar hasta **5 llamadas a Claude** (loop de tools), con el historial + resultados de tools creciendo en cada vuelta. El promedio real de `ia_uso` para `asistente` (~3.2K tokens) es por *fila*, no por *mensaje del usuario*. | No es un bug — es para tener en cuenta en la proyección de costos: un mensaje "pesado" del asistente ≈ 20-30K tokens, no 3K. |

### No son hallazgos (están bien resueltos)

- **Compresión de imágenes del lado del cliente** antes de subir: móvil resize a 1600px
  / calidad 0.6 (`mobile/src/lib/imagen.ts`), web 1600px / 0.7
  (`web/src/lib/comprimirImagen.ts`). Las fotos llegan a ~150-400 KB, no en crudo.
- **La foto se sube una sola vez:** `trabajos.ts:877` usa `req.file.buffer` para
  `subirFoto` y el **mismo buffer** (`.toString("base64")`) para `analizarFoto` — no
  hay doble upload.
- **Panel de OS con relaciones embebidas:** `ordenesServicio.ts:27` hace el join en un
  solo `.select("*, cliente_info:clientes(nombre), responsable:usuarios(nombre), orden:ordenes_servicio(*)")` — patrón correcto, no N+1.
- **Tools del asistente acotadas:** `consultarRegistros` con `Math.min(limite, 50)`,
  `.select(<columnas específicas>)`, nunca `select("*")`.
- **`urlFirmada`** (`storage.ts`) es firma HMAC **local** (`getSignedUrl` de
  `@aws-sdk/s3-request-presigner`), no una llamada de red — `Promise.all(fotos.map(urlFirmada))` no es N+1.
- **Índice `empresa_id` presente en 40 de 51 tablas de tenant**, casi siempre compuesto
  con la columna de orden (`(empresa_id, fecha desc)`, `(empresa_id, estado)`).

---

## 2. Índices de base de datos

Consultado directo sobre `pg_indexes` de **producción**.

### Tablas de tenant SIN índice que empiece por `empresa_id`

| Tabla | Índices que tiene | ¿Se filtra por `empresa_id` en el código? | Severidad |
|---|---|---|---|
| `usuarios` | `id` (PK) | **Sí, en decenas de endpoints** (listar equipo, resolver nombres, `esUltimoAdminActivo`, `notificarGerencia`, invitaciones, roles) | Media — la tabla queda chica, seq scan barato, pero es la más consultada |
| `inventario_movimientos` | `id`, `(catalogo_item_id, creado_en desc)` | Sí (`routes/inventario.ts` para el historial de la empresa) | Media-Alta — log que crece rápido |
| `inventario` | `id` | Sí (`routes/inventario.ts` listado) | Media |
| `accesos_usuario` | `id`, `(usuario_id, creado_en desc)` | Sí, en `/api/accesos` (vista admin), el export individual, y la limpieza de retención (`.lt("creado_en")`) | Media — el `/me/accesos` usa `usuario_id` (ok), el resto escanea |
| `os_items` | `id`, `(trabajo_id)` | Casi siempre por `trabajo_id` (ok vía ese índice); algún `.eq("empresa_id")` | Baja |
| `portal_accesos` | `id` | Sí (export de empresa `TABLAS_POR_EMPRESA`, anonimización) | Baja-Media |
| `portal_codigos` | `id`, `(cliente_id, creado_en desc)` | Por `cliente_id` (ok); la limpieza de retención filtra por `creado_en` | Baja |
| `presupuesto_items` | `id`, `(presupuesto_id)` | Por `presupuesto_id` (ok vía join) | Baja |
| `catalogo_kit_items` | `id`, `(kit_id, item_id)`, `(kit_id)` | Por `kit_id` (ok) | Baja |
| `informes_personalizados` | `id` | Config, pocas filas | Baja |
| `tipos_trabajo` | `id` | Config, pocas filas | Baja |

**Recomendación (no implementada):** una migración con
```sql
create index on usuarios (empresa_id);
create index on inventario_movimientos (empresa_id, creado_en desc);
create index on inventario (empresa_id);
create index on accesos_usuario (empresa_id, creado_en desc);
```
Las otras 7 pueden esperar o no hacen falta.

### Columnas de `WHERE`/`ORDER BY` de los listados pesados

| Tabla | Columna | ¿Índice? | Endpoint(s) |
|---|---|---|---|
| `trabajos` | `empresa_id, fecha desc` | ✅ `idx_trabajos_empresa` | `GET /api/trabajos`, `GET /api/ordenes-servicio` |
| `trabajos` | `responsable_id` | ❌ (existe `(empresa_id, equipo_id)` pero no responsable) | `GET /api/trabajos?propio=true`, colaborador scope, `notificarGerencia` |
| `trabajos` | `cliente_id` | ❌ | `GET /api/ordenes-servicio?cliente_id=`, Portal, ficha de cliente |
| `viajes` | `empresa_id, fecha desc` / `empresa_id, estado` | ✅ | `GET /api/viajes`, `/api/mis-viajes` |
| `viajes` | `chofer_id` | ❌ | `/api/mis-viajes` (scope del chofer) |
| `facturas` | `empresa_id, estado` | ✅ | `GET /api/cobros` |
| `facturas` | `cliente_id` | ❌ | ficha de cliente, Portal, export individual |
| `tareas` | `empresa_id, fecha` / `empresa_id, responsable_id` | ✅ | agenda |
| `gastos` | `empresa_id, fecha, estado` | ✅ | `GET /api/gastos` |

**`trabajos.responsable_id` y `trabajos.cliente_id` sin índice** es lo más notable acá:
el scope de colaborador (`.eq("responsable_id", req.userId)`) corre en **cada** request
de trabajos de un colaborador, y la ficha de cliente filtra `trabajos` por `cliente_id`.
Hoy con 5 OS es irrelevante; con miles, cada una de esas es un scan del índice de
`empresa_id` + filtro.

---

## 3. Concurrencia y workers

| Recurso | Config actual | ¿Pensado para escala? | Riesgo |
|---|---|---|---|
| Llamadas a Claude simultáneas | `crearLimitadorConcurrencia(8)` hardcodeado (`claude.ts:24`) | No — "para que un pico de varias empresas no choque con los rate limits" pero el 8 es arbitrario | Cola sin cota. A fin de mes, 20+ empresas × informe → decenas en cola, esperas de minutos, después la request propia hasta 240s. |
| PDF (OS, cotización, informe) | `new Worker` por request, sin pool ni límite (`pdfWorkerPool.ts`) | No — comentario explícito "no hay volumen todavía" | N workers concurrentes = N × ~10-30 MB. Render free (512 MB) → OOM con ~10-15 PDFs a la vez. |
| Timeouts de proveedores | Resend 10s, Flow 15s, WhatsApp 10/20s, Anthropic 90s (240s informes) | Sí (auditoría de resiliencia) | Los timeouts en sí están bien. El problema es que una llamada lenta a Claude retiene un **slot de los 8** hasta 240s → 8 informes lentos = backend "sin cupo de IA" por 4 min. |

**Recomendación:** antes del onboarding de varias empresas, (a) envolver
`generarPdfEnWorker` en un limitador de concurrencia (2-4), (b) subir o hacer
configurable el límite de Claude, (c) agregar un tope de espera en cola que responda
`503 "reintenta en unos minutos"` en vez de dejar la request colgada.

---

## 4. Bundle y frontend

`npm run build` en `web/` — chunks de `.next/static/chunks/`:

| Chunk | Tamaño | Contenido |
|---|---|---|
| `3qwszsi4m_41x.js` | **340 KB** | **Recharts** (37 referencias) |
| `2bbtb72oe7iqq.js` | 256 KB | framework de Next.js |
| `2y6oh6_e40m05.js` | 224 KB | React + runtime |
| `1utknih_qp5-e.js` | 156 KB | app / vendor |
| `37ux7yg4q_1bo.js` | **148 KB** | **Leaflet** (103 referencias) |
| **Total chunks** | **~3.5 MB** sin gzip (~1 MB gzip) | |

- **Recharts (340 KB)** se importa estático en `dashboard/page.tsx` → entra en el
  first-load del dashboard, que es lo primero que ve todo usuario. Los 7 componentes
  `charts/*` lo usan; solo las páginas de Informes los necesitan de verdad.
- **Leaflet (148 KB)** en 3 rutas (`/dashboard/rutas`, `/dashboard/ordenes/nueva`,
  `/dashboard/rutas/nueva`) vía `MapaRutas`, import estático.
- **Cero `next/dynamic`** en todo `web/src/`.
- **Sin imports de librería completa** — no hay `import _ from "lodash"`, `moment`, ni
  `import * as` de libs grandes.

**Recomendación (no implementada):**
```tsx
const GraficoIngresos = dynamic(() => import("@/components/charts/GraficoIngresos"), { ssr: false, loading: () => <SkeletonGrafico /> });
const MapaRutas = dynamic(() => import("@/components/MapaRutas"), { ssr: false });
```
Baja el first-load del dashboard ~340 KB y el de las páginas con mapa ~148 KB.

---

## 5. Storage y transferencia

- **Fotos:** comprimidas en el cliente antes de subir (§1, "no son hallazgos"). Una foto
  típica pesa ~150-400 KB. El backend las guarda tal cual (no re-comprime, no hace
  falta).
- **Una OS completa genera aprox.:** 4 fotos (~1 MB) + firma (~20 KB) + PDF de la OS
  (~100-150 KB) ≈ **~1.15 MB por OS**.
- **Proyección de Storage** (asumiendo 120 OS/mes por empresa activa — ver §6):
  - ~140 MB/mes/empresa → **~1.7 GB/año/empresa**.
- Las descargas de fotos/PDF van por **URL firmada directo al Storage de Supabase**
  (no pasan por el backend) → cuentan como **egress de Storage de Supabase**, no de
  Render.

---

## 6. Proyección de costos al escalar

> ⚠️ **Todo esto es estimación, no medición.** Modelo de "empresa activa típica":
> 8 usuarios · 120 OS/mes · 4 fotos + firma + PDF por OS · ~300 correos/mes
> (asignación, completada, cotizaciones, cobros, cumpleaños) · ~150 mensajes de
> WhatsApp/mes · 1 cobro de suscripción/mes · crecimiento de DB ~3 MB/mes.
>
> **Uso de IA por empresa/mes** (si se reactiva; **hoy está apagada**):
> ~8 informes (~50K tokens) + ~40 mensajes de asistente (~600K tokens, contando el
> loop de tools) + ~480 análisis de foto (~960K tokens) ≈ **~1.6M tokens/mes/empresa**.

### Volumen proyectado

| | 1 empresa | 5 | 20 | 50 |
|---|---|---|---|---|
| Storage Supabase (acumulado 12 meses) | ~1.7 GB | ~8 GB | ~34 GB | ~85 GB |
| Egress Supabase / mes | ~8 GB | ~40 GB | ~160 GB | ~400 GB |
| DB size (12 meses) | ~40 MB | ~200 MB | ~800 MB | ~2 GB |
| Correos / mes | 300 | 1.500 | 6.000 | 15.000 |
| Tokens Anthropic / mes (IA on) | 1,6M | 8M | 32M | 80M |
| Egress Vercel / mes | ~1 GB | ~5 GB | ~20 GB | ~50 GB |
| Transacciones Flow / mes | 1 | 5 | 20 | 50 |

### Costo estimado mensual por servicio (USD)

| Servicio | 1 empresa | 5 | 20 | 50 | Nota |
|---|---|---|---|---|---|
| **Vercel** | $0–20 | $0–20 | $20 | $20 | Hobby (free) técnicamente no permite uso comercial → **Pro $20/mes fijo**. 100 GB de banda incluidos » 50 GB proyectados. |
| **Render** | $0 | $7 | $7 | $25 | Hoy **Free**. Los cold starts empiezan a molestar con usuarios concurrentes de ~5 empresas → **Starter $7** (always-on, 512 MB). A ~50 empresas + PDF workers: **Standard $25** (2 GB). |
| **Supabase** | **$25** | $25 | $25 | ~$40 | Hoy probablemente **Free** — pero el egress estimado de 1 sola empresa activa (~8 GB) ya supera los 5 GB del Free. **Pro $25/mes** desde la empresa #1 con uso real. A 50: egress 400 GB → 150 GB de overage × $0.09 ≈ **+$14**. Storage 85 GB < 100 GB incluidos. DB 2 GB < 8 GB. |
| **Resend** | $0 | $0 | $20 | $20 | Free = 3.000 correos/mes (cubre 1-5 empresas). 20+ empresas → **Pro $20/mes** (50.000). |
| **Anthropic** (IA **on**) | ~$9 | ~$43 | ~$173 | **~$432** | Estimado a ~$3/M input + $15/M output, blend ~$5,4/M. 1,6M tokens/empresa/mes. **La única línea que escala peligrosamente.** Hoy = **$0** (IA apagada). |
| **Flow** | ~$2 | ~$10 | ~$40 | ~$100 | ~2,9% de un cobro de ~$60. Lineal, sin sorpresas de tier. Es costo de *cobrar*, no de operar. |
| **Total infra (IA off, Flow aparte)** | **~$45** | **~$52** | **~$72** | **~$105** | |
| **Total infra (IA on, Flow aparte)** | **~$54** | **~$95** | **~$245** | **~$537** | |

---

## 7. Costo real por empresa vs. precio del plan

Planes: **Básico $50.000 CLP/mes (~US$53)** · **Pro $90.000 CLP/mes (~US$95)**.

| Escenario | Costo infra / empresa / mes (IA off) | (IA on) | % del plan Básico (IA on) |
|---|---|---|---|
| 1 empresa | ~$45 | ~$54 | ~100% ⚠️ (pero es el costo fijo mínimo, se diluye) |
| 5 empresas | ~$10 | ~$19 | ~36% |
| 20 empresas | ~$3,6 | ~$12 | ~23% |
| 50 empresas | ~$2,1 | ~$11 | ~20% |

**Con IA apagada** (como está hoy): el comentario de `limites.ts` —"el costo real de
IA/storage es insignificante frente al precio del plan"— **se sostiene**: a partir de
~5 empresas el costo marginal por empresa está en US$2-10, entre el 4% y el 20% del
plan Básico.

**Con IA encendida**, dos cosas a vigilar:

1. **Anthropic es el 80% del costo variable** a escala. La estimación de 1,6M
   tokens/empresa/mes **ya supera el límite del plan Básico** (`iaTokensPorMes:
   1_500_000` en `limites.ts`). O sea: el límite actual no contempla el análisis de
   fotos en todas las OS. **Decisión de producto:** ¿el análisis de fotos cuenta contra
   el tope?, ¿es solo Pro?, ¿se sube el tope del Básico?

2. Si el uso real por empresa fuera **2-3× la estimación** (asistente muy usado, fotos
   en cada OS), Anthropic solo podría llegar a **US$25-30/empresa/mes ≈ 50-60% del
   margen del plan Básico**. Ahí el plan Básico deja de tener sentido económico con IA
   incluida.

**Recomendación:** no reactivar el análisis de fotos con IA de forma masiva sin (a)
instrumentar el costo real por empresa (ver §8), (b) revisar los topes de `limites.ts`,
(c) decidir si la IA de fotos es un add-on / solo Pro.

---

## 8. Recomendación de instrumentación (para que la próxima auditoría sea con datos reales)

Qué empezar a loguear **ahora**, aunque no se actúe sobre ello todavía:

| Métrica | Cómo | Estado |
|---|---|---|
| **Tokens de IA por empresa por mes** | Ya existe: `ia_uso` (`empresa_id`, `feature`, `modelo`, `tokens_entrada`, `tokens_salida`, `creado_en`). **Sirve tal cual.** Falta solo un panel/consulta mensual en el Super-Admin que muestre `sum(tokens) group by empresa, feature, date_trunc('month')` y lo cruce contra `iaTokensPorMes` del plan. | ✅ el dato está, falta la vista |
| **Tamaño de Storage por empresa en el tiempo** | Hoy `empresas.storage_bytes_usado` es un contador acumulado (se incrementa en cada subida, `limites.ts`), sin histórico. **Agregar** una tabla `storage_snapshot_mensual (empresa_id, mes, bytes)` que se llene 1×/mes (job perezoso como el de retención). | ❌ falta el histórico |
| **Tiempo de respuesta por endpoint (p50/p95/p99)** | No existe. **Agregar** un middleware que loguee `{ ruta, metodo, ms, empresa_id }` — a `errores_backend` no (es para errores), sino a una tabla `latencia_requests` con retención corta (7-14 días) o directo a Sentry (cuando tenga DSN — Sentry tiene tracing). Con eso la próxima auditoría dice "el p95 de `GET /api/ordenes-servicio` es 800ms" en vez de "podría ser lento". | ❌ falta |
| **Filas devueltas por los endpoints de listado** | El mismo middleware puede loguear `Array.isArray(body) ? body.length : null`. Detecta cuándo un listado sin paginación empieza a devolver miles de filas. | ❌ falta |
| **Correos enviados por empresa por mes** | `notificaciones_cliente_log` ya tiene `empresa_id` + `creado_en` + `canal` implícito en `tipo`. Sirve para el conteo de correos. Los correos internos (invitaciones, encuestas) no quedan registrados — **agregar** un log si el volumen importa. | 🟡 parcial |
| **Cola de IA / PDF: profundidad y tiempo de espera** | El limitador de concurrencia no expone métricas. **Agregar** un contador de `cola.length` y el tiempo que cada tarea esperó, logueado cuando supere un umbral (ej. > 30s de espera). | ❌ falta |

Con `ia_uso` (que ya sirve) + un middleware de latencia + snapshots mensuales de
storage, la v2 de esta auditoría se puede hacer con números medidos de 3-6 meses de
operación real en vez de proyecciones.
