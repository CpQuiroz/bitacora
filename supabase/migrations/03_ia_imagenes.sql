-- ============================================================
-- BITÁCORA — Análisis de imágenes con IA + tiempo real
-- Se ejecuta DESPUÉS de bitacora-schema.sql y bitacora-logica-negocio.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. TABLA: análisis de cada foto subida
-- ------------------------------------------------------------
create table analisis_fotos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  orden_servicio_id uuid references ordenes_servicio(id) on delete cascade,
  foto_url text not null,
  subida_por uuid references usuarios(id),
  estado text not null default 'procesando', -- procesando, listo, error
  resumen text,          -- descripción corta generada por IA
  alerta boolean default false,   -- true si la IA detecta algo que requiere atención
  detalle_alerta text,   -- qué detectó (ej. "daño visible en la carga")
  creado_en timestamptz default now()
);

alter table analisis_fotos enable row level security;

create policy "acceso por empresa" on analisis_fotos
  for all using (empresa_id = empresa_actual());

-- ------------------------------------------------------------
-- 2. ACTIVAR TIEMPO REAL sobre esta tabla
--    Esto permite que el panel del admin "escuche" cambios
--    y se actualice solo, sin recargar la página
-- ------------------------------------------------------------
alter publication supabase_realtime add table analisis_fotos;

-- ------------------------------------------------------------
-- 3. ÍNDICE para consultar rápido las alertas pendientes
-- ------------------------------------------------------------
create index idx_analisis_alertas on analisis_fotos(empresa_id, alerta) where alerta = true;
