import { Router } from "express";
import type { Equipo } from "@bitacora/shared";
import { estadoDocumento } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { rolPuedeVerModulo } from "../roles";

export const equiposRouter = Router();

// Equipo (categoría "Vehículo") actualmente asignado a cada uno — se
// usa acá y también en Ruteo/notificacionesFeed. Migrado desde
// vehiculos.ts cuando Vehículos se fusionó dentro de Equipos — la
// tabla de asignaciones se mantuvo (vehiculo_asignaciones), solo su
// columna vehiculo_id pasó a llamarse equipo_id.
export async function asignacionVigentePorEquipo(empresaId: string, equipoIds: string[]) {
  if (equipoIds.length === 0) return new Map<string, { colaborador_id: string; colaborador_nombre: string }>();
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("vehiculo_asignaciones")
    .select("equipo_id, colaborador_id, desde, hasta, colaborador:usuarios(nombre)")
    .eq("empresa_id", empresaId)
    .in("equipo_id", equipoIds)
    .lte("desde", hoy)
    // hasta.gt (no gte): un desasignar() pone hasta = hoy y debe dejar
    // de contar como vigente ese mismo día, no recién al día siguiente
    // — bug preexistente en el vehiculos.ts original, encontrado y
    // corregido acá al mover esta lógica (ver RESUMEN_TRABAJO.md).
    .or(`hasta.is.null,hasta.gt.${hoy}`)
    .order("desde", { ascending: false });

  const mapa = new Map<string, { colaborador_id: string; colaborador_nombre: string }>();
  for (const a of data ?? []) {
    if (mapa.has(a.equipo_id)) continue; // ya tomamos la más reciente
    const colaboradorNombre = (a as unknown as { colaborador: { nombre: string } | null }).colaborador?.nombre ?? "—";
    mapa.set(a.equipo_id, { colaborador_id: a.colaborador_id, colaborador_nombre: colaboradorNombre });
  }
  return mapa;
}

// Sentido inverso — el equipo (si hay alguno) asignado hoy a un
// colaborador puntual. Usado en Ruteo (Nueva ruta) y en /api/usuarios/me/vehiculo.
export async function equipoAsignadoAColaborador(empresaId: string, colaboradorId: string): Promise<Equipo | null> {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("vehiculo_asignaciones")
    .select("equipo:equipos(*)")
    .eq("empresa_id", empresaId)
    .eq("colaborador_id", colaboradorId)
    .lte("desde", hoy)
    // hasta.gt (no gte): un desasignar() pone hasta = hoy y debe dejar
    // de contar como vigente ese mismo día, no recién al día siguiente
    // — bug preexistente en el vehiculos.ts original, encontrado y
    // corregido acá al mover esta lógica (ver RESUMEN_TRABAJO.md).
    .or(`hasta.is.null,hasta.gt.${hoy}`)
    .order("desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as unknown as { equipo: Equipo } | null)?.equipo ?? null;
}

// Permisos de escritura (23-sep-2026) — antes NINGÚN handler de este
// router chequeaba permisos: cualquier usuario autenticado de la
// empresa (incluido un colaborador) podía crear/editar equipos y
// asignar/desasignar vehículos. Las lecturas siguen abiertas a propósito
// (mobile las usa en Viajes y Mantención para elegir equipo/vehículo).
//   · Vehículo (categoría "Vehículo" o con patente) → módulo "flota".
//   · Cualquier otro equipo → "equipos" (su propia sección desde la
//     tarea 124; antes "registros") o "flota".
export function esVehiculo(e: { categoria?: unknown; patente?: unknown } | null | undefined): boolean {
  if (!e) return false;
  return e.categoria === "Vehículo" || (typeof e.patente === "string" && e.patente.trim() !== "");
}

export async function puedeEscribirEquipo(req: RequestConEmpresa, vehiculo: boolean): Promise<boolean> {
  const rol = req.rol ?? "colaborador";
  if (await rolPuedeVerModulo(rol, "flota", req.empresaId)) return true;
  return !vehiculo && (await rolPuedeVerModulo(rol, "equipos", req.empresaId));
}

const SIN_PERMISO_EQUIPOS = "No tienes permiso para modificar equipos";
const SIN_PERMISO_FLOTA = "No tienes permiso para gestionar vehículos de la flota";

equiposRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("equipos")
      .select("*, cliente:clientes(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const asignaciones = await asignacionVigentePorEquipo(req.empresaId!, (data ?? []).map((e) => e.id));
    res.json((data ?? []).map((e) => ({ ...e, asignacion_vigente: asignaciones.get(e.id) ?? null })));
  })
);

// Bloque C — Dashboard de Equipos: métricas agregadas. Montada ANTES
// de "/:id" a propósito (si no, Express intentaría matchear "dashboard"
// como :id).
equiposRouter.get(
  "/dashboard",
  ah<RequestConEmpresa>(async (req, res) => {
    const empresaId = req.empresaId!;
    const hoy = new Date().toISOString().slice(0, 10);
    const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [{ data: equipos }, { data: planes }, { data: planesProximos }, { data: trabajos }, { data: docsPorVencer }] = await Promise.all([
      supabase.from("equipos").select("id, nombre, categoria, activo, garantia_vencimiento").eq("empresa_id", empresaId),
      supabase.from("planes_mantencion").select("id").eq("empresa_id", empresaId).eq("activo", true),
      supabase
        .from("planes_mantencion")
        .select("id, proxima_fecha, equipo:equipos(nombre)")
        .eq("empresa_id", empresaId)
        .eq("activo", true)
        .gte("proxima_fecha", hoy)
        .lte("proxima_fecha", en30dias)
        .order("proxima_fecha", { ascending: true }),
      supabase.from("trabajos").select("equipo_id").eq("empresa_id", empresaId).not("equipo_id", "is", null),
      // Documentos de equipos próximos a vencer — misma ventana que Flota
      // → "Documentos por vencer" (documentos.ts, GET /por-vencer): sin
      // piso inferior, así entran también los ya vencidos. Solo
      // entidad_tipo="vehiculo" (los de colaboradores viven en Flota).
      supabase
        .from("documentos")
        .select("id, entidad_id, fecha_vencimiento, tipo:tipos_documento(nombre)")
        .eq("empresa_id", empresaId)
        .eq("entidad_tipo", "vehiculo")
        .not("fecha_vencimiento", "is", null)
        .lte("fecha_vencimiento", en30dias)
        .order("fecha_vencimiento", { ascending: true }),
    ]);

    const porCategoria = new Map<string, number>();
    let garantiasPorVencer = 0;
    for (const e of equipos ?? []) {
      const categoria = e.categoria || "Sin categoría";
      porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + 1);
      if (e.garantia_vencimiento && e.garantia_vencimiento >= hoy && e.garantia_vencimiento <= en30dias) garantiasPorVencer++;
    }

    const osPorEquipo = new Map<string, number>();
    for (const t of trabajos ?? []) {
      if (!t.equipo_id) continue;
      osPorEquipo.set(t.equipo_id, (osPorEquipo.get(t.equipo_id) ?? 0) + 1);
    }
    const nombrePorEquipo = new Map((equipos ?? []).map((e) => [e.id, e.nombre]));
    const equiposConMasOs = [...osPorEquipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([equipoId, cantidad]) => ({ equipo_id: equipoId, nombre: nombrePorEquipo.get(equipoId) ?? "—", cantidad_os: cantidad }));

    res.json({
      total_equipos: (equipos ?? []).length,
      equipos_activos: (equipos ?? []).filter((e) => e.activo).length,
      planes_mantencion_activos: (planes ?? []).length,
      garantias_por_vencer: garantiasPorVencer,
      equipos_por_categoria: [...porCategoria.entries()].map(([categoria, cantidad]) => ({ categoria, cantidad })),
      proximas_mantenciones: (planesProximos ?? []).map((p) => ({
        id: p.id,
        proxima_fecha: p.proxima_fecha,
        equipo_nombre: (p as unknown as { equipo: { nombre: string } | null }).equipo?.nombre ?? "—",
      })),
      documentos_por_vencer: (docsPorVencer ?? []).map((d) => ({
        id: d.id,
        equipo_nombre: nombrePorEquipo.get(d.entidad_id) ?? "—",
        tipo_nombre: (d as unknown as { tipo: { nombre: string } | null }).tipo?.nombre ?? "—",
        fecha_vencimiento: d.fecha_vencimiento,
        estado: estadoDocumento(d.fecha_vencimiento),
      })),
      equipos_con_mas_os: equiposConMasOs,
    });
  })
);

equiposRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("equipos")
      .select("*, cliente:clientes(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Equipo no encontrado" });
      return;
    }
    const asignaciones = await asignacionVigentePorEquipo(req.empresaId!, [data.id]);

    // Bloque C — Histórico de Mantenciones: OS pasadas de este equipo
    // específico (trabajos.equipo_id), más recientes primero.
    const { data: historico } = await supabase
      .from("trabajos")
      .select("*, orden:ordenes_servicio(folio, estado_os)")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", req.params.id)
      .order("fecha", { ascending: false });
    const historicoNormalizado = (historico ?? []).map((t) => ({
      ...t,
      orden: Array.isArray(t.orden) ? (t.orden[0] ?? null) : t.orden,
    }));

    res.json({ ...data, asignacion_vigente: asignaciones.get(data.id) ?? null, historico_mantenciones: historicoNormalizado });
  })
);

equiposRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, nombre, marca, modelo, numero_serie, categoria, notas, patente, anio, tipo_vehiculo, capacidad_carga, garantia_vencimiento } = req.body ?? {};

    const vehiculo = esVehiculo({ categoria, patente });
    if (!(await puedeEscribirEquipo(req, vehiculo))) {
      res.status(403).json({ error: vehiculo ? SIN_PERMISO_FLOTA : SIN_PERMISO_EQUIPOS });
      return;
    }

    // cliente_id ahora es opcional — sin cliente significa "activo
    // propio de la empresa" (ej. un vehículo de la flota propia).
    if (cliente_id) {
      const { data: cliente } = await supabase.from("clientes").select("id").eq("empresa_id", req.empresaId!).eq("id", cliente_id).maybeSingle();
      if (!cliente) {
        res.status(400).json({ error: "El cliente indicado no existe" });
        return;
      }
    }
    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (anio !== undefined && anio !== null && anio !== "" && !Number.isInteger(Number(anio))) {
      res.status(400).json({ error: "anio inválido" });
      return;
    }

    const { data, error } = await supabase
      .from("equipos")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id: cliente_id || null,
        nombre: nombre.trim(),
        marca: marca?.trim() || null,
        modelo: modelo?.trim() || null,
        numero_serie: numero_serie?.trim() || null,
        categoria: categoria?.trim() || null,
        notas: notas?.trim() || null,
        patente: patente?.trim() ? patente.trim().toUpperCase() : null,
        anio: anio ? Number(anio) : null,
        tipo_vehiculo: tipo_vehiculo?.trim() || null,
        capacidad_carga: capacidad_carga?.trim() || null,
        garantia_vencimiento: garantia_vencimiento || null,
      })
      .select("*, cliente:clientes(id, nombre)")
      .single();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe un equipo con esa patente" : error.message,
      });
      return;
    }
    res.status(201).json(data);
  })
);

// POST /importar — alta masiva desde CSV (mismo patrón que
// clientes.ts). Dedupe por patente (si viene y es Vehículo) — hay un
// índice único (empresa_id, patente) en la base; se chequea antes de
// insertar para reportar "omitida" en vez de que el batch entero falle
// por una fila con constraint violation. No resuelve cliente_id por
// nombre (ambiguo con homónimos) — un vehículo importado queda sin
// cliente asignado, se completa editando la ficha.
type FilaImportEquipo = {
  nombre?: unknown;
  categoria?: unknown;
  marca?: unknown;
  modelo?: unknown;
  numero_serie?: unknown;
  patente?: unknown;
  anio?: unknown;
  tipo_vehiculo?: unknown;
  capacidad_carga?: unknown;
  garantia_vencimiento?: unknown;
};

equiposRouter.post(
  "/importar",
  ah<RequestConEmpresa>(async (req, res) => {
    const filas = req.body?.filas;
    if (!Array.isArray(filas) || filas.length === 0) {
      res.status(400).json({ error: "Falta el arreglo de filas a importar" });
      return;
    }
    if (filas.length > 500) {
      res.status(400).json({ error: "Máximo 500 filas por importación — dividí el archivo en partes más chicas" });
      return;
    }
    const traeVehiculos = (filas as { categoria?: unknown; patente?: unknown }[]).some((f) => esVehiculo(f));
    if (!(await puedeEscribirEquipo(req, traeVehiculos))) {
      res.status(403).json({ error: traeVehiculos ? SIN_PERMISO_FLOTA : SIN_PERMISO_EQUIPOS });
      return;
    }

    const { data: existentes } = await supabase.from("equipos").select("patente").eq("empresa_id", req.empresaId!).not("patente", "is", null);
    const patentesExistentes = new Set((existentes ?? []).map((e) => e.patente));

    const errores: { fila: number; motivo: string }[] = [];
    const omitidos: { fila: number; motivo: string }[] = [];
    const paraCrear: {
      empresa_id: string;
      nombre: string;
      categoria: string | null;
      marca: string | null;
      modelo: string | null;
      numero_serie: string | null;
      patente: string | null;
      anio: number | null;
      tipo_vehiculo: string | null;
      capacidad_carga: string | null;
      garantia_vencimiento: string | null;
    }[] = [];
    const patentesEnEsteArchivo = new Set<string>();

    (filas as FilaImportEquipo[]).forEach((f, i) => {
      const numeroFila = i + 2;
      const nombre = typeof f.nombre === "string" ? f.nombre.trim() : "";
      if (!nombre) {
        errores.push({ fila: numeroFila, motivo: "Falta el nombre" });
        return;
      }
      const anioRaw = f.anio;
      let anio: number | null = null;
      if (anioRaw !== undefined && anioRaw !== null && anioRaw !== "") {
        const n = Number(anioRaw);
        if (!Number.isInteger(n)) {
          errores.push({ fila: numeroFila, motivo: `año inválido: "${anioRaw}"` });
          return;
        }
        anio = n;
      }
      const patenteRaw = typeof f.patente === "string" ? f.patente.trim().toUpperCase() : "";
      const patente = patenteRaw || null;
      if (patente && (patentesExistentes.has(patente) || patentesEnEsteArchivo.has(patente))) {
        omitidos.push({ fila: numeroFila, motivo: `Ya existe un equipo con patente ${patente} — no se creó de nuevo` });
        return;
      }
      if (patente) patentesEnEsteArchivo.add(patente);

      paraCrear.push({
        empresa_id: req.empresaId!,
        nombre,
        categoria: typeof f.categoria === "string" && f.categoria.trim() ? f.categoria.trim() : null,
        marca: typeof f.marca === "string" && f.marca.trim() ? f.marca.trim() : null,
        modelo: typeof f.modelo === "string" && f.modelo.trim() ? f.modelo.trim() : null,
        numero_serie: typeof f.numero_serie === "string" && f.numero_serie.trim() ? f.numero_serie.trim() : null,
        patente,
        anio,
        tipo_vehiculo: typeof f.tipo_vehiculo === "string" && f.tipo_vehiculo.trim() ? f.tipo_vehiculo.trim() : null,
        capacidad_carga: typeof f.capacidad_carga === "string" && f.capacidad_carga.trim() ? f.capacidad_carga.trim() : null,
        garantia_vencimiento: typeof f.garantia_vencimiento === "string" && f.garantia_vencimiento.trim() ? f.garantia_vencimiento.trim() : null,
      });
    });

    if (paraCrear.length === 0) {
      res.status(400).json({ error: "Ninguna fila es válida", errores, omitidos });
      return;
    }

    const { data: creados, error: errorImport } = await supabase.from("equipos").insert(paraCrear).select("id");
    if (errorImport) {
      res.status(500).json({ error: errorImport.message });
      return;
    }
    res.json({ creados: creados?.length ?? 0, errores, omitidos });
  })
);

equiposRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, nombre, marca, modelo, numero_serie, categoria, notas, activo, patente, anio, tipo_vehiculo, capacidad_carga, garantia_vencimiento } = req.body ?? {};
    const cambios: Partial<Equipo> = {};

    const { data: actual } = await supabase.from("equipos").select("categoria, patente").eq("empresa_id", req.empresaId!).eq("id", req.params.id).maybeSingle();
    if (!actual) {
      res.status(404).json({ error: "Equipo no encontrado" });
      return;
    }
    // Vehículo antes O después del cambio → hace falta "flota".
    const vehiculo = esVehiculo(actual) || esVehiculo({ categoria, patente });
    if (!(await puedeEscribirEquipo(req, vehiculo))) {
      res.status(403).json({ error: vehiculo ? SIN_PERMISO_FLOTA : SIN_PERMISO_EQUIPOS });
      return;
    }

    if (cliente_id !== undefined) {
      if (cliente_id) {
        const { data: cliente } = await supabase.from("clientes").select("id").eq("empresa_id", req.empresaId!).eq("id", cliente_id).maybeSingle();
        if (!cliente) {
          res.status(400).json({ error: "El cliente indicado no existe" });
          return;
        }
        cambios.cliente_id = cliente_id;
      } else {
        cambios.cliente_id = null;
      }
    }
    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (marca !== undefined) cambios.marca = marca?.trim() || null;
    if (modelo !== undefined) cambios.modelo = modelo?.trim() || null;
    if (numero_serie !== undefined) cambios.numero_serie = numero_serie?.trim() || null;
    if (categoria !== undefined) cambios.categoria = categoria?.trim() || null;
    if (notas !== undefined) cambios.notas = notas?.trim() || null;
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (patente !== undefined) cambios.patente = patente?.trim() ? patente.trim().toUpperCase() : null;
    if (anio !== undefined) {
      if (anio !== null && anio !== "" && !Number.isInteger(Number(anio))) {
        res.status(400).json({ error: "anio inválido" });
        return;
      }
      cambios.anio = anio ? Number(anio) : null;
    }
    if (tipo_vehiculo !== undefined) cambios.tipo_vehiculo = tipo_vehiculo?.trim() || null;
    if (capacidad_carga !== undefined) cambios.capacidad_carga = capacidad_carga?.trim() || null;
    if (garantia_vencimiento !== undefined) cambios.garantia_vencimiento = garantia_vencimiento || null;

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("equipos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente:clientes(id, nombre)")
      .maybeSingle();

    if (error) {
      res.status(error.code === "23505" ? 409 : 500).json({
        error: error.code === "23505" ? "Ya existe un equipo con esa patente" : error.message,
      });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Equipo no encontrado" });
      return;
    }
    res.json(data);
  })
);

// Historial de asignaciones a colaborador de un equipo (más reciente
// primero) — en la práctica solo se usa para equipos categoría
// "Vehículo", pero el endpoint no lo exige.
equiposRouter.get(
  "/:id/asignaciones",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("vehiculo_asignaciones")
      .select("*, colaborador:usuarios(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", req.params.id)
      .order("desde", { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Asigna el equipo a un colaborador — si había una asignación vigente
// (sin "hasta"), se cierra automáticamente el día anterior, así el
// equipo no queda "asignado" a dos personas a la vez.
equiposRouter.post(
  "/:id/asignar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await rolPuedeVerModulo(req.rol ?? "colaborador", "flota", req.empresaId))) {
      res.status(403).json({ error: SIN_PERMISO_FLOTA });
      return;
    }
    const { colaborador_id, desde } = req.body ?? {};
    if (typeof colaborador_id !== "string" || !colaborador_id.trim()) {
      res.status(400).json({ error: "Falta colaborador_id" });
      return;
    }
    const { data: equipo } = await supabase.from("equipos").select("id").eq("empresa_id", req.empresaId!).eq("id", req.params.id).maybeSingle();
    if (!equipo) {
      res.status(404).json({ error: "Equipo no encontrado" });
      return;
    }
    const { data: colaborador } = await supabase
      .from("usuarios")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", colaborador_id)
      .maybeSingle();
    if (!colaborador) {
      res.status(400).json({ error: "El colaborador indicado no existe" });
      return;
    }

    const fechaDesde = typeof desde === "string" && desde ? desde : new Date().toISOString().slice(0, 10);
    const diaAnterior = new Date(new Date(fechaDesde).getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await supabase
      .from("vehiculo_asignaciones")
      .update({ hasta: diaAnterior })
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", req.params.id)
      .is("hasta", null);

    const { data, error } = await supabase
      .from("vehiculo_asignaciones")
      .insert({ empresa_id: req.empresaId!, equipo_id: req.params.id, colaborador_id, desde: fechaDesde })
      .select("*, colaborador:usuarios(nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// Termina la asignación vigente de un equipo (sin reemplazarla por otra).
equiposRouter.post(
  "/:id/desasignar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await rolPuedeVerModulo(req.rol ?? "colaborador", "flota", req.empresaId))) {
      res.status(403).json({ error: SIN_PERMISO_FLOTA });
      return;
    }
    const { error, count } = await supabase
      .from("vehiculo_asignaciones")
      .update({ hasta: new Date().toISOString().slice(0, 10) }, { count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", req.params.id)
      .is("hasta", null);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Este equipo no tiene una asignación vigente" });
      return;
    }
    res.status(204).end();
  })
);
