-- ============================================================
-- Precio de viajes por tramos y por km (tarea 135, 24-sep-2026).
-- Propuesta aprobada: docs/PROPUESTA_PRECIOS_VIAJES.md §2.
--
-- - tarifas_tramo: precio neto de un tramo entre dos ciudades. Vale lo
--   mismo en ambos sentidos (decisión de la usuaria): el par se guarda
--   normalizado y ordenado (par_a <= par_b). Un tramo con cliente gana
--   sobre el general.
-- - tarifas_km: precio neto por km, general o por cliente.
-- - distancias_cache: km por carretera ya calculados con el proveedor de
--   mapas (OpenRouteService) — dato geográfico, no de una empresa; solo
--   lo toca el backend.
-- - viajes: cómo se calculó su precio (modo_precio, distancia_km,
--   precio_km, tramos_detalle). El subtotal sigue siendo el monto final.
-- - clientes: forma de cobro por defecto al crear un viaje.
--
-- Tarifas y detalle solo los ven Admin y Supervisor (lo exige el backend).
-- Aditiva e idempotente.
-- ============================================================

create table if not exists tarifas_tramo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  -- Nombres como los escribió el Admin (para mostrar).
  origen text not null,
  destino text not null,
  -- Par normalizado (sin tildes, minúsculas) y ordenado: A-B = B-A.
  par_a text not null,
  par_b text not null,
  precio numeric(12,2) not null check (precio >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (par_a <= par_b)
);
create unique index if not exists tarifas_tramo_unico
  on tarifas_tramo (empresa_id, par_a, par_b, cliente_id) nulls not distinct;
create index if not exists idx_tarifas_tramo_cliente on tarifas_tramo (cliente_id) where cliente_id is not null;
alter table tarifas_tramo enable row level security;
drop policy if exists "acceso por empresa" on tarifas_tramo;
create policy "acceso por empresa" on tarifas_tramo for all using (empresa_id = empresa_actual());

create table if not exists tarifas_km (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete cascade,
  precio_km numeric(12,2) not null check (precio_km >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index if not exists tarifas_km_unico
  on tarifas_km (empresa_id, cliente_id) nulls not distinct;
create index if not exists idx_tarifas_km_cliente on tarifas_km (cliente_id) where cliente_id is not null;
alter table tarifas_km enable row level security;
drop policy if exists "acceso por empresa" on tarifas_km;
create policy "acceso por empresa" on tarifas_km for all using (empresa_id = empresa_actual());

create table if not exists distancias_cache (
  par_a text not null,
  par_b text not null,
  km numeric(10,2) not null check (km >= 0),
  proveedor text not null,
  calculado_en timestamptz not null default now(),
  primary key (par_a, par_b),
  check (par_a <= par_b)
);
-- Sin políticas: solo el backend (service_role) la lee y escribe.
alter table distancias_cache enable row level security;

alter table viajes add column if not exists modo_precio text not null default 'fijo'
  check (modo_precio in ('fijo', 'tramos', 'km'));
alter table viajes add column if not exists distancia_km numeric(10,2) check (distancia_km is null or distancia_km >= 0);
alter table viajes add column if not exists precio_km numeric(12,2) check (precio_km is null or precio_km >= 0);
-- [{ origen, destino, precio, km? }] tal como se calculó (fijo en el viaje:
-- el cobro no cambia aunque después cambien las tarifas).
alter table viajes add column if not exists tramos_detalle jsonb;

alter table clientes add column if not exists modo_precio_default text
  check (modo_precio_default is null or modo_precio_default in ('fijo', 'tramos', 'km'));
