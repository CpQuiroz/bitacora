-- BITÁCORA — Fase 4 (23-sep-2026, pedido explícito): el Admin puede
-- agregar más materiales a un levantamiento ya realizado por el
-- técnico. Auditoría (quién, cuándo — "cuándo" ya lo daba
-- `creado_en`, que no se toca) + distinción visual de qué fila agregó
-- el Admin en vez del técnico.
alter table levantamiento_materiales add column agregado_por uuid references usuarios(id) on delete set null;
alter table levantamiento_materiales add column agregado_por_admin boolean not null default false;
