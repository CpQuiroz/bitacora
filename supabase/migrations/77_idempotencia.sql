-- ============================================================
-- BITÁCORA — Idempotencia para operaciones que crean plata
-- (AUDITORIA_RESILIENCIA.md R3). El cliente manda un header
-- `Idempotency-Key` (UUID que genera una vez por acción); si la misma
-- clave llega dos veces —doble-click, reintento tras timeout, reinicio
-- de Render a mitad de camino— la segunda devuelve la MISMA respuesta
-- que la primera en vez de crear un cobro nuevo.
--
-- La fila se inserta ANTES de procesar (status_code null = "en curso").
-- Al terminar: si 2xx/4xx se guarda la respuesta; si 5xx se borra la
-- fila para que un reintento legítimo pueda volver a intentar.
--
-- Solo la toca el backend (service role). Mismo criterio que las tablas
-- de la migración 73.
-- ============================================================
create table idempotencia (
  clave        text primary key,            -- '<empresa_id>:<Idempotency-Key>'
  empresa_id   uuid,
  metodo       text not null,
  ruta         text not null,
  status_code  int,                          -- null mientras la request está en curso
  respuesta    jsonb,
  creado_en    timestamptz not null default now()
);

create index idempotencia_creado_en_idx on idempotencia (creado_en);

alter table idempotencia enable row level security;
revoke all on idempotencia from anon, authenticated;
