// ============================================================
// Agenda Pro — aviso de "cita agendada" al cliente. Un solo punto de
// entrada usado tanto por la creación de tareas desde el dashboard
// (routes/tareas.ts) como por la reserva pública (routes/reservaPublica.ts)
// para no duplicar la lógica de buscar el cliente/empresa y armar las
// variables. No bloquea a quien la llama — nunca lanza.
// ============================================================
import { supabase } from "./supabase";
import { empresaTieneModulo } from "./permisos";
import { notificarCliente } from "./notificarCliente";

export async function avisarCitaAgendada(empresaId: string, tareaId: string, fecha: string, hora: string | null, clienteId: string): Promise<void> {
  try {
    if (!(await empresaTieneModulo(empresaId, "agenda_pro"))) return;
    // tenant-ok: clienteId siempre viene ya validado contra empresaId por
    // el llamador (clienteExiste() en tareas.ts, o la búsqueda/creación
    // scopeada por empresa_id en reservaPublica.ts) antes de llegar acá.
    const { data: cliente } = await supabase.from("clientes").select("nombre, correo, telefono").eq("id", clienteId).maybeSingle();
    if (!cliente?.correo && !cliente?.telefono) return;
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();
    await notificarCliente(empresaId, "cita_agendada", cliente.correo, {
      clienteId,
      entidadTipo: "tarea",
      entidadId: tareaId,
      telefono: cliente.telefono,
      variables: {
        cliente: cliente.nombre ?? "",
        empresa: empresa?.nombre ?? "",
        fecha,
        hora: hora ? ` a las ${hora}` : "",
      },
    });
  } catch (err) {
    console.error("Error avisando cita agendada:", err);
  }
}
