-- BITÁCORA — Asistente conversacional con IA en el dashboard. A
-- diferencia de "Informe IA" (que genera un documento puntual), esto
-- es un hilo de chat continuo por usuario, con acceso a los mismos
-- datos agregados vía tool-use.
create table asistente_mensajes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  rol text not null check (rol in ('user', 'assistant')),
  contenido text not null,
  creado_en timestamptz not null default now()
);
alter table asistente_mensajes enable row level security;
create policy "acceso por empresa" on asistente_mensajes
  for all using (empresa_id = empresa_actual());
create index on asistente_mensajes (empresa_id, usuario_id, creado_en);
