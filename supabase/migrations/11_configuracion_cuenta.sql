-- ============================================================
-- BITÁCORA — Submódulo Configuración → Cuenta: preferencias
-- personales del usuario (no de la empresa).
-- Se ejecuta después de 10_personalizacion.sql
-- ============================================================
alter table usuarios add column telefono text;
alter table usuarios add column idioma text not null default 'es';
alter table usuarios add column pais text not null default 'CL';
alter table usuarios add column huso_horario text not null default 'America/Santiago';
alter table usuarios add column foto_url text;
