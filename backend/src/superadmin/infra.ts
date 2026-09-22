// ============================================================
// BITÁCORA — Monitoreo de infraestructura (Panel de Super-Admin,
// 22-sep-2026). Cada servicio es independiente: si falta la
// credencial o la llamada falla, ese bloque vuelve con
// `disponible: false` + un motivo legible, sin tumbar el resto del
// panel. Las credenciales (env.ts) nunca se devuelven al cliente —
// solo los números ya calculados.
// ============================================================
import { env } from "../env";

export type EstadoServicioInfra =
  | { disponible: true; [k: string]: unknown }
  | { disponible: false; motivo: string };

const SUPABASE_MGMT_URL = "https://api.supabase.com/v1";

// ---------------------------------------------------------------
// Supabase — status + tamaño real de cada proyecto (prod y dev),
// vía el endpoint de query SQL de la Management API (de solo
// lectura acá: pg_database_size, nada de DDL).
// ---------------------------------------------------------------
type ProyectoSupabase = { id: string; ref: string; name: string; region: string; status: string };

export async function obtenerEstadoSupabase(): Promise<EstadoServicioInfra> {
  if (!env.SUPABASE_MGMT_TOKEN) return { disponible: false, motivo: "Falta SUPABASE_MGMT_TOKEN" };

  const headers = { Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}` };
  const resProyectos = await fetch(`${SUPABASE_MGMT_URL}/projects`, { headers });
  if (!resProyectos.ok) {
    return { disponible: false, motivo: `Error ${resProyectos.status} listando proyectos` };
  }
  const proyectos = (await resProyectos.json()) as ProyectoSupabase[];

  const conTamano = await Promise.all(
    proyectos.map(async (p) => {
      try {
        const r = await fetch(`${SUPABASE_MGMT_URL}/projects/${p.ref}/database/query`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "select pg_database_size(current_database()) as bytes, pg_size_pretty(pg_database_size(current_database())) as pretty;",
          }),
        });
        if (!r.ok) return { ref: p.ref, nombre: p.name, region: p.region, estado: p.status, dbBytes: null, dbTexto: null };
        const filas = (await r.json()) as { bytes: number; pretty: string }[];
        return { ref: p.ref, nombre: p.name, region: p.region, estado: p.status, dbBytes: filas[0]?.bytes ?? null, dbTexto: filas[0]?.pretty ?? null };
      } catch {
        return { ref: p.ref, nombre: p.name, region: p.region, estado: p.status, dbBytes: null, dbTexto: null };
      }
    })
  );

  return { disponible: true, proyectos: conTamano };
}

// ---------------------------------------------------------------
// Resend — dominios (verificación) + un conteo simple de correos
// recientes como proxy de uso (la API pública no expone cuota/plan
// directamente).
// ---------------------------------------------------------------
export async function obtenerEstadoResend(): Promise<EstadoServicioInfra> {
  if (!env.RESEND_API_KEY) return { disponible: false, motivo: "Falta RESEND_API_KEY" };

  const headers = { Authorization: `Bearer ${env.RESEND_API_KEY}` };
  const resDominios = await fetch("https://api.resend.com/domains", { headers });
  if (!resDominios.ok) {
    const body = await resDominios.json().catch(() => ({}));
    const restringida = resDominios.status === 401 && (body as { name?: string }).name === "restricted_api_key";
    return {
      disponible: false,
      motivo: restringida
        ? "La API key es de solo envío — necesita permiso 'Full access' para leer dominios/envíos"
        : `Error ${resDominios.status} consultando Resend`,
    };
  }
  const dominios = (await resDominios.json()) as { data: { name: string; status: string; region: string }[] };

  let ultimos30dias: number | null = null;
  try {
    const resEmails = await fetch("https://api.resend.com/emails?limit=1", { headers });
    if (resEmails.ok) {
      // La API no da un total agregado — solo confirmamos que el
      // endpoint responde. El conteo real de envíos queda para el
      // dashboard de Resend (no expuesto por esta API).
      ultimos30dias = null;
    }
  } catch {
    /* best-effort */
  }

  return { disponible: true, dominios: dominios.data.map((d) => ({ nombre: d.name, estado: d.status, region: d.region })), ultimos30dias };
}

// ---------------------------------------------------------------
// Anthropic — uso/costo de la organización (Admin API, requiere una
// Admin API Key — distinta de la key normal de inferencia).
// ---------------------------------------------------------------
export async function obtenerEstadoAnthropic(): Promise<EstadoServicioInfra> {
  if (!env.ANTHROPIC_ADMIN_KEY) return { disponible: false, motivo: "Falta ANTHROPIC_ADMIN_KEY" };

  const hoy = new Date();
  const hace30dias = new Date(hoy.getTime() - 30 * 24 * 60 * 60 * 1000);
  const qs = new URLSearchParams({
    starting_at: hace30dias.toISOString().slice(0, 10) + "T00:00:00Z",
    bucket_width: "1d",
  });

  const r = await fetch(`https://api.anthropic.com/v1/organizations/usage_report/messages?${qs}`, {
    headers: { "x-api-key": env.ANTHROPIC_ADMIN_KEY, "anthropic-version": "2023-06-01" },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    return { disponible: false, motivo: (body as { error?: { message?: string } }).error?.message ?? `Error ${r.status}` };
  }
  const datos = (await r.json()) as { data: unknown[] };
  return { disponible: true, dias: datos.data.length, crudo: datos };
}
