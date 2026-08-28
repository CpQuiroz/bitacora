-- ============================================================
-- BITÁCORA — Submódulos Configuración → Checklists y Tipos de OS.
-- "Tipos de OS" es una entidad nueva y deliberadamente separada de
-- "tipos_trabajo" (que ya existe, para campos dinámicos por tipo de
-- trabajo) — acá el foco es color + checklist predeterminado +
-- activo/inactivo, un concepto distinto aunque el nombre se parezca.
-- Se ejecuta después de 14_configuracion_plantillas.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. CHECKLIST_TEMPLATES
--    secciones: [{ "nombre": "Sección 1", "preguntas": ["...", "..."] }]
-- ------------------------------------------------------------
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  activo boolean not null default true,
  version int not null default 1,
  secciones jsonb not null default '[]',
  creado_en timestamptz default now(),
  actualizado_en timestamptz default now()
);

alter table checklist_templates enable row level security;
create policy "acceso por empresa" on checklist_templates
  for all using (empresa_id = empresa_actual());

create index idx_checklist_templates_empresa on checklist_templates(empresa_id, activo);

-- ------------------------------------------------------------
-- 2. TIPOS_OS
-- ------------------------------------------------------------
create table tipos_os (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  descripcion text,
  color text not null default '#4338ca',
  checklist_template_id uuid references checklist_templates(id) on delete set null,
  activo boolean not null default true,
  creado_en timestamptz default now()
);

alter table tipos_os enable row level security;
create policy "acceso por empresa" on tipos_os
  for all using (empresa_id = empresa_actual());

create index idx_tipos_os_empresa on tipos_os(empresa_id, activo);
