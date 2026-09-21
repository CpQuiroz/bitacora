-- ============================================================
-- BITÁCORA — Hora de visita en Levantamientos.
--
-- Pedido (21-sep-2026): fecha_visita (migración 111) le dice al técnico
-- QUÉ DÍA ir, pero no A QUÉ HORA — el pedido explícito fue agregar hora
-- "para que asista el técnico". Sigue el mismo criterio que fecha_visita:
-- nullable, sin backfill, un levantamiento sin hora_visita simplemente no
-- muestra hora (se ve como "todo el día" en Pizarra/Agenda, igual que hoy).
--
-- text, no time — mismo criterio que tareas.hora (migración 36): se
-- guarda tal cual "HH:MM" (validado en el backend, ver HORA_REGEX en
-- levantamientos.ts), sin el redondeo/formato de segundos que agrega
-- Postgres `time` al leer.
-- ============================================================

alter table levantamientos add column hora_visita text;
