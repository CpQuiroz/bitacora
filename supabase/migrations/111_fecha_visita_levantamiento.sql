-- ============================================================
-- BITÁCORA — Fecha de visita en Levantamientos.
--
-- Pedido (20-sep-2026): el Admin necesita poder decirle al técnico
-- CUÁNDO ir a evaluar en terreno, no solo QUIÉN va — hoy
-- levantamientos no tiene ningún campo de fecha (a diferencia de
-- trabajos.fecha, tareas.fecha, viajes.fecha), así que en la Pizarra
-- (mobile) un levantamiento asignado aparece siempre como "pendiente
-- de siempre", sin día concreto (ver mobile/src/services/hoy.ts).
--
-- Nullable, sin backfill — un levantamiento sin fecha_visita sigue
-- comportándose como hoy (aparece como pendiente sin día fijo, ver
-- cargarHoy() en hoy.ts). Es una fecha simple (date, sin hora): el
-- pedido fue "para que el técnico sepa CUÁNDO ir", no una cita con
-- horario — para eso ya existe Agenda (tareas.hora).
-- ============================================================

alter table levantamientos add column fecha_visita date;
