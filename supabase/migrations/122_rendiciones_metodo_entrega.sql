-- ============================================================
-- Rendiciones — método de entrega (pedido 22-sep-2026): el jefe le
-- entrega el fondo semanal/diario al colaborador en efectivo o por
-- transferencia — dato informativo elegido por quien crea la
-- rendición, sin exigir comprobante (a diferencia del comprobante que
-- SÍ se exige en cada gasto — ver POST /:id/enviar).
-- Backfill = 'efectivo' para las filas existentes.
-- ============================================================

alter table rendiciones add column metodo_entrega text;

update rendiciones set metodo_entrega = 'efectivo' where metodo_entrega is null;

alter table rendiciones alter column metodo_entrega set not null;
alter table rendiciones alter column metodo_entrega set default 'efectivo';
alter table rendiciones add constraint rendiciones_metodo_entrega_check check (metodo_entrega in ('efectivo', 'transferencia'));
