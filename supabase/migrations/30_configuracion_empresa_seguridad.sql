alter table empresas add column giro text;
alter table usuarios add column mfa_activado boolean not null default false;

create table accesos_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  ip text,
  user_agent text,
  creado_en timestamptz not null default now()
);
alter table accesos_usuario enable row level security;
create policy "acceso por empresa" on accesos_usuario
  for all using (empresa_id = empresa_actual());
create index on accesos_usuario (usuario_id, creado_en desc);
