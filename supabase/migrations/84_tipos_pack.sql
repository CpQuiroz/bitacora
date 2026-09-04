-- Catálogo reutilizable de "tipos de pack" (Agenda Pro) — hasta ahora
-- cada paquete de sesiones se creaba tipeando nombre y cantidad a mano
-- (ver 40_paquetes_sesiones.sql). Esto define plantillas que la empresa
-- administra una vez (ej. "Pack 5 sesiones" / $45.000) y reutiliza al
-- vender un paquete a un cliente puntual.
create table tipos_pack (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  cantidad_sesiones integer not null check (cantidad_sesiones > 0),
  precio numeric,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table tipos_pack enable row level security;
create policy "acceso por empresa" on tipos_pack
  for all using (empresa_id = empresa_actual());
create index on tipos_pack (empresa_id);

-- Trazabilidad: de qué tipo de pack salió un paquete vendido. Nullable —
-- los paquetes ad-hoc (sin tipo del catálogo) siguen funcionando igual.
alter table paquetes_sesiones add column tipo_pack_id uuid references tipos_pack(id) on delete set null;
