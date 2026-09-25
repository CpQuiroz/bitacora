// Tarea 135 (etapa 4): cotización de viaje y "Convertir en viaje".
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function cotizacionViaje(ctx: Ctx): Promise<void> {
  const { check, api, hoy } = ctx;
  const adm = await ctx.sesion("admin");
  const tec = await ctx.sesion("tecnico");
  const c = await api(adm, "POST", "/api/clientes", { nombre: "E2E Cliente Cotiza", direccion: "Alameda 700, Santiago" });
  const cid = c.j?.id;
  await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Santiago", destino: "Valparaíso", precio: 150000 });
  await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Valparaíso", destino: "La Serena", precio: 350000 });

  const cot = await api(adm, "POST", "/api/cotizaciones", {
    cliente_id: cid, tipo: "viaje",
    viaje: { fecha: hoy, origen: "Santiago", destino: "La Serena", paradas: ["Valparaíso"], modo_precio: "tramos", monto: 500000 },
  });
  check("135-40 cotización de viaje: un ítem con el recorrido y los datos del viaje", cot.s === 201 && cot.j.tipo === "viaje" && cot.j.items?.[0]?.descripcion === "Viaje Santiago → Valparaíso → La Serena" && Number(cot.j.subtotal) === 500000 && cot.j.viaje_datos?.tramos_detalle?.length === 2, `${cot.s} ${JSON.stringify(cot.j).slice(0, 300)}`);
  const cotTec = await api(tec, "POST", "/api/cotizaciones", { cliente_id: cid, tipo: "viaje", viaje: { origen: "A", destino: "B", monto: 1 } });
  check("135-41 sin permiso de precios no cotiza viajes (403)", cotTec.s === 403, `${cotTec.s}`);
  const sinMonto = await api(adm, "POST", "/api/cotizaciones", { cliente_id: cid, tipo: "viaje", viaje: { origen: "Santiago", destino: "Talca" } });
  check("135-42 sin monto → 400", sinMonto.s === 400, `${sinMonto.s}`);

  const antes = await api(adm, "POST", `/api/cotizaciones/${cot.j.id}/convertir-a-viaje`);
  check("135-43 no aprobada → no se convierte (400)", antes.s === 400, `${antes.s}`);
  const apr = await api(adm, "PATCH", `/api/cotizaciones/${cot.j.id}`, { estado: "aprobado" });
  const conv = await api(adm, "POST", `/api/cotizaciones/${cot.j.id}/convertir-a-viaje`);
  const { data: viaje } = await supabase.from("viajes").select("*").eq("id", conv.j?.viaje_id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  check("135-44 aprobada → viaje en borrador con el mismo precio y recorrido", apr.s === 200 && conv.s === 201 && viaje?.estado === "borrador" && Number(viaje.subtotal) === 500000 && viaje.modo_precio === "tramos" && viaje.origen === "Santiago" && viaje.destino === "La Serena" && viaje.cliente_id === cid, `${apr.s} ${conv.s} ${JSON.stringify(viaje).slice(0, 250)}`);
  const otra = await api(adm, "POST", `/api/cotizaciones/${cot.j.id}/convertir-a-viaje`);
  check("135-45 no se convierte dos veces (409)", otra.s === 409, `${otra.s}`);

  const serv = await api(adm, "POST", "/api/cotizaciones", { cliente_id: cid, items: [{ descripcion: "Mantención", cantidad: 1, precio_unitario: 10000 }] });
  await api(adm, "PATCH", `/api/cotizaciones/${serv.j.id}`, { estado: "aprobado" });
  const servConv = await api(adm, "POST", `/api/cotizaciones/${serv.j.id}/convertir-a-viaje`);
  check("135-46 una cotización de servicio no se convierte en viaje (400)", serv.j?.tipo === "servicio" && servConv.s === 400, `${serv.j?.tipo} ${servConv.s}`);
}
