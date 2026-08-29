-- BITÁCORA — Módulo Viajes (transporte). Reemplaza el Excel de guías
-- de despacho: cada viaje referencia el número de guía que la empresa
-- ya emitió por su vía habitual (NO emite el DTE — eso requiere
-- certificación aparte ante el SII), y agrupa varios viajes en una
-- factura reutilizando la tabla "facturas" que ya existe.
--
-- Ya existía una tabla "viajes" de una iteración muy anterior del
-- proyecto (antes de la generalización a "trabajos", ver el comentario
-- en packages/shared/src/types.ts) — quedó huérfana, sin filas y sin
-- ninguna referencia en el código actual, así que se reemplaza por el
-- diseño completo en vez de dejar dos esquemas de "viajes" en pugna.
drop table viajes;

create table viajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  fecha date not null,
  numero_guia text not null,
  cliente text not null,
  cliente_id uuid references clientes(id) on delete set null,
  chofer_id uuid references usuarios(id) on delete set null,
  origen text not null,
  destino text not null,
  km_inicial numeric(10, 1),
  km_final numeric(10, 1),
  subtotal numeric(12, 2) not null default 0,
  aplica_iva boolean not null default true,
  iva numeric(12, 2) not null default 0,
  total numeric(12, 2) not null default 0,
  estado text not null default 'confirmado' check (estado in ('borrador', 'confirmado', 'facturado')),
  origen_captura text not null default 'manual' check (origen_captura in ('manual', 'whatsapp')),
  factura_id uuid references facturas(id) on delete set null,
  foto_guia_url text,
  comentarios text,
  creado_en timestamptz not null default now()
);
alter table viajes enable row level security;
create policy "acceso por empresa" on viajes
  for all using (empresa_id = empresa_actual());
create index on viajes (empresa_id, fecha desc);
create index on viajes (empresa_id, estado);

-- Una factura puede agrupar varios viajes (además de, o en vez de,
-- trabajo_ids que ya existía para el flujo de OS).
alter table facturas add column viaje_ids uuid[];
