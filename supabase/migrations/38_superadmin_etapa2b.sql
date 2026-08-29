-- Etapa 2b del Panel de Super-Admin: instrumentación nueva (no existía
-- antes) para consumo de Claude API y errores recientes, por empresa.
create table ia_uso (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  feature text not null,
  modelo text not null,
  tokens_entrada int not null,
  tokens_salida int not null,
  creado_en timestamptz not null default now()
);
create index on ia_uso (empresa_id, creado_en);

create table errores_backend (
  id uuid primary key default gen_random_uuid(),
  -- null si el error ocurrió antes de resolver la empresa (ej. login).
  empresa_id uuid references empresas(id) on delete set null,
  ruta text not null,
  metodo text not null,
  mensaje text not null,
  creado_en timestamptz not null default now()
);
create index on errores_backend (empresa_id, creado_en);
create index on errores_backend (creado_en);
