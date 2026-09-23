-- ============================================================
-- BITÁCORA — super_admins.tema: estilo visual propio del Super-Admin.
--
-- Pedido explícito (23-sep-2026): "en el super admin también quiero
-- que elija su propio estilo". Mismos 3 valores que empresas.tema
-- (migraciones 109/110) — pero es una preferencia PERSONAL del
-- Super-Admin para ver su panel (web y mobile), independiente del tema
-- de cualquier empresa. Se guarda en la cuenta (no en el dispositivo)
-- para que sea el mismo en web y en el celular.
--
-- super_admins no tiene RLS a propósito (ver 37_superadmin.sql: solo
-- la toca el service role); agregar una columna no cambia eso.
-- Idempotente.
-- ============================================================

alter table super_admins
  add column if not exists tema text not null default 'faena'
    check (tema in ('faena', 'taller', 'confianza'));
