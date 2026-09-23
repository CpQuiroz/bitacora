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

// ---------------------------------------------------------------
// Vercel — proyectos + estado del último deploy de producción de cada
// uno (23-sep-2026). Token: vercel.com/account/tokens (VERCEL_TOKEN);
// si los proyectos viven en un equipo, VERCEL_TEAM_ID (team_...).
// ---------------------------------------------------------------
type ProyectoVercel = { id: string; name: string; framework: string | null };
type DeployVercel = { url: string | null; state?: string; readyState?: string; created: number };

export async function obtenerEstadoVercel(): Promise<EstadoServicioInfra> {
  if (!env.VERCEL_TOKEN) return { disponible: false, motivo: "Falta VERCEL_TOKEN" };
  const headers = { Authorization: `Bearer ${env.VERCEL_TOKEN}` };
  const equipo = env.VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : "";

  const resProyectos = await fetch(`https://api.vercel.com/v9/projects?limit=20${equipo ? `&${equipo}` : ""}`, { headers });
  if (!resProyectos.ok) {
    return { disponible: false, motivo: resProyectos.status === 403 ? "El token no tiene acceso (¿falta VERCEL_TEAM_ID?)" : `Error ${resProyectos.status} listando proyectos` };
  }
  const { projects } = (await resProyectos.json()) as { projects: ProyectoVercel[] };

  const proyectos = await Promise.all(
    projects.map(async (p) => {
      try {
        const qs = new URLSearchParams({ projectId: p.id, target: "production", limit: "1" });
        if (env.VERCEL_TEAM_ID) qs.set("teamId", env.VERCEL_TEAM_ID);
        const r = await fetch(`https://api.vercel.com/v6/deployments?${qs}`, { headers });
        const d = r.ok ? ((await r.json()) as { deployments: DeployVercel[] }).deployments[0] : undefined;
        return {
          nombre: p.name,
          framework: p.framework,
          ultimoDeploy: d ? { estado: d.state ?? d.readyState ?? "UNKNOWN", fecha: new Date(d.created).toISOString(), url: d.url } : null,
        };
      } catch {
        return { nombre: p.name, framework: p.framework, ultimoDeploy: null };
      }
    })
  );
  return { disponible: true, proyectos };
}

// ---------------------------------------------------------------
// Render — servicios + estado del último deploy (23-sep-2026). API key:
// dashboard.render.com → Account Settings → API Keys (RENDER_API_KEY).
// ---------------------------------------------------------------
type ServicioRender = { id: string; name: string; type: string; suspended: string; serviceDetails?: { plan?: string } };
type DeployRender = { status: string; finishedAt: string | null; createdAt: string };

export async function obtenerEstadoRender(): Promise<EstadoServicioInfra> {
  if (!env.RENDER_API_KEY) return { disponible: false, motivo: "Falta RENDER_API_KEY" };
  const headers = { Authorization: `Bearer ${env.RENDER_API_KEY}`, Accept: "application/json" };

  const resServicios = await fetch("https://api.render.com/v1/services?limit=20", { headers });
  if (!resServicios.ok) return { disponible: false, motivo: `Error ${resServicios.status} listando servicios` };
  const filas = (await resServicios.json()) as { service: ServicioRender }[];

  const servicios = await Promise.all(
    filas.map(async ({ service: s }) => {
      try {
        const r = await fetch(`https://api.render.com/v1/services/${s.id}/deploys?limit=1`, { headers });
        const d = r.ok ? ((await r.json()) as { deploy: DeployRender }[])[0]?.deploy : undefined;
        return {
          nombre: s.name,
          tipo: s.type,
          plan: s.serviceDetails?.plan ?? null,
          suspendido: s.suspended === "suspended",
          ultimoDeploy: d ? { estado: d.status, fecha: d.finishedAt ?? d.createdAt } : null,
        };
      } catch {
        return { nombre: s.name, tipo: s.type, plan: s.serviceDetails?.plan ?? null, suspendido: s.suspended === "suspended", ultimoDeploy: null };
      }
    })
  );
  return { disponible: true, servicios };
}

// ---------------------------------------------------------------
// Cloudflare — zonas (dominios) con su estado/plan + tráfico de los
// últimos 7 días vía GraphQL Analytics (23-sep-2026). Token con
// permisos "Zone:Read" y "Analytics:Read" (CLOUDFLARE_API_TOKEN). El
// tráfico es best-effort: si el token no tiene Analytics, la zona se
// muestra igual sin esos números.
// ---------------------------------------------------------------
type ZonaCloudflare = { id: string; name: string; status: string; plan?: { name?: string } };

export async function obtenerEstadoCloudflare(): Promise<EstadoServicioInfra> {
  if (!env.CLOUDFLARE_API_TOKEN) return { disponible: false, motivo: "Falta CLOUDFLARE_API_TOKEN" };
  const headers = { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" };

  const resZonas = await fetch("https://api.cloudflare.com/client/v4/zones?per_page=20", { headers });
  const cuerpo = (await resZonas.json().catch(() => ({}))) as { success?: boolean; result?: ZonaCloudflare[]; errors?: { message: string }[] };
  if (!resZonas.ok || !cuerpo.success) {
    return { disponible: false, motivo: cuerpo.errors?.[0]?.message ?? `Error ${resZonas.status} listando zonas` };
  }

  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const zonas = await Promise.all(
    (cuerpo.result ?? []).map(async (z) => {
      let requests7d: number | null = null;
      let bytes7d: number | null = null;
      try {
        const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
          method: "POST",
          headers,
          body: JSON.stringify({
            query:
              "query($zona: String!, $desde: Date!) { viewer { zones(filter: { zoneTag: $zona }) { httpRequests1dGroups(limit: 7, filter: { date_geq: $desde }) { sum { requests bytes } } } } }",
            variables: { zona: z.id, desde },
          }),
        });
        if (r.ok) {
          const g = (await r.json()) as {
            data?: { viewer?: { zones?: { httpRequests1dGroups?: { sum: { requests: number; bytes: number } }[] }[] } };
          };
          const grupos = g.data?.viewer?.zones?.[0]?.httpRequests1dGroups;
          if (grupos) {
            requests7d = grupos.reduce((n, x) => n + x.sum.requests, 0);
            bytes7d = grupos.reduce((n, x) => n + x.sum.bytes, 0);
          }
        }
      } catch {
        /* best-effort */
      }
      return { nombre: z.name, estado: z.status, plan: z.plan?.name ?? null, requests7d, bytes7d };
    })
  );
  return { disponible: true, zonas };
}
