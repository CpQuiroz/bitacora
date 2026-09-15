-- BITÁCORA — clientes_resumen(): agrega en Postgres los indicadores por
-- cliente que GET /api/clientes necesita (cantidad de OS, última
-- actividad, saldo por cobrar/vencido, cotizaciones, si tiene pack).
--
-- Antes, el endpoint traía TODAS las filas históricas de trabajos y
-- facturas de la empresa a Node para reducirlas ahí con un for — sin
-- filtro de fecha ni límite. Funciona hoy porque las empresas son
-- nuevas, pero crece sin techo: cada trabajo/factura que se crea hace
-- la pantalla de Clientes (la más visitada) un poco más pesada, para
-- siempre. Esta función mueve el cálculo a SQL (GROUP BY, con los
-- índices que ya existen por cliente_id — migraciones 82 y 99), así
-- solo viajan a Node las filas ya agregadas (una por cliente).
--
-- security invoker (default): el único que la llama es el backend con
-- la service role, que ya bypassa RLS — mismo criterio que
-- trabajos_del_dia() (05_rutas.sql) y superadmin_metricas_calcular()
-- (60_superadmin_metricas.sql).
create or replace function clientes_resumen(p_empresa_id uuid)
returns table (
  cliente_id uuid,
  cantidad_os bigint,
  ultima_actividad date,
  cantidad_cotizaciones bigint,
  total_por_cobrar numeric,
  total_vencido numeric,
  tiene_pack boolean
)
language sql
stable
set search_path = public
as $$
  with os as (
    select cliente_id, count(*) as cantidad_os, max(fecha) as ultima_actividad
    from trabajos
    where empresa_id = p_empresa_id and cliente_id is not null
    group by cliente_id
  ),
  cotiz as (
    select cliente_id, count(*) as cantidad_cotizaciones
    from presupuestos
    where empresa_id = p_empresa_id and cliente_id is not null
    group by cliente_id
  ),
  fact as (
    select
      cliente_id,
      sum(monto) filter (where estado <> 'pagada') as total_por_cobrar,
      sum(monto) filter (where estado <> 'pagada' and fecha_vencimiento < current_date) as total_vencido
    from facturas
    where empresa_id = p_empresa_id and cliente_id is not null
    group by cliente_id
  ),
  pack as (
    select distinct cliente_id
    from paquetes_sesiones
    where empresa_id = p_empresa_id
  )
  select
    c.id as cliente_id,
    coalesce(os.cantidad_os, 0) as cantidad_os,
    os.ultima_actividad,
    coalesce(cotiz.cantidad_cotizaciones, 0) as cantidad_cotizaciones,
    coalesce(fact.total_por_cobrar, 0) as total_por_cobrar,
    coalesce(fact.total_vencido, 0) as total_vencido,
    (pack.cliente_id is not null) as tiene_pack
  from clientes c
  left join os on os.cliente_id = c.id
  left join cotiz on cotiz.cliente_id = c.id
  left join fact on fact.cliente_id = c.id
  left join pack on pack.cliente_id = c.id
  where c.empresa_id = p_empresa_id;
$$;
