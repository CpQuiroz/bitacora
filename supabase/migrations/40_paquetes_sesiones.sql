-- Paquetes de sesiones (Agenda Pro) — algunos clientes compran packs
-- de N sesiones (ej. 5 o 10) en vez de pagar cita por cita. El saldo
-- restante se calcula siempre a partir de las tareas asociadas, nunca
-- se guarda como contador aparte (mismo criterio que "estado de
-- documento" en Flota) — evita que se desincronice.
create table paquetes_sesiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete cascade,
  nombre text not null,
  cantidad_total integer not null check (cantidad_total > 0),
  fecha_compra date not null default current_date,
  notas text,
  creado_en timestamptz not null default now()
);
alter table paquetes_sesiones enable row level security;
create policy "acceso por empresa" on paquetes_sesiones
  for all using (empresa_id = empresa_actual());
create index on paquetes_sesiones (empresa_id, cliente_id);

alter table tareas add column paquete_id uuid references paquetes_sesiones(id) on delete set null;
alter table tareas add column sesiones_consumidas integer not null default 1 check (sesiones_consumidas > 0);
create index on tareas (paquete_id);
