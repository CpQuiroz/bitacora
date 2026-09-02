-- BITÁCORA — Viajes registrados desde la app móvil.
--
-- viajes.origen_captura hasta ahora era 'manual' (formulario web) o
-- 'whatsapp' (bot de choferes). La app móvil agrega un tercer origen:
-- el chofer registra el viaje desde su teléfono (POST /api/mis-viajes),
-- también en estado 'borrador' para que la oficina lo revise.
alter table viajes drop constraint if exists viajes_origen_captura_check;
alter table viajes add constraint viajes_origen_captura_check
  check (origen_captura in ('manual', 'whatsapp', 'app'));
