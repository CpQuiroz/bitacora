import { Router } from "express";
import multer from "multer";
import type { AgruparViaticos, EstadoGasto, Gasto } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirComprobante, urlFirmadaComprobante } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { siguienteFolioGasto } from "../folios";
import { resumirViaticos, type GastoViaticoConChofer } from "../viajesViaticos";
import { hoyChile } from "../fechaChile";

export const gastosRouter = Router();

const ESTADOS: EstadoGasto[] = ["pagado", "pendiente"];

// Fase 5.1 (23-sep-2026, pedido explícito): "el colaborador solo ve sus
// propios gastos". Un gasto queda "del colaborador" cuando cuelga de una
// rendición suya (rendicion_id -> rendiciones.colaborador_id) — el gasto
// "suelto" (rendicion_id null, alta rápida desde el celular, sin owner
// en la tabla) es un registro de empresa sin dueño individual, no algo
// personal para filtrar; ver mobile/src/features/mas/MasScreen.tsx
// ("Nuevo gasto" queda disponible para cualquier rol con financiero
// delegado, a propósito — no se toca acá). Mismo criterio que ya usa
// rendiciones.ts (esGestion), duplicado localmente para no crear un
// import circular (rendiciones.ts ya importa de este archivo).
const esGestion = (req: RequestConEmpresa) => req.rol !== "colaborador";

async function idsRendicionesPropias(empresaId: string, userId: string): Promise<string[]> {
  const { data } = await supabase.from("rendiciones").select("id").eq("empresa_id", empresaId).eq("colaborador_id", userId);
  return (data ?? []).map((r) => r.id);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.mimetype)) {
      cb(new Error("Formato no soportado (usa jpeg, png, webp o pdf)"));
      return;
    }
    cb(null, true);
  },
});

// Exportadas para reusarlas en rendiciones.ts (POST /:id/items crea un
// gasto igual que acá, solo que scopeado a una rendición y exigiendo
// comprobante) — nada de duplicar esta validación.
export async function resolverCategoria(empresaId: string, categoriaGastoId: string | undefined) {
  if (!categoriaGastoId) return { categoria_gasto_id: null, categoria: null };
  const { data } = await supabase
    .from("categorias_gasto")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("id", categoriaGastoId)
    .maybeSingle();
  if (!data) return null;
  return { categoria_gasto_id: data.id, categoria: data.nombre };
}

export async function existeEnTabla(tabla: string, empresaId: string, id: string) {
  const { data } = await supabase.from(tabla).select("id").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  return Boolean(data);
}

gastosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("gastos")
      .select("*, categoria_info:categorias_gasto(id, nombre, color), centro_costo_info:centros_costo(id, nombre), proveedor_info:proveedores(id, nombre), trabajo_info:trabajos(id, cliente, fecha)")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false });

    if (!esGestion(req)) {
      const idsPropias = await idsRendicionesPropias(req.empresaId!, req.userId!);
      if (idsPropias.length === 0) {
        res.json([]);
        return;
      }
      query = query.in("rendicion_id", idsPropias);
    }

    const { desde, hasta, estado } = req.query;
    if (typeof desde === "string" && desde) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && hasta) query = query.lte("fecha", hasta);
    if (typeof estado === "string" && ESTADOS.includes(estado as EstadoGasto)) {
      query = query.eq("estado", estado as EstadoGasto);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// ---------- Viáticos (tarea 137) ----------
// Cuánto hay que pagarle a cada chofer por semana o por mes. El chofer
// del viático es el del viaje (gastos.viaje_id → viajes.chofer_id).
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function rangoValido(desde: unknown, hasta: unknown): { desde: string; hasta: string } | { error: string } {
  if (typeof desde !== "string" || typeof hasta !== "string" || !FECHA.test(desde) || !FECHA.test(hasta) || desde > hasta) {
    return { error: "Indica un rango de fechas válido (desde y hasta, YYYY-MM-DD)" };
  }
  const dias = (Date.parse(hasta) - Date.parse(desde)) / 86_400_000;
  if (!(dias <= 400)) return { error: "El rango no puede superar 400 días" };
  return { desde, hasta };
}

type FilaGastoViatico = { id: string; monto: number; estado: EstadoGasto; fecha: string; viaje: { chofer_id: string | null; chofer: { nombre: string } | null } | null };

// Lee por páginas: PostgREST devuelve a lo más 1000 filas por consulta y
// un rango de 400 días con muchos choferes puede pasarse de eso.
const PAGINA = 1000;
const MAX_FILAS = 20_000;

async function gastosViaticos(empresaId: string, desde: string, hasta: string, choferId?: string) {
  const filas: FilaGastoViatico[] = [];
  for (let offset = 0; offset < MAX_FILAS; offset += PAGINA) {
    let q = supabase
      .from("gastos")
      .select("id, monto, estado, fecha, viaje:viajes!inner(chofer_id, chofer:usuarios(nombre))")
      .eq("empresa_id", empresaId)
      .eq("es_viatico", true)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("id")
      .range(offset, offset + PAGINA - 1);
    if (choferId) q = q.eq("viaje.chofer_id", choferId);
    const { data, error } = await q;
    if (error) return { data: filas, error, truncado: false };
    filas.push(...((data ?? []) as unknown as FilaGastoViatico[]));
    if ((data ?? []).length < PAGINA) return { data: filas, error: null, truncado: false };
  }
  return { data: filas, error: null, truncado: true };
}


gastosRouter.get(
  "/viaticos",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!esGestion(req)) {
      res.status(403).json({ error: "No tienes permiso para ver los viáticos" });
      return;
    }
    const rango = rangoValido(req.query.desde, req.query.hasta);
    if ("error" in rango) {
      res.status(400).json({ error: rango.error });
      return;
    }
    const agrupar: AgruparViaticos = req.query.agrupar === "mes" ? "mes" : "semana";
    const choferId = typeof req.query.chofer_id === "string" && req.query.chofer_id ? req.query.chofer_id : undefined;
    const { data, error, truncado } = await gastosViaticos(req.empresaId!, rango.desde, rango.hasta, choferId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (truncado) {
      res.status(400).json({ error: "Demasiados viáticos en ese rango: acorta las fechas" });
      return;
    }
    const filas: GastoViaticoConChofer[] = data.map((g) => ({
      monto: g.monto,
      estado: g.estado,
      fecha: g.fecha,
      chofer_id: g.viaje?.chofer_id ?? null,
      chofer: g.viaje?.chofer?.nombre ?? null,
    }));
    res.json(resumirViaticos(filas, agrupar));
  })
);

// Marca como pagados los viáticos pendientes de un chofer en un período
// (cuando se le transfiere). Deshacer: el gasto se vuelve a pendiente en
// Gastos, uno por uno.
gastosRouter.post(
  "/viaticos/pagar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!esGestion(req)) {
      res.status(403).json({ error: "No tienes permiso para pagar viáticos" });
      return;
    }
    const { chofer_id, desde, hasta, fecha_pago } = req.body ?? {};
    if (typeof chofer_id !== "string" || !chofer_id) {
      res.status(400).json({ error: "Falta el chofer" });
      return;
    }
    const rango = rangoValido(desde, hasta);
    if ("error" in rango) {
      res.status(400).json({ error: rango.error });
      return;
    }
    const { data, error, truncado } = await gastosViaticos(req.empresaId!, rango.desde, rango.hasta, chofer_id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (truncado) {
      res.status(400).json({ error: "Demasiados viáticos en ese rango: acorta las fechas" });
      return;
    }
    const ids = data.filter((g) => g.estado === "pendiente").map((g) => g.id);
    const fechaPago = typeof fecha_pago === "string" && FECHA.test(fecha_pago) ? fecha_pago : hoyChile();
    let pagados = 0;
    let total = 0;
    // En lotes: una lista de miles de ids no cabe en la URL de PostgREST.
    for (let i = 0; i < ids.length; i += 200) {
      const { data: lote, error: errorPago } = await supabase
        .from("gastos")
        .update({ estado: "pagado", fecha_pago: fechaPago })
        .eq("empresa_id", req.empresaId!)
        .eq("es_viatico", true)
        .eq("estado", "pendiente")
        .in("id", ids.slice(i, i + 200))
        .select("monto");
      if (errorPago) {
        res.status(500).json({ error: `Se marcaron ${pagados} viático(s) antes del error: ${errorPago.message}`, pagados, total });
        return;
      }
      pagados += lote?.length ?? 0;
      total += (lote ?? []).reduce((t, g) => t + Number(g.monto), 0);
    }
    res.json({ pagados, total });
  })
);

gastosRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("gastos")
      .select("*, categoria_info:categorias_gasto(id, nombre, color), centro_costo_info:centros_costo(id, nombre), proveedor_info:proveedores(id, nombre, telefono, correo), trabajo_info:trabajos(id, cliente, fecha), rendicion:rendiciones(colaborador_id)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }
    const rendicionDelGasto = (data as unknown as { rendicion: { colaborador_id: string } | null }).rendicion;
    if (!esGestion(req) && rendicionDelGasto?.colaborador_id !== req.userId) {
      res.status(403).json({ error: "No tienes acceso a este gasto" });
      return;
    }
    res.json(data);
  })
);

gastosRouter.post(
  "/",
  upload.single("comprobante"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { categoria, categoria_gasto_id, centro_costo_id, proveedor_id, trabajo_id, descripcion, monto, fecha, estado, fecha_pago } = req.body ?? {};

    const montoNum = Number(monto);
    if (Number.isNaN(montoNum) || montoNum <= 0) {
      res.status(400).json({ error: "monto inválido" });
      return;
    }
    if (typeof fecha !== "string" || !fecha) {
      res.status(400).json({ error: "Falta fecha (YYYY-MM-DD)" });
      return;
    }

    const resuelta = await resolverCategoria(req.empresaId!, categoria_gasto_id);
    if (resuelta === null) {
      res.status(400).json({ error: "La categoría indicada no existe" });
      return;
    }
    const categoriaFinal = resuelta.categoria ?? (typeof categoria === "string" ? categoria.trim() : "");
    if (!categoriaFinal) {
      res.status(400).json({ error: "Falta categoría" });
      return;
    }

    if (centro_costo_id && !(await existeEnTabla("centros_costo", req.empresaId!, centro_costo_id))) {
      res.status(400).json({ error: "El centro de costo indicado no existe" });
      return;
    }
    if (proveedor_id && !(await existeEnTabla("proveedores", req.empresaId!, proveedor_id))) {
      res.status(400).json({ error: "El proveedor indicado no existe" });
      return;
    }
    if (trabajo_id && !(await existeEnTabla("trabajos", req.empresaId!, trabajo_id))) {
      res.status(400).json({ error: "La orden de servicio indicada no existe" });
      return;
    }

    const estadoFinal: EstadoGasto = ESTADOS.includes(estado) ? estado : "pendiente";

    // Folio propio (migración 112), formateado como "GTO-000X" solo al
    // mostrarlo (formatearFolio, @bitacora/shared). Tolerante a error —
    // ver folios.ts.
    const folio = await siguienteFolioGasto(req.empresaId!);

    const { data, error } = await supabase
      .from("gastos")
      .insert({
        empresa_id: req.empresaId!,
        categoria: categoriaFinal,
        categoria_gasto_id: resuelta.categoria_gasto_id,
        centro_costo_id: centro_costo_id || null,
        proveedor_id: proveedor_id || null,
        trabajo_id: trabajo_id || null,
        descripcion: descripcion?.trim() || null,
        monto: montoNum,
        fecha,
        estado: estadoFinal,
        fecha_pago: estadoFinal === "pagado" ? fecha_pago || fecha : null,
        folio,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (req.file) {
      const key = await subirComprobante(req.empresaId!, data.id, req.file.originalname, req.file.buffer, req.file.mimetype);
      const { data: actualizado } = await supabase
        .from("gastos")
        .update({ comprobante_url: key, comprobante_nombre: req.file.originalname })
        .eq("id", data.id)
        .select()
        .single();
      res.status(201).json(actualizado);
      return;
    }

    res.status(201).json(data);
  })
);

gastosRouter.patch(
  "/:id",
  upload.single("comprobante"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { estado, fecha_pago, categoria_gasto_id, centro_costo_id, proveedor_id, trabajo_id, descripcion, monto, fecha } = req.body ?? {};
    const cambios: Partial<Gasto> = {};

    const { data: gastoActual } = await supabase
      .from("gastos")
      .select("estado, es_viatico, monto, fecha, categoria_gasto_id, rendicion:rendiciones(estado, colaborador_id)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!gastoActual) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }
    const rendicionDeGasto = (gastoActual as unknown as { rendicion: { estado: string; colaborador_id: string } | null }).rendicion;
    // Fase 5.1: si el gasto es de una rendición, solo su dueño (o
    // gestión) la toca — un colaborador no edita el gasto de otro.
    if (rendicionDeGasto && !esGestion(req) && rendicionDeGasto.colaborador_id !== req.userId) {
      res.status(403).json({ error: "No tienes acceso a este gasto" });
      return;
    }
    // Rendiciones (migración 120): una vez que la rendición dejó
    // 'borrador' (enviada/aprobada), sus gastos quedan congelados — ni
    // el colaborador ni nadie los edita desde acá. Se libera si se
    // rechaza (vuelve a 'borrador').
    if (rendicionDeGasto && rendicionDeGasto.estado !== "borrador") {
      res.status(409).json({ error: "Este gasto pertenece a una rendición ya enviada — no se puede editar" });
      return;
    }

    // Viático de un viaje (tarea 137): monto, fecha y categoría se cambian
    // desde el viaje; acá solo el estado (pagado/pendiente), el
    // comprobante y la descripción.
    if (
      gastoActual.es_viatico &&
      ((monto !== undefined && Number(monto) !== Number(gastoActual.monto)) ||
        (fecha !== undefined && fecha !== gastoActual.fecha) ||
        (categoria_gasto_id !== undefined && (categoria_gasto_id || null) !== gastoActual.categoria_gasto_id))
    ) {
      res.status(409).json({ error: "Este gasto es el viático de un viaje: cambia su monto o fecha desde el viaje" });
      return;
    }

    if (monto !== undefined) {
      const montoNum = Number(monto);
      if (Number.isNaN(montoNum) || montoNum < 0) {
        res.status(400).json({ error: "monto inválido" });
        return;
      }
      cambios.monto = montoNum;
    }
    if (fecha !== undefined) {
      if (typeof fecha !== "string" || !fecha) {
        res.status(400).json({ error: "fecha inválida" });
        return;
      }
      cambios.fecha = fecha;
    }
    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) {
        res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
        return;
      }
      cambios.estado = estado;
      cambios.fecha_pago = estado === "pagado" ? fecha_pago || new Date().toISOString().slice(0, 10) : null;
    }
    if (categoria_gasto_id !== undefined) {
      const resuelta = await resolverCategoria(req.empresaId!, categoria_gasto_id || undefined);
      if (resuelta === null) {
        res.status(400).json({ error: "La categoría indicada no existe" });
        return;
      }
      cambios.categoria_gasto_id = resuelta.categoria_gasto_id;
      if (resuelta.categoria) cambios.categoria = resuelta.categoria;
    }
    if (centro_costo_id !== undefined) {
      if (centro_costo_id && !(await existeEnTabla("centros_costo", req.empresaId!, centro_costo_id))) {
        res.status(400).json({ error: "El centro de costo indicado no existe" });
        return;
      }
      cambios.centro_costo_id = centro_costo_id || null;
    }
    if (proveedor_id !== undefined) {
      if (proveedor_id && !(await existeEnTabla("proveedores", req.empresaId!, proveedor_id))) {
        res.status(400).json({ error: "El proveedor indicado no existe" });
        return;
      }
      cambios.proveedor_id = proveedor_id || null;
    }
    if (trabajo_id !== undefined) {
      if (trabajo_id && !(await existeEnTabla("trabajos", req.empresaId!, trabajo_id))) {
        res.status(400).json({ error: "La orden de servicio indicada no existe" });
        return;
      }
      cambios.trabajo_id = trabajo_id || null;
    }
    if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;

    if (req.file) {
      const key = await subirComprobante(req.empresaId!, req.params.id, req.file.originalname, req.file.buffer, req.file.mimetype);
      cambios.comprobante_url = key;
      cambios.comprobante_nombre = req.file.originalname;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    // Registro simple de auditoría: solo si el gasto YA estaba pagado
    // antes de este cambio (no hay ninguna restricción que impida
    // editarlo, pero conviene dejar trazado quién tocó algo ya pagado).
    if (gastoActual.estado === "pagado") {
      cambios.editado_por = req.userId!;
      cambios.editado_en = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from("gastos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, categoria_info:categorias_gasto(id, nombre, color), centro_costo_info:centros_costo(id, nombre), proveedor_info:proveedores(id, nombre), trabajo_info:trabajos(id, cliente, fecha)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Gasto no encontrado" });
      return;
    }
    res.json(data);
  })
);

gastosRouter.get(
  "/:id/comprobante",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data } = await supabase
      .from("gastos")
      .select("comprobante_url, rendicion:rendiciones(colaborador_id)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (!data) {
      res.status(404).json({ error: "Este gasto no tiene comprobante adjunto" });
      return;
    }
    const rendicionDelGasto = (data as unknown as { rendicion: { colaborador_id: string } | null }).rendicion;
    if (!esGestion(req) && rendicionDelGasto?.colaborador_id !== req.userId) {
      res.status(403).json({ error: "No tienes acceso a este gasto" });
      return;
    }
    if (!data.comprobante_url) {
      res.status(404).json({ error: "Este gasto no tiene comprobante adjunto" });
      return;
    }
    const url = await urlFirmadaComprobante(data.comprobante_url);
    res.json({ url });
  })
);
