// Tarea 133: Admin crea viaje y asigna chofer; pizarra/agenda; reasignación; aviso; validaciones.
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function viajesAsignarChofer(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const adm = await ctx.sesion("admin"), sup = await ctx.sesion("supervisor"), cho = await ctx.sesion("chofer"), cho2 = await ctx.sesion("chofer2");
  const U = ctx.u;
  const hoy = ctx.hoy;
  const cli = await api(adm, "POST", "/api/clientes", { nombre: "QA Cliente Asignación", direccion: "Alameda 300, Santiago" });
  const cid = cli.j.id;

  const v = await api(adm, "POST", "/api/viajes", { fecha: hoy, hora: "08:30", numero_guia: "QA-A1", cliente_id: cid, chofer_id: U.chofer.id, origen: "Santiago", destino: "Valparaíso", subtotal: 90000 });
  check("133-1 admin crea viaje con chofer y hora", v.s === 201 && v.j.chofer_id === U.chofer.id && v.j.hora === "08:30:00", `${v.s} ${JSON.stringify(v.j).slice(0, 200)}`);
  const vid = v.j.id;

  const { data: notif } = await supabase.from("notificaciones").select("*").eq("usuario_id", U.chofer.id).eq("tipo", "viaje_asignado").eq("entidad_id", vid);
  check("133-2 aviso al chofer (campana)", notif?.length === 1 && notif[0].entidad_tipo === "viaje", JSON.stringify(notif));

  const piz = await api(cho, "GET", "/api/mis-viajes");
  check("133-3 el chofer lo ve en la pizarra (mis-viajes)", piz.s === 200 && piz.j.some((x: any) => x.id === vid && x.hora === "08:30:00"), `${piz.s}`);
  const ag = await api(cho, "GET", `/api/mis-viajes?equipo=true&desde=${hoy}&hasta=${hoy}`);
  check("133-4 el chofer lo ve en su agenda (rango, solo los suyos)", ag.s === 200 && ag.j.some((x: any) => x.id === vid) && ag.j.every((x: any) => x.chofer_id === U.chofer.id), `${ag.s} ${ag.j?.length}`);
  const agOtro = await api(cho2, "GET", `/api/mis-viajes?equipo=true&desde=${hoy}&hasta=${hoy}`);
  check("133-5 otro chofer NO lo ve", agOtro.s === 200 && !agOtro.j.some((x: any) => x.id === vid), `${agOtro.s}`);

  const re = await api(sup, "PATCH", `/api/viajes/${vid}`, { chofer_id: U.chofer2.id });
  check("133-6 supervisor reasigna al chofer 2", re.s === 200 && re.j.chofer_id === U.chofer2.id, `${re.s} ${JSON.stringify(re.j).slice(0, 150)}`);
  const antes = await api(cho, "GET", "/api/mis-viajes");
  const ahora = await api(cho2, "GET", "/api/mis-viajes");
  check("133-7 desaparece del anterior y aparece en el nuevo", !antes.j.some((x: any) => x.id === vid) && ahora.j.some((x: any) => x.id === vid), "");
  const { data: notif2 } = await supabase.from("notificaciones").select("id").eq("usuario_id", U.chofer2.id).eq("tipo", "viaje_asignado").eq("entidad_id", vid);
  check("133-8 aviso al nuevo chofer", notif2?.length === 1, JSON.stringify(notif2));

  const noChofer = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-A2", cliente_id: cid, chofer_id: U.tecnico.id, origen: "A", destino: "B", subtotal: 1 });
  check("133-9 asignar a alguien sin función Chofer → 400", noChofer.s === 400, `${noChofer.s} ${JSON.stringify(noChofer.j)}`);
  const { data: otraEmp } = await supabase.from("usuarios").select("id").neq("empresa_id", ctx.empresaId).limit(1).single();
  const otra = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "QA-A3", cliente_id: cid, chofer_id: otraEmp!.id, origen: "A", destino: "B", subtotal: 1 });
  check("133-10 chofer de OTRA empresa → 400 (antes se aceptaba)", otra.s === 400, `${otra.s}`);
  const horaMala = await api(adm, "PATCH", `/api/viajes/${vid}`, { hora: "25:99" });
  check("133-11 hora inválida → 400", horaMala.s === 400, `${horaMala.s}`);
  const mismo = await api(adm, "PATCH", `/api/viajes/${vid}`, { chofer_id: U.chofer2.id, numero_guia: "QA-A1b" });
  check("133-12 editar sin cambiar chofer no re-avisa ni falla", mismo.s === 200, `${mismo.s}`);

  // Limpieza.
  await supabase.from("notificaciones").delete().eq("entidad_id", vid);
  await supabase.from("viajes").delete().eq("id", vid);
  await supabase.from("clientes").delete().eq("id", cid);
}
