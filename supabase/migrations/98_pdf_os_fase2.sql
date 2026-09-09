-- BITÁCORA — Fase 2 del PDF de OS (ver docs/pdf-os-fase2.md).
-- Aditiva y reversible. Sin backfill: las OS viejas quedan con las
-- columnas en null y el PDF las omite.

-- 1. Categoría de cada foto de la OS — para agrupar la galería del PDF.
--    Texto libre acotado por la UI (equipo / antes / durante / despues);
--    null = foto general.
alter table analisis_fotos add column categoria text;

-- 2. Firma del técnico, además de la del cliente. Bloques separados en el
--    PDF, cada uno con nombre + documento.
alter table ordenes_servicio
  add column firma_tecnico_url text,
  add column tecnico_firmante_nombre text,
  add column tecnico_firmante_documento text;
