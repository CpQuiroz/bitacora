-- ============================================================
-- BITÁCORA — Ley 21.719: registro de consentimiento
--
-- La ley exige poder *demostrar* la aceptación de la Política de
-- Privacidad / Términos, no tenerla implícita. Una fila por
-- (persona, documento, versión) — insert-only por disciplina de código
-- (solo el backend con service role escribe; RLS niega todo al cliente).
--
-- Exactamente uno de usuario_id / cliente_id según el titular.
-- ============================================================
create table consentimientos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  empresa_id uuid references empresas(id) on delete set null,
  documento text not null check (documento in ('privacidad', 'terminos')),
  version text not null,
  aceptado_en timestamptz not null default now(),
  ip text,
  user_agent text,
  creado_en timestamptz not null default now()
);

create index on consentimientos (usuario_id) where usuario_id is not null;
create index on consentimientos (cliente_id) where cliente_id is not null;
create index on consentimientos (empresa_id);

alter table consentimientos enable row level security;
revoke all on consentimientos from anon, authenticated;
