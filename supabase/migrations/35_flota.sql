alter table usuarios add column zona text;

-- Tipos de documento configurables por empresa (no hardcodeados) — mismo
-- patrón que categorias_gasto: nombre + a qué aplica.
create table tipos_documento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  aplica_a text not null check (aplica_a in ('colaborador', 'vehiculo', 'ambos')),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, nombre)
);
alter table tipos_documento enable row level security;
create policy "acceso por empresa" on tipos_documento
  for all using (empresa_id = empresa_actual());

-- Documento genérico — un solo lugar para licencias, revisión técnica,
-- seguros, permisos, etc., de colaboradores Y vehículos.
create table documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  entidad_tipo text not null check (entidad_tipo in ('colaborador', 'vehiculo')),
  entidad_id uuid not null,
  tipo_documento_id uuid not null references tipos_documento(id) on delete restrict,
  numero text,
  fecha_emision date,
  fecha_vencimiento date,
  archivo_key text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table documentos enable row level security;
create policy "acceso por empresa" on documentos
  for all using (empresa_id = empresa_actual());
create index on documentos (empresa_id, entidad_tipo, entidad_id);
create index on documentos (empresa_id, fecha_vencimiento);

create table vehiculos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  patente text not null,
  marca text,
  modelo text,
  anio integer,
  tipo text,
  capacidad_carga text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, patente)
);
alter table vehiculos enable row level security;
create policy "acceso por empresa" on vehiculos
  for all using (empresa_id = empresa_actual());

-- Relación colaborador-vehículo con vigencia — un vehículo puede rotar.
create table vehiculo_asignaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  vehiculo_id uuid not null references vehiculos(id) on delete cascade,
  colaborador_id uuid not null references usuarios(id) on delete cascade,
  desde date not null default current_date,
  hasta date,
  creado_en timestamptz not null default now()
);
alter table vehiculo_asignaciones enable row level security;
create policy "acceso por empresa" on vehiculo_asignaciones
  for all using (empresa_id = empresa_actual());
create index on vehiculo_asignaciones (empresa_id, colaborador_id, hasta);
create index on vehiculo_asignaciones (empresa_id, vehiculo_id, hasta);

-- Conecta Viajes con Vehículos (hoy Viajes no tenía nada que referenciar).
alter table viajes add column vehiculo_id uuid references vehiculos(id) on delete set null;

-- Migra el dato ya existente al nuevo sistema genérico, en vez de dejarlo
-- huérfano en la columna vieja (fecha_vencimiento_licencia se mantiene,
-- pero deja de ser la fuente de verdad).
insert into tipos_documento (empresa_id, nombre, aplica_a)
select distinct empresa_id, 'Licencia de Conducir', 'colaborador'
from usuarios where fecha_vencimiento_licencia is not null
on conflict (empresa_id, nombre) do nothing;

insert into documentos (empresa_id, entidad_tipo, entidad_id, tipo_documento_id, fecha_vencimiento)
select u.empresa_id, 'colaborador', u.id, td.id, u.fecha_vencimiento_licencia
from usuarios u
join tipos_documento td on td.empresa_id = u.empresa_id and td.nombre = 'Licencia de Conducir'
where u.fecha_vencimiento_licencia is not null;
