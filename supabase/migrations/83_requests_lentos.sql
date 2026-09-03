-- ============================================================
-- BITÁCORA — Instrumentación de latencia (AUDITORIA_PERFORMANCE_COSTOS.md §8)
--
-- No se loguea CADA request (sería un write por request). Solo las que
-- superan un umbral (por defecto 2s) — para tener datos reales de qué
-- endpoint se pone lento y con qué empresa, sin costo en el caso feliz.
-- Retención corta: la limpieza perezosa borra lo de >14 días.
-- ============================================================
create table requests_lentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid,
  ruta text not null,
  metodo text not null,
  ms integer not null,
  status_code integer,
  filas_devueltas integer,   -- si la respuesta era un array (listados sin paginar)
  creado_en timestamptz not null default now()
);
create index on requests_lentos (creado_en desc);
create index on requests_lentos (ruta, creado_en desc);

alter table requests_lentos enable row level security;
revoke all on requests_lentos from anon, authenticated;
