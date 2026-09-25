// Tarea 135 (etapa 1): tarifas por tramo y por km, y precio propuesto.
import type { Ctx } from "../entorno";

export async function tarifasViajes(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const adm = await ctx.sesion("admin");
  const sup = await ctx.sesion("supervisor");
  const cho = await ctx.sesion("chofer");

  const c = await api(adm, "POST", "/api/clientes", { nombre: "E2E Cliente Tarifas", direccion: "Alameda 500, Santiago" });
  const cid = c.j?.id;

  const noCho = await api(cho, "GET", "/api/viajes/tarifas");
  check("135-1 el chofer no ve las tarifas (403)", noCho.s === 403, `${noCho.s}`);

  const t1 = await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Santiago", destino: "Concepción", precio: 300000 });
  check("135-2 admin crea tramo general", t1.s === 201 && t1.j.par_a === "concepcion" && t1.j.par_b === "santiago", `${t1.s} ${JSON.stringify(t1.j)}`);
  const dup = await api(sup, "POST", "/api/viajes/tarifas/tramos", { origen: "Concepcion", destino: "santiago", precio: 1 });
  check("135-3 el mismo tramo al revés es duplicado (409)", dup.s === 409, `${dup.s}`);
  const t2 = await api(sup, "POST", "/api/viajes/tarifas/tramos", { origen: "Concepción", destino: "Santiago", precio: 280000, cliente_id: cid });
  check("135-4 supervisor crea tramo propio del cliente", t2.s === 201 && t2.j.cliente_id === cid, `${t2.s} ${JSON.stringify(t2.j)}`);
  await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Concepción", destino: "Temuco", precio: 200000 });
  const mismo = await api(adm, "POST", "/api/viajes/tarifas/tramos", { origen: "Talca", destino: "talca", precio: 1 });
  check("135-5 origen igual a destino → 400", mismo.s === 400, `${mismo.s}`);

  const calc = await api(adm, "POST", "/api/viajes/tarifas/calcular", { modo: "tramos", paradas: ["Santiago", "Concepción", "Temuco", "Puerto Montt"], cliente_id: cid });
  check("135-6 cálculo por tramos: usa la tarifa del cliente y lista el faltante", calc.s === 200 && calc.j.subtotal === 480000 && calc.j.faltantes.length === 1 && calc.j.faltantes[0].destino === "Puerto Montt", JSON.stringify(calc.j));
  const calcGen = await api(adm, "POST", "/api/viajes/tarifas/calcular", { modo: "tramos", paradas: ["Santiago", "Concepción"] });
  check("135-7 sin cliente usa la tarifa general", calcGen.s === 200 && calcGen.j.subtotal === 300000, JSON.stringify(calcGen.j));

  const sinKm = await api(adm, "POST", "/api/viajes/tarifas/calcular", { modo: "km", km: 100 });
  check("135-8 sin precio por km definido → 400", sinKm.s === 400, `${sinKm.s}`);
  const kmG = await api(adm, "PUT", "/api/viajes/tarifas/km", { precio_km: 950 });
  const kmC = await api(adm, "PUT", "/api/viajes/tarifas/km", { precio_km: 900, cliente_id: cid });
  const kmG2 = await api(adm, "PUT", "/api/viajes/tarifas/km", { precio_km: 1000 });
  check("135-9 precio por km general y por cliente (actualizar no duplica)", kmG.s === 201 && kmC.s === 201 && kmG2.s === 200 && kmG2.j.id === kmG.j.id, `${kmG.s} ${kmC.s} ${kmG2.s}`);
  const cKm = await api(adm, "POST", "/api/viajes/tarifas/calcular", { modo: "km", km: 123.4, cliente_id: cid });
  const gKm = await api(adm, "POST", "/api/viajes/tarifas/calcular", { modo: "km", km: 123.4 });
  check("135-10 cálculo por km: tarifa del cliente o general, redondeado", cKm.j?.subtotal === 111060 && gKm.j?.subtotal === 123400, `${JSON.stringify(cKm.j)} ${JSON.stringify(gKm.j)}`);

  const lista = await api(sup, "GET", "/api/viajes/tarifas");
  check("135-11 el listado trae tramos y km de la empresa", lista.s === 200 && lista.j.tramos.length === 3 && lista.j.km.length === 2, `${lista.s} ${lista.j?.tramos?.length} ${lista.j?.km?.length}`);
  const off = await api(adm, "PATCH", `/api/viajes/tarifas/tramos/${t2.j.id}`, { activo: false });
  const calc2 = await api(adm, "POST", "/api/viajes/tarifas/calcular", { modo: "tramos", paradas: ["Santiago", "Concepción"], cliente_id: cid });
  check("135-12 tarifa del cliente desactivada → vuelve a la general", off.s === 200 && calc2.j?.subtotal === 300000, `${off.s} ${JSON.stringify(calc2.j)}`);
  const del = await api(adm, "DELETE", `/api/viajes/tarifas/tramos/${t1.j.id}`);
  check("135-13 eliminar tramo", del.s === 204, `${del.s}`);
}
