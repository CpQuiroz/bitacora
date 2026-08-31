// ============================================================
// Felicitación automática de cumpleaños al cliente — sin cron en este
// proyecto, se revisa con un chequeo perezoso enganchado en GET
// /api/me (server.ts): a diferencia de un chequeo atado a una lista
// puntual (ej. revisarCotizacionesPorVencer en cotizaciones.ts), acá
// conviene el endpoint más universal posible — cualquier navegación
// por el dashboard, de cualquier rol, lo llama — porque si nadie abre
// la pantalla de Clientes justo ese día, el aviso nunca saldría.
//
// Dedupe: no manda dos veces en el mismo año a un mismo cliente —
// revisa notificaciones_cliente_log de los últimos 350 días (margen
// de sobra sin tener que hacer aritmética exacta de año calendario).
// ============================================================
import { supabase } from "./supabase";
import { notificarCliente } from "./notificarCliente";

export async function revisarCumpleanosClientes(empresaId: string): Promise<void> {
  const hoy = new Date();
  const mesHoy = hoy.getMonth() + 1;
  const diaHoy = hoy.getDate();

  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, correo, fecha_nacimiento")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .not("fecha_nacimiento", "is", null)
    .not("correo", "is", null);

  const cumpleanerosHoy = (clientes ?? []).filter((c) => {
    const fecha = new Date(`${c.fecha_nacimiento}T00:00:00`);
    return fecha.getMonth() + 1 === mesHoy && fecha.getDate() === diaHoy;
  });
  if (cumpleanerosHoy.length === 0) return;

  const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();
  const desde = new Date(Date.now() - 350 * 24 * 60 * 60 * 1000).toISOString();

  // Solo informativo — nunca se calcula ni se aplica nada en la app,
  // la empresa lo honra a mano. Sin config o sin porcentaje elegido,
  // "descuento" queda vacío y el texto default cierra igual de bien
  // (ver CUERPOS_DEFAULT en notificarCliente.ts).
  const { data: config } = await supabase
    .from("notificaciones_config")
    .select("cliente_cumpleanos_descuento_pct")
    .eq("empresa_id", empresaId)
    .maybeSingle();
  const pct = config?.cliente_cumpleanos_descuento_pct;
  const descuento = pct
    ? ` Como regalo, tienes un ${pct}% de descuento en tu próxima visita — coméntanoslo cuando vengas.`
    : "";

  for (const cliente of cumpleanerosHoy) {
    const { data: yaEnviado } = await supabase
      .from("notificaciones_cliente_log")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("tipo", "cliente_cumpleanos")
      .eq("entidad_id", cliente.id)
      .eq("exito", true)
      .gte("creado_en", desde)
      .limit(1)
      .maybeSingle();
    if (yaEnviado) continue;

    await notificarCliente(empresaId, "cliente_cumpleanos", cliente.correo, {
      clienteId: cliente.id,
      entidadTipo: "cliente",
      entidadId: cliente.id,
      variables: { cliente: cliente.nombre, empresa: empresa?.nombre ?? "", descuento },
    });
  }
}
