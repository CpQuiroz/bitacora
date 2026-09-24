// Tarea 137: viáticos por viaje → gasto "Viáticos", resumen por chofer, pagar, bloqueos.
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function viaticos(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const U = ctx.u;
  const E = ctx.empresaId;
  const adm = await ctx.sesion("admin"), sup = await ctx.sesion("supervisor"), cho = await ctx.sesion("chofer");
  const hoy = ctx.hoy;
  const { data: empAntes } = await supabase.from("empresas").select("viatico_local_monto, viatico_interregional_monto").eq("id", E).single();

  // Config por defecto
  const cfgSup = await api(sup, "PATCH", "/api/viajes/config", { viatico_local_monto: 1 });
  check("137-1 supervisor no cambia montos por defecto (403)", cfgSup.s === 403, `${cfgSup.s}`);
  const cfg = await api(adm, "PATCH", "/api/viajes/config", { viatico_local_monto: 15000, viatico_interregional_monto: "35000" });
  check("137-2 admin guarda montos por defecto", cfg.s === 200 && Number(cfg.j.viatico_local_monto) === 15000 && Number(cfg.j.viatico_interregional_monto) === 35000, JSON.stringify(cfg.j));
  const cfgMala = await api(adm, "PATCH", "/api/viajes/config", { viatico_local_monto: -5 });
  check("137-3 monto negativo → 400", cfgMala.s === 400, `${cfgMala.s}`);

  const c = await api(adm, "POST", "/api/clientes", { nombre: "QA Cliente Viáticos", direccion: "Alameda 300, Santiago" });
  const cid = c.j.id;

  // Sin chofer → 400
  const sinCho = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-V0", cliente_id: cid, origen: "Santiago", destino: "Maipú", subtotal: 50000, viatico_tipo: "local", viatico_monto: 15000 });
  check("137-4 viático sin chofer → 400", sinCho.s === 400, `${sinCho.s} ${JSON.stringify(sinCho.j)}`);
  const tipoMalo = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-V0", cliente_id: cid, chofer_id: U.chofer.id, origen: "Santiago", destino: "Maipú", subtotal: 50000, viatico_tipo: "nacional", viatico_monto: 1 });
  check("137-5 tipo inválido → 400", tipoMalo.s === 400, `${tipoMalo.s}`);

  // Crear con viático → gasto
  const v = await api(sup, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-V1", cliente_id: cid, chofer_id: U.chofer.id, origen: "Santiago", destino: "Maipú", subtotal: 50000, viatico_tipo: "local", viatico_monto: 15000 });
  const vid = v.j?.id;
  const gastoDe = async () => (await supabase.from("gastos").select("*").eq("viaje_id", vid).eq("es_viatico", true)).data ?? [];
  let g = await gastoDe();
  check("137-6 supervisor crea viaje con viático → 1 gasto Viáticos pendiente", v.s === 201 && g.length === 1 && g[0].categoria === "Viáticos" && Number(g[0].monto) === 15000 && g[0].estado === "pendiente" && g[0].fecha === hoy && !!g[0].categoria_gasto_id, `${v.s} ${JSON.stringify(g)}`);

  // Editar viático → actualiza el mismo gasto
  const e1 = await api(adm, "PATCH", `/api/viajes/${vid}`, { viatico_tipo: "interregional", viatico_monto: 35000, destino: "Rancagua" });
  const g2 = await gastoDe();
  check("137-7 editar viático actualiza el mismo gasto", e1.s === 200 && g2.length === 1 && g2[0].id === g[0].id && Number(g2[0].monto) === 35000 && !!g2[0].descripcion?.includes("interregional"), `${e1.s} ${JSON.stringify(g2)}`);

  // Gasto: no se cambia el monto desde Gastos
  const pg = await api(adm, "PATCH", `/api/gastos/${g[0].id}`, { monto: 1000 });
  check("137-8 monto del viático no se edita desde Gastos (409)", pg.s === 409, `${pg.s}`);
  const pgMismo = await api(adm, "PATCH", `/api/gastos/${g[0].id}`, { monto: 35000, descripcion: "nota" });
  check("137-9 guardar el gasto sin cambiar el monto sí se puede", pgMismo.s === 200, `${pgMismo.s} ${JSON.stringify(pgMismo.j)}`);

  // Chofer no toca el viático (mis-viajes lo ignora)
  const chPatch = await api(cho, "PATCH", `/api/mis-viajes/${vid}`, { numero_guia: "QA-V1b", viatico_tipo: "local", viatico_monto: 1 });
  const { data: vChofer } = await supabase.from("viajes").select("viatico_tipo, viatico_monto").eq("id", vid).single();
  const g3 = await gastoDe();
  check("137-10 chofer no cambia el viático; el gasto sigue la guía", chPatch.s === 200 && vChofer?.viatico_tipo === "interregional" && !!g3[0]?.descripcion?.includes("QA-V1b"), `${chPatch.s} ${JSON.stringify(vChofer)} ${g3[0]?.descripcion}`);
  const chPost = await api(cho, "POST", "/api/viajes", { fecha: hoy, numero_guia: "X", cliente_id: cid, origen: "a", destino: "b", subtotal: 1, viatico_tipo: "local", viatico_monto: 1 });
  check("137-11 chofer no entra a /api/viajes (403)", chPost.s === 403, `${chPost.s}`);
  const chRes = await api(cho, "GET", `/api/gastos/viaticos?desde=${hoy}&hasta=${hoy}`);
  check("137-12 chofer no ve el resumen de viáticos (403)", chRes.s === 403, `${chRes.s}`);

  // Segundo viaje para otro chofer
  const v2 = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-V2", cliente_id: cid, chofer_id: U.chofer2.id, origen: "Santiago", destino: "Talca", subtotal: 80000, viatico_tipo: "interregional", viatico_monto: 20000 });
  const v2id = v2.j?.id;

  // Resumen
  const rs = await api(adm, "GET", `/api/gastos/viaticos?desde=${hoy}&hasta=${hoy}&agrupar=semana`);
  const f1 = rs.j?.find((f: any) => f.chofer_id === U.chofer.id);
  const f2 = rs.j?.find((f: any) => f.chofer_id === U.chofer2.id);
  const idsPropios = new Set(Object.values(U).map((u: any) => u.id));
  check("137-13 resumen semanal por chofer (pendiente)", rs.s === 200 && f1?.total === 35000 && f1.pendiente === 35000 && f2?.total === 20000 && f1.cantidad === 1, `${rs.s} ${JSON.stringify(rs.j)}`);
  check("137-14 resumen solo trae choferes de la empresa", rs.s === 200 && rs.j.every((f: any) => !f.chofer_id || idsPropios.has(f.chofer_id)), JSON.stringify(rs.j));
  const rm = await api(adm, "GET", `/api/gastos/viaticos?desde=${hoy.slice(0, 8)}01&hasta=${hoy}&agrupar=mes`);
  check("137-15 resumen mensual agrupa en el día 1", rm.s === 200 && rm.j.every((f: any) => f.periodo.endsWith("-01")), JSON.stringify(rm.j));
  const rMalo = await api(adm, "GET", `/api/gastos/viaticos?desde=2026-12-01&hasta=2026-01-01`);
  check("137-16 rango inválido → 400", rMalo.s === 400, `${rMalo.s}`);

  // Pagar al chofer 1
  const pay = await api(adm, "POST", "/api/gastos/viaticos/pagar", { chofer_id: U.chofer.id, desde: hoy, hasta: hoy });
  const g4 = await gastoDe();
  const { data: g5 } = await supabase.from("gastos").select("estado").eq("viaje_id", v2id).eq("es_viatico", true).single();
  check("137-17 marcar pagado solo afecta a ese chofer", pay.s === 200 && pay.j.pagados >= 1 && g4[0]?.estado === "pagado" && !!g4[0]?.fecha_pago && g5?.estado === "pendiente", `${pay.s} ${JSON.stringify(pay.j)} ${g5?.estado}`);

  // Bloqueos con viático pagado
  const b1 = await api(adm, "PATCH", `/api/viajes/${vid}`, { viatico_monto: 1, viatico_tipo: "interregional" });
  check("137-18 viático pagado: no se cambia (409)", b1.s === 409, `${b1.s} ${JSON.stringify(b1.j)}`);
  const b2 = await api(adm, "PATCH", `/api/viajes/${vid}`, { chofer_id: U.chofer2.id });
  check("137-19 viático pagado: no se cambia el chofer (409)", b2.s === 409, `${b2.s}`);
  const b3 = await api(adm, "DELETE", `/api/viajes/${vid}`);
  check("137-20 viático pagado: no se borra el viaje (409)", b3.s === 409, `${b3.s} ${JSON.stringify(b3.j)}`);
  const b4 = await api(adm, "PATCH", `/api/viajes/${vid}`, { comentarios: "ok" });
  check("137-21 viático pagado: el resto del viaje sí se edita", b4.s === 200, `${b4.s}`);

  // Deshacer pago en Gastos → se puede quitar el viático
  await api(adm, "PATCH", `/api/gastos/${g[0].id}`, { estado: "pendiente" });
  const q = await api(adm, "PATCH", `/api/viajes/${vid}`, { viatico_tipo: null });
  check("137-22 quitar viático borra su gasto pendiente", q.s === 200 && (await gastoDe()).length === 0 && q.j.viatico_tipo === null, `${q.s}`);

  // Borrar viaje con viático pendiente → borra el gasto
  const d2 = await api(adm, "DELETE", `/api/viajes/${v2id}`);
  const { data: g6 } = await supabase.from("gastos").select("id").eq("viaje_id", v2id);
  const { data: huerf } = await supabase.from("gastos").select("id").eq("empresa_id", E).eq("es_viatico", true).is("viaje_id", null);
  check("137-23 borrar viaje con viático pendiente borra el gasto (sin huérfanos)", d2.s === 204 && (g6?.length ?? 0) === 0 && (huerf?.length ?? 0) === 0, `${d2.s} ${JSON.stringify(huerf)}`);

  // Reasignar chofer con viático pendiente → el resumen pasa al chofer nuevo
  const v3 = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-V3", cliente_id: cid, chofer_id: U.chofer.id, origen: "Santiago", destino: "Puente Alto", subtotal: 30000, viatico_tipo: "local", viatico_monto: 12000 });
  const v3id = v3.j?.id;
  const re = await api(adm, "PATCH", `/api/viajes/${v3id}`, { chofer_id: U.chofer2.id });
  const rs2 = await api(adm, "GET", `/api/gastos/viaticos?desde=${hoy}&hasta=${hoy}&agrupar=semana`);
  const deChofer1 = rs2.j?.find((f: any) => f.chofer_id === U.chofer.id);
  const deChofer2 = rs2.j?.find((f: any) => f.chofer_id === U.chofer2.id);
  const { data: g7 } = await supabase.from("gastos").select("descripcion").eq("viaje_id", v3id).eq("es_viatico", true).single();
  check("137-24 reasignar chofer: el viático pendiente pasa al chofer nuevo", re.s === 200 && (deChofer1?.pendiente ?? 0) === 0 && deChofer2?.pendiente === 12000 && !!g7, `${re.s} ${JSON.stringify(rs2.j)} ${g7?.descripcion}`);

  // Dos guardados simultáneos con montos distintos → un solo gasto, igual al viaje
  const [p1, p2] = await Promise.all([
    api(adm, "PATCH", `/api/viajes/${v3id}`, { viatico_tipo: "interregional", viatico_monto: 40000 }),
    api(sup, "PATCH", `/api/viajes/${v3id}`, { viatico_tipo: "interregional", viatico_monto: 41000 }),
  ]);
  const { data: g8 } = await supabase.from("gastos").select("monto").eq("viaje_id", v3id).eq("es_viatico", true);
  const { data: v3db } = await supabase.from("viajes").select("viatico_monto").eq("id", v3id).single();
  check("137-25 guardados simultáneos: un gasto y coincide con el viaje", p1.s === 200 && p2.s === 200 && g8?.length === 1 && Number(g8[0].monto) === Number(v3db?.viatico_monto), `${JSON.stringify(g8)} ${JSON.stringify(v3db)}`);

  // Pagar y borrar a la vez → o se paga (y el viaje queda) o se borra todo; nunca un gasto sin viaje
  const [pp, dd] = await Promise.all([
    api(adm, "POST", "/api/gastos/viaticos/pagar", { chofer_id: U.chofer2.id, desde: hoy, hasta: hoy }),
    api(sup, "DELETE", `/api/viajes/${v3id}`),
  ]);
  const { data: v3fin } = await supabase.from("viajes").select("id").eq("id", v3id);
  const { data: huerf2 } = await supabase.from("gastos").select("id").eq("empresa_id", E).eq("es_viatico", true).is("viaje_id", null);
  const coherente = (dd.s === 204 && (v3fin?.length ?? 0) === 0) || (dd.s === 409 && (v3fin?.length ?? 0) === 1);
  check("137-26 pagar y borrar a la vez: sin gastos sueltos", pp.s === 200 && coherente && (huerf2?.length ?? 0) === 0, `pagar ${pp.s} borrar ${dd.s} viaje=${v3fin?.length} huerfanos=${huerf2?.length}`);

  // Limpieza
  await supabase.from("gastos").delete().eq("empresa_id", E).eq("es_viatico", true).eq("viaje_id", v3id);
  await supabase.from("viajes").delete().eq("id", v3id);
  await supabase.from("viajes").delete().eq("id", vid);
  await supabase.from("gastos").delete().eq("empresa_id", E).eq("es_viatico", true).in("viaje_id", [vid, v2id]);
  await supabase.from("clientes").delete().eq("id", cid);
  await supabase.from("auditoria_empresa").delete().in("entidad_id", [vid, v2id, v3id].filter(Boolean));
  await supabase.from("notificaciones").delete().in("entidad_id", [vid, v2id, v3id].filter(Boolean));
  await supabase.from("empresas").update(empAntes!).eq("id", E);
}
