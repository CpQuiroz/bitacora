// ============================================================
// BITÁCORA — Registros de mantención de flota (migración 96).
//
// Montado en /api/equipos (sin requiereModulo, igual que el resto de
// Flota) — la autorización se resuelve por handler:
//   * gestionar flota (admin / supervisor / rol con el módulo): todo.
//   * chofer: solo su vehículo asignado hoy; el historial completo con
//     filtros NO (usa GET /api/usuarios/me/vehiculo/registros-mantencion).
//
// Registros INMUTABLES: no hay PATCH ni DELETE. El PDF se genera de
// forma perezosa en el primer GET .../pdf y se cachea; subir una foto
// después invalida ese caché (pdf_url → null).
// ============================================================
import { Router } from "express";
import multer from "multer";
import type {
  Equipo,
  ItemChecklistMantencion,
  RegistroMantencionEquipo,
  RespuestaChecklistMantencion,
} from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { rolPuedeVerModulo } from "../roles";
import { equipoAsignadoAColaborador } from "./equipos";
import {
  subirFotoRegistroMantencion,
  subirFirmaRegistroMantencion,
  subirPdfRegistroMantencion,
  descargarPdfRegistroMantencion,
  urlFirmada,
} from "../storage";
import { generarPdfEnWorker } from "../pdfWorkerPool";
import type { DatosRegistroMantencionPdf } from "../generarPdfRegistroMantencion";

export const registrosMantencionRouter = Router();

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

const RESPUESTAS: RespuestaChecklistMantencion[] = ["si", "no", "na"];

function puedeGestionarFlota(req: RequestConEmpresa): Promise<boolean> {
  return rolPuedeVerModulo(req.rol ?? "colaborador", "flota", req.empresaId);
}

async function buscarEquipo(empresaId: string, equipoId: string): Promise<Equipo | null> {
  const { data } = await supabase
    .from("equipos")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("id", equipoId)
    .maybeSingle();
  return (data as Equipo) ?? null;
}

// ¿El usuario puede registrar/ver mantenciones de ESTE equipo?
// admin/supervisor: sí. chofer: solo si es el vehículo que tiene
// asignado hoy.
async function puedeSobreEquipo(req: RequestConEmpresa, equipoId: string): Promise<boolean> {
  if (await puedeGestionarFlota(req)) return true;
  const asignado = await equipoAsignadoAColaborador(req.empresaId!, req.userId!);
  return asignado?.id === equipoId;
}

function normalizarChecklist(valor: unknown): ItemChecklistMantencion[] | null {
  if (!Array.isArray(valor)) return null;
  const salida: ItemChecklistMantencion[] = [];
  for (const fila of valor) {
    if (!fila || typeof fila !== "object") return null;
    const f = fila as Record<string, unknown>;
    if (typeof f.seccion !== "string" || typeof f.item !== "string") return null;
    if (!RESPUESTAS.includes(f.respuesta as RespuestaChecklistMantencion)) return null;
    salida.push({
      seccion: f.seccion,
      item: f.item,
      respuesta: f.respuesta as RespuestaChecklistMantencion,
    });
  }
  return salida;
}

function numeroOpcional(valor: unknown): number | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

// Nombre a mostrar en "Realizado por" — persona (interno) o taller (externo).
async function nombreRealizadoPor(
  empresaId: string,
  reg: Pick<RegistroMantencionEquipo, "origen" | "proveedor_id" | "realizado_por">
): Promise<string | null> {
  if (reg.origen === "externo" && reg.proveedor_id) {
    const { data } = await supabase
      .from("proveedores")
      .select("nombre")
      .eq("empresa_id", empresaId)
      .eq("id", reg.proveedor_id)
      .maybeSingle();
    return data?.nombre ?? null;
  }
  if (reg.realizado_por) {
    const { data } = await supabase
      .from("usuarios")
      .select("nombre")
      .eq("empresa_id", empresaId)
      .eq("id", reg.realizado_por)
      .maybeSingle();
    return data?.nombre ?? null;
  }
  return null;
}

// ------------------------------------------------------------
// POST /:equipoId/registros-mantencion — crea un registro.
// ------------------------------------------------------------
registrosMantencionRouter.post(
  "/:equipoId/registros-mantencion",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipoId } = req.params;
    const equipo = await buscarEquipo(req.empresaId!, equipoId);
    if (!equipo) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }
    if (!(await puedeSobreEquipo(req, equipoId))) {
      res.status(403).json({ error: "No puedes registrar mantenciones de este vehículo" });
      return;
    }

    const { tipo, checklist, kilometraje, horas_motor, observaciones, proveedor_id, realizado_por, firma_base64 } = req.body ?? {};

    if (tipo !== "diario" && tipo !== "programa") {
      res.status(400).json({ error: "tipo debe ser 'diario' o 'programa'" });
      return;
    }

    const items = normalizarChecklist(checklist ?? []);
    if (!items) {
      res.status(400).json({ error: "checklist inválido — se espera [{seccion, item, respuesta}]" });
      return;
    }
    if (items.length === 0) {
      res.status(400).json({ error: "Responde al menos un ítem del checklist" });
      return;
    }

    const km = numeroOpcional(kilometraje);
    const horas = numeroOpcional(horas_motor);
    if (km === undefined || horas === undefined) {
      res.status(400).json({ error: "kilometraje / horas_motor inválidos" });
      return;
    }

    // Origen derivado del tipo (diario ⇒ interno, programa ⇒ externo). No
    // se pide en el formulario; se guarda explícito para poder distinguir
    // a futuro un Programa hecho en taller propio.
    const origen: "interno" | "externo" = tipo === "diario" ? "interno" : "externo";

    let proveedorFinal: string | null = null;
    let realizadoPorFinal: string | null = null;

    if (origen === "externo") {
      if (typeof proveedor_id !== "string" || !proveedor_id) {
        res.status(400).json({ error: "Falta el taller / lubricentro (proveedor_id)" });
        return;
      }
      const { data: prov } = await supabase
        .from("proveedores")
        .select("id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", proveedor_id)
        .maybeSingle();
      if (!prov) {
        res.status(400).json({ error: "El taller / lubricentro indicado no existe" });
        return;
      }
      proveedorFinal = proveedor_id;
    } else {
      // Interno: el chofer siempre se registra a sí mismo; admin/supervisor
      // pueden indicar a otro colaborador.
      const puedeGestionar = await puedeGestionarFlota(req);
      if (puedeGestionar && typeof realizado_por === "string" && realizado_por) {
        const { data: u } = await supabase
          .from("usuarios")
          .select("id")
          .eq("empresa_id", req.empresaId!)
          .eq("id", realizado_por)
          .maybeSingle();
        if (!u) {
          res.status(400).json({ error: "El colaborador indicado no existe" });
          return;
        }
        realizadoPorFinal = realizado_por;
      } else {
        realizadoPorFinal = req.userId!;
      }
    }

    const { data: creado, error } = await supabase
      .from("registros_mantencion_equipo")
      .insert({
        empresa_id: req.empresaId!,
        equipo_id: equipoId,
        tipo,
        origen,
        proveedor_id: proveedorFinal,
        realizado_por: realizadoPorFinal,
        checklist: items,
        kilometraje: km ?? null,
        horas_motor: horas ?? null,
        observaciones: typeof observaciones === "string" && observaciones.trim() ? observaciones.trim() : null,
        creado_por: req.userId!,
      })
      .select("*")
      .single();

    if (error || !creado) {
      res.status(500).json({ error: error?.message ?? "No se pudo crear el registro" });
      return;
    }

    // Firma (solo 'programa') — opcional, puede llegar después vía sync.
    if (tipo === "programa" && typeof firma_base64 === "string" && firma_base64) {
      try {
        const buffer = Buffer.from(firma_base64, "base64");
        const key = await subirFirmaRegistroMantencion(req.empresaId!, creado.id, buffer);
        await supabase.from("registros_mantencion_equipo").update({ firma_url: key }).eq("id", creado.id);
        creado.firma_url = key;
      } catch (err) {
        console.error("subir firma registro mantención:", err);
      }
    }

    res.status(201).json(creado);
  })
);

// ------------------------------------------------------------
// GET /:equipoId/registros-mantencion — historial completo. Solo
// quien puede gestionar Flota (admin / supervisor). Filtro ?tipo=.
// ------------------------------------------------------------
registrosMantencionRouter.get(
  "/:equipoId/registros-mantencion",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await puedeGestionarFlota(req))) {
      res.status(403).json({ error: "No tienes permiso para ver el historial de mantención" });
      return;
    }
    const { equipoId } = req.params;
    const equipo = await buscarEquipo(req.empresaId!, equipoId);
    if (!equipo) {
      res.status(404).json({ error: "Vehículo no encontrado" });
      return;
    }

    let query = supabase
      .from("registros_mantencion_equipo")
      .select("*, proveedor:proveedores(nombre), responsable:usuarios!registros_mantencion_equipo_realizado_por_fkey(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", equipoId)
      .order("creado_en", { ascending: false });

    const tipo = req.query.tipo;
    if (tipo === "diario" || tipo === "programa") query = query.eq("tipo", tipo);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// ------------------------------------------------------------
// GET /:equipoId/registros-mantencion/:id — detalle + fotos + firma.
// admin/supervisor, o el chofer de ese vehículo.
// ------------------------------------------------------------
registrosMantencionRouter.get(
  "/:equipoId/registros-mantencion/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipoId, id } = req.params;
    if (!(await puedeSobreEquipo(req, equipoId))) {
      res.status(403).json({ error: "No puedes ver este registro" });
      return;
    }
    const { data, error } = await supabase
      .from("registros_mantencion_equipo")
      .select("*, proveedor:proveedores(nombre), responsable:usuarios!registros_mantencion_equipo_realizado_por_fkey(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", equipoId)
      .eq("id", id)
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Registro no encontrado" });
      return;
    }

    const { data: fotos } = await supabase
      .from("registro_mantencion_fotos")
      .select("id, foto_url, subida_por, creado_en")
      .eq("registro_id", id)
      .order("creado_en", { ascending: true });

    const fotosFirmadas = await Promise.all(
      (fotos ?? []).map(async (f) => ({ ...f, url: await urlFirmada(f.foto_url, 15) }))
    );
    const firmaUrlFirmada = data.firma_url ? await urlFirmada(data.firma_url, 15) : null;

    res.json({ ...data, fotos: fotosFirmadas, firma_url_firmada: firmaUrlFirmada });
  })
);

// ------------------------------------------------------------
// POST /:equipoId/registros-mantencion/:id/fotos — sube una foto de
// respaldo (multipart, campo "foto"). La usa tanto el web como la cola
// de sync offline del móvil. Invalida el PDF cacheado.
// ------------------------------------------------------------
registrosMantencionRouter.post(
  "/:equipoId/registros-mantencion/:id/fotos",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipoId, id } = req.params;
    if (!req.file) {
      res.status(400).json({ error: "Falta el archivo (campo 'foto')" });
      return;
    }
    if (!(await puedeSobreEquipo(req, equipoId))) {
      res.status(403).json({ error: "No puedes editar este registro" });
      return;
    }
    const { data: registro } = await supabase
      .from("registros_mantencion_equipo")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", equipoId)
      .eq("id", id)
      .maybeSingle();
    if (!registro) {
      res.status(404).json({ error: "Registro no encontrado" });
      return;
    }

    const key = await subirFotoRegistroMantencion(req.empresaId!, id, req.file.buffer, req.file.mimetype);
    const { data: foto, error } = await supabase
      .from("registro_mantencion_fotos")
      .insert({ empresa_id: req.empresaId!, registro_id: id, foto_url: key, subida_por: req.userId! })
      .select("id, foto_url, subida_por, creado_en")
      .single();
    if (error || !foto) {
      res.status(500).json({ error: error?.message ?? "No se pudo guardar la foto" });
      return;
    }
    // El PDF cacheado ya no refleja las fotos — se regenera al próximo pedido.
    await supabase.from("registros_mantencion_equipo").update({ pdf_url: null }).eq("id", id);

    res.status(201).json({ ...foto, url: await urlFirmada(key, 15) });
  })
);

// ------------------------------------------------------------
// GET /:equipoId/registros-mantencion/:id/pdf — PDF del registro.
// Perezoso: se genera y cachea la primera vez.
// ------------------------------------------------------------
registrosMantencionRouter.get(
  "/:equipoId/registros-mantencion/:id/pdf",
  ah<RequestConEmpresa>(async (req, res) => {
    const { equipoId, id } = req.params;
    if (!(await puedeSobreEquipo(req, equipoId))) {
      res.status(403).json({ error: "No puedes ver este registro" });
      return;
    }
    const { data: reg } = await supabase
      .from("registros_mantencion_equipo")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("equipo_id", equipoId)
      .eq("id", id)
      .maybeSingle();
    if (!reg) {
      res.status(404).json({ error: "Registro no encontrado" });
      return;
    }

    const nombreArchivo = `mantencion-${reg.tipo}-${(reg.creado_en as string).slice(0, 10)}.pdf`;

    if (reg.pdf_url) {
      try {
        const cacheado = await descargarPdfRegistroMantencion(reg.pdf_url);
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${nombreArchivo}"`);
        res.send(cacheado);
        return;
      } catch (err) {
        console.error("No se pudo leer el PDF cacheado de mantención, se regenera:", err);
      }
    }

    const equipo = await buscarEquipo(req.empresaId!, equipoId);
    const { data: empresa } = await supabase
      .from("empresas")
      .select("nombre, logo_url, color_primario")
      .eq("id", req.empresaId!)
      .single();
    const { data: fotos } = await supabase
      .from("registro_mantencion_fotos")
      .select("foto_url")
      .eq("registro_id", id)
      .order("creado_en", { ascending: true });

    const fotoUrls = await Promise.all((fotos ?? []).map((f) => urlFirmada(f.foto_url, 15)));
    const firmaUrl = reg.firma_url ? await urlFirmada(reg.firma_url, 15) : null;
    const realizadoPor = await nombreRealizadoPor(req.empresaId!, reg);

    // Agrupa las respuestas del checklist por sección, respetando el orden
    // de aparición.
    const ordenSecciones: string[] = [];
    const porSeccion = new Map<string, { item: string; respuesta: RespuestaChecklistMantencion }[]>();
    for (const it of (reg.checklist as ItemChecklistMantencion[]) ?? []) {
      if (!porSeccion.has(it.seccion)) {
        porSeccion.set(it.seccion, []);
        ordenSecciones.push(it.seccion);
      }
      porSeccion.get(it.seccion)!.push({ item: it.item, respuesta: it.respuesta });
    }

    const datos: DatosRegistroMantencionPdf = {
      empresaNombre: empresa?.nombre ?? "",
      empresaLogoUrl: empresa?.logo_url ?? null,
      colorPrimario: empresa?.color_primario ?? null,
      textoPie: null,
      tipo: reg.tipo,
      origen: reg.origen,
      fecha: (reg.creado_en as string).slice(0, 10),
      vehiculoPatente: equipo?.patente ?? null,
      vehiculoNombre: equipo?.nombre ?? "—",
      vehiculoDescripcion: [equipo?.marca, equipo?.modelo, equipo?.anio].filter(Boolean).join(" · ") || null,
      realizadoPor,
      kilometraje: reg.kilometraje === null ? null : Number(reg.kilometraje),
      horasMotor: reg.horas_motor === null ? null : Number(reg.horas_motor),
      observaciones: reg.observaciones,
      secciones: ordenSecciones.map((nombre) => ({ nombre, items: porSeccion.get(nombre)! })),
      fotoUrls,
      firmaUrl,
    };

    const pdf = await generarPdfEnWorker<DatosRegistroMantencionPdf>("mantencion", datos);
    try {
      const key = await subirPdfRegistroMantencion(req.empresaId!, id, pdf);
      await supabase.from("registros_mantencion_equipo").update({ pdf_url: key }).eq("id", id);
    } catch (err) {
      console.error("No se pudo cachear el PDF de mantención:", err);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombreArchivo}"`);
    res.send(pdf);
  })
);
