-- ============================================================
-- Viáticos por viaje (tarea 137, 24-sep-2026). Cada viaje puede llevar
-- un viático local (origen y destino dentro de la Región Metropolitana)
-- o interregional, que se le paga siempre al chofer asignado. El viático
-- se registra como un gasto de categoría "Viáticos" (pendiente hasta que
-- se le paga al chofer) enlazado al viaje por gastos.viaje_id. No sale
-- en el cobro ni en su PDF: es un costo interno.
-- Aditiva e idempotente. Sin tablas nuevas (RLS de viajes/gastos/
-- empresas ya activa).
-- ============================================================

-- Montos por defecto de la empresa (se precargan al elegir el tipo).
alter table empresas add column if not exists viatico_local_monto numeric(12,2)
  check (viatico_local_monto is null or viatico_local_monto >= 0);
alter table empresas add column if not exists viatico_interregional_monto numeric(12,2)
  check (viatico_interregional_monto is null or viatico_interregional_monto >= 0);

-- Viático del viaje: tipo y monto van juntos (los dos o ninguno).
alter table viajes add column if not exists viatico_tipo text
  check (viatico_tipo is null or viatico_tipo in ('local', 'interregional'));
alter table viajes add column if not exists viatico_monto numeric(12,2)
  check (viatico_monto is null or viatico_monto >= 0);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'viajes_viatico_completo') then
    alter table viajes add constraint viajes_viatico_completo
      check ((viatico_tipo is null) = (viatico_monto is null));
  end if;
end $$;

-- Marca del gasto generado por el viático de un viaje. Un solo gasto de
-- viático por viaje (el índice único lo garantiza aunque lleguen dos
-- guardados a la vez); también es el índice del resumen por chofer.
alter table gastos add column if not exists es_viatico boolean not null default false;
create unique index if not exists idx_gastos_viatico_viaje
  on gastos (viaje_id) where es_viatico;
create index if not exists idx_gastos_viatico_empresa_fecha
  on gastos (empresa_id, fecha) where es_viatico;
