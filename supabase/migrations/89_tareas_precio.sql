-- Detectado al construir Nueva reserva (Punto 4): el formulario pide un
-- campo "Precio" editable (precarga desde servicios.precio, pero se
-- puede ajustar por descuentos puntuales) — no estaba en la migración
-- 88 porque no se había pedido explícitamente hasta ver el mockup del
-- formulario. Nullable: no todas las citas necesitan un precio propio
-- (se puede seguir usando el de lista del servicio).
alter table tareas add column precio numeric;
