-- Ventana de cancelación sin costo para citas asociadas a un paquete
-- de sesiones (Agenda Pro) — vive en la misma tabla que el resto de
-- reglas de agenda (anticipacion_min_horas, dias_max_adelante) para no
-- fragmentar la configuración de Agenda Pro en dos lugares.
alter table agenda_pro_config add column ventana_cancelacion_horas int not null default 24 check (ventana_cancelacion_horas >= 0);

-- Dos estados nuevos, solo relevantes para citas con paquete_id: antes
-- toda cancelación caía en el mismo "cancelada" genérico sin distinguir
-- si se avisó a tiempo o no. Ahora "no_asistio" (inasistencia o aviso
-- tardío, descuenta la sesión) y "cancelada_anticipada" (aviso con
-- tiempo suficiente, no descuenta) separan ambos casos. Las citas sin
-- paquete siguen usando "cancelada" tal cual.
alter table tareas drop constraint tareas_estado_check;
alter table tareas add constraint tareas_estado_check
  check (estado in ('pendiente', 'confirmada', 'completada', 'cancelada', 'no_asistio', 'cancelada_anticipada'));
