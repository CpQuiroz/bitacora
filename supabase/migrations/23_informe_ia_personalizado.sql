-- BITÁCORA — Informe IA: plantillas de informe personalizado. El
-- usuario elige qué secciones incluir (reutilizando toda la
-- analítica del módulo de Informes), le pone nombre, y la guarda
-- para volver a generarla con un período distinto.
create table informes_personalizados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nombre text not null,
  secciones text[] not null,
  pregunta text,
  creado_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
alter table informes_personalizados enable row level security;
create policy "acceso por empresa" on informes_personalizados
  for all using (empresa_id = empresa_actual());

-- El historial de informes generados ahora también acepta el tipo
-- "personalizado" (multi-sección), y guarda qué secciones se usaron
-- y de qué plantilla salió (si vino de una guardada) — snapshot
-- propio en vez de solo la FK, para que el historial no cambie si
-- la plantilla se edita o borra después.
alter table informes_generados drop constraint informes_generados_tipo_check;
alter table informes_generados add constraint informes_generados_tipo_check
  check (tipo in ('financiero', 'operativo', 'clientes', 'colaboradores', 'personalizado'));
alter table informes_generados add column secciones text[];
alter table informes_generados add column personalizado_id uuid references informes_personalizados(id) on delete set null;
alter table informes_generados add column nombre text;
