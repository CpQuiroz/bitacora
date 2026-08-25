-- ============================================================
-- BITÁCORA — Clientes con ubicación + planificación de rutas
-- Se ejecuta después de los SQL anteriores
-- ============================================================

-- ------------------------------------------------------------
-- 1. CLIENTES — con coordenadas para poder rutear
-- ------------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  direccion text not null,
  lat numeric(9,6),   -- se llenan automáticamente al geocodificar
  lng numeric(9,6),
  telefono text,
  notas text,
  creado_en timestamptz default now()
);

alter table clientes enable row level security;
create policy "acceso por empresa" on clientes
  for all using (empresa_id = empresa_actual());

create index idx_clientes_empresa on clientes(empresa_id);

-- ------------------------------------------------------------
-- 2. Vincular trabajos a un cliente real (no solo texto suelto)
-- ------------------------------------------------------------
alter table trabajos add column cliente_id uuid references clientes(id);

-- ------------------------------------------------------------
-- 3. RUTA DEL DÍA — trabajos de un chofer/técnico agrupados
--    por fecha, listos para mandar a Google Maps a optimizar
-- ------------------------------------------------------------
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
  select t.id, c.nombre, c.direccion, c.lat, c.lng
  from trabajos t
  join clientes c on c.id = t.cliente_id
  where t.empresa_id = p_empresa_id
    and t.responsable_id = p_responsable_id
    and t.fecha = p_fecha
    and t.estado != 'cancelado';
$$ language sql stable;

-- ------------------------------------------------------------
-- CÓMO SE USA (flujo completo, esto vive en el backend):
-- 1. select * from trabajos_del_dia(empresa, chofer, hoy);
-- 2. Se manda esa lista de direcciones a Google Maps
--    Route Optimization API → devuelve el orden óptimo
-- 3. Se arma un link de Waze con las paradas en ese orden:
--    https://waze.com/ul?ll=<lat>,<lng>&navigate=yes
--    (Waze no optimiza multi-parada, solo abre y navega —
--    por eso el orden ya viene calculado desde Google Maps)
-- 4. El chofer toca un botón en la app y se abre Waze directo
--    con la primera parada cargada
-- ============================================================
