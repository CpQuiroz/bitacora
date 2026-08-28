-- ============================================================
-- BITÁCORA — Submódulo Configuración → Plantillas: apariencia de
-- los documentos PDF (Cotización, OS, Cobranza, Términos).
-- Se ejecuta después de 13_configuracion_plan.sql
-- ============================================================
create table plantillas_documento (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('cotizacion', 'orden_servicio', 'cobranza', 'terminos_aceptacion')),
  mostrar_logo boolean not null default true,
  posicion_logo text not null default 'izquierda' check (posicion_logo in ('izquierda', 'centro', 'derecha')),
  color_primario text,
  color_secundario text,
  texto_encabezado text,
  texto_pie text,
  mensaje_predeterminado text,
  terminos_condiciones text,
  mostrar_firma boolean not null default true,
  actualizado_en timestamptz default now()
);

alter table plantillas_documento enable row level security;
create policy "acceso por empresa" on plantillas_documento
  for all using (empresa_id = empresa_actual());

create unique index idx_plantillas_documento_tipo on plantillas_documento(empresa_id, tipo);
