-- ============================================================
-- Rutas asociables a viajes (tarea 130, 24-sep-2026). Ruteo pasa a ser
-- una subsección de Viajes; hasta ahora rutas_planificadas solo agrupaba
-- trabajos (trabajos.ruta_id). Esta tabla deja el modelo listo para que
-- una ruta se asocie a uno o más viajes (y un viaje a una ruta), para
-- reutilizar rutas y, a futuro, calcular precio por tramos o por km
-- (tarea 135, solo propuesta). Todavía sin UI: solo el modelo.
--
-- Aditiva e idempotente.
-- ============================================================

create table if not exists ruta_viajes (
  empresa_id uuid not null references empresas(id) on delete cascade,
  ruta_id uuid not null references rutas_planificadas(id) on delete cascade,
  viaje_id uuid not null references viajes(id) on delete cascade,
  -- Posición del viaje dentro de la ruta (null = sin orden definido).
  orden integer,
  creado_en timestamptz not null default now(),
  primary key (ruta_id, viaje_id)
);

create index if not exists ruta_viajes_empresa_idx on ruta_viajes (empresa_id);
create index if not exists ruta_viajes_viaje_idx on ruta_viajes (viaje_id);

alter table ruta_viajes enable row level security;
drop policy if exists "acceso por empresa" on ruta_viajes;
create policy "acceso por empresa" on ruta_viajes
  for all using (empresa_id = empresa_actual());

-- Solo el backend (service_role) la usa — mismo criterio que la migración 130.
revoke all on ruta_viajes from anon, authenticated;
