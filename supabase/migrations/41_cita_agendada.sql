-- Agenda Pro: el cliente confirma o cancela su cita desde el Portal,
-- avisado por correo (mismo mecanismo que cotizaciones aprobar/rechazar).

alter table tareas drop constraint tareas_estado_check;
alter table tareas add constraint tareas_estado_check
  check (estado in ('pendiente', 'confirmada', 'completada', 'cancelada'));

alter table notificaciones_config add column cita_agendada boolean not null default true;

alter table mensajes_personalizados drop constraint mensajes_personalizados_tipo_check;
alter table mensajes_personalizados add constraint mensajes_personalizados_tipo_check
  check (tipo in ('cotizacion', 'orden_servicio', 'cobranza', 'tecnico_en_camino', 'cita_agendada'));

alter table notificaciones_cliente_log drop constraint notificaciones_cliente_log_tipo_check;
alter table notificaciones_cliente_log add constraint notificaciones_cliente_log_tipo_check
  check (tipo in (
    'cotizacion_enviada', 'cotizacion_por_vencer', 'tecnico_en_camino',
    'os_completada', 'cobro_pendiente', 'cobro_vencido', 'cita_agendada'
  ));

alter table notificaciones_cliente_log drop constraint notificaciones_cliente_log_entidad_tipo_check;
alter table notificaciones_cliente_log add constraint notificaciones_cliente_log_entidad_tipo_check
  check (entidad_tipo in ('cotizacion', 'trabajo', 'factura', 'tarea'));

alter table portal_accesos drop constraint portal_accesos_entidad_tipo_check;
alter table portal_accesos add constraint portal_accesos_entidad_tipo_check
  check (entidad_tipo in ('trabajo', 'cotizacion', 'factura', 'tarea'));
