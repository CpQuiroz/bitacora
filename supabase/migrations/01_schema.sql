-- ============================================================
-- BITÁCORA — Esquema de base de datos multi-empresa
-- Diseñado para Supabase (Postgres + Auth + Row Level Security)
-- ============================================================
-- Cómo usarlo:
-- 1. Crea un proyecto gratis en https://supabase.com
-- 2. Ve a SQL Editor → pega este archivo completo → Run
-- 3. Supabase ya te da login/autenticación (auth.users) gratis
-- ============================================================

-- ------------------------------------------------------------
-- 1. EMPRESAS (el "tenant" — cada pyme que use Bitácora)
-- ------------------------------------------------------------
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text not null default 'transporte', -- transporte, servicio_tecnico, otro
  plan text not null default 'trial',        -- trial, basico, pro
  creado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- 2. USUARIOS (vinculados a auth.users de Supabase)
-- ------------------------------------------------------------
create table usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  rol text not null default 'chofer', -- admin, contador, chofer
  creado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- 3. VIAJES (equivalente a "órdenes de servicio" de Auvo,
--    adaptado a transporte — tu hoja "Viajes" del Excel)
-- ------------------------------------------------------------
create table viajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  n_guia text not null,
  fecha date not null,
  chofer_id uuid references usuarios(id),
  origen text not null,
  destino text not null,
  monto numeric(12,2) not null default 0,
  km numeric(8,1),
  estado text not null default 'completado', -- en_curso, completado, cancelado
  creado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- 4. FACTURAS (tu hoja "Facturas" del Excel)
-- ------------------------------------------------------------
create table facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente text not null,
  semana_facturada text,
  monto numeric(12,2) not null default 0,
  fecha_emision date not null,
  fecha_vencimiento date not null,
  estado text not null default 'pendiente', -- pendiente, pagada, vencida
  viaje_ids uuid[], -- viajes incluidos en esta factura
  creado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- 5. ÓRDENES DE SERVICIO (checklist + fotos + firma — como Auvo)
-- ------------------------------------------------------------
create table ordenes_servicio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  viaje_id uuid references viajes(id),
  checklist jsonb not null default '[]', -- [{"item": "Check-in origen", "hecho": true, "hora": "..."}]
  fotos text[], -- URLs a Supabase Storage
  firma_url text,
  creado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- 6. INVENTARIO
-- ------------------------------------------------------------
create table inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  stock int not null default 0,
  stock_minimo int not null default 0,
  costo numeric(12,2),
  precio numeric(12,2),
  actualizado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- 7. GASTOS FIJOS (tu módulo diferenciador — negocio + personal)
-- ------------------------------------------------------------
create table gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria text not null,   -- peajes, iva, leyes_sociales, pension, renta, hipoteca, dca_cripto...
  tipo text not null default 'negocio', -- negocio, personal
  monto numeric(12,2) not null,
  dia_vencimiento int, -- ej: 11, 19 → para recordatorios
  activo boolean default true,
  creado_en timestamptz default now()
);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY — esto es lo que AISLA los datos
-- entre empresas. Sin esto, cualquier pyme vería los datos
-- de las demás.
-- ------------------------------------------------------------
alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table viajes enable row level security;
alter table facturas enable row level security;
alter table ordenes_servicio enable row level security;
alter table inventario enable row level security;
alter table gastos_fijos enable row level security;

-- Función auxiliar: obtiene la empresa del usuario logueado
create or replace function empresa_actual()
returns uuid as $$
  select empresa_id from usuarios where id = auth.uid();
$$ language sql stable;

-- Política: cada usuario solo ve datos de SU empresa
create policy "acceso por empresa" on viajes
  for all using (empresa_id = empresa_actual());
create policy "acceso por empresa" on facturas
  for all using (empresa_id = empresa_actual());
create policy "acceso por empresa" on ordenes_servicio
  for all using (empresa_id = empresa_actual());
create policy "acceso por empresa" on inventario
  for all using (empresa_id = empresa_actual());
create policy "acceso por empresa" on gastos_fijos
  for all using (empresa_id = empresa_actual());
create policy "ver mi propia empresa" on empresas
  for select using (id = empresa_actual());
create policy "ver companeros de mi empresa" on usuarios
  for select using (empresa_id = empresa_actual());

-- ------------------------------------------------------------
-- Índices para que las consultas sean rápidas al crecer
-- ------------------------------------------------------------
create index idx_viajes_empresa on viajes(empresa_id, fecha desc);
create index idx_facturas_empresa on facturas(empresa_id, estado);
create index idx_gastos_empresa on gastos_fijos(empresa_id, tipo);
