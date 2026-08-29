alter table tipos_os add column tiempo_estimado_minutos integer;
alter table empresas add column inventario_stock_minimo_default integer not null default 5;

-- Checklists: los ítems pasan de string a {texto, obligatorio}. Backfill de
-- lo ya guardado (solo la empresa demo) — default obligatorio=true, la
-- opción conservadora para checklists que ya están en uso.
update checklist_templates
set secciones = (
  select jsonb_agg(
    jsonb_build_object(
      'nombre', sec->>'nombre',
      'preguntas', (
        select jsonb_agg(jsonb_build_object('texto', p, 'obligatorio', true))
        from jsonb_array_elements_text(sec->'preguntas') as p
      )
    )
  )
  from jsonb_array_elements(secciones) as sec
)
where jsonb_typeof(secciones) = 'array' and jsonb_array_length(secciones) > 0;

create table unidades_medida (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  abreviatura text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (empresa_id, nombre)
);
alter table unidades_medida enable row level security;
create policy "acceso por empresa" on unidades_medida
  for all using (empresa_id = empresa_actual());
create index on unidades_medida (empresa_id, activo);
