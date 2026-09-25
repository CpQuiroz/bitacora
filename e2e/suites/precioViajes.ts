// Tarea 135 (etapas 2 y 3): forma de cobro del viaje, costos ocultos al chofer,
// forma de cobro por defecto del cliente, km y paradas en el cobro.
import { supabase } from "../../backend/src/supabase";
import type { Ctx } from "../entorno";

export async function precioViajes(ctx: Ctx): Promise<void> {
  const { check, api, hoy, u } = ctx;
  const adm = await ctx.sesion("admin");
  const cho = await ctx.sesion("chofer");
  const c = await api(adm, "POST", "/api/clientes", { nombre: "E2E Cliente Precio", direccion: "Alameda 600, Santiago" });
  const cid = c.j?.id;
  await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Santiago", destino: "Concepción", precio: 300000 });
  await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Concepción", destino: "Temuco", precio: 200000 });
  await api(adm, "PUT", "/api/viajes/tarifas/km", { precio_km: 1000 });

  const vt = await api(adm, "POST", "/api/viajes", {
    fecha: hoy, numero_guia: "E2E-T1", cliente_id: cid, chofer_id: u.chofer.id, origen: "x", destino: "y",
    subtotal: 510000, modo_precio: "tramos", paradas: ["Santiago", "Concepción", "Temuco"],
  });
  check("135-20 viaje por tramos: guarda el detalle y va del primer al último punto", vt.s === 201 && vt.j.modo_precio === "tramos" && vt.j.tramos_detalle?.length === 2 && vt.j.origen === "Santiago" && vt.j.destino === "Temuco" && Number(vt.j.subtotal) === 510000, `${vt.s} ${JSON.stringify(vt.j).slice(0, 300)}`);
  const vk = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "E2E-K1", cliente_id: cid, origen: "Santiago", destino: "Rancagua", subtotal: 87000, modo_precio: "km", distancia_km: 87 });
  check("135-21 viaje por km: guarda km y precio por km", vk.s === 201 && Number(vk.j.distancia_km) === 87 && Number(vk.j.precio_km) === 1000, `${vk.s} ${JSON.stringify(vk.j).slice(0, 200)}`);
  const kmMalo = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "E2E-K2", cliente_id: cid, origen: "A", destino: "B", subtotal: 1, modo_precio: "km" });
  check("135-22 por km sin km → 400", kmMalo.s === 400, `${kmMalo.s}`);

  const piz = await api(cho, "GET", "/api/mis-viajes");
  const suyo = piz.j?.find((v: { id: string }) => v.id === vt.j.id);
  check("135-23 el chofer ve su viaje sin tarifas ni detalle de tramos", !!suyo && !("tramos_detalle" in suyo) && !("precio_km" in suyo), JSON.stringify(suyo ?? null).slice(0, 200));
  const det = await api(cho, "GET", `/api/mis-viajes/${vt.j.id}`);
  check("135-24 tampoco en el detalle", det.s === 200 && !("tramos_detalle" in det.j) && !("precio_km" in det.j), `${det.s}`);

  const fijo = await api(adm, "PATCH", `/api/viajes/${vk.j.id}`, { modo_precio: "fijo" });
  check("135-25 volver a monto fijo limpia km y precio por km", fijo.s === 200 && fijo.j.modo_precio === "fijo" && fijo.j.distancia_km === null && fijo.j.precio_km === null, `${fijo.s}`);

  const md = await api(adm, "PATCH", `/api/clientes/${cid}`, { modo_precio_default: "tramos" });
  const mdCho = await api(cho, "PATCH", `/api/clientes/${cid}`, { modo_precio_default: "km" });
  check("135-26 forma de cobro por defecto del cliente (el chofer no la cambia)", md.s === 200 && md.j.modo_precio_default === "tramos" && mdCho.s === 403, `${md.s} ${mdCho.s}`);

  const vk2 = await api(adm, "POST", "/api/viajes", { fecha: hoy, numero_guia: "E2E-K3", cliente_id: cid, origen: "Santiago", destino: "Talca", subtotal: 255000, modo_precio: "km", distancia_km: 255 });
  const cobro = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [vt.j.id, vk2.j.id] });
  const d = await api(adm, "GET", `/api/cobros/${cobro.j?.id}`);
  const filaT = d.j?.viajes?.filas?.find((f: { numero_guia: string }) => f.numero_guia === "E2E-T1");
  const filaK = d.j?.viajes?.filas?.find((f: { numero_guia: string }) => f.numero_guia === "E2E-K3");
  check("135-27 el cobro muestra las paradas (por tramos) y los km (por km)", cobro.s === 201 && filaT?.via?.[0] === "Concepción" && filaK?.km === 255, `${cobro.s} ${JSON.stringify([filaT, filaK]).slice(0, 300)}`);
  const pdf = await fetch(`${process.env.E2E_API_URL ?? "http://localhost:8080"}/api/cobros/${cobro.j?.id}/pdf`, { headers: { Authorization: `Bearer ${adm}` } });
  check("135-28 el PDF del cobro se genera", pdf.status === 200, `${pdf.status}`);

  const dist = await api(adm, "POST", "/api/viajes/tarifas/distancia", { paradas: ["Santiago", "Rancagua"] });
  const conClave = dist.s === 200 && dist.j.km > 50 && dist.j.km < 150;
  const sinClave = dist.s === 503;
  check("135-29 km con el mapa: calcula o avisa que falta configurarlo", conClave || sinClave, `${dist.s} ${JSON.stringify(dist.j)}`);
  const { data: cache } = await supabase.from("distancias_cache").select("km").eq("par_a", "rancagua").eq("par_b", "santiago");
  check("135-30 si calculó, queda en caché", sinClave || (cache?.length ?? 0) === 1, JSON.stringify(cache));
}
