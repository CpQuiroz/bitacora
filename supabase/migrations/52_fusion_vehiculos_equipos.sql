-- Vehículos deja de ser una tabla/módulo separado — pasa a ser una
-- categoría dentro de equipos, con sus campos específicos (patente,
-- tipo_vehiculo, capacidad_carga, año) opcionales, visibles solo
-- cuando categoria = 'Vehículo'.
--
-- equipos.cliente_id pasa a ser opcional: null significa "activo
-- propio de la empresa" (ej. la flota propia de vehículos); no-null
-- sigue significando "activo del cliente", comportamiento de siempre.
alter table equipos alter column cliente_id drop not null;

alter table equipos add column patente text;
alter table equipos add column anio integer;
alter table equipos add column tipo_vehiculo text;
alter table equipos add column capacidad_carga text;

-- Unicidad de patente por empresa, solo entre los equipos que
-- efectivamente tienen patente (los que no son vehículo la dejan null,
-- sin restricción — varios null conviven sin problema en un índice
-- parcial).
create unique index equipos_empresa_patente_idx on equipos (empresa_id, patente) where patente is not null;

-- Migra los datos de vehiculos -> equipos preservando el MISMO id: así
-- documentos.entidad_id, vehiculo_asignaciones y viajes (repunteados
-- abajo) siguen resolviendo al registro correcto sin tener que
-- reescribir esas tablas fila por fila. equipos.nombre es NOT NULL y
-- vehiculos no tenía un campo "nombre" propio — se usa la patente.
insert into equipos (id, empresa_id, cliente_id, nombre, marca, modelo, numero_serie, categoria, notas, activo, creado_en, patente, anio, tipo_vehiculo, capacidad_carga)
select id, empresa_id, null, patente, marca, modelo, null, 'Vehículo', null, activo, creado_en, patente, anio, tipo, capacidad_carga
from vehiculos;

-- Repuntar vehiculo_asignaciones y viajes a equipos — se renombra la
-- columna a equipo_id (ya no referencia vehiculos) y se recrea el FK.
alter table vehiculo_asignaciones rename column vehiculo_id to equipo_id;
alter table vehiculo_asignaciones drop constraint vehiculo_asignaciones_vehiculo_id_fkey;
alter table vehiculo_asignaciones add constraint vehiculo_asignaciones_equipo_id_fkey
  foreign key (equipo_id) references equipos(id) on delete cascade;

alter table viajes rename column vehiculo_id to equipo_id;
alter table viajes drop constraint viajes_vehiculo_id_fkey;
alter table viajes add constraint viajes_equipo_id_fkey
  foreign key (equipo_id) references equipos(id) on delete set null;

-- documentos.entidad_tipo sigue usando el valor 'vehiculo' tal cual —
-- es una etiqueta semántica ("este documento es de un vehículo"), no
-- un nombre de tabla; sigue siendo correcta ahora que el vehículo vive
-- en equipos con esa categoría. No requiere cambio.

-- La tabla vehiculos (y su índice/constraint propios) queda existente
-- pero sin uso activo — nada la referencia ya — por si hace falta
-- rollback. Se puede eliminar en una migración posterior una vez
-- confirmado que todo funciona en producción.
