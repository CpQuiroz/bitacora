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
//
// Tarea 140 (auditoría de índices, C1): antes corría en CADA GET /api/me
// y leía todos los clientes activos de la empresa en cada navegación.
// Ahora corre a lo más una vez por empresa y por día de Chile, por
// proceso (Render tiene una instancia; si fueran varias, el dedupe de
// notificaciones_cliente_log igual evita saludos repetidos).
// ============================================================
import { supabase } from "./supabase";
import { notificarCliente } from "./notificarCliente";
import { hoyChile } from "./fechaChile";

const revisadoEl = new Map<string, string>(); // empresaId → YYYY-MM-DD (Chile)

export function revisarCumpleanosSiCorresponde(empresaId: string): void {
  const hoy = hoyChile();
  if (revisadoEl.get(empresaId) === hoy) return;
  revisadoEl.set(empresaId, hoy);
  revisarCumpleanosClientes(empresaId, hoy).catch((err) => {
    // Falló: se deja reintentar en la próxima navegación.
    revisadoEl.delete(empresaId);
    console.error("Error revisando cumpleaños de clientes:", err);
  });
}

// ¿Cumple años hoy? Compara mes y día como texto (sin zona horaria). Quien
// nació un 29 de febrero se saluda el 28 en los años no bisiestos.
export function esCumpleanos(fechaNacimiento: string, hoy: string): boolean {
  const mmdd = fechaNacimiento.slice(5, 10);
  const hoyMmdd = hoy.slice(5, 10);
  if (mmdd === hoyMmdd) return true;
  const anio = Number(hoy.slice(0, 4));
  const bisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return mmdd === "02-29" && hoyMmdd === "02-28" && !bisiesto;
}

export async function revisarCumpleanosClientes(empresaId: string, hoy: string = hoyChile()): Promise<void> {
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id, nombre, correo, fecha_nacimiento")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .not("fecha_nacimiento", "is", null)
    .not("correo", "is", null);

  const cumpleanerosHoy = (clientes ?? []).filter((c) => !!c.fecha_nacimiento && esCumpleanos(c.fecha_nacimiento, hoy));
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
