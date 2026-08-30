-- Autenticación de dos factores (TOTP o código por correo) para
-- usuarios normales (usuarios.mfa_activado ya existía, sin usar).
alter table usuarios add column mfa_metodo text check (mfa_metodo in ('totp', 'email'));

-- Secreto TOTP cifrado, en tabla aparte — nunca la tocan los
-- select("*") de usuarios que sí llegan al frontend (ej. GET
-- /api/usuarios, que le muestra el equipo completo a cualquier
-- miembro de la empresa).
create table mfa_totp_secretos (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  secreto_cifrado text not null,
  creado_en timestamptz not null default now()
);

-- Código de 6 dígitos vigente para un usuario — se reutiliza tanto
-- para activar 2FA por correo (enrollment) como para el challenge de
-- login con 2FA por correo ya activo. Un código a la vez (upsert).
create table mfa_codigo_pendiente (
  usuario_id uuid primary key references usuarios(id) on delete cascade,
  codigo_hash text not null,
  intentos int not null default 0,
  expira_en timestamptz not null,
  creado_en timestamptz not null default now()
);

-- Ticket de login pendiente de segundo factor — guarda la sesión de
-- Supabase YA VÁLIDA (contraseña correcta) cifrada, hasta confirmar el
-- código. De un solo uso, vida corta.
create table login_2fa_pendiente (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  metodo text not null check (metodo in ('totp', 'email')),
  intentos int not null default 0,
  access_token_cifrado text not null,
  refresh_token_cifrado text not null,
  expira_en timestamptz not null,
  creado_en timestamptz not null default now()
);
create index on login_2fa_pendiente (expira_en);

-- Sin RLS en las tres tablas — mismo criterio que super_admins
-- (37_superadmin.sql): solo las toca el backend con service role,
-- nunca un cliente con req.empresaId.
