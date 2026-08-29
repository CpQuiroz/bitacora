-- Identidad de plataforma para el Panel de Super-Admin — completamente
-- separada de la matriz de roles por empresa (usuarios/empresa_id).
-- Sin Supabase Auth: credenciales propias (password + TOTP), nunca en
-- auth.users. Sin RLS: estas tablas nunca las toca el backend "normal"
-- con req.empresaId, y el service role sigue siendo el único cliente
-- (consistente con el resto del proyecto, ver Etapa 0).
create table super_admins (
  id uuid primary key default gen_random_uuid(),
  correo text not null unique,
  password_hash text not null,
  totp_secreto text not null,
  nombre text not null,
  activo boolean not null default true,
  intentos_fallidos int not null default 0,
  bloqueado_hasta timestamptz,
  ultimo_login_en timestamptz,
  creado_en timestamptz not null default now()
);

create table super_admin_auditoria (
  id uuid primary key default gen_random_uuid(),
  super_admin_id uuid not null references super_admins(id) on delete cascade,
  accion text not null,
  empresa_id uuid references empresas(id) on delete set null,
  detalle text,
  ip text,
  creado_en timestamptz not null default now()
);
create index on super_admin_auditoria (super_admin_id, creado_en);
create index on super_admin_auditoria (empresa_id);

-- Estado operacional de la empresa (distinto de empresas.plan, que es
-- el nivel de suscripción). Default 'activa' refleja la realidad de
-- hoy sin migrar datos — las acciones para cambiarlo son Etapa 3.
alter table empresas add column estado text not null default 'activa'
  check (estado in ('activa', 'suspendida', 'dada_de_baja'));
