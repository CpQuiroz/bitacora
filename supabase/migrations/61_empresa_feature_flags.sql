-- ============================================================
-- Feature flags por empresa — rollout gradual de funcionalidad en beta.
--
-- DISTINTO de empresa_modulos: aquel dice qué está *contratado* (según
-- el plan); esto dice qué está *en prueba* para 1-2 empresas puntuales
-- ANTES de ofrecerlo a todos. Se mantiene separado a propósito aunque
-- se parezcan en forma.
--
-- Sin catálogo fijo de flags posibles por ahora: el Super-Admin escribe
-- el nombre del flag como texto libre al activarlo. Si más adelante hace
-- falta un catálogo cerrado, se agrega.
--
-- Sin RLS: solo el backend (service role) la toca, igual que
-- empresa_modulos. El backend expone los flags activos de la empresa
-- del usuario logueado vía GET /api/me (`feature_flags: string[]`).
-- ============================================================

create table empresa_feature_flags (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  flag text not null,
  activado boolean not null default true,
  activado_en timestamptz not null default now(),
  activado_por uuid references super_admins(id) on delete set null,
  unique (empresa_id, flag)
);
create index on empresa_feature_flags (empresa_id) where activado;
