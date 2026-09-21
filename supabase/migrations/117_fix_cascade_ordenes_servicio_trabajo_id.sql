-- ============================================================
-- BITÁCORA — Fix: borrar una OS/trabajo daba 500 (llave foránea sin
-- cascade en ordenes_servicio).
--
-- Encontrado probando en vivo (21-sep-2026): DELETE /api/trabajos/:id
-- fallaba con "update or delete on table trabajos violates foreign key
-- constraint ordenes_servicio_trabajo_id_fkey" para CUALQUIER trabajo
-- con una OS asociada (o sea, prácticamente todos) — un bug latente
-- desde la migración 04 (20-ago-2026), que renombró
-- ordenes_servicio.viaje_id -> trabajo_id y recreó la constraint SIN
-- ON DELETE CASCADE (la original viaje_id_fkey si lo tenía). Nunca se
-- disparó antes porque no existe ningún botón "Eliminar OS" en la web
-- — recién apareció al usar el endpoint directo.
--
-- Verificado read-only contra prod que esta es la ÚNICA FK de
-- trabajos sin regla de borrado (gastos/presupuestos/tareas ya tienen
-- ON DELETE SET NULL; os_items ya tiene CASCADE) — y que lo que
-- ordenes_servicio referencia a su vez (analisis_fotos, levantamientos)
-- ya cascada/desvincula bien, así que este es el único eslabón roto.
-- ============================================================

alter table ordenes_servicio drop constraint ordenes_servicio_trabajo_id_fkey;
alter table ordenes_servicio add constraint ordenes_servicio_trabajo_id_fkey
  foreign key (trabajo_id) references trabajos(id) on delete cascade;
