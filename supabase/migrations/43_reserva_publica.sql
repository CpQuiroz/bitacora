-- Agenda Pro: reserva online pública. Horario único por empresa (no
-- por responsable individual) — decisión explícita para v1, simple de
-- construir y de mantener; el responsable se asigna después, como ya
-- pasa hoy con las tareas creadas a mano.
create table agenda_pro_config (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  duracion_slot_min int not null default 30 check (duracion_slot_min > 0),
  anticipacion_min_horas int not null default 2 check (anticipacion_min_horas >= 0),
  dias_max_adelante int not null default 30 check (dias_max_adelante > 0),
  actualizado_en timestamptz not null default now()
);
alter table agenda_pro_config enable row level security;
create policy "acceso por empresa" on agenda_pro_config
  for all using (empresa_id = empresa_actual());

-- Un rango continuo por día de semana (0=domingo .. 6=sábado); un día
-- sin fila = cerrado ese día. Sin turnos partidos en v1.
create table agenda_pro_horarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  hora_inicio time not null,
  hora_fin time not null check (hora_fin > hora_inicio),
  unique (empresa_id, dia_semana)
);
alter table agenda_pro_horarios enable row level security;
create policy "acceso por empresa" on agenda_pro_horarios
  for all using (empresa_id = empresa_actual());

-- Trazabilidad de cómo se creó la tarea — mismo criterio que
-- viajes.origen_captura.
alter table tareas add column origen text not null default 'manual' check (origen in ('manual', 'reserva_publica'));
