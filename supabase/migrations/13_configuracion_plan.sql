-- ============================================================
-- BITÁCORA — Submódulo Configuración → Plan: fecha de término
-- del período de prueba (14 días desde la creación de la empresa).
-- Se ejecuta después de 12_configuracion_empresa.sql
-- ============================================================
alter table empresas add column prueba_termina_en date;

update empresas
set prueba_termina_en = (creado_en::date + interval '14 days')::date
where prueba_termina_en is null;
