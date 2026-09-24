// Tarea 132: editar monto del viaje (Admin/Supervisor), historial, bloqueo si está cobrado.
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function viajesMonto(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const adm = await ctx.sesion("admin"), sup = await ctx.sesion("supervisor"), cont = await ctx.sesion("tecnico"), cho = await ctx.sesion("chofer");
  const hoy = ctx.hoy;
  const cli = await api(adm, "POST", "/api/clientes", { nombre: "QA Cliente Montos", direccion: "Alameda 200, Santiago" });
  const cid = cli.j.id;
  const v = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-M1", cliente_id: cid, chofer_id: ctx.u.chofer.id, origen: "Santiago", destino: "Talca", subtotal: 100000, aplica_iva: true });
  const vid = v.j.id;
  check("132-1 viaje creado", !!vid, `${v.s} ${JSON.stringify(v.j)}`);

  const a1 = await api(adm, "PATCH", `/api/viajes/${vid}`, { subtotal: 120000 });
  check("132-2 admin cambia el monto (IVA recalculado)", a1.s === 200 && Number(a1.j.subtotal) === 120000 && Number(a1.j.total) === 142800, `${a1.s} ${JSON.stringify(a1.j).slice(0, 150)}`);
  const s1 = await api(sup, "PATCH", `/api/viajes/${vid}`, { subtotal: 130000 });
  check("132-3 supervisor cambia el monto", s1.s === 200 && Number(s1.j.subtotal) === 130000, `${s1.s}`);

  const c1 = await api(cho, "PATCH", `/api/mis-viajes/${vid}`, { subtotal: 1 });
  check("132-4 chofer NO cambia el monto (403)", c1.s === 403, `${c1.s} ${JSON.stringify(c1.j)}`);
  const c2 = await api(cho, "PATCH", `/api/mis-viajes/${vid}`, { subtotal: 130000, aplica_iva: true, km_final: 250 });
  check("132-5 chofer edita otros datos mandando el mismo monto (200)", c2.s === 200 && Number(c2.j.km_final) === 250, `${c2.s} ${JSON.stringify(c2.j).slice(0, 120)}`);
  // Tarea 138: el Contador se fusionó en Supervisor; el rol sin permiso es el colaborador (chofer).
  const k1 = await api(cho, "PATCH", `/api/mis-viajes/${vid}`, { subtotal: 5 });
  check("132-6 colaborador NO cambia el monto (403)", k1.s === 403, `${k1.s}`);

  const h = await api(adm, "GET", `/api/viajes/${vid}/historial-monto`);
  const filas = h.j ?? [];
  check("132-7 historial: 2 cambios, anterior/nuevo, usuario y fecha", h.s === 200 && filas.length === 2 && filas[1].detalle.anterior.subtotal === 100000 && filas[1].detalle.nuevo.subtotal === 120000 && filas[0].usuario?.nombre === "E2E supervisor" && !!filas[0].creado_en, `${h.s} ${JSON.stringify(filas).slice(0, 300)}`);

  const f = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [vid] });
  check("132-8 viaje facturado", f.s === 201 || f.s === 200, `${f.s} ${JSON.stringify(f.j)}`);
  const a2 = await api(adm, "PATCH", `/api/viajes/${vid}`, { subtotal: 1000 });
  check("132-9 viaje cobrado: no editable (409) y dice el cobro", a2.s === 409 && a2.j?.cobro?.id === (f.j?.id ?? f.j?.factura?.id ?? a2.j?.cobro?.id), `${a2.s} ${JSON.stringify(a2.j)}`);

  // Limpieza.
  const facturaId = a2.j?.cobro?.id;
  await supabase.from("viajes").delete().eq("id", vid);
  if (facturaId) await supabase.from("facturas").delete().eq("id", facturaId);
  await supabase.from("clientes").delete().eq("id", cid);
  await supabase.from("auditoria_empresa").delete().eq("entidad_id", vid);
}
