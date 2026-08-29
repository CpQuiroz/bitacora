alter table clientes add column rut text;
create index idx_clientes_rut on clientes(rut) where rut is not null;

-- El id de esta fila ES el token del link (uuid random de Postgres, ya
-- impredecible) — vencido a los 7 días, reutilizable dentro de esa
-- ventana (no de un solo clic).
create table portal_accesos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  entidad_tipo text check (entidad_tipo in ('trabajo', 'cotizacion', 'factura')),
  entidad_id uuid,
  expira_en timestamptz not null,
  creado_en timestamptz not null default now()
);
alter table portal_accesos enable row level security;
create policy "acceso por empresa" on portal_accesos
  for all using (empresa_id = empresa_actual());

-- Login recurrente: código de 6 dígitos, hasheado, 10 min, se invalida
-- al usarse.
create table portal_codigos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  codigo_hash text not null,
  expira_en timestamptz not null,
  usado_en timestamptz,
  creado_en timestamptz not null default now()
);
alter table portal_codigos enable row level security;
create policy "acceso por empresa" on portal_codigos
  for all using (empresa_id = empresa_actual());
create index on portal_codigos (cliente_id, creado_en desc);
