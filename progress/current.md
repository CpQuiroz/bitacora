# Sesión actual

> Plan, decisiones y bloqueos de la tarea en curso. Al cerrar: resumen a
> `progress/history.md` y vaciar este archivo. Historial anterior al
> 23-sep-2026: `progress/archivo/current_2026-09-11_a_2026-09-23.md`.

- **Agente:** Claude (directo)

## 23-sep-2026 — tarea 99: Agenda con paridad web/mobile

Pedido explícito ("Ejecuta tu lado ambas tareas"). La tab Agenda de
mobile figura como congelada en CLAUDE.md — se tocó por este pedido.

- Backend: `GET /api/levantamientos` acepta `?desde&hasta` (fecha_visita).
- Web: la Agenda suma levantamientos con `fecha_visita` (tolerante a
  403 si no hay módulo); chip "Levantamiento" solo con el módulo
  activo; click → `/dashboard/levantamientos?id=...`, que ahora abre
  el detalle directo.
- Mobile: la Agenda suma OS (`listarOSRango`, con caché offline), solo
  con el módulo `ordenes_servicio`; `FilaOS` en mes/semana/día (en Día
  van fijas arriba junto a levantamientos, no en la grilla horaria);
  barritas por estado; abre `TrabajoDetalle` vía `TrabajosStack`
  anidado en `AgendaStack` (mismo patrón que Hoy).
- `verificar.sh` en verde. No probado contra la app real en esta
  sesión. Mobile requiere build EAS.
