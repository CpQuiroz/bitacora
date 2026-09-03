-- ============================================================
-- BITÁCORA — Ley 21.719: oposición del cliente + minimización
-- ============================================================

-- 1. Oposición al contacto por parte del cliente final. El link "no
--    recibir más avisos" en los correos lo pone en true; notificarCliente
--    lo respeta (sigue permitiendo lo transaccional crítico según decida
--    la empresa, pero no los avisos).
alter table clientes add column if not exists notificaciones_opt_out boolean not null default false;

-- 2. Minimización: la tabla `vehiculos` quedó huérfana tras la fusión con
--    `equipos` (migración 52). Ningún código ni FK la referencia ya
--    (`vehiculo_asignaciones` y `viajes` se repuntaron a `equipos` en la
--    52). Se elimina — no tiene sentido conservar datos de patentes /
--    asignaciones previas que nada usa.
drop table if exists vehiculos cascade;
