# Sesión actual

- **Tarea en curso:** 9 — edicion_viajes_y_fotos_os (ver detalle abajo)
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
