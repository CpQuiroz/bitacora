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
