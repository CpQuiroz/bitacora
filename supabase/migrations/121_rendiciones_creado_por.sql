-- ============================================================
-- Rendiciones — creado_por (pedido 22-sep-2026): distinguir quién
-- REGISTRÓ la rendición (siempre req.userId al crear) de a quién
-- pertenece (colaborador_id) — hoy son iguales cuando el colaborador
-- se auto-registra desde el celular, pero divergen cuando gestión
-- carga una rendición en nombre de otro. Backfill = colaborador_id
-- (todas las filas existentes fueron auto-registradas).
-- ============================================================

alter table rendiciones add column creado_por uuid references usuarios(id) on delete restrict;

update rendiciones set creado_por = colaborador_id where creado_por is null;

alter table rendiciones alter column creado_por set not null;
