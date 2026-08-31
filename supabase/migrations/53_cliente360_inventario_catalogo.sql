-- Cliente 360°, descuento automático de inventario, y etiquetado de
-- catálogo por tipo de equipo.

-- Bloque C: una OS puede vincularse a un equipo específico del cliente
-- (no solo al cliente en general) — necesario para armar el histórico
-- de mantenciones de un equipo. Opcional: la mayoría de las OS de hoy
-- no aplican a un equipo puntual.
alter table trabajos add column equipo_id uuid references equipos(id) on delete set null;
create index on trabajos (empresa_id, equipo_id);

-- Bloque C: fecha de vencimiento de garantía — alimenta la métrica
-- "garantías por vencer" del dashboard de Equipos. No existía ningún
-- campo de garantía hoy.
alter table equipos add column garantia_vencimiento date;

-- Bloque C: Plan de Mantención Preventiva por equipo — solo CRUD por
-- ahora. La generación automática de una OS al llegar proxima_fecha
-- queda para más adelante (ver TODO en el endpoint).
create table planes_mantencion (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  equipo_id uuid not null references equipos(id) on delete cascade,
  frecuencia_dias integer not null check (frecuencia_dias > 0),
  proxima_fecha date not null,
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table planes_mantencion enable row level security;
create policy "acceso por empresa" on planes_mantencion
  for all using (empresa_id = empresa_actual());
create index on planes_mantencion (empresa_id, equipo_id);
create index on planes_mantencion (empresa_id, proxima_fecha) where activo;

-- Bloque D: etiquetado muchos-a-muchos de un ítem de Catálogo con
-- "tipos de equipo" — texto libre (mismo criterio que equipos.categoria,
-- que tampoco es un enum ni tiene tabla propia; no existía ninguna
-- tabla de "tipos de equipo" antes de esto).
create table catalogo_item_tipos_equipo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  catalogo_item_id uuid not null references catalogo_items(id) on delete cascade,
  tipo_equipo text not null,
  unique (catalogo_item_id, tipo_equipo)
);
alter table catalogo_item_tipos_equipo enable row level security;
create policy "acceso por empresa" on catalogo_item_tipos_equipo
  for all using (empresa_id = empresa_actual());
create index on catalogo_item_tipos_equipo (catalogo_item_id);
create index on catalogo_item_tipos_equipo (empresa_id, tipo_equipo);

-- Bloque B: marca si esta OS ya generó sus movimientos de salida de
-- inventario (al firmarse) — evita descontar dos veces o revertir sin
-- haber descontado antes (ej. si se cancela una OS que nunca llegó a
-- firmarse).
alter table ordenes_servicio add column stock_descontado boolean not null default false;
