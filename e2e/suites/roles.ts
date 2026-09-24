// Tarea 138: el Contador se fusionó en Supervisor (un solo rol, 2FA opcional).
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function roles(ctx: Ctx): Promise<void> {
  const { check, api, hoy } = ctx;
  const { data: filas } = await supabase.from("roles").select("slug, modulos, requiere_2fa");
  const sup = filas?.find((r) => r.slug === "supervisor");
  check("138-1 ya no existe el rol Contador", !!filas && !filas.some((r) => r.slug === "contador"), JSON.stringify(filas?.map((r) => r.slug)));
  const tiene = ["agenda", "ordenes_servicio", "viajes", "financiero", "cotizaciones", "cobros", "informes"].every((m) => sup?.modulos.includes(m));
  check("138-2 Supervisor contiene lo del Contador y lo suyo; 2FA opcional", tiene && sup?.requiere_2fa === false, JSON.stringify(sup));
  const ts = await ctx.sesion("supervisor");
  const adm = await ctx.sesion("admin");
  const mfaSup = await api(ts, "GET", "/api/usuarios/me/mfa");
  const mfaAdm = await api(adm, "GET", "/api/usuarios/me/mfa");
  check("138-3 2FA exigido: admin sí, supervisor no", mfaSup.j?.exigido === false && mfaAdm.j?.exigido === true, `${JSON.stringify(mfaSup.j)} ${JSON.stringify(mfaAdm.j)}`);
  const v = await api(ts, "GET", "/api/viajes");
  const g = await api(ts, "GET", `/api/gastos/viaticos?desde=${hoy}&hasta=${hoy}`);
  check("138-4 supervisor entra a Viajes y a Gastos › Viáticos", v.s === 200 && g.s === 200, `${v.s} ${g.s}`);
  const sel = await api(adm, "GET", "/api/usuarios/roles");
  check("138-5 el selector de roles ya no ofrece Contador", sel.s === 200 && !sel.j.some((r: { slug: string }) => r.slug === "contador"), JSON.stringify(sel.j));
}
