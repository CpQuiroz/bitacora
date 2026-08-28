-- Equipos: activos/maquinaria del cliente. Deben vincularse a un
-- cliente existente (cliente_id not null), nunca texto libre.
create table equipos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  marca text,
  modelo text,
  numero_serie text,
  categoria text,
  notas text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table equipos enable row level security;
create policy "acceso por empresa" on equipos
  for all using (empresa_id = empresa_actual());
create index equipos_empresa_cliente_idx on equipos(empresa_id, cliente_id);

-- Catálogo: productos, servicios y kits reutilizables al armar
-- cotizaciones y órdenes de servicio (os_items ya existe desde el
-- módulo de OS Digitales; el catálogo es la fuente de precios/nombres
-- que ese flujo — y el de cotizaciones — podrán consumir más adelante).
create table catalogo_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('producto', 'servicio', 'kit')),
  nombre text not null,
  sku text,
  categoria text,
  unidad text not null default 'unidad',
  precio_base numeric(12,2) not null default 0,
  -- Solo se usan cuando tipo = 'producto'; Inventario los administra.
  stock_actual numeric(12,2),
  stock_minimo numeric(12,2),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table catalogo_items enable row level security;
create policy "acceso por empresa" on catalogo_items
  for all using (empresa_id = empresa_actual());
create index catalogo_items_empresa_tipo_idx on catalogo_items(empresa_id, tipo);

-- Un kit combina ítems de catálogo ya existentes (producto o
-- servicio) con una cantidad cada uno.
create table catalogo_kit_items (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  kit_id uuid not null references catalogo_items(id) on delete cascade,
  item_id uuid not null references catalogo_items(id) on delete cascade,
  cantidad numeric(10,2) not null default 1,
  unique (kit_id, item_id)
);
alter table catalogo_kit_items enable row level security;
create policy "acceso por empresa" on catalogo_kit_items
  for all using (empresa_id = empresa_actual());
create index catalogo_kit_items_kit_idx on catalogo_kit_items(kit_id);

-- Auditoría de movimientos de stock (entradas/salidas/ajustes
-- manuales) — solo tiene sentido cuando Configuración → Inventario
-- está activado; el backend lo exige al crear un movimiento.
create table inventario_movimientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  catalogo_item_id uuid not null references catalogo_items(id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste')),
  cantidad numeric(12,2) not null,
  stock_resultante numeric(12,2) not null,
  motivo text,
  creado_en timestamptz not null default now()
);
alter table inventario_movimientos enable row level security;
create policy "acceso por empresa" on inventario_movimientos
  for all using (empresa_id = empresa_actual());
create index inventario_movimientos_item_idx on inventario_movimientos(catalogo_item_id, creado_en desc);
