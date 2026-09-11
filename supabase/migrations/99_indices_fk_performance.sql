-- ============================================================
-- BITÁCORA — Índices de cobertura para foreign keys sin índice
-- Origen: Supabase Performance Advisor, proyecto bitacora-prod
--         (yjbskbskyadxjooxngjv), ejecutado 2026-09-11 — 73 hallazgos
--         ("unindexed_foreign_keys").
--
-- Postgres no crea automáticamente un índice sobre la columna de una
-- foreign key (solo sobre la primary key referenciada). Estas 73
-- columnas son FKs (empresa_id, cliente_id, usuario_id, etc.) que hoy
-- se recorren con seq scan completo en cada JOIN, filtro multi-tenant
-- (empresa_id) o verificación de integridad al borrar/editar la fila
-- padre. Mismo criterio que 82_indices_performance.sql: se agregan
-- ahora que las tablas están chicas para no tener que hacerlo después
-- con volumen real.
--
-- Sin CONCURRENTLY a propósito: el runner de migraciones (Supabase
-- CLI) manda el archivo completo como un solo query string, y el
-- protocolo simple de Postgres ejecuta múltiples statements de un
-- mismo query string como un bloque transaccional implícito —
-- CREATE INDEX CONCURRENTLY no puede correr dentro de ningún bloque
-- transaccional (falla con "cannot run inside a transaction block").
-- Con el volumen actual el bloqueo de un CREATE INDEX normal es de
-- milisegundos, así que no hace falta CONCURRENTLY hoy.
--
-- `if not exists` por si alguna ya se agregó a mano en el ínterin.
-- Todas las columnas verificadas contra el esquema real (supabase/
-- migrations/*.sql) antes de aplicar.
-- ============================================================

create index if not exists idx_analisis_fotos_orden_servicio_id on public.analisis_fotos (orden_servicio_id);
create index if not exists idx_analisis_fotos_subida_por on public.analisis_fotos (subida_por);
create index if not exists idx_asistente_mensajes_usuario_id on public.asistente_mensajes (usuario_id);
create index if not exists idx_auditoria_usuarios_realizado_por_id on public.auditoria_usuarios (realizado_por_id);
create index if not exists idx_auditoria_usuarios_usuario_afectado_id on public.auditoria_usuarios (usuario_afectado_id);
create index if not exists idx_catalogo_kit_items_empresa_id on public.catalogo_kit_items (empresa_id);
create index if not exists idx_catalogo_kit_items_item_id on public.catalogo_kit_items (item_id);
create index if not exists idx_documentos_tipo_documento_id on public.documentos (tipo_documento_id);
create index if not exists idx_empresa_feature_flags_activado_por on public.empresa_feature_flags (activado_por);
create index if not exists idx_empresa_plan_historial_super_admin_id on public.empresa_plan_historial (super_admin_id);
create index if not exists idx_empresa_plan_historial_usuario_id on public.empresa_plan_historial (usuario_id);
create index if not exists idx_empresa_rol_modulos_rol_slug on public.empresa_rol_modulos (rol_slug);
create index if not exists idx_equipos_cliente_id on public.equipos (cliente_id);
create index if not exists idx_gastos_categoria_gasto_id on public.gastos (categoria_gasto_id);
create index if not exists idx_gastos_centro_costo_id on public.gastos (centro_costo_id);
create index if not exists idx_gastos_editado_por on public.gastos (editado_por);
create index if not exists idx_gastos_proveedor_id on public.gastos (proveedor_id);
create index if not exists idx_gastos_trabajo_id on public.gastos (trabajo_id);
create index if not exists idx_informes_generados_personalizado_id on public.informes_generados (personalizado_id);
create index if not exists idx_informes_generados_usuario_id on public.informes_generados (usuario_id);
create index if not exists idx_informes_personalizados_creado_por on public.informes_personalizados (creado_por);
create index if not exists idx_informes_personalizados_empresa_id on public.informes_personalizados (empresa_id);
create index if not exists idx_liquidaciones_creado_por on public.liquidaciones (creado_por);
create index if not exists idx_liquidaciones_editado_por on public.liquidaciones (editado_por);
create index if not exists idx_liquidaciones_emitida_por on public.liquidaciones (emitida_por);
create index if not exists idx_liquidaciones_usuario_id on public.liquidaciones (usuario_id);
create index if not exists idx_login_2fa_pendiente_usuario_id on public.login_2fa_pendiente (usuario_id);
create index if not exists idx_notificaciones_usuario_id on public.notificaciones (usuario_id);
create index if not exists idx_ordenes_servicio_cobro_id on public.ordenes_servicio (cobro_id);
create index if not exists idx_os_items_catalogo_item_id on public.os_items (catalogo_item_id);
create index if not exists idx_os_items_empresa_id on public.os_items (empresa_id);
create index if not exists idx_paquetes_sesiones_cliente_id on public.paquetes_sesiones (cliente_id);
create index if not exists idx_paquetes_sesiones_servicio_id on public.paquetes_sesiones (servicio_id);
create index if not exists idx_paquetes_sesiones_tipo_pack_id on public.paquetes_sesiones (tipo_pack_id);
create index if not exists idx_planes_mantencion_equipo_id on public.planes_mantencion (equipo_id);
create index if not exists idx_portal_accesos_cliente_id on public.portal_accesos (cliente_id);
create index if not exists idx_portal_accesos_empresa_id on public.portal_accesos (empresa_id);
create index if not exists idx_portal_codigos_empresa_id on public.portal_codigos (empresa_id);
create index if not exists idx_presupuesto_items_catalogo_item_id on public.presupuesto_items (catalogo_item_id);
create index if not exists idx_presupuesto_items_empresa_id on public.presupuesto_items (empresa_id);
create index if not exists idx_presupuestos_cliente_id on public.presupuestos (cliente_id);
create index if not exists idx_presupuestos_trabajo_id on public.presupuestos (trabajo_id);
create index if not exists idx_proveedores_categoria_gasto_id on public.proveedores (categoria_gasto_id);
create index if not exists idx_registro_mantencion_fotos_empresa_id on public.registro_mantencion_fotos (empresa_id);
create index if not exists idx_registro_mantencion_fotos_subida_por on public.registro_mantencion_fotos (subida_por);
create index if not exists idx_registros_mantencion_equipo_creado_por on public.registros_mantencion_equipo (creado_por);
create index if not exists idx_registros_mantencion_equipo_equipo_id on public.registros_mantencion_equipo (equipo_id);
create index if not exists idx_registros_mantencion_equipo_proveedor_id on public.registros_mantencion_equipo (proveedor_id);
create index if not exists idx_registros_mantencion_equipo_realizado_por on public.registros_mantencion_equipo (realizado_por);
create index if not exists idx_rol_empresas_empresa_id on public.rol_empresas (empresa_id);
create index if not exists idx_rutas_planificadas_responsable_id on public.rutas_planificadas (responsable_id);
create index if not exists idx_tareas_cliente_id on public.tareas (cliente_id);
create index if not exists idx_tareas_responsable_id on public.tareas (responsable_id);
create index if not exists idx_tareas_servicio_id on public.tareas (servicio_id);
create index if not exists idx_tareas_trabajo_id on public.tareas (trabajo_id);
create index if not exists idx_tipos_os_checklist_template_id on public.tipos_os (checklist_template_id);
create index if not exists idx_tipos_pack_servicio_id on public.tipos_pack (servicio_id);
create index if not exists idx_tipos_trabajo_empresa_id on public.tipos_trabajo (empresa_id);
create index if not exists idx_trabajos_equipo_id on public.trabajos (equipo_id);
create index if not exists idx_trabajos_tipo_os_id on public.trabajos (tipo_os_id);
create index if not exists idx_trabajos_tipo_trabajo_id on public.trabajos (tipo_trabajo_id);
create index if not exists idx_vehiculo_asignaciones_colaborador_id on public.vehiculo_asignaciones (colaborador_id);
create index if not exists idx_vehiculo_asignaciones_equipo_id on public.vehiculo_asignaciones (equipo_id);
create index if not exists idx_venta_lineas_empresa_id on public.venta_lineas (empresa_id);
create index if not exists idx_venta_lineas_paquete_sesiones_id on public.venta_lineas (paquete_sesiones_id);
create index if not exists idx_ventas_registrada_por on public.ventas (registrada_por);
create index if not exists idx_viaje_fotos_empresa_id on public.viaje_fotos (empresa_id);
create index if not exists idx_viaje_fotos_subida_por on public.viaje_fotos (subida_por);
create index if not exists idx_viajes_cliente_id on public.viajes (cliente_id);
create index if not exists idx_viajes_equipo_id on public.viajes (equipo_id);
create index if not exists idx_viajes_factura_id on public.viajes (factura_id);
create index if not exists idx_whatsapp_conversaciones_empresa_id on public.whatsapp_conversaciones (empresa_id);
create index if not exists idx_whatsapp_conversaciones_usuario_id on public.whatsapp_conversaciones (usuario_id);
