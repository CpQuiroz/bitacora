-- BITÁCORA — Agenda Pro: adicionales por reserva ("valor agregado").
--
-- Una cita/reserva tiene su `precio` (el del servicio, editable puntual).
-- Faltaba poder sumar extras itemizados: un producto que se llevó el
-- cliente, un adicional del servicio, etc. Se guardan como una lista
-- `[{ concepto, monto }]`. El `precio` del servicio NO cambia de
-- significado; el total de la reserva = precio + suma de los montos.
--
-- jsonb con default '[]' → aditivo, 0 filas afectadas.

alter table tareas add column if not exists adicionales jsonb not null default '[]'::jsonb;
