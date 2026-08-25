-- ============================================================
-- BITÁCORA — Lógica de negocio: viajes y facturas
-- Se ejecuta DESPUÉS de bitacora-schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. SEMANA AUTOMÁTICA en cada viaje
--    (equivalente a la columna auto-calculada de tu Excel)
-- ------------------------------------------------------------
alter table viajes add column semana int;

create or replace function calcular_semana()
returns trigger as $$
begin
  new.semana := extract(week from new.fecha);
  return new;
end;
$$ language plpgsql;

create trigger trg_calcular_semana
  before insert or update of fecha on viajes
  for each row execute function calcular_semana();

-- ------------------------------------------------------------
-- 2. FACTURAS VENCIDAS AUTOMÁTICAMENTE
--    Si hoy > fecha_vencimiento y sigue "pendiente" → "vencida"
--    (esto reemplaza el formato condicional rojo/verde del Excel)
-- ------------------------------------------------------------
create or replace function actualizar_estado_facturas()
returns void as $$
begin
  update facturas
  set estado = 'vencida'
  where estado = 'pendiente'
    and fecha_vencimiento < current_date;
end;
$$ language plpgsql;

-- Se ejecuta automáticamente cada día a las 6:00 AM
-- (requiere activar la extensión pg_cron en Supabase → Database → Extensions)
select cron.schedule(
  'revisar-facturas-vencidas',
  '0 6 * * *',
  $$ select actualizar_estado_facturas(); $$
);

-- ------------------------------------------------------------
-- 3. RESUMEN SEMANAL DE VIAJES (para armar la factura)
--    Junta todos los viajes de una semana + chofer, listo
--    para facturar — como tu resumen semanal del Excel
-- ------------------------------------------------------------
create or replace function resumen_semanal(p_empresa_id uuid, p_semana int)
returns table(chofer text, total_viajes bigint, total_monto numeric) as $$
  select u.nombre, count(v.id), sum(v.monto)
  from viajes v
  join usuarios u on u.id = v.chofer_id
  where v.empresa_id = p_empresa_id
    and v.semana = p_semana
    and v.estado = 'completado'
  group by u.nombre;
$$ language sql stable;

-- ------------------------------------------------------------
-- 4. GENERAR FACTURA A PARTIR DE VIAJES SELECCIONADOS
--    Toma varios viajes, suma sus montos, crea la factura
--    y la deja vinculada a esos viajes
-- ------------------------------------------------------------
create or replace function generar_factura(
  p_empresa_id uuid,
  p_cliente text,
  p_semana text,
  p_viaje_ids uuid[],
  p_dias_plazo int default 30
)
returns uuid as $$
declare
  v_total numeric;
  v_factura_id uuid;
begin
  select coalesce(sum(monto), 0) into v_total
  from viajes where id = any(p_viaje_ids) and empresa_id = p_empresa_id;

  insert into facturas (empresa_id, cliente, semana_facturada, monto,
                         fecha_emision, fecha_vencimiento, estado, viaje_ids)
  values (p_empresa_id, p_cliente, p_semana, v_total,
          current_date, current_date + p_dias_plazo, 'pendiente', p_viaje_ids)
  returning id into v_factura_id;

  return v_factura_id;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 5. GASTOS FIJOS PRÓXIMOS A VENCER (para el recordatorio
--    del día 11 y 19 que ya tienes en tu calendario)
-- ------------------------------------------------------------
create or replace function gastos_por_vencer(p_empresa_id uuid, p_dias_antes int default 1)
returns table(categoria text, monto numeric, dia_vencimiento int) as $$
  select categoria, monto, dia_vencimiento
  from gastos_fijos
  where empresa_id = p_empresa_id
    and activo = true
    and dia_vencimiento = extract(day from current_date + p_dias_antes)::int;
$$ language sql stable;

-- ------------------------------------------------------------
-- EJEMPLO DE USO
-- ------------------------------------------------------------
-- Facturar los viajes 0231, 0232 y 0234 a "Minera Los Andes":
-- select generar_factura(
--   '<empresa_id>',
--   'Minera Los Andes',
--   'S33',
--   array['<id_viaje_1>', '<id_viaje_2>', '<id_viaje_3>']::uuid[]
-- );
