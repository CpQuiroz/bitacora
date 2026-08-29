-- Tareas de Agenda: eventos livianos que no requieren una Orden de
-- Servicio (recordatorios, visitas técnicas sin cotización asociada).
-- La Agenda combina esta tabla con `trabajos` en la misma vista de
-- calendario — no reemplaza ni toca el flujo de OS Digitales.
create table tareas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  titulo text not null,
  descripcion text,
  fecha date not null,
  hora text,
  responsable_id uuid references usuarios(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  prioridad text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'completada', 'cancelada')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table tareas enable row level security;
create policy "acceso por empresa" on tareas
  for all using (empresa_id = empresa_actual());
create index on tareas (empresa_id, fecha);
create index on tareas (empresa_id, responsable_id);
