-- Selector de Catálogo unificado (Fase A) — os_items gana la misma
-- trazabilidad que presupuesto_items ya tiene. No se toca el modelo de
-- catalogo_items/inventario.
alter table os_items add column catalogo_item_id uuid references catalogo_items(id) on delete set null;
