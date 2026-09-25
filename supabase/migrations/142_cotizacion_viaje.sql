-- ============================================================
-- Cotización de viaje (tarea 135, etapa 4). Una cotización puede ser de
-- servicio (como hasta ahora) o de viaje: lleva el recorrido y la forma de
-- cobro, y al aprobarse se convierte en un viaje con el mismo precio. El
-- PDF y el portal del cliente siguen usando los ítems (un ítem "Viaje …").
-- Aditiva e idempotente.
-- ============================================================
alter table presupuestos add column if not exists tipo text not null default 'servicio'
  check (tipo in ('servicio', 'viaje'));
-- { fecha, origen, destino, paradas[], modo_precio, distancia_km, precio_km, tramos_detalle, aplica_iva }
alter table presupuestos add column if not exists viaje_datos jsonb;
alter table presupuestos add column if not exists viaje_id uuid references viajes(id) on delete set null;
create index if not exists idx_presupuestos_viaje_id on presupuestos (viaje_id) where viaje_id is not null;
