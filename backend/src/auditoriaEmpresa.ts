// ============================================================
// Auditoría de acciones de usuarios de una empresa (migración 135):
// quién hizo qué, cuándo y sobre qué registro. Se llama DESPUÉS de que
// la acción se hizo; si registrar falla no se deshace la acción (no hay
// transacción entre ambas), pero queda en errores_backend para que el
// Super-Admin lo vea.
// ============================================================
import { supabase } from "./supabase";

export async function registrarAuditoriaEmpresa(params: {
  empresaId: string;
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId: string | null;
  detalle?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("auditoria_empresa").insert({
    empresa_id: params.empresaId,
    usuario_id: params.usuarioId,
    accion: params.accion,
    entidad: params.entidad,
    entidad_id: params.entidadId,
    detalle: params.detalle ?? {},
  });
  if (!error) return;
  console.error("No se pudo registrar la auditoría:", error.message);
  await supabase
    .from("errores_backend")
    .insert({
      empresa_id: params.empresaId,
      ruta: `auditoria:${params.entidad}:${params.accion}`,
      metodo: "POST",
      mensaje: `No se registró la auditoría de ${params.entidad} ${params.entidadId ?? ""}: ${error.message}`.slice(0, 500),
    })
    .then(({ error: e }) => {
      if (e) console.error("errores_backend:", e.message);
    });
}
