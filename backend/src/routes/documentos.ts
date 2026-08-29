import { Router } from "express";
import multer from "multer";
import type { Documento, EntidadDocumento, Rol } from "@bitacora/shared";
import { estadoDocumento, puedeVerModulo } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirDocumento, urlFirmadaDocumento } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const documentosRouter = Router();

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

// Un colaborador siempre puede ver/editar SUS PROPIOS documentos (sin el
// módulo "flota", igual criterio que /api/usuarios/me) — para cualquier
// otra entidad (otro colaborador, o un vehículo) hace falta el módulo.
function autorizado(req: RequestConEmpresa, entidadTipo: EntidadDocumento, entidadId: string): boolean {
  if (entidadTipo === "colaborador" && entidadId === req.userId) return true;
  return puedeVerModulo((req.rol ?? "colaborador") as Rol, "flota");
}

const ENTIDADES: EntidadDocumento[] = ["colaborador", "vehiculo"];

documentosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { entidad_tipo, entidad_id } = req.query;
    if (!ENTIDADES.includes(entidad_tipo as EntidadDocumento) || typeof entidad_id !== "string") {
      res.status(400).json({ error: "Faltan entidad_tipo/entidad_id" });
      return;
    }
    if (!autorizado(req, entidad_tipo as EntidadDocumento, entidad_id)) {
      res.status(403).json({ error: "No tienes permiso para ver estos documentos" });
      return;
    }

    const { data, error } = await supabase
      .from("documentos")
      .select("*, tipo:tipos_documento(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("entidad_tipo", entidad_tipo as EntidadDocumento)
      .eq("entidad_id", entidad_id)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data ?? []).map((d) => ({ ...d, estado: estadoDocumento(d.fecha_vencimiento) })));
  })
);

// Vista consolidada — solo admin/supervisor (flota). Vencidos primero,
// después por días restantes — para no tener que entrar ficha por ficha.
documentosRouter.get(
  "/por-vencer",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!puedeVerModulo((req.rol ?? "colaborador") as Rol, "flota")) {
      res.status(403).json({ error: "No tienes permiso para acceder a este módulo" });
      return;
    }
    const en30dias = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("documentos")
      .select("*, tipo:tipos_documento(nombre)")
      .eq("empresa_id", req.empresaId!)
      .not("fecha_vencimiento", "is", null)
      .lte("fecha_vencimiento", en30dias)
      .order("fecha_vencimiento", { ascending: true });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const colaboradorIds = (data ?? []).filter((d) => d.entidad_tipo === "colaborador").map((d) => d.entidad_id);
    const vehiculoIds = (data ?? []).filter((d) => d.entidad_tipo === "vehiculo").map((d) => d.entidad_id);
    const [{ data: colaboradores }, { data: vehiculos }] = await Promise.all([
      colaboradorIds.length ? supabase.from("usuarios").select("id, nombre").in("id", colaboradorIds) : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
      vehiculoIds.length ? supabase.from("vehiculos").select("id, patente").in("id", vehiculoIds) : Promise.resolve({ data: [] as { id: string; patente: string }[] }),
    ]);
    const nombreColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nombre]));
    const patenteVehiculo = new Map((vehiculos ?? []).map((v) => [v.id, v.patente]));

    res.json(
      (data ?? []).map((d) => ({
        ...d,
        estado: estadoDocumento(d.fecha_vencimiento),
        entidad_nombre: d.entidad_tipo === "colaborador" ? nombreColaborador.get(d.entidad_id) ?? "—" : patenteVehiculo.get(d.entidad_id) ?? "—",
      }))
    );
  })
);

documentosRouter.post(
  "/",
  upload.single("archivo"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { entidad_tipo, entidad_id, tipo_documento_id, numero, fecha_emision, fecha_vencimiento } = req.body ?? {};
    if (!ENTIDADES.includes(entidad_tipo)) {
      res.status(400).json({ error: `entidad_tipo debe ser uno de: ${ENTIDADES.join(", ")}` });
      return;
    }
    if (typeof entidad_id !== "string" || !entidad_id) {
      res.status(400).json({ error: "Falta entidad_id" });
      return;
    }
    if (!autorizado(req, entidad_tipo, entidad_id)) {
      res.status(403).json({ error: "No tienes permiso para agregar este documento" });
      return;
    }
    if (typeof tipo_documento_id !== "string" || !tipo_documento_id) {
      res.status(400).json({ error: "Falta tipo_documento_id" });
      return;
    }
    const { data: tipoDoc } = await supabase.from("tipos_documento").select("id").eq("empresa_id", req.empresaId!).eq("id", tipo_documento_id).maybeSingle();
    if (!tipoDoc) {
      res.status(400).json({ error: "tipo_documento_id inválido" });
      return;
    }

    let archivoKey: string | null = null;
    if (req.file) {
      archivoKey = await subirDocumento(req.empresaId!, entidad_tipo, entidad_id, req.file.originalname, req.file.buffer, req.file.mimetype);
    }

    const { data, error } = await supabase
      .from("documentos")
      .insert({
        empresa_id: req.empresaId!,
        entidad_tipo,
        entidad_id,
        tipo_documento_id,
        numero: numero?.trim() || null,
        fecha_emision: fecha_emision || null,
        fecha_vencimiento: fecha_vencimiento || null,
        archivo_key: archivoKey,
      })
      .select("*, tipo:tipos_documento(nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ ...data, estado: estadoDocumento(data.fecha_vencimiento) });
  })
);

async function documentoAutorizado(req: RequestConEmpresa, id: string): Promise<Documento | null> {
  const { data } = await supabase.from("documentos").select("*").eq("empresa_id", req.empresaId!).eq("id", id).maybeSingle();
  if (!data) return null;
  if (!autorizado(req, data.entidad_tipo, data.entidad_id)) return null;
  return data;
}

documentosRouter.patch(
  "/:id",
  upload.single("archivo"),
  ah<RequestConEmpresa>(async (req, res) => {
    const actual = await documentoAutorizado(req, req.params.id);
    if (!actual) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }
    const { numero, fecha_emision, fecha_vencimiento, tipo_documento_id } = req.body ?? {};
    const cambios: Partial<Documento> = { actualizado_en: new Date().toISOString() };
    if (numero !== undefined) cambios.numero = numero?.trim() || null;
    if (fecha_emision !== undefined) cambios.fecha_emision = fecha_emision || null;
    if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento || null;
    if (tipo_documento_id !== undefined) {
      const { data: tipoDoc } = await supabase.from("tipos_documento").select("id").eq("empresa_id", req.empresaId!).eq("id", tipo_documento_id).maybeSingle();
      if (!tipoDoc) {
        res.status(400).json({ error: "tipo_documento_id inválido" });
        return;
      }
      cambios.tipo_documento_id = tipo_documento_id;
    }
    if (req.file) {
      cambios.archivo_key = await subirDocumento(req.empresaId!, actual.entidad_tipo, actual.entidad_id, req.file.originalname, req.file.buffer, req.file.mimetype);
    }

    const { data, error } = await supabase.from("documentos").update(cambios).eq("id", req.params.id).select("*, tipo:tipos_documento(nombre)").single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ...data, estado: estadoDocumento(data.fecha_vencimiento) });
  })
);

documentosRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const actual = await documentoAutorizado(req, req.params.id);
    if (!actual) {
      res.status(404).json({ error: "Documento no encontrado" });
      return;
    }
    // tenant-ok: documentoAutorizado() arriba ya validó empresa_id.
    const { error } = await supabase.from("documentos").delete().eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);

documentosRouter.get(
  "/:id/archivo",
  ah<RequestConEmpresa>(async (req, res) => {
    const actual = await documentoAutorizado(req, req.params.id);
    if (!actual || !actual.archivo_key) {
      res.status(404).json({ error: "Este documento no tiene archivo adjunto" });
      return;
    }
    const url = await urlFirmadaDocumento(actual.archivo_key);
    res.json({ url });
  })
);
