// Tarea 134: cobro desde varios viajes con detalle, folio, sin duplicar, PDF con período, borrar libera.
// Portada al repo (tarea 127): corre dentro de la empresa E2E aislada.
import { supabase } from "../../backend/src/supabase";
import { API, type Ctx } from "../entorno";

export async function cobroMultiViaje(ctx: Ctx): Promise<void> {
  const { check, api } = ctx;
  const adm = await ctx.sesion("admin"), sup = await ctx.sesion("supervisor");
  const U = ctx.u;
  const a = await api(adm, "POST", "/api/clientes", { nombre: "QA Transportes Andes", direccion: "Av. Libertador 1500, Santiago", rut: "76.123.456-0" });
  const b = await api(adm, "POST", "/api/clientes", { nombre: "QA Otro Cliente", direccion: "Calle 2, Santiago" });
  const ca = a.j?.id ?? (await supabase.from("clientes").select("id").eq("nombre", "QA Transportes Andes").single()).data!.id;
  const cb = b.j.id;
  const fechas = ["2026-09-01", "2026-09-03", "2026-09-08", "2026-09-15", "2026-09-22"];
  const ids: string[] = [];
  for (const [i, f] of fechas.entries()) {
    const v = await api(adm, "POST", "/api/viajes", { fecha: f, numero_guia: `G-10${i}`, cliente_id: ca, chofer_id: i % 2 ? U.chofer.id : U.chofer2.id, origen: "Santiago", destino: ["Rancagua", "Talca", "Chillán", "Temuco", "Concepción"][i], subtotal: 100000 + i * 12345, aplica_iva: true });
    ids.push(v.j.id);
  }
  const vb = await api(adm, "POST", "/api/viajes", { fecha: "2026-09-05", numero_guia: "G-B1", cliente_id: cb, origen: "Santiago", destino: "Los Andes", subtotal: 50000 });

  const mezcla = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [...ids, vb.j.id] });
  check("134-1 viajes de distintos clientes → 400", mezcla.s === 400, `${mezcla.s} ${JSON.stringify(mezcla.j)}`);
  const supF = await api(sup, "POST", "/api/viajes/facturar", { viaje_ids: ids });
  check("134-2 supervisor no factura (acción facturar) → 403", supF.s === 403, `${supF.s}`);

  const f = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: ids });
  check("134-3 cobro de 5 viajes con folio", f.s === 201 && f.j.folio != null, `${f.s} ${JSON.stringify(f.j).slice(0, 160)}`);
  const cobroId = f.j.id;
  const rep = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [ids[0]] });
  check("134-4 un viaje ya cobrado no se vuelve a cobrar → 409", rep.s === 409, `${rep.s}`);

  const d = await api(adm, "GET", `/api/cobros/${cobroId}`);
  const vj = d.j.viajes;
  const sumaNeto = vj.filas.reduce((s: number, x: any) => s + x.neto, 0);
  const sumaIva = vj.filas.reduce((s: number, x: any) => s + x.iva, 0);
  check("134-5 detalle: 5 filas con guía, fecha, chofer, cliente, origen, destino", vj.filas.length === 5 && vj.filas.every((x: any) => x.numero_guia && x.fecha && x.chofer && x.cliente === "QA Transportes Andes" && x.origen && x.destino), JSON.stringify(vj.filas[0]));
  check("134-6 neto + IVA = total, y cuadra con el monto del cobro", vj.totales.neto === sumaNeto && vj.totales.iva === sumaIva && vj.totales.neto + vj.totales.iva === vj.totales.total && Number(d.j.monto) === vj.totales.total, JSON.stringify(vj.totales) + " monto=" + d.j.monto);
  check("134-7 período por defecto = primer y último viaje", vj.periodo.desde === "2026-09-01" && vj.periodo.hasta === "2026-09-22", JSON.stringify(vj.periodo));

  const pdfRes = await fetch(`${API}/api/cobros/${cobroId}/pdf`, { headers: { Authorization: `Bearer ${adm}` } });
  const pdf = Buffer.from(await pdfRes.arrayBuffer());
  check("134-8 PDF por defecto", pdfRes.status === 200 && pdfRes.headers.get("content-type") === "application/pdf" && pdf.subarray(0, 4).toString() === "%PDF", `${pdfRes.status} ${pdf.length}`);
  const pdf2 = await fetch(`${API}/api/cobros/${cobroId}/pdf?desde=2026-09-01&hasta=2026-09-30`, { headers: { Authorization: `Bearer ${adm}` } });
  check("134-9 PDF con período editado", pdf2.status === 200, `${pdf2.status}`);
  const pdf3 = await api(adm, "GET", `/api/cobros/${cobroId}/pdf?desde=2026-09-30&hasta=2026-09-01`);
  check("134-10 período al revés → 400", pdf3.s === 400, `${pdf3.s}`);

  // Carrera: dos cobros simultáneos con los mismos 2 viajes nuevos.
  const x1 = await api(adm, "POST", "/api/viajes", { fecha: "2026-09-25", numero_guia: "G-R1", cliente_id: ca, origen: "Santiago", destino: "Talca", subtotal: 10000 });
  const x2 = await api(adm, "POST", "/api/viajes", { fecha: "2026-09-26", numero_guia: "G-R2", cliente_id: ca, origen: "Santiago", destino: "Talca", subtotal: 10000 });
  const carrera = await Promise.all([1, 2].map(() => api(adm, "POST", "/api/viajes/facturar", { viaje_ids: [x1.j.id, x2.j.id] })));
  const ganadores = carrera.filter((r) => r.s === 201);
  const { data: cobrosCarrera } = await supabase.from("facturas").select("id").contains("viaje_ids", [x1.j.id]);
  check("134-11 pedidos simultáneos: un solo cobro", ganadores.length === 1 && cobrosCarrera?.length === 1, `status=${carrera.map((r) => r.s)} cobros=${cobrosCarrera?.length}`);

  const del = await api(adm, "DELETE", `/api/cobros/${cobroId}`);
  const { data: libres } = await supabase.from("viajes").select("estado, factura_id").in("id", ids);
  check("134-12 borrar el cobro libera los viajes", del.s === 204 && libres!.every((v) => v.estado === "confirmado" && v.factura_id === null), `${del.s} ${JSON.stringify(libres)}`);
  const f2 = await api(adm, "POST", "/api/viajes/facturar", { viaje_ids: ids });
  check("134-13 se pueden volver a cobrar", f2.s === 201, `${f2.s}`);

}
