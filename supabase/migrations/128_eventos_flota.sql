-- ============================================================
-- BITÁCORA — Eventos semanales de flota (23-sep-2026, pedido explícito):
-- "un checklist semanal donde se puedan registrar eventos ocurridos en
-- la semana sobre un vehículo — por ejemplo, cambio de una luz o un
-- neumático pinchado. Múltiples eventos por semana, con fecha y tipo".
--
-- Tabla nueva (no reutiliza checklist_templates: un checklist son
-- preguntas fijas sí/no respondidas de una vez; esto son hechos sueltos,
-- N por semana, cada uno con su propia fecha). La "semana" no se guarda:
-- sale de filtrar por fecha (lunes–domingo), igual que el resumen
-- semanal de viajes — no hay nada que "cerrar".
--
-- Vehículo = equipos.id (categoría 'Vehículo', migración 52 — la tabla
-- vieja `vehiculos` quedó huérfana, no se referencia).
--
-- tipo: lista FIJA en código (packages/shared TIPOS_EVENTO_FLOTA, decisión
-- de la usuaria) — el CHECK la replica.
-- ============================================================

create table if not exists eventos_flota (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  equipo_id uuid not null references equipos(id) on delete cascade,
  tipo text not null check (tipo in ('luz', 'neumatico', 'frenos', 'aceite_fluidos', 'bateria', 'golpe_dano', 'limpieza', 'otro')),
  fecha date not null default current_date,
  descripcion text,
  kilometraje numeric(10, 1),
  reportado_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now()
);

alter table eventos_flota enable row level security;
drop policy if exists "acceso por empresa" on eventos_flota;
create policy "acceso por empresa" on eventos_flota
  for all using (empresa_id = empresa_actual());

create index if not exists eventos_flota_equipo_fecha_idx on eventos_flota (empresa_id, equipo_id, fecha desc);
