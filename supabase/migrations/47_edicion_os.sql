-- Edición de OS desde el panel: campo no-contractual, siempre editable
-- (incluso con firma de conformidad ya registrada) — a diferencia de
-- ítems/monto/descripción, que se bloquean apenas hay firma.
alter table trabajos add column notas_internas text;
