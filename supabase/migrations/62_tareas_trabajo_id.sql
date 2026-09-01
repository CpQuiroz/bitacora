-- ============================================================
-- Vincula una tarea de Agenda con la Orden de Servicio que se creó desde
-- el flujo "Nueva tarea → Crear Orden de Servicio" (ver módulo Agenda,
-- web/src/app/dashboard/agenda/page.tsx).
--
-- FK a `trabajos` y NO a `ordenes_servicio`: `trabajos` es la entidad
-- que agenda el trabajo (tiene fecha / responsable_id / cliente_id —
-- misma forma que una tarea), mientras que `ordenes_servicio` es su
-- detalle de ejecución 1:1 (checklist, fotos, firma, folio), creado
-- aparte. El endpoint POST /api/trabajos devuelve el id del trabajo.
--
-- Nullable: la enorme mayoría de las tareas no tiene OS asociada.
-- on delete set null: borrar la OS desvincula la tarea, no la borra.
-- ============================================================

alter table tareas add column trabajo_id uuid references trabajos(id) on delete set null;
create index on tareas (empresa_id, trabajo_id) where trabajo_id is not null;
