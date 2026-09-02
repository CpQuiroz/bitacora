-- BITÁCORA — Módulo Remuneraciones (Bloque 3): datos para el archivo
-- de carga Previred y el Libro de Remuneraciones Electrónico (DT).
--
-- El archivo Previred identifica al trabajador por RUT y necesita el
-- código de la institución de salud (Fonasa = 07, cada Isapre tiene el
-- suyo). Nada de esto hace falta para el cálculo de la liquidación, por
-- eso se agrega recién ahora.
alter table usuarios add column rut text;

alter table datos_laborales
  add column codigo_isapre text,          -- código Previred de la Isapre (null si Fonasa)
  add column apellido_paterno text,
  add column apellido_materno text;
