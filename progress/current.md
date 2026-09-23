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

## 23-sep-2026 — pedido de 6 mejoras (OS, PDF, ventas, flota)

Análisis previo con 4 subagentes Explore (solo lectura), reportado a la
usuaria antes de tocar código. Decisiones de la usuaria:
- T1 (quitar tipo de OS): pidió explicación antes de decidir — NO aplicado.
- T2 (fotos): aplicar; nombres de categorías → confirmar antes. Aplicado
  con los nombres actuales (tarea 100).
- T3 (comentarios): mover debajo de fotos (tarea 101).
- T4 (PDF): aplicado (tarea 102).
- T5 (ventas) y T6 (flota): no los marcó en el alcance — pendiente
  confirmar. Sí marcó cerrar permisos de Equipos (tarea 103).
- Segunda ronda de decisiones: T1 quitar tipo + mapa (tarea 104); T2
  nombres actuales; T5 al revés de lo pedido originalmente: solo Admin
  vende (tarea 105, acción `registrar_venta`); T6 construir con tipos
  fijos (en curso).
