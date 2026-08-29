alter table notificaciones_config add column cotizacion_enviada boolean not null default true;
alter table notificaciones_config add column cotizacion_por_vencer boolean not null default true;
alter table notificaciones_config add column dias_aviso_vencimiento integer not null default 3;
alter table notificaciones_config add column tecnico_en_camino boolean not null default true;
alter table notificaciones_config add column cobro_pendiente boolean not null default false;

alter table mensajes_personalizados drop constraint mensajes_personalizados_tipo_check;
alter table mensajes_personalizados add constraint mensajes_personalizados_tipo_check
  check (tipo in ('cotizacion', 'orden_servicio', 'cobranza', 'tecnico_en_camino'));

-- Registro de cada intento de envío al cliente — para poder ver qué
-- falló y reenviar manualmente.
create table notificaciones_cliente_log (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in (
    'cotizacion_enviada', 'cotizacion_por_vencer', 'tecnico_en_camino',
    'os_completada', 'cobro_pendiente', 'cobro_vencido'
  )),
  destinatario text not null,
  entidad_tipo text not null check (entidad_tipo in ('cotizacion', 'trabajo', 'factura')),
  entidad_id uuid not null,
  exito boolean not null,
  error text,
  creado_en timestamptz not null default now()
);
alter table notificaciones_cliente_log enable row level security;
create policy "acceso por empresa" on notificaciones_cliente_log
  for all using (empresa_id = empresa_actual());
create index on notificaciones_cliente_log (empresa_id, creado_en desc);
