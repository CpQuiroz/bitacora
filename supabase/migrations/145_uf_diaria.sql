-- ============================================================
-- Valor diario de la UF (tarea 151, 26-sep-2026).
--
-- "Mi plan" (mobile) muestra el precio del plan en UF y su equivalente en
-- CLP al valor del día. El backend consulta mindicador.cl una sola vez por
-- día y guarda el valor acá (también en memoria); si mindicador no
-- responde, se usa el último valor guardado.
--
-- Dato público, no de una empresa: sin empresa_id. Solo lo lee y escribe
-- el backend (service_role): RLS activa sin políticas y sin permisos
-- directos para anon/authenticated. Aditiva e idempotente.
-- ============================================================

create table if not exists uf_diaria (
  fecha date primary key,
  valor numeric(12, 2) not null check (valor > 0),
  fuente text not null default 'mindicador',
  obtenido_en timestamptz not null default now()
);

alter table uf_diaria enable row level security;
revoke all on uf_diaria from anon, authenticated;
