-- BITÁCORA — Módulo "Gestión y Control": roles/permisos reales +
-- notificaciones internas. Ver plan en
-- /Users/cmagno/.claude/plans/jolly-sparking-pie.md para el contexto
-- completo de por qué se modela así.

-- Cuentas: activar/desactivar (no existía) + vencimiento de licencia
-- del colaborador (campo simple, sin tabla de vehículos todavía).
alter table usuarios add column activo boolean not null default true;
alter table usuarios add column fecha_vencimiento_licencia date;

-- Auditoría mínima: quién cambió el rol o el estado de otro usuario,
-- y cuándo. No hay tabla de roles/permisos separada — la matriz de
-- permisos vive en código (packages/shared/src/permisos.ts) porque
-- son 4 roles fijos, sin roles custom por empresa.
create table auditoria_usuarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_afectado_id uuid not null references usuarios(id) on delete cascade,
  realizado_por_id uuid references usuarios(id) on delete set null,
  campo text not null,
  valor_anterior text,
  valor_nuevo text,
  creado_en timestamptz not null default now()
);
alter table auditoria_usuarios enable row level security;
create policy "acceso por empresa" on auditoria_usuarios
  for all using (empresa_id = empresa_actual());
create index on auditoria_usuarios (empresa_id, usuario_afectado_id, creado_en desc);

-- Centro de notificaciones real (feed que alguien lee y marca como
-- leído) — distinto de "notificaciones_config", que sigue existiendo
-- tal cual para las preferencias de correo por-empresa. Una fila por
-- destinatario: con el volumen de esta app es más simple de
-- consultar, y cada fila ya pertenece a un usuario_id — el filtro de
-- "solo lo mío" es gratis, no hace falta lógica de permisos aparte.
create table notificaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  cuerpo text,
  entidad_tipo text,
  entidad_id uuid,
  leido boolean not null default false,
  creado_en timestamptz not null default now()
);
alter table notificaciones enable row level security;
create policy "acceso por empresa" on notificaciones
  for all using (empresa_id = empresa_actual());
create index on notificaciones (empresa_id, usuario_id, leido, creado_en desc);

-- Preferencias por usuario y tipo de evento — distinto de
-- "notificaciones_config" (por-empresa, solo correo). El campo
-- email_activado queda preparado para cuando se conecte el envío de
-- verdad; hoy no dispara nada.
create table notificaciones_preferencias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  tipo text not null,
  app_activado boolean not null default true,
  email_activado boolean not null default false,
  unique (usuario_id, tipo)
);
alter table notificaciones_preferencias enable row level security;
create policy "acceso por usuario" on notificaciones_preferencias
  for all using (
    usuario_id in (select id from usuarios where empresa_id = empresa_actual())
  );
