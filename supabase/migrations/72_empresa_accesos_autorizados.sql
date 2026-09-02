-- ============================================================
-- Correos y dominios autorizados por empresa.
--
-- Hasta ahora un correo quedaba ligado a una empresa SOLO al invitarlo
-- (se creaba la fila en `usuarios` en el acto). Un correo que entraba
-- por Google o autorregistro sin invitación caía en /onboarding y
-- creaba una empresa nueva.
--
-- Con esta tabla, un admin (o el Super-Admin) puede preautorizar:
--   - un correo exacto:  tipo='correo',  valor='pedro@transportes.cl'
--   - un dominio entero:  tipo='dominio', valor='transportes.cl'
-- Al entrar por primera vez sin fila en `usuarios`, el backend resuelve
-- el correo contra esta tabla (ver backend/src/accesos.ts):
--   - 1 empresa  -> se crea la fila en `usuarios` con el rol indicado
--   - >1 empresa -> se niega el acceso (una persona = una empresa)
--   - 0          -> /onboarding solo si el user se autorregistró
--                   (user_metadata.self_signup), si no, acceso denegado.
--
-- `rol` es texto libre: el slug de una fila de `roles` (migración 71).
-- Sin RLS: la toca solo el backend (service role), igual criterio que
-- empresa_modulos / empresa_feature_flags.
-- ============================================================

create table empresa_accesos_autorizados (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresas(id) on delete cascade,
  tipo        text not null check (tipo in ('correo', 'dominio')),
  valor       text not null,               -- correo o dominio, siempre en minúsculas
  rol         text not null default 'colaborador',
  creado_por  uuid,                         -- auth user id o super_admin id (informativo)
  creado_en   timestamptz not null default now(),
  unique (empresa_id, tipo, valor)
);

create index on empresa_accesos_autorizados (valor);
