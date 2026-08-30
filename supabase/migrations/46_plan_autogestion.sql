-- Autogestión de plan (Trial/Básico/Pro) desde Configuración > Plan.
-- Historial de cambios de plan, visible tanto para la empresa como para
-- Super-Admin (a diferencia de super_admin_auditoria, que es interna).
create table empresa_plan_historial (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  plan_anterior text not null check (plan_anterior in ('trial','basico','pro')),
  plan_nuevo text not null check (plan_nuevo in ('trial','basico','pro')),
  origen text not null check (origen in ('empresa','super_admin')),
  usuario_id uuid references usuarios(id) on delete set null,
  super_admin_id uuid references super_admins(id) on delete set null,
  cobro_conectado boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table empresa_plan_historial enable row level security;
create policy "acceso por empresa" on empresa_plan_historial
  for all using (empresa_id = empresa_actual());
create index on empresa_plan_historial (empresa_id, creado_en desc);

-- Plan al que está apuntando un registro de tarjeta en curso — para que
-- el lazy-check de suscripcion.ts sepa a qué Plan de Flow suscribir una
-- vez la tarjeta quede confirmada (antes usaba un único FLOW_PLAN_ID fijo,
-- sin relación con el tier elegido).
alter table suscripciones add column plan_pendiente text check (plan_pendiente in ('basico','pro'));
