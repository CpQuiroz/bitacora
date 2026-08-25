-- ============================================================
-- BITÁCORA — Generalización: de "viajes" a "trabajos" flexible
-- Reemplaza el uso de la tabla viajes de bitacora-schema.sql
-- para que la app sirva a cualquier rubro de servicio en terreno
-- ============================================================

-- ------------------------------------------------------------
-- 1. TIPOS DE TRABAJO — cada empresa define los suyos
-- ------------------------------------------------------------
create table tipos_trabajo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,              -- "Viaje", "Mantención", "Instalación"
  campos jsonb not null default '[]', -- [{"clave":"origen","etiqueta":"Origen","tipo":"texto"}, ...]
  creado_en timestamptz default now()
);

alter table tipos_trabajo enable row level security;
create policy "acceso por empresa" on tipos_trabajo
  for all using (empresa_id = empresa_actual());

-- ------------------------------------------------------------
-- 2. TRABAJOS — reemplaza a "viajes", genérico para todo rubro
-- ------------------------------------------------------------
create table trabajos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo_trabajo_id uuid references tipos_trabajo(id),
  codigo text,                   -- n° guía, n° orden, folio... lo que use cada rubro
  fecha date not null,
  semana int,
  responsable_id uuid references usuarios(id), -- chofer, técnico, instalador
  cliente text not null,
  ubicacion text,                -- dirección, edificio, tramo de ruta, etc.
  monto numeric(12,2) default 0,
  estado text not null default 'completado', -- en_curso, completado, cancelado
  datos jsonb not null default '{}',  -- campos específicos del rubro (ver tipos_trabajo.campos)
  creado_en timestamptz default now()
);

alter table trabajos enable row level security;
create policy "acceso por empresa" on trabajos
  for all using (empresa_id = empresa_actual());

create trigger trg_calcular_semana_trabajo
  before insert or update of fecha on trabajos
  for each row execute function calcular_semana();

create index idx_trabajos_empresa on trabajos(empresa_id, fecha desc);

-- ------------------------------------------------------------
-- 3. ACTUALIZAR REFERENCIAS: ordenes_servicio y facturas
--    ya apuntaban a "viaje_id" / "viaje_ids" — se renombran
-- ------------------------------------------------------------
alter table ordenes_servicio rename column viaje_id to trabajo_id;
alter table facturas rename column viaje_ids to trabajo_ids;

-- Renombrar la columna NO mueve el FK con ella: ordenes_servicio.trabajo_id
-- seguía apuntando a viajes(id). Hay que recrear la constraint apuntando
-- a la tabla nueva.
alter table ordenes_servicio drop constraint ordenes_servicio_viaje_id_fkey;
alter table ordenes_servicio
  add constraint ordenes_servicio_trabajo_id_fkey
  foreign key (trabajo_id) references trabajos(id);

-- ------------------------------------------------------------
-- 4. FUNCIONES ACTUALIZADAS para trabajar con "trabajos"
-- ------------------------------------------------------------
-- resumen_semanal cambia los nombres de sus columnas de salida
-- (chofer -> responsable, total_viajes -> total_trabajos), y
-- Postgres no permite CREATE OR REPLACE cuando cambian los OUT:
-- hay que borrar la versión de 02_logica_negocio.sql primero.
drop function if exists resumen_semanal(uuid, int);

create or replace function resumen_semanal(p_empresa_id uuid, p_semana int)
returns table(responsable text, total_trabajos bigint, total_monto numeric) as $$
  select u.nombre, count(t.id), sum(t.monto)
  from trabajos t
  join usuarios u on u.id = t.responsable_id
  where t.empresa_id = p_empresa_id
    and t.semana = p_semana
    and t.estado = 'completado'
  group by u.nombre;
$$ language sql stable;

-- mismo motivo: Postgres no permite renombrar parámetros de entrada
-- (p_viaje_ids -> p_trabajo_ids) vía CREATE OR REPLACE.
drop function if exists generar_factura(uuid, text, text, uuid[], int);

create or replace function generar_factura(
  p_empresa_id uuid,
  p_cliente text,
  p_semana text,
  p_trabajo_ids uuid[],
  p_dias_plazo int default 30
)
returns uuid as $$
declare
  v_total numeric;
  v_factura_id uuid;
begin
  select coalesce(sum(monto), 0) into v_total
  from trabajos where id = any(p_trabajo_ids) and empresa_id = p_empresa_id;

  insert into facturas (empresa_id, cliente, semana_facturada, monto,
                         fecha_emision, fecha_vencimiento, estado, trabajo_ids)
  values (p_empresa_id, p_cliente, p_semana, v_total,
          current_date, current_date + p_dias_plazo, 'pendiente', p_trabajo_ids)
  returning id into v_factura_id;

  return v_factura_id;
end;
$$ language plpgsql;

-- ------------------------------------------------------------
-- 5. EJEMPLO: cómo queda cada rubro usando la misma tabla
-- ------------------------------------------------------------
-- Transportes Itineris:
-- insert into tipos_trabajo (empresa_id, nombre, campos) values
--   ('<empresa_id>', 'Viaje', '[
--      {"clave":"origen","etiqueta":"Origen","tipo":"texto"},
--      {"clave":"destino","etiqueta":"Destino","tipo":"texto"},
--      {"clave":"km","etiqueta":"Kilómetros","tipo":"numero"}
--   ]');
--
-- Técnico de purificadoras:
-- insert into tipos_trabajo (empresa_id, nombre, campos) values
--   ('<empresa_id>', 'Mantención en terreno', '[
--      {"clave":"equipo","etiqueta":"Equipo/modelo","tipo":"texto"},
--      {"clave":"tipo_servicio","etiqueta":"Tipo de servicio","tipo":"texto"},
--      {"clave":"repuestos","etiqueta":"Repuestos usados","tipo":"texto"}
--   ]');
--
-- Instalador contraincendios:
-- insert into tipos_trabajo (empresa_id, nombre, campos) values
--   ('<empresa_id>', 'Instalación / avance', '[
--      {"clave":"edificio","etiqueta":"Edificio","tipo":"texto"},
--      {"clave":"sistema","etiqueta":"Sistema instalado","tipo":"texto"},
--      {"clave":"etapa","etiqueta":"Etapa de avance","tipo":"texto"},
--      {"clave":"piso","etiqueta":"Piso/nivel","tipo":"texto"}
--   ]');
--
-- Los tres usan la MISMA tabla "trabajos" — solo cambia
-- qué campos se muestran en el formulario, según tipo_trabajo_id.
