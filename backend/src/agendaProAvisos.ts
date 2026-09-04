// ============================================================
// Agenda Pro — avisos de citas al cliente ("agendada" / "cancelada"). Un
// solo punto de entrada por evento, usado tanto por la creación/cancelación
// de tareas desde el dashboard (routes/tareas.ts) como por la reserva
// pública (routes/reservaPublica.ts) para no duplicar la lógica de buscar
// el cliente/empresa y armar las variables. No bloquea a quien llama —
// nunca lanza.
// ============================================================
import { supabase } from "./supabase";
import { empresaTieneModulo } from "./permisos";
import { notificarCliente } from "./notificarCliente";

// Bloque de dirección del CLIENTE (no de la empresa — la cita ocurre donde
// está él) para el correo de "cita agendada". Vacío si no dejó dirección
// cargada, así el texto default cierra igual de bien sin dejar un hueco.
function bloqueDireccion(direccion: string | null, comuna: string | null): string {
  if (!direccion) return "";
  const linea = comuna ? `${direccion}, ${comuna}` : direccion;
  return `<p style="margin-top:12px;color:#555;">📍 ${linea}</p>`;
}

export async function avisarCitaAgendada(
  empresaId: string,
  tareaId: string,
  fecha: string,
  hora: string | null,
  clienteId: string,
  forzar = false
): Promise<void> {
  try {
    if (!(await empresaTieneModulo(empresaId, "agenda_pro"))) return;
    // tenant-ok: clienteId siempre viene ya validado contra empresaId por
    // el llamador (clienteExiste() en tareas.ts, o la búsqueda/creación
    // scopeada por empresa_id en reservaPublica.ts) antes de llegar acá.
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nombre, correo, telefono, direccion, comuna")
      .eq("id", clienteId)
      .maybeSingle();
    if (!cliente?.correo && !cliente?.telefono) return;
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();
    await notificarCliente(empresaId, "cita_agendada", cliente.correo, {
      clienteId,
      entidadTipo: "tarea",
      entidadId: tareaId,
      telefono: cliente.telefono,
      forzar,
      variables: {
        cliente: cliente.nombre ?? "",
        empresa: empresa?.nombre ?? "",
        fecha,
        hora: hora ? ` a las ${hora}` : "",
        direccion: bloqueDireccion(cliente.direccion, cliente.comuna),
      },
    });
  } catch (err) {
    console.error("Error avisando cita agendada:", err);
  }
}

export async function avisarCitaCancelada(
  empresaId: string,
  tareaId: string,
  fecha: string,
  hora: string | null,
  clienteId: string
): Promise<void> {
  try {
    if (!(await empresaTieneModulo(empresaId, "agenda_pro"))) return;
    // tenant-ok: mismo criterio que avisarCitaAgendada — clienteId ya
    // viene validado contra empresaId por el llamador (POST /:id/cancelar
    // en tareas.ts, que además exige que la tarea sea de esta empresa).
    const { data: cliente } = await supabase.from("clientes").select("nombre, correo, telefono").eq("id", clienteId).maybeSingle();
    if (!cliente?.correo && !cliente?.telefono) return;
    const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();
    await notificarCliente(empresaId, "cita_cancelada", cliente.correo, {
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
    console.error("Error avisando cita cancelada:", err);
  }
}
