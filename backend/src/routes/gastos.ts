import { Router } from "express";
import multer from "multer";
import type { EstadoGasto, Gasto } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirComprobante, urlFirmadaComprobante } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const gastosRouter = Router();

const ESTADOS: EstadoGasto[] = ["pagado", "pendiente"];

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

async function resolverCategoria(empresaId: string, categoriaGastoId: string | undefined) {
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

async function existeEnTabla(tabla: string, empresaId: string, id: string) {
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
    const { estado, fecha_pago, categoria_gasto_id, centro_costo_id, proveedor_id, trabajo_id, descripcion } = req.body ?? {};
    const cambios: Partial<Gasto> = {};

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
      .select("comprobante_url")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (!data?.comprobante_url) {
      res.status(404).json({ error: "Este gasto no tiene comprobante adjunto" });
      return;
    }
    const url = await urlFirmadaComprobante(data.comprobante_url);
    res.json({ url });
  })
);
