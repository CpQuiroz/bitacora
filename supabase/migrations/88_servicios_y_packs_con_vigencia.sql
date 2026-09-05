-- Punto 5 del rediseño Agenda Pro — piezas del modelo que no existían:
-- catálogo de servicios, notas separadas cliente/interna, aviso de
-- WhatsApp por cita, y packs con servicio atado + vigencia. Ver
-- discusión en el chat (confirmado antes de migrar).

-- Catálogo de servicios (nombre, precio, duración sugerida) — se
-- administra en la web, mismo patrón que tipos_pack: gateado por
-- agenda_pro, RLS por empresa.
create table servicios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  precio numeric not null default 0,
  duracion_sugerida_min integer not null check (duracion_sugerida_min > 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table servicios enable row level security;
create policy "acceso por empresa" on servicios
  for all using (empresa_id = empresa_actual());
create index on servicios (empresa_id);

-- Tarea (cita): servicio elegido, nota separada para el cliente (la
-- columna "descripcion" existente sigue siendo la nota interna — no se
-- renombra para no romper nada que ya la use), y si esta cita concreta
-- avisa por WhatsApp.
alter table tareas add column servicio_id uuid references servicios(id) on delete set null;
alter table tareas add column nota_cliente text;
alter table tareas add column avisar_whatsapp boolean not null default true;

-- tipos_pack: a qué servicio está atado el pack (para poder ofrecerlo
-- solo/automáticamente al elegir ESE servicio en Nueva reserva) y su
-- vigencia por defecto en meses.
alter table tipos_pack add column servicio_id uuid references servicios(id) on delete set null;
alter table tipos_pack add column vigencia_meses integer not null default 6 check (vigencia_meses > 0);

-- paquetes_sesiones: servicio y vencimiento COPIADOS al vender (mismo
-- criterio que nombre/cantidad_total con tipo_pack_id) — si el tipo de
-- pack cambia después, el paquete ya vendido no se desincroniza.
alter table paquetes_sesiones add column servicio_id uuid references servicios(id) on delete set null;
alter table paquetes_sesiones add column vence_el date;
