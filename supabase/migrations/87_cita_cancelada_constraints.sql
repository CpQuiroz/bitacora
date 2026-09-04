-- Sumar 'cita_cancelada' a los check constraints de tipo, mismo patrón
-- que 41_cita_agendada.sql y 58_cumpleanos_clientes.sql — la columna
-- notificaciones_config.cita_cancelada ya se agregó en 86, esto es lo
-- que faltaba para que notificarCliente() pueda de verdad registrar el
-- envío (y guardar un mensaje personalizado para este tipo).
alter table mensajes_personalizados drop constraint mensajes_personalizados_tipo_check;
alter table mensajes_personalizados add constraint mensajes_personalizados_tipo_check
  check (tipo in ('cotizacion', 'orden_servicio', 'cobranza', 'tecnico_en_camino', 'cita_agendada', 'cita_cancelada', 'cumpleanos'));

alter table notificaciones_cliente_log drop constraint notificaciones_cliente_log_tipo_check;
alter table notificaciones_cliente_log add constraint notificaciones_cliente_log_tipo_check
  check (tipo in (
    'cotizacion_enviada', 'cotizacion_por_vencer', 'tecnico_en_camino',
    'os_completada', 'cobro_pendiente', 'cobro_vencido', 'cita_agendada', 'cita_cancelada', 'cliente_cumpleanos'
  ));
