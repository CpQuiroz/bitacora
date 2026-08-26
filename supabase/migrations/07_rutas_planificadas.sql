-- ============================================================
-- BITÁCORA — Planificación de rutas / enrutamiento de tareas
-- Se ejecuta después de 06_logo_empresa.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. RUTAS PLANIFICADAS — metadata de una jornada de ruta para
--    un colaborador (punto base, horario, almuerzo)
-- ------------------------------------------------------------
create table rutas_planificadas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  responsable_id uuid not null references usuarios(id),
  nombre text,
  punto_base_direccion text not null,
  punto_base_lat numeric(9,6),
  punto_base_lng numeric(9,6),
  fecha_inicio date not null,
  dias_semana text[] not null default '{}',
  hora_inicio time not null,
  hora_fin time not null,
  almuerzo_inicio time,
  almuerzo_fin time,
  estado text not null default 'borrador', -- borrador, finalizada
  distancia_total_km numeric(8,2),
  duracion_total_min int,
  creado_en timestamptz default now()
);

alter table rutas_planificadas enable row level security;
create policy "acceso por empresa" on rutas_planificadas
  for all using (empresa_id = empresa_actual());

create index idx_rutas_planificadas_empresa on rutas_planificadas(empresa_id, fecha_inicio desc);

-- ------------------------------------------------------------
-- 2. TRABAJOS (= "tareas") — se extiende con todo lo que pide
--    el formulario de tarea: descripción, prioridad, etiquetas,
--    duración estimada, tipo de check-in, anexos, encuesta de
--    satisfacción, y el vínculo a la ruta con su orden/horario
--    calculado al optimizar.
-- ------------------------------------------------------------
alter table trabajos add column descripcion text;
alter table trabajos add column ruta_id uuid references rutas_planificadas(id) on delete set null;
alter table trabajos add column orden_en_ruta int;
alter table trabajos add column hora_estimada_llegada text; -- "HH:MM"
alter table trabajos add column duracion_estimada_min int;
alter table trabajos add column prioridad text not null default 'media'
  check (prioridad in ('alta', 'media', 'baja'));
alter table trabajos add column etiquetas text[] not null default '{}';
alter table trabajos add column tipo_checkin text not null default 'manual'
  check (tipo_checkin in ('manual', 'ubicacion'));
alter table trabajos add column anexos jsonb not null default '[]';
alter table trabajos add column encuesta_email text;
alter table trabajos add column encuesta_enviada_en timestamptz;
alter table trabajos add column calificacion_satisfaccion int
  check (calificacion_satisfaccion between 1 and 5);
alter table trabajos add column encuesta_respondida_en timestamptz;

create index idx_trabajos_ruta on trabajos(ruta_id, orden_en_ruta);
