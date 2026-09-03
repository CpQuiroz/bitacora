-- ============================================================
-- BITÁCORA — Ley 21.719: fecha de baja de la empresa (retención #6)
--
-- Cuando una empresa pasa a 'dada_de_baja' se registra la fecha. El
-- Panel de Super-Admin la muestra para poder decidir cuándo eliminar
-- definitivamente sus datos (no hay borrado automático — es una acción
-- consciente, ver docs/AUDITORIA_LEY21719.md hallazgo #6).
-- ============================================================
alter table empresas add column if not exists dada_de_baja_en timestamptz;
