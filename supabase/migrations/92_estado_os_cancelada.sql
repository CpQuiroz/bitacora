-- PASO 1 (A') del rediseño de navegación — un solo vocabulario de estados.
--
-- Trabajo y OrdenServicio son dos capas del mismo registro pero tenían
-- dos juegos de estados (EstadoTrabajo de 3, EstadoOS de 5) y el badge
-- del historial mezclaba "completado"/"completada" según si había
-- documento. EstadoOS pasa a ser el único vocabulario visible; el
-- backend sincroniza ordenes_servicio.estado_os desde cada write de
-- trabajos.estado, así que la UI solo mira estado_os.
--
-- EstadoOS suma "cancelada" (antes solo vivía en EstadoTrabajo).

alter table ordenes_servicio drop constraint if exists ordenes_servicio_estado_os_check;
alter table ordenes_servicio add constraint ordenes_servicio_estado_os_check
  check (estado_os in ('pendiente', 'enviada', 'en_proceso', 'completada', 'firmada', 'cancelada'));

-- Trabajos ya cancelados: alinear su orden (0 filas hoy en dev y prod,
-- se corre igual por si alguno quedó suelto).
update ordenes_servicio o
   set estado_os = 'cancelada'
  from trabajos t
 where t.id = o.trabajo_id
   and t.estado = 'cancelado'
   and o.estado_os <> 'cancelada';
