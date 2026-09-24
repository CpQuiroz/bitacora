-- ============================================================
-- Hora opcional del viaje (tarea 133, 24-sep-2026): el Admin crea el
-- viaje, asigna chofer y opcionalmente la hora de salida; el viaje
-- aparece en la Agenda del chofer a esa hora (sin hora = todo el día).
-- Aditiva e idempotente.
-- ============================================================
alter table viajes add column if not exists hora time;
