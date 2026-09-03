import { supabase } from "./supabase";

// Tablas con columna empresa_id — mantener sincronizada con
// Database.Tables en packages/shared/src/types.ts. Las que NO están
// acá (empresas, whatsapp_mensajes_procesados, notificaciones_preferencias)
// se acotan por otra columna, no por empresa_id.
export const TABLAS_POR_EMPRESA = [
  "accesos_usuario", "agenda_pro_config", "agenda_pro_horarios", "analisis_fotos",
  "asistente_mensajes", "auditoria_usuarios",
  "catalogo_items", "catalogo_item_tipos_equipo", "catalogo_kit_items", "categorias_gasto", "centros_costo",
  "checklist_templates", "clientes", "consentimientos", "documentos", "empresa_modulos", "empresa_rol_modulos", "equipos", "facturas",
  "gastos", "gastos_fijos", "informes_generados", "informes_personalizados",
  "integraciones", "inventario", "inventario_movimientos", "mensajes_personalizados",
  "notificaciones", "notificaciones_cliente_log", "notificaciones_config",
  "ordenes_servicio", "os_items", "paquetes_sesiones", "planes_mantencion", "plantillas_documento", "portal_accesos",
  "portal_codigos", "presupuesto_items", "presupuestos", "proveedores",
  "rutas_planificadas", "suscripciones", "suscripcion_cobros", "tareas", "tipos_documento", "tipos_os", "tipos_trabajo",
  "trabajos", "unidades_medida", "usuarios", "vehiculo_asignaciones",
  "viajes",
] as const;

export type TablaPorEmpresa = (typeof TABLAS_POR_EMPRESA)[number];

// Azúcar para el patrón repetido `.from(x)....eq("empresa_id", ...)` que
// ya usan las ~300 consultas existentes (auditadas, correctas — esto
// NO las reemplaza). Es el camino recomendado para rutas nuevas de acá
// en adelante: hace el filtro por empresa el default, no algo que haya
// que acordarse de escribir cada vez. Un helper por tipo de operación
// porque `.eq()` en supabase-js solo existe después de .select()/
// .update()/.delete() — no directo sobre .from().
// (el cast en "empresa_id" es deliberado: TABLAS_POR_EMPRESA ya
// garantiza que la columna existe en las 43 tablas listadas arriba)
export function seleccionarDeEmpresa<T extends TablaPorEmpresa>(empresaId: string, tabla: T, columnas = "*") {
  return supabase.from(tabla).select(columnas).eq("empresa_id" as never, empresaId);
}

export function actualizarEnEmpresa<T extends TablaPorEmpresa>(empresaId: string, tabla: T, cambios: Record<string, unknown>) {
  return supabase.from(tabla).update(cambios as never).eq("empresa_id" as never, empresaId);
}

export function eliminarDeEmpresa<T extends TablaPorEmpresa>(empresaId: string, tabla: T) {
  return supabase.from(tabla).delete().eq("empresa_id" as never, empresaId);
}

// Solo recuerda incluir empresa_id en el insert — no hay un ".eq()" que
// aplicar acá, la seguridad de un insert está en qué valor se guarda.
export function insertarEnEmpresa<T extends TablaPorEmpresa>(empresaId: string, tabla: T, fila: Record<string, unknown>) {
  return supabase.from(tabla).insert({ ...fila, empresa_id: empresaId } as never);
}
