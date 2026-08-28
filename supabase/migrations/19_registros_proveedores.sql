create table proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  razon_social text,
  rut text,
  telefono text,
  correo text,
  categoria_gasto_id uuid references categorias_gasto(id) on delete set null,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table proveedores enable row level security;
create policy "acceso por empresa" on proveedores
  for all using (empresa_id = empresa_actual());
create index proveedores_empresa_idx on proveedores(empresa_id);
