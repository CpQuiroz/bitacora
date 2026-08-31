-- Cumpleaños de cliente: campo opcional + nuevo tipo de notificación
-- al cliente, mismo patrón ya usado para sumar cita_agendada
-- (migración 41) — sumarlo a los 3 check constraints + la config +
-- mensajes_personalizados. Sin cron en este proyecto: se revisa con
-- un chequeo perezoso (ver revisarCumpleanosClientes en
-- backend/src/cumpleanosClientes.ts) enganchado en GET /api/me, que
-- es el endpoint que sí se llama todos los días con cualquier uso
-- normal de la app (a diferencia de una lista puntual que capaz nadie
-- abre justo ese día).
alter table clientes add column fecha_nacimiento date;

alter table notificaciones_config add column cliente_cumpleanos boolean not null default true;

alter table mensajes_personalizados drop constraint mensajes_personalizados_tipo_check;
alter table mensajes_personalizados add constraint mensajes_personalizados_tipo_check
  check (tipo in ('cotizacion', 'orden_servicio', 'cobranza', 'tecnico_en_camino', 'cita_agendada', 'cumpleanos'));

alter table notificaciones_cliente_log drop constraint notificaciones_cliente_log_tipo_check;
alter table notificaciones_cliente_log add constraint notificaciones_cliente_log_tipo_check
  check (tipo in (
    'cotizacion_enviada', 'cotizacion_por_vencer', 'tecnico_en_camino',
    'os_completada', 'cobro_pendiente', 'cobro_vencido', 'cita_agendada', 'cliente_cumpleanos'
  ));

alter table notificaciones_cliente_log drop constraint notificaciones_cliente_log_entidad_tipo_check;
alter table notificaciones_cliente_log add constraint notificaciones_cliente_log_entidad_tipo_check
  check (entidad_tipo in ('cotizacion', 'trabajo', 'factura', 'tarea', 'cliente'));
