// Tarea 131: eliminar clientes (solo Admin, sin historial; auditoría).
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function clientesEliminar(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const adm = await ctx.sesion("admin"), sup = await ctx.sesion("supervisor"), cont = await ctx.sesion("tecnico");
  const hoy = ctx.hoy;

  const c1 = await api(adm, "POST", "/api/clientes", { nombre: "QA Cliente Sin Historial", direccion: "Av. Providencia 1234, Santiago" });
  check("131-1 crear cliente sin historial", c1.s === 201 || c1.s === 200, `${c1.s} ${JSON.stringify(c1.j)}`);
  const id1 = c1.j?.id;
  const uso1 = await api(adm, "GET", `/api/clientes/${id1}/uso`);
  check("131-2 uso: eliminable", uso1.s === 200 && uso1.j.eliminable === true, JSON.stringify(uso1.j));
  const dSup = await api(sup, "DELETE", `/api/clientes/${id1}`);
  check("131-3 supervisor no puede eliminar (403)", dSup.s === 403, `${dSup.s}`);
  const uCont = await api(cont, "GET", `/api/clientes/${id1}/uso`);
  check("131-4 técnico no ve el uso (403)", uCont.s === 403, `${uCont.s}`);
  const dAdm = await api(adm, "DELETE", `/api/clientes/${id1}`);
  check("131-5 admin elimina (204)", dAdm.s === 204, `${dAdm.s} ${JSON.stringify(dAdm.j)}`);
  const g = await api(adm, "GET", `/api/clientes/${id1}`);
  check("131-6 el cliente ya no existe (404)", g.s === 404, `${g.s}`);
  const { data: aud } = await supabase.from("auditoria_empresa").select("*").eq("entidad", "cliente").eq("entidad_id", id1);
  check("131-7 auditoría: quién, cuándo y qué cliente", aud?.length === 1 && aud[0].usuario_id === ctx.u.admin.id && aud[0].detalle?.nombre === "QA Cliente Sin Historial" && !!aud[0].creado_en, JSON.stringify(aud));

  const c2 = await api(adm, "POST", "/api/clientes", { nombre: "QA Cliente Con Viaje", direccion: "Alameda 100, Santiago" });
  const id2 = c2.j?.id;
  const v = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-1", cliente_id: id2, origen: "Santiago", destino: "Rancagua", subtotal: 100000, aplica_iva: true });
  check("131-8 viaje del cliente creado", v.s === 201 || v.s === 200, `${v.s} ${JSON.stringify(v.j)}`);
  const uso2 = await api(adm, "GET", `/api/clientes/${id2}/uso`);
  check("131-9 uso: no eliminable, 1 viaje", uso2.j?.eliminable === false && uso2.j.uso?.[0]?.cantidad === 1, JSON.stringify(uso2.j));
  const d2 = await api(adm, "DELETE", `/api/clientes/${id2}`);
  check("131-10 con historial → 409 con el detalle", d2.s === 409 && d2.j?.code === "CLIENTE_CON_HISTORIAL" && Array.isArray(d2.j.uso), `${d2.s} ${JSON.stringify(d2.j)}`);
  const g2 = await api(adm, "GET", `/api/clientes/${id2}`);
  check("131-11 el cliente con historial sigue existiendo", g2.s === 200, `${g2.s}`);

  // Limpieza.
  if (v.j?.id) await supabase.from("viajes").delete().eq("id", v.j.id);
  await supabase.from("clientes").delete().eq("id", id2);
  await supabase.from("auditoria_empresa").delete().eq("entidad_id", id1);
}
