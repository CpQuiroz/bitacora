# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

## 23-sep-2026 (noche) — feedback del build 1.10.16

- Tarea 112 (done): Asistente 96→72, chips de Agenda en scroll, botón
  "Nueva OS" neutro. Falta build mobile.
- Pendiente de decisión: precios (la usuaria aún no define montos; se le
  propusieron modelos de cobro) y "Plan y pago" en mobile (solo Admin,
  pensando en Google Play → mobile solo muestra el plan, pago en la web).
- Tarea 113 (done): "Mi plan" en mobile, solo lectura y solo Admin
  (pago/cambio de plan en la web por reglas de Google Play). Mobile 1.10.17.
- Precios: la usuaria todavía está definiendo montos; se le propuso
  planes por tramo + implementación + adaptaciones aparte + IA con límite.

## 24-sep-2026 — infraestructura

- Tarea 114 (done): se borró `keep-warm.yml`. Render está en Starter pago
  (verificado vía API), ya no se duerme.
- Tarea 115 (pending, deuda técnica a pedido de la usuaria): mover Render de Ohio a Oregón. No es un cambio de
  región en el panel: servicio nuevo + dominio propio + URLs de web/mobile/
  Flow. Pasos entregados a la usuaria; lo ejecuta ella en los paneles.
- Hallazgos de la revisión de infra (para la Fase 0 de precios): Supabase
  org en plan FREE (sin backups, 1 GB storage), Vercel en cuenta personal
  (probable Hobby = sin uso comercial).
- Nuevo `docs/DEUDA_TECNICA.md`: listado de deuda técnica (111 y 115) con pasos.

## 24-sep-2026 — mejoras post-auditoría, 1 a 1

Orden pedido por la usuaria: (1) huecos en límites, (2) mensaje de límite
en mobile, (3) paginación, (4) IA en fotos por plan [decisión pendiente],
(5) RLS de suscripciones, (6) tests, (7) tareas programadas.

- (1) Tarea 116 (done): límites de OS/usuarios en todas las rutas +
  contador de storage que descuenta y se recalibra al llegar al tope.
- (2) Tarea 117 (done): 403 con code LIMITE_PLAN; la cola offline mobile muestra el mensaje real. Requiere build.
- (5) Tarea 118 (in_progress): migración 130 cierra el acceso directo PostgREST a todas las tablas. Falta que la usuaria la aplique en dev y prod.
- (3) Paginación: relevamiento hecho (listas sin tope + agregaciones del dashboard en JS). Pendiente definir alcance con la usuaria.
- (4) IA en fotos por plan: decisión pendiente de la usuaria.
- Tarea 119 (done): crash al abrir una OS en mobile 1.10.16 (hooks después de return anticipado). Fix + regla rules-of-hooks en verificar.sh. Sale en 1.10.17.
- Decisiones de la usuaria (24-sep): paginación etapa A = tarea 120 (pendiente); etapa B = deuda técnica 121; IA en fotos solo Pro/Empresa y a pedido del Admin + evaluar modelo barato = tarea 122.
- Migración 130: la usuaria la corrió desde una copia vieja (builds/1.10.16) sin el archivo, y contra prod en vez de dev. Se le explicó cómo hacerlo.
- Tarea 118 (done): migración 130 aplicada en dev y prod por la usuaria; verificado en prod.
