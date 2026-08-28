-- ============================================================
-- BITÁCORA — Órdenes de Servicio (OS) Digitales
-- Se ejecuta después de 07_rutas_planificadas.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. FOLIO CORRELATIVO por empresa (uno por empresa, atómico)
-- ------------------------------------------------------------
alter table empresas add column siguiente_folio_os int not null default 1;

create or replace function siguiente_folio_os(p_empresa_id uuid)
returns int as $$
declare
  v_folio int;
begin
  update empresas
  set siguiente_folio_os = siguiente_folio_os + 1
  where id = p_empresa_id
  returning siguiente_folio_os - 1 into v_folio;

  return v_folio;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 2. ORDENES_SERVICIO — folio, estado propio de la OS, firmante
--    y notas de cierre, y el timestamp que bloquea edición.
-- ------------------------------------------------------------
alter table ordenes_servicio add column folio int;
alter table ordenes_servicio add column estado_os text not null default 'enviada'
  check (estado_os in ('pendiente', 'enviada', 'en_proceso', 'completada', 'firmada'));
alter table ordenes_servicio add column firmante_nombre text;
alter table ordenes_servicio add column firmante_documento text;
alter table ordenes_servicio add column observaciones_cierre text;
alter table ordenes_servicio add column finalizada_en timestamptz;

create unique index idx_ordenes_servicio_folio on ordenes_servicio(empresa_id, folio);

-- Un trabajo tiene a lo más una orden de servicio (ya era la regla en
-- código — obtenerOCrearOrden busca antes de insertar — esto la hace
-- explícita a nivel de datos y además permite el embed singular
-- "trabajos -> orden:ordenes_servicio(*)" en PostgREST).
create unique index idx_ordenes_servicio_trabajo on ordenes_servicio(trabajo_id) where trabajo_id is not null;

-- ------------------------------------------------------------
-- 3. OS_ITEMS — ítems/materiales de la OS, con cantidad y precio
--    unitario (el total se calcula al leer, no se guarda aparte).
-- ------------------------------------------------------------
create table os_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  trabajo_id uuid not null references trabajos(id) on delete cascade,
  descripcion text not null,
  cantidad numeric(10,2) not null default 1,
  precio_unitario numeric(12,2) not null default 0,
  creado_en timestamptz default now()
);

alter table os_items enable row level security;
create policy "acceso por empresa" on os_items
  for all using (empresa_id = empresa_actual());

create index idx_os_items_trabajo on os_items(trabajo_id);

-- ------------------------------------------------------------
-- 4. TRABAJOS — hora programada del servicio (la fecha ya existe)
-- ------------------------------------------------------------
alter table trabajos add column hora_programada text; -- "HH:MM"
