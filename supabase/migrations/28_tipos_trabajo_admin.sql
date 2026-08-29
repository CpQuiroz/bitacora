-- BITÁCORA — Pantalla de administración de Tipos de Trabajo
-- (Configuración → Tipos de Trabajo). Se agrega "activo" para poder
-- desactivar un tipo sin romper el historial de trabajos que ya lo
-- usan (mismo patrón que tipos_os).
alter table tipos_trabajo add column activo boolean not null default true;
