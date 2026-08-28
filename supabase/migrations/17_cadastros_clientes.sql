-- ============================================================
-- BITÁCORA — Cadastros → Clientes: correo y estado activo/inactivo
-- (nombre, dirección, teléfono, lat/lng ya existían desde 05_rutas.sql).
-- Se ejecuta después de 16_configuracion_resto.sql
-- ============================================================
alter table clientes add column correo text;
alter table clientes add column activo boolean not null default true;
