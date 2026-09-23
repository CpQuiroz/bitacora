-- BITÁCORA — Fase 3 del pedido grande de colaborador/OS (23-sep-2026).
--
-- 3.1 — descripción por foto de OS (mismo criterio que
-- levantamiento_fotos, migración 124).
alter table analisis_fotos add column descripcion text;

-- 3.2 — "Cliente no disponible" al cerrar una OS (no siempre hay
-- alguien que firme): motivo obligatorio + foto de evidencia, la OS
-- queda cerrada igual con esa marca visible en el PDF y para Admin.
-- foto_url es la KEY de storage (igual convención que firma_url/
-- pdf_url en esta misma tabla, no una URL pública).
alter table ordenes_servicio add column cliente_no_disponible boolean not null default false;
alter table ordenes_servicio add column cliente_no_disponible_motivo text;
alter table ordenes_servicio add column cliente_no_disponible_foto text;

-- 3.4b — "sin ubicación": el flujo nuevo permite continuar el check-in/
-- check-out aunque se niegue el permiso de GPS. check_in_lat/lng ya
-- podían ser null por eso ANTES de esta fase (varios motivos posibles,
-- sin distinguir) — estas 2 banderas dejan sin ambigüedad, para el
-- check-in/check-out hechos desde el flujo nuevo, que la ausencia de
-- coordenadas fue una decisión consciente ("continuar sin ubicación"),
-- no un olvido ni un bug.
alter table ordenes_servicio add column check_in_sin_ubicacion boolean not null default false;
alter table ordenes_servicio add column check_out_sin_ubicacion boolean not null default false;

-- 3.3 — versiones del PDF con Informe IA. `ordenes_servicio.pdf_url`
-- sigue siendo la v1 (la original, generada al firmar) — INMUTABLE,
-- nunca se pisa (mismo invariante de siempre: "OS inmutable post-
-- firma"). Cada vez que el Admin genera una versión nueva con el
-- Informe IA (revisado/editado antes de generar), se agrega una fila
-- acá — nunca se borra ni actualiza una versión ya creada.
create table os_pdf_versiones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  orden_servicio_id uuid not null references ordenes_servicio(id) on delete cascade,
  -- v1 = la original (pdf_url en ordenes_servicio) — esta tabla arranca
  -- en v2 (la primera vez que se agrega el Informe IA a una nueva
  -- versión). Se guarda igual el número acá (no se infiere por orden)
  -- para que un borrado accidental de una fila intermedia no corra la
  -- numeración de las demás.
  version integer not null check (version >= 2),
  pdf_url text not null,
  -- Texto del Informe IA tal como quedó en ESTA versión puntual (el
  -- Admin lo pudo haber editado antes de generar) — se guarda acá y
  -- no solo en ordenes_servicio.informe_ia (que sigue siendo "el
  -- último generado", conveniencia para no tener que abrir el
  -- historial para ver el más reciente).
  informe_ia text not null,
  creado_por uuid references usuarios(id) on delete set null,
  creado_en timestamptz not null default now(),
  unique (orden_servicio_id, version)
);
alter table os_pdf_versiones enable row level security;
create policy "acceso por empresa" on os_pdf_versiones
  for all using (empresa_id = empresa_actual());
create index on os_pdf_versiones (orden_servicio_id, version desc);

-- 3.4c — migración de OS en curso con el flujo antiguo: NO se necesita
-- ningún mapeo de estados ni backfill de datos. `estado_os`
-- (pendiente/enviada/en_proceso/completada/firmada/cancelada) no
-- cambia de vocabulario ni de significado con el flujo nuevo — el
-- rediseño (ver mobile) es de PANTALLAS (unificar check-in/checklist/
-- fotos/materiales/cierre en 3 pasos con indicador de progreso), no de
-- estados en la base. Una OS que hoy está a mitad de camino (con
-- check-in ya marcado, o con la firma del técnico ya guardada de
-- antes) sigue teniendo exactamente los mismos datos con los mismos
-- nombres de columna después de este despliegue — la pantalla nueva
-- simplemente lee esos mismos datos para decidir en qué paso mostrarla
-- (ver comentario en TrabajoDetalleScreen.tsx). Ninguna OS pierde
-- datos ya capturados ni queda bloqueada para terminarse.
