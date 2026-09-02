-- BITÁCORA — Check-in / check-out geolocalizado (app móvil).
--
-- Hasta ahora POST /api/trabajos/:id/checklist solo marcaba el item en
-- el jsonb `checklist` con su hora (calculada en el servidor). El
-- módulo Flota ya tenía trabajos.tipo_checkin ('manual' | 'ubicacion')
-- pero nadie lo leía. Con la app móvil reconstruida, el técnico/chofer
-- marca check-in y check-out con las coordenadas del dispositivo — se
-- guardan en columnas propias (no dentro del jsonb) para poder
-- consultarlas después: ej. "check-ins a más de 500 m de la dirección
-- del cliente", cumplimiento de recorrido, etc.
--
-- El item en `checklist` se sigue escribiendo igual (compatibilidad con
-- el web y los informes que lo leen).
alter table ordenes_servicio
  add column check_in_at         timestamptz,
  add column check_in_lat        numeric(9, 6),
  add column check_in_lng        numeric(9, 6),
  add column check_in_precision  numeric(7, 1),
  add column check_out_at        timestamptz,
  add column check_out_lat       numeric(9, 6),
  add column check_out_lng       numeric(9, 6),
  add column check_out_precision numeric(7, 1);

comment on column ordenes_servicio.check_in_precision is
  'Exactitud del GPS en metros al momento del check-in (accuracy de expo-location). Null = check-in manual sin ubicación.';
