-- Duración estimada de una cita/tarea, en minutos (Fase 5 del selector de
-- hora en Agenda). Nullable a propósito — no forzamos un valor en las
-- citas existentes ni en las que se sigan creando sin especificarlo. No
-- se guarda hora_fin: se deriva siempre de hora + duracion_min (mismo
-- criterio que el saldo de paquetes_sesiones).
alter table tareas add column duracion_min integer check (duracion_min is null or duracion_min > 0);
