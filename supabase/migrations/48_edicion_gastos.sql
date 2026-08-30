-- Edición de gastos existentes. Registro simple de auditoría (quién y
-- cuándo) solo para gastos que ya estaban en estado "pagado" al momento
-- de editarlos — no hay ninguna restricción de integridad que impida
-- editar un gasto en general (a diferencia de una OS firmada), pero
-- tocar un gasto ya pagado sí conviene dejarlo trazado.
alter table gastos add column editado_por uuid references usuarios(id) on delete set null;
alter table gastos add column editado_en timestamptz;
