-- ============================================================
-- BITÁCORA — Índices de la auditoría del 24-sep-2026 (tarea 139).
-- Detalle y justificación: progress/auditoria_indices.md.
-- Preventivo: hoy prod es chico y no hay consultas lentas; esto deja
-- listas las rutas más frecuentes para cuando crezcan los datos.
-- Solo índices: no toca datos. Idempotente.
-- ============================================================

-- ---------- A. Consultas frecuentes ----------
-- A1. Campana: últimas notificaciones del usuario (se consulta cada 60 s).
create index if not exists idx_notificaciones_usuario_recientes
  on notificaciones (empresa_id, usuario_id, creado_en desc);
-- A2. Evitar avisos de vencimiento duplicados.
create index if not exists idx_notificaciones_tipo_entidad
  on notificaciones (empresa_id, tipo, entidad_id);
-- A3. Evitar avisos duplicados a clientes (cumpleaños, cotizaciones, cobros).
create index if not exists idx_notif_cliente_log_tipo_entidad
  on notificaciones_cliente_log (empresa_id, tipo, entidad_id);
-- A4. Dashboard/informes por rango de fecha de emisión y lista de Cobros.
create index if not exists idx_facturas_empresa_fecha_emision
  on facturas (empresa_id, fecha_emision);
-- A5. Dashboard: OS finalizadas por período.
create index if not exists idx_ordenes_servicio_finalizada
  on ordenes_servicio (empresa_id, finalizada_en) where finalizada_en is not null;
-- A6. "Mis trabajos" del técnico y lista de OS por responsable.
create index if not exists idx_trabajos_responsable_fecha
  on trabajos (empresa_id, responsable_id, fecha desc);
-- A7. Pizarra y Agenda del chofer.
create index if not exists idx_viajes_chofer_fecha
  on viajes (empresa_id, chofer_id, fecha desc) where chofer_id is not null;

-- ---------- B. Claves foráneas sin índice (19) ----------
create index if not exists idx_auditoria_empresa_usuario_id on auditoria_empresa (usuario_id);
create index if not exists idx_eventos_flota_equipo_id on eventos_flota (equipo_id);
create index if not exists idx_eventos_flota_reportado_por on eventos_flota (reportado_por);
create index if not exists idx_levantamiento_fotos_empresa_id on levantamiento_fotos (empresa_id);
create index if not exists idx_levantamiento_fotos_subida_por on levantamiento_fotos (subida_por);
create index if not exists idx_levantamiento_materiales_empresa_id on levantamiento_materiales (empresa_id);
create index if not exists idx_levantamiento_materiales_agregado_por on levantamiento_materiales (agregado_por);
create index if not exists idx_levantamientos_cliente_id on levantamientos (cliente_id);
create index if not exists idx_levantamientos_tecnico_id on levantamientos (tecnico_id);
create index if not exists idx_levantamientos_creado_por on levantamientos (creado_por);
create index if not exists idx_os_pdf_versiones_empresa_id on os_pdf_versiones (empresa_id);
create index if not exists idx_os_pdf_versiones_creado_por on os_pdf_versiones (creado_por);
create index if not exists idx_presupuestos_etapa_id on presupuestos (etapa_id);
create index if not exists idx_rendiciones_colaborador_id on rendiciones (colaborador_id);
create index if not exists idx_rendiciones_aprobado_por on rendiciones (aprobado_por);
create index if not exists idx_rendiciones_creado_por on rendiciones (creado_por);
create index if not exists idx_tipos_os_trabajo_checklist_template_id on tipos_os_trabajo (checklist_template_id);
-- Estas dos solo tenían índices parciales, que no sirven para la FK.
create index if not exists idx_analisis_fotos_empresa_id on analisis_fotos (empresa_id);
create index if not exists idx_datos_laborales_empresa_id on datos_laborales (empresa_id);

-- ---------- C. Redundantes (otro índice ya cubre las mismas columnas) ----------
drop index if exists catalogo_item_tipos_equipo_catalogo_item_id_idx;  -- UNIQUE (catalogo_item_id, tipo_equipo)
drop index if exists catalogo_kit_items_kit_idx;                       -- UNIQUE (kit_id, item_id)
drop index if exists empresa_rol_modulos_empresa_idx;                  -- PK (empresa_id, rol_slug, modulo)
drop index if exists idx_rendiciones_empresa;                          -- (empresa_id, colaborador_id)
drop index if exists os_pdf_versiones_orden_servicio_id_version_idx;   -- UNIQUE (orden_servicio_id, version)
