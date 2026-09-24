// Casos agregados por la revisión de la Parte A (B4, M1, M2).
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function revisionParteA(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const adm = await ctx.sesion("admin");
  const hoy = ctx.hoy;

  // B4: una cita de agenda cuenta como historial.
  const c = await api(adm, "POST", "/api/clientes", { nombre: "QA Cliente Con Cita", direccion: "Alameda 200, Santiago" });
  const { data: t } = await supabase.from("tareas").insert({ empresa_id: ctx.empresaId, titulo: "QA cita", fecha: hoy, cliente_id: c.j.id }).select("id").single();
  const d = await api(adm, "DELETE", `/api/clientes/${c.j.id}`);
  check("R-1 cliente con 1 cita → 409 y la nombra", d.s === 409 && JSON.stringify(d.j.uso).includes("citas de agenda"), `${d.s} ${JSON.stringify(d.j)}`);

  // M2: un viaje en borrador no se puede cobrar.
  const v = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-R1", cliente_id: c.j.id, origen: "Santiago", destino: "Talca", subtotal: 50000, aplica_iva: true, estado: "borrador" });
  await supabase.from("viajes").update({ estado: "borrador" }).eq("id", v.j.id);
  const f = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [v.j.id] });
  const libre = (await supabase.from("viajes").select("factura_id").eq("id", v.j.id).single()).data?.factura_id === null;
  check("R-2 viaje en borrador → 400 y sigue libre", f.s === 400 && libre, `${f.s} ${JSON.stringify(f.j)}`);

  // M1: borrar el cobro libera sus viajes.
  await supabase.from("viajes").update({ estado: "confirmado" }).eq("id", v.j.id);
  const f2 = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [v.j.id] });
  const cobroId = f2.j?.id ?? f2.j?.cobro?.id ?? f2.j?.factura_id;
  check("R-3 viaje confirmado se cobra", f2.s === 201 || f2.s === 200, `${f2.s} ${JSON.stringify(f2.j)}`);
  const del = await api(adm, "DELETE", `/api/cobros/${cobroId}`);
  const vv = (await supabase.from("viajes").select("estado, factura_id").eq("id", v.j.id).single()).data;
  check("R-4 borrar cobro → viaje libre y confirmado", (del.s === 204 || del.s === 200) && vv?.factura_id === null && vv?.estado === "confirmado", `${del.s} ${JSON.stringify(vv)}`);

  await supabase.from("viajes").delete().eq("id", v.j.id);
  await supabase.from("tareas").delete().eq("id", t!.id);
  await supabase.from("clientes").delete().eq("id", c.j.id);
}
