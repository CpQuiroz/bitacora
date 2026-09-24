-- ============================================================
-- Auditoría de acciones de usuarios de una empresa (tarea 131,
-- 24-sep-2026). Hasta ahora solo existía auditoria_usuarios (cambios de
-- rol/activo/clave). Esta es genérica: quién hizo qué, cuándo y sobre
-- qué registro. La usan:
--   - eliminar cliente (tarea 131): entidad 'cliente', accion 'eliminar'
--   - cambio de monto de un viaje (tarea 132): entidad 'viaje',
--     accion 'cambiar_monto', detalle con monto anterior y nuevo
-- entidad_id sin FK a propósito: el registro puede haberse borrado.
-- Aditiva e idempotente. RLS por empresa; solo el backend la escribe.
-- ============================================================

create table if not exists auditoria_empresa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid references usuarios(id) on delete set null,
  accion text not null,
  entidad text not null,
  entidad_id uuid,
  detalle jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now()
);

create index if not exists auditoria_empresa_entidad_idx on auditoria_empresa (empresa_id, entidad, entidad_id);
create index if not exists auditoria_empresa_fecha_idx on auditoria_empresa (empresa_id, creado_en desc);

alter table auditoria_empresa enable row level security;
drop policy if exists "acceso por empresa" on auditoria_empresa;
create policy "acceso por empresa" on auditoria_empresa
  for all using (empresa_id = empresa_actual());

revoke all on auditoria_empresa from anon, authenticated;
