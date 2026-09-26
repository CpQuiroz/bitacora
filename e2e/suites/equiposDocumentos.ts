// Tarea 146: Equipos en mobile. Documentos de vehículos: el Admin (Flota)
// en todos; el chofer ve, sube y edita solo los de su vehículo asignado (no
// los borra). Plan de mantención: solo con permiso de escritura del equipo.
import crypto from "node:crypto";
import { supabase } from "../../backend/src/supabase";
import { API, type Ctx } from "../entorno";

// PDF mínimo válido para el multipart.
const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

export async function equiposDocumentos(ctx: Ctx): Promise<void> {
  const { check, api, sesion, empresaId, hoy } = ctx;
  const admin = await sesion("admin");
  const chofer = await sesion("chofer");

  const { data: tipo } = await supabase.from("tipos_documento").insert({ empresa_id: empresaId, nombre: "SOAP E2E", aplica_a: "vehiculo", activo: true }).select("id").single();
  const { data: equipos } = await supabase
    .from("equipos")
    .insert([
      { empresa_id: empresaId, nombre: "Camión asignado E2E", categoria: "Vehículo", patente: "EEEE11" },
      { empresa_id: empresaId, nombre: "Camión ajeno E2E", categoria: "Vehículo", patente: "EEEE22" },
    ])
    .select("id, nombre");
  const propio = equipos!.find((e) => e.nombre.startsWith("Camión asignado"))!.id;
  const ajeno = equipos!.find((e) => e.nombre.startsWith("Camión ajeno"))!.id;
  await supabase.from("vehiculo_asignaciones").insert({ empresa_id: empresaId, equipo_id: propio, colaborador_id: ctx.u.chofer.id, desde: "2026-01-01" });

  const subir = async (token: string, metodo: "POST" | "PATCH", ruta: string, campos: Record<string, string>, conArchivo = true) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(campos)) fd.append(k, v);
    if (conArchivo) fd.append("archivo", new Blob([PDF], { type: "application/pdf" }), "soap.pdf");
    const r = await fetch(`${API}${ruta}`, { method: metodo, headers: { Authorization: `Bearer ${token}` }, body: fd });
    return { s: r.status, j: await r.json().catch(() => null) };
  };

  const verPropio = await api(chofer, "GET", `/api/documentos?entidad_tipo=vehiculo&entidad_id=${propio}`);
  check("146-1 el chofer ve los documentos de su vehículo asignado", verPropio.s === 200 && Array.isArray(verPropio.j), `${verPropio.s}`);
  const verAjeno = await api(chofer, "GET", `/api/documentos?entidad_tipo=vehiculo&entidad_id=${ajeno}`);
  check("146-2 el chofer no ve los de otro vehículo", verAjeno.s === 403, `${verAjeno.s}`);

  const base = { entidad_tipo: "vehiculo", tipo_documento_id: tipo!.id, fecha_vencimiento: "2027-03-31" };
  const subido = await subir(chofer, "POST", "/api/documentos", { ...base, entidad_id: propio, numero: "A-1" });
  check("146-3 el chofer sube un PDF a su vehículo", subido.s === 201 && subido.j?.archivo_key, JSON.stringify(subido));
  const docId = subido.j?.id as string;
  const subirAjeno = await subir(chofer, "POST", "/api/documentos", { ...base, entidad_id: ajeno });
  check("146-4 el chofer no sube a otro vehículo", subirAjeno.s === 403, `${subirAjeno.s}`);
  const editado = await subir(chofer, "PATCH", `/api/documentos/${docId}`, { numero: "A-2", fecha_vencimiento: "2027-06-30" }, false);
  check("146-5 el chofer edita el documento de su vehículo", editado.s === 200 && editado.j?.numero === "A-2" && editado.j?.fecha_vencimiento === "2027-06-30", JSON.stringify(editado.j));
  const archivo = await api(chofer, "GET", `/api/documentos/${docId}/archivo`);
  check("146-6 el chofer abre el archivo (URL firmada)", archivo.s === 200 && typeof archivo.j?.url === "string", `${archivo.s}`);
  const borrarChofer = await api(chofer, "DELETE", `/api/documentos/${docId}`);
  check("146-7 el chofer no puede borrar documentos", borrarChofer.s === 404, `${borrarChofer.s}`);

  const ajenoAdmin = await subir(admin, "POST", "/api/documentos", { ...base, entidad_id: ajeno });
  check("146-8 el Admin sube a cualquier vehículo", ajenoAdmin.s === 201, `${ajenoAdmin.s}`);
  // Vehículo real de OTRA empresa (se crea y se borra acá).
  const { data: empresaB } = await supabase.from("empresas").insert({ nombre: `E2E otra ${crypto.randomBytes(3).toString("hex")}`, rubro: "transporte", plan: "pro" }).select("id").single();
  try {
    const { data: vehiculoB } = await supabase.from("equipos").insert({ empresa_id: empresaB!.id, nombre: "Camión otra empresa", categoria: "Vehículo", patente: "ZZZZ99" }).select("id").single();
    const otraEmpresa = await subir(admin, "POST", "/api/documentos", { ...base, entidad_id: vehiculoB!.id });
    check("146-9 no se puede colgar un documento de un vehículo de otra empresa", otraEmpresa.s === 400, `${otraEmpresa.s}`);
    const verOtra = await api(admin, "GET", `/api/documentos?entidad_tipo=vehiculo&entidad_id=${vehiculoB!.id}`);
    check("146-9b tampoco se listan documentos de otra empresa", verOtra.s === 200 && Array.isArray(verOtra.j) && verOtra.j.length === 0, `${verOtra.s}`);
  } finally {
    await supabase.from("empresas").delete().eq("id", empresaB!.id);
  }
  const { data: tipoColab } = await supabase.from("tipos_documento").insert({ empresa_id: empresaId, nombre: "Licencia E2E", aplica_a: "colaborador", activo: true }).select("id").single();
  const tipoMalo = await subir(admin, "POST", "/api/documentos", { ...base, entidad_id: ajeno, tipo_documento_id: tipoColab!.id });
  check("146-9c un tipo de colaborador no se usa en un vehículo", tipoMalo.s === 400, `${tipoMalo.s}`);
  const borrarAdmin = await api(admin, "DELETE", `/api/documentos/${docId}`);
  check("146-10 el Admin borra documentos", borrarAdmin.s === 204, `${borrarAdmin.s}`);

  // Al quitarle el vehículo, el chofer pierde el acceso.
  await supabase.from("vehiculo_asignaciones").update({ hasta: hoy }).eq("equipo_id", propio).is("hasta", null);
  const sinAsignacion = await api(chofer, "GET", `/api/documentos?entidad_tipo=vehiculo&entidad_id=${propio}`);
  check("146-11 sin asignación vigente el chofer ya no ve los documentos", sinAsignacion.s === 403, `${sinAsignacion.s}`);

  // Plan de mantención preventiva.
  const planChofer = await api(chofer, "POST", "/api/planes-mantencion", { equipo_id: propio, frecuencia_dias: 180, proxima_fecha: "2027-01-01" });
  check("146-12 el chofer no crea planes de mantención", planChofer.s === 403, `${planChofer.s}`);
  const plan = await api(admin, "POST", "/api/planes-mantencion", { equipo_id: propio, frecuencia_dias: 180, proxima_fecha: "2027-01-01" });
  check("146-13 el Admin crea el plan", plan.s === 201, `${plan.s}`);
  const fechaMala = await api(admin, "POST", "/api/planes-mantencion", { equipo_id: propio, frecuencia_dias: 30, proxima_fecha: "mañana" });
  check("146-14 fecha inválida → 400", fechaMala.s === 400, `${fechaMala.s}`);
  const pausarChofer = await api(chofer, "PATCH", `/api/planes-mantencion/${plan.j?.id}`, { activo: false });
  check("146-15 el chofer no pausa el plan", pausarChofer.s === 403, `${pausarChofer.s}`);
  const pausar = await api(admin, "PATCH", `/api/planes-mantencion/${plan.j?.id}`, { activo: false });
  check("146-16 el Admin pausa el plan", pausar.s === 200 && pausar.j?.activo === false, JSON.stringify(pausar.j));
  const borrarPlan = await api(admin, "DELETE", `/api/planes-mantencion/${plan.j?.id}`);
  check("146-17 el Admin elimina el plan", borrarPlan.s === 204, `${borrarPlan.s}`);

  // Tarea 148: pestaña Viajes de la ficha → /api/viajes?equipo_id=
  await supabase.from("viajes").insert([
    { empresa_id: empresaId, fecha: hoy, numero_guia: "E2E-148-A", cliente: "Cliente E2E", origen: "Santiago", destino: "Rancagua", equipo_id: propio },
    { empresa_id: empresaId, fecha: hoy, numero_guia: "E2E-148-B", cliente: "Cliente E2E", origen: "Santiago", destino: "Talca", equipo_id: ajeno },
  ]);
  const viajesPropio = await api(admin, "GET", `/api/viajes?equipo_id=${propio}`);
  check(
    "148-1 los viajes se filtran por equipo",
    viajesPropio.s === 200 && viajesPropio.j?.length === 1 && viajesPropio.j[0].numero_guia === "E2E-148-A",
    JSON.stringify((viajesPropio.j ?? []).map((v: { numero_guia: string }) => v.numero_guia))
  );

  const filtroMalo = await api(admin, "GET", "/api/viajes?equipo_id=no-es-uuid");
  check("148-2 un equipo_id inválido responde 400 (no 500)", filtroMalo.s === 400, `${filtroMalo.s}`);

  const editarChofer = await api(chofer, "PATCH", `/api/equipos/${propio}`, { nombre: "Hackeado" });
  check("146-18 el chofer no edita los datos del vehículo", editarChofer.s === 403, `${editarChofer.s}`);
  const editarAdmin = await api(admin, "PATCH", `/api/equipos/${propio}`, { marca: "Volvo", anio: 2021 });
  check("146-19 el Admin edita los datos del vehículo", editarAdmin.s === 200, `${editarAdmin.s}`);

  // Tarea 145 (opción B): informe Servicios sin "Tipo de OS"; campos viejos vacíos para apps instaladas.
  const serv = await api(admin, "GET", `/api/informes/servicios?periodo=personalizado&desde=2026-01-01&hasta=${hoy}`);
  check(
    "145-1 informe Servicios: KPIs y clientes con más OS, sin tipos",
    serv.s === 200 && typeof serv.j?.kpis?.total_os === "number" && Array.isArray(serv.j?.top_clientes) && serv.j?.ranking_tipos?.length === 0 && serv.j?.distribucion_tipo?.length === 0,
    JSON.stringify(serv.j)?.slice(0, 200)
  );

  // Tarea 151: "Mi plan" — precio en UF y CLP (UF del día), consumo y módulos activos.
  const miPlan = await api(admin, "GET", "/api/plan");
  check(
    "151-1 /api/plan trae precio (UF y CLP), consumo y módulos activos",
    miPlan.s === 200 &&
      miPlan.j?.precio?.uf === 6 &&
      (miPlan.j.precio.clp === null || miPlan.j.precio.clp === Math.round(6 * miPlan.j.precio.valorUf)) &&
      miPlan.j?.consumo?.usuarios?.usados >= 5 &&
      Array.isArray(miPlan.j?.modulosActivosLista),
    JSON.stringify({ precio: miPlan.j?.precio, consumo: miPlan.j?.consumo })
  );
}
