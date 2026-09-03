-- ============================================================
-- Fix: los trabajos sin cliente_id desaparecían de "Mi ruta" en la
-- app móvil. trabajos_del_dia hacía un INNER join a clientes; un
-- trabajo cuyo cliente se cargó solo como texto libre (trabajos.cliente)
-- sin vincular a un registro de `clientes` no aparecía.
--
-- Ahora: LEFT JOIN. El nombre sale de coalesce(clientes.nombre,
-- trabajos.cliente); la dirección de coalesce(clientes.direccion,
-- trabajos.ubicacion); lat/lng quedan null si no hay cliente vinculado
-- (la pantalla los muestra en la lista "sin coordenadas", no los pierde).
-- ============================================================
create or replace function trabajos_del_dia(
  p_empresa_id uuid,
  p_responsable_id uuid,
  p_fecha date
)
returns table(
  trabajo_id uuid,
  cliente_nombre text,
  direccion text,
  lat numeric,
  lng numeric
) as $$
  select
    t.id,
    coalesce(nullif(trim(c.nombre), ''), nullif(trim(t.cliente), ''), 'Sin cliente'),
    coalesce(nullif(trim(c.direccion), ''), nullif(trim(t.ubicacion), '')),
    c.lat,
    c.lng
  from trabajos t
  left join clientes c on c.id = t.cliente_id
  where t.empresa_id = p_empresa_id
    and t.responsable_id = p_responsable_id
    and t.fecha = p_fecha
    and t.estado != 'cancelado'
  order by t.hora_programada nulls last, t.creado_en;
$$ language sql stable;
