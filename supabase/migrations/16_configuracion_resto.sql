-- ============================================================
-- BITÁCORA — Submódulos Configuración → Integraciones, Inventario,
-- Categorías de Gastos, Centros de Costo, Notificaciones.
-- (Seguridad no necesita tablas nuevas: reutiliza Supabase Auth.)
-- Se ejecuta después de 15_configuracion_checklists_tipos_os.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. INVENTARIO — un solo toggle a nivel de empresa
-- ------------------------------------------------------------
alter table empresas add column inventario_activado boolean not null default false;

-- ------------------------------------------------------------
-- 2. INTEGRACIONES — credenciales guardadas server-side, nunca
--    devueltas en texto plano al frontend (solo un preview
--    enmascarado + el booleano "conectado").
-- ------------------------------------------------------------
create table integraciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  proveedor text not null check (proveedor in ('webpay', 'flow', 'mercadopago', 'whatsapp', 'anthropic', 'google_document_ai')),
  categoria text not null check (categoria in ('pagos', 'comunicacion', 'ia')),
  credenciales jsonb not null default '{}',
  conectado boolean not null default false,
  conectado_en timestamptz,
  actualizado_en timestamptz default now()
);

alter table integraciones enable row level security;
create policy "acceso por empresa" on integraciones
  for all using (empresa_id = empresa_actual());

create unique index idx_integraciones_proveedor on integraciones(empresa_id, proveedor);

-- ------------------------------------------------------------
-- 3. CATEGORÍAS DE GASTOS
-- ------------------------------------------------------------
create table categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  color text not null default '#4338ca',
  creado_en timestamptz default now()
);

alter table categorias_gasto enable row level security;
create policy "acceso por empresa" on categorias_gasto
  for all using (empresa_id = empresa_actual());

create unique index idx_categorias_gasto_nombre on categorias_gasto(empresa_id, nombre);

-- ------------------------------------------------------------
-- 4. CENTROS DE COSTO
-- ------------------------------------------------------------
create table centros_costo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  categoria_gasto_ids uuid[] not null default '{}',
  creado_en timestamptz default now()
);

alter table centros_costo enable row level security;
create policy "acceso por empresa" on centros_costo
  for all using (empresa_id = empresa_actual());

create index idx_centros_costo_empresa on centros_costo(empresa_id);

-- ------------------------------------------------------------
-- 5. NOTIFICACIONES — preferencias generales + mensajes
--    personalizados por tipo de evento.
-- ------------------------------------------------------------
create table notificaciones_config (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references empresas(id) on delete cascade,
  correo_activado boolean not null default true,
  cotizacion_creada boolean not null default true,
  cotizacion_aprobada boolean not null default true,
  cotizacion_rechazada boolean not null default true,
  os_creada boolean not null default true,
  os_completada boolean not null default true,
  cobranza_recibida boolean not null default true,
  cobranza_atrasada boolean not null default true,
  actualizado_en timestamptz default now()
);

alter table notificaciones_config enable row level security;
create policy "acceso por empresa" on notificaciones_config
  for all using (empresa_id = empresa_actual());

create table mensajes_personalizados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('cotizacion', 'orden_servicio', 'cobranza')),
  mensaje_whatsapp text,
  asunto_correo text,
  cuerpo_correo text,
  actualizado_en timestamptz default now()
);

alter table mensajes_personalizados enable row level security;
create policy "acceso por empresa" on mensajes_personalizados
  for all using (empresa_id = empresa_actual());

create unique index idx_mensajes_personalizados_tipo on mensajes_personalizados(empresa_id, tipo);
