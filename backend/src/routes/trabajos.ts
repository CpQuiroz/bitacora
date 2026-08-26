import { Router } from "express";
import multer from "multer";
import type { EstadoTrabajo, ItemChecklist, Trabajo } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFirma, subirFoto, urlFirmada } from "../storage";
import { analizarFoto } from "../claude";
import { obtenerOCrearOrden } from "../ordenes";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const trabajosRouter = Router();

const ESTADOS: EstadoTrabajo[] = ["en_curso", "completado", "cancelado"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("Formato de imagen no soportado (usa jpeg, png o webp)"));
      return;
    }
    cb(null, true);
  },
});

async function trabajoExiste(empresaId: string, trabajoId: string) {
  const { data } = await supabase
    .from("trabajos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", trabajoId)
    .maybeSingle();
  return Boolean(data);
}

async function tipoTrabajoExiste(empresaId: string, tipoTrabajoId: string) {
  const { data } = await supabase
    .from("tipos_trabajo")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", tipoTrabajoId)
    .maybeSingle();
  return Boolean(data);
}

async function clienteExiste(empresaId: string, clienteId: string) {
  const { data } = await supabase
    .from("clientes")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", clienteId)
    .maybeSingle();
  return Boolean(data);
}

trabajosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("trabajos")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false });

    // La app móvil pide solo "mis trabajos" (los asignados al usuario logueado).
    if (req.query.propio === "true") {
      query = query.eq("responsable_id", req.userId!);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

trabajosRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("trabajos")
      .select("*, tipo_trabajo:tipos_trabajo(*)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }
    res.json(data);
  })
);

trabajosRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { datos, estado, tipo_trabajo_id } = req.body ?? {};
    const cambios: Partial<Trabajo> = {};

    if (datos !== undefined) {
      if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
        res.status(400).json({ error: "datos debe ser un objeto" });
        return;
      }
      cambios.datos = datos;
    }
    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) {
        res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
        return;
      }
      cambios.estado = estado;
    }
    if (tipo_trabajo_id !== undefined) {
      if (tipo_trabajo_id !== null && !(await tipoTrabajoExiste(req.empresaId!, tipo_trabajo_id))) {
        res.status(400).json({ error: "tipo_trabajo_id inválido" });
        return;
      }
      cambios.tipo_trabajo_id = tipo_trabajo_id;
    }
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("trabajos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }
    res.json(data);
  })
);

trabajosRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const {
      cliente,
      cliente_id,
      fecha,
      monto,
      ubicacion,
      codigo,
      estado,
      tipo_trabajo_id,
      responsable_id,
    } = req.body ?? {};

    if (typeof cliente !== "string" || !cliente.trim()) {
      res.status(400).json({ error: "Falta cliente" });
      return;
    }
    if (typeof fecha !== "string" || !fecha) {
      res.status(400).json({ error: "Falta fecha (YYYY-MM-DD)" });
      return;
    }
    const montoNum = Number(monto ?? 0);
    if (Number.isNaN(montoNum) || montoNum < 0) {
      res.status(400).json({ error: "monto inválido" });
      return;
    }
    if (tipo_trabajo_id && !(await tipoTrabajoExiste(req.empresaId!, tipo_trabajo_id))) {
      res.status(400).json({ error: "tipo_trabajo_id inválido" });
      return;
    }
    // cliente_id vincula a un cliente con coordenadas — lo usa la
    // planificación de rutas. Es opcional, "cliente" (texto) sigue
    // siendo el nombre a mostrar/facturar.
    if (cliente_id && !(await clienteExiste(req.empresaId!, cliente_id))) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    const estadoFinal: EstadoTrabajo = ESTADOS.includes(estado) ? estado : "completado";

    const { data, error } = await supabase
      .from("trabajos")
      .insert({
        empresa_id: req.empresaId!,
        cliente: cliente.trim(),
        cliente_id: cliente_id || null,
        fecha,
        monto: montoNum,
        ubicacion: ubicacion?.trim() || null,
        codigo: codigo?.trim() || null,
        estado: estadoFinal,
        tipo_trabajo_id: tipo_trabajo_id || null,
        responsable_id: responsable_id || req.userId!,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// Check-in / check-out: marca un item del checklist de la orden de
// servicio del trabajo (la crea si es la primera interacción).
trabajosRouter.post(
  "/:id/checklist",
  ah<RequestConEmpresa>(async (req, res) => {
    const { item } = req.body ?? {};
    if (item !== "Check-in" && item !== "Check-out") {
      res.status(400).json({ error: 'item debe ser "Check-in" o "Check-out"' });
      return;
    }
    if (!(await trabajoExiste(req.empresaId!, req.params.id))) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }

    const orden = await obtenerOCrearOrden(req.empresaId!, req.params.id);
    const checklist: ItemChecklist[] = orden.checklist ?? [];
    const ahora = new Date().toISOString();
    const yaEstaba = checklist.find((c) => c.item === item);
    const nuevoChecklist = yaEstaba
      ? checklist.map((c) => (c.item === item ? { ...c, hecho: true, hora: ahora } : c))
      : [...checklist, { item, hecho: true, hora: ahora }];

    const { data, error } = await supabase
      .from("ordenes_servicio")
      .update({ checklist: nuevoChecklist })
      .eq("id", orden.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

trabajosRouter.get(
  "/:id/orden",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await trabajoExiste(req.empresaId!, req.params.id))) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }
    const { data, error } = await supabase
      .from("ordenes_servicio")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("trabajo_id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.json(null);
      return;
    }
    const firmaUrl = data.firma_url ? await urlFirmada(data.firma_url, 15) : null;
    res.json({ ...data, firma_url_firmada: firmaUrl });
  })
);

// Guarda la firma del cliente al cerrar la orden de servicio (viene
// como PNG en base64, capturado del lienzo de firma en la app).
trabajosRouter.post(
  "/:id/firma",
  ah<RequestConEmpresa>(async (req, res) => {
    const { firma_base64 } = req.body ?? {};
    if (typeof firma_base64 !== "string" || !firma_base64) {
      res.status(400).json({ error: "Falta firma_base64" });
      return;
    }
    if (!(await trabajoExiste(req.empresaId!, req.params.id))) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }

    const orden = await obtenerOCrearOrden(req.empresaId!, req.params.id);
    const buffer = Buffer.from(firma_base64, "base64");
    const key = await subirFirma(req.empresaId!, req.params.id, buffer);

    const { data, error } = await supabase
      .from("ordenes_servicio")
      .update({ firma_url: key })
      .eq("id", orden.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const firmaUrl = await urlFirmada(key, 15);
    res.json({ ...data, firma_url_firmada: firmaUrl });
  })
);

// Sube una foto del trabajo y la analiza automáticamente con Claude
// (detecta daños/riesgos visibles) — la orden de servicio se crea si
// hace falta.
trabajosRouter.post(
  "/:id/fotos",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo (campo 'foto')" });
      return;
    }
    if (!(await trabajoExiste(req.empresaId!, req.params.id))) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }

    const orden = await obtenerOCrearOrden(req.empresaId!, req.params.id);

    const key = await subirFoto(req.empresaId!, req.params.id, req.file.buffer, req.file.mimetype);

    const mediaType = req.file.mimetype as "image/jpeg" | "image/png" | "image/webp";
    const analisis = await analizarFoto(req.file.buffer.toString("base64"), mediaType);

    const { data: fotoGuardada, error: errorAnalisis } = await supabase
      .from("analisis_fotos")
      .insert({
        empresa_id: req.empresaId!,
        orden_servicio_id: orden.id,
        foto_url: key,
        subida_por: req.userId!,
        estado: "listo",
        resumen: analisis.resumen,
        alerta: analisis.alerta,
        detalle_alerta: analisis.detalle_alerta,
      })
      .select()
      .single();

    if (errorAnalisis) {
      res.status(500).json({ error: errorAnalisis.message });
      return;
    }

    await supabase
      .from("ordenes_servicio")
      .update({ fotos: [...(orden.fotos ?? []), key] })
      .eq("id", orden.id);

    res.status(201).json(fotoGuardada);
  })
);

// Lista las fotos ya analizadas del trabajo, con una URL firmada
// fresca para cada una (el bucket es privado).
trabajosRouter.get(
  "/:id/fotos",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await trabajoExiste(req.empresaId!, req.params.id))) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }
    const { data: orden } = await supabase
      .from("ordenes_servicio")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("trabajo_id", req.params.id)
      .maybeSingle();

    if (!orden) {
      res.json([]);
      return;
    }

    const { data: fotos, error } = await supabase
      .from("analisis_fotos")
      .select("*")
      .eq("orden_servicio_id", orden.id)
      .order("creado_en", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const conUrl = await Promise.all(
      (fotos ?? []).map(async (f) => ({ ...f, url: await urlFirmada(f.foto_url, 15) }))
    );
    res.json(conUrl);
  })
);
