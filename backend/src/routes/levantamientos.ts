// ============================================================
// BITÁCORA — Módulo Levantamientos (migración 100).
//
// Admin crea una Orden de Levantamiento → el técnico asignado (rol
// colaborador, usuarios.funcion ∈ FUNCIONES_LEVANTAMIENTOS) la completa
// en terreno (descripción + materiales del Catálogo + fotos, SIN tocar
// stock) → el Admin cotiza fuera de Bitácora (referencia_externa libre,
// ningún ERP integrado) → al aprobar nace una OS automáticamente,
// heredando los materiales como os_items. El descuento de stock ocurre
// ahí mismo, pero no hace falta ningún gancho especial: la OS se crea
// igual que una manual (mismo crearOrdenServicio + os_items) y
// aplicarDescuentoInventarioSiCorresponde (inventario.ts) se dispara
// solo, por transición de estado_os, exactamente como para cualquier
// otra OS.
//
// Autorización por handler (no requiereModulo() a nivel de router):
// el eje de rol (admin/supervisor/...) no alcanza para distinguir
// "técnico" dentro de "colaborador" — eso lo da usuarios.funcion. Cada
// handler valida módulo contratado (empresaTieneModulo) + el permiso
// puntual (Admin para gestión; el propio técnico asignado para terreno).
//
// Solo Admin crea/cotiza/aprueba/rechaza (confirmado con la usuaria,
// Paso 0) — Supervisor no tiene acceso especial acá.
// ============================================================
import { Router } from "express";
import multer from "multer";
import type { EstadoLevantamiento, FuncionColaborador } from "@bitacora/shared";
import { ESTADOS_LEVANTAMIENTO, FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { empresaTieneModulo } from "../permisos";
import { verificarLimiteOS } from "../limites";
import { crearOrdenServicio } from "../ordenes";
import { subirFotoLevantamiento, urlFirmada } from "../storage";
import { notificar } from "../notificar";

export const levantamientosRouter = Router();

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

async function moduloActivo(req: RequestConEmpresa, res: import("express").Response): Promise<boolean> {
  if (!(await empresaTieneModulo(req.empresaId!, "levantamientos"))) {
    res.status(403).json({ error: "Este módulo no está disponible para tu empresa" });
    return false;
  }
  return true;
}

const esAdmin = (req: RequestConEmpresa) => req.rol === "admin";

// Siempre acotado a la empresa del request — sin esto, un Admin podría
// (por error de tipeo del id, o un id adivinado) asignar como técnico a
// un usuario de OTRA empresa. Hallazgo real de audit:tenant.
async function funcionDe(empresaId: string, userId: string): Promise<FuncionColaborador | null> {
  const { data } = await supabase.from("usuarios").select("funcion").eq("empresa_id", empresaId).eq("id", userId).maybeSingle();
  return (data?.funcion as FuncionColaborador | null) ?? null;
}

async function esTecnicoAsignable(empresaId: string, userId: string): Promise<boolean> {
  const funcion = await funcionDe(empresaId, userId);
  return funcion != null && FUNCIONES_LEVANTAMIENTOS.includes(funcion);
}

type LevantamientoRow = {
  id: string;
  empresa_id: string;
  cliente_id: string;
  tecnico_id: string | null;
  creado_por: string | null;
  estado: EstadoLevantamiento;
  descripcion_requerimiento: string | null;
  descripcion_tecnico: string | null;
  referencia_externa: string | null;
  orden_servicio_id: string | null;
  creado_en: string;
  actualizado_en: string;
};

async function buscarLevantamiento(empresaId: string, id: string): Promise<LevantamientoRow | null> {
  const { data } = await supabase.from("levantamientos").select("*").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  return (data as LevantamientoRow) ?? null;
}

// Admin ve cualquiera de su empresa; el técnico solo los suyos.
async function puedeVer(req: RequestConEmpresa, lev: LevantamientoRow): Promise<boolean> {
  if (esAdmin(req)) return true;
  return lev.tecnico_id === req.userId && (await esTecnicoAsignable(req.empresaId!, req.userId!));
}

// ------------------------------------------------------------
// GET / — listar. Admin: todos (filtro opcional ?estado=). Técnico:
// solo los suyos asignados.
// ------------------------------------------------------------
levantamientosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;

    let query = supabase
      .from("levantamientos")
      // levantamientos tiene 2 FK a usuarios (tecnico_id, creado_por) —
      // PostgREST necesita el hint de columna (!tecnico_id) para saber
      // cuál de las dos usar; sin esto tira "more than one relationship
      // was found" (hallazgo real, probado en vivo contra dev).
      .select("*, cliente:clientes(id, nombre), tecnico:usuarios!tecnico_id(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false });

    if (esAdmin(req)) {
      const estado = typeof req.query.estado === "string" && ESTADOS_LEVANTAMIENTO.includes(req.query.estado as EstadoLevantamiento) ? (req.query.estado as EstadoLevantamiento) : undefined;
      if (estado) query = query.eq("estado", estado);
    } else if (await esTecnicoAsignable(req.empresaId!, req.userId!)) {
      query = query.eq("tecnico_id", req.userId!);
    } else {
      res.status(403).json({ error: "No tienes permiso para ver levantamientos" });
      return;
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// ------------------------------------------------------------
// GET /:id — detalle (con materiales y fotos firmadas).
// ------------------------------------------------------------
levantamientosRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    if (!(await puedeVer(req, lev))) {
      res.status(403).json({ error: "No tienes permiso para ver este levantamiento" });
      return;
    }

    const [{ data: materiales }, { data: fotosRaw }, { data: cliente }, { data: tecnico }, { data: orden }] = await Promise.all([
      supabase
        .from("levantamiento_materiales")
        .select("id, catalogo_item_id, cantidad, catalogo_item:catalogo_items(id, nombre, precio_base, unidad)")
        .eq("levantamiento_id", lev.id),
      supabase.from("levantamiento_fotos").select("id, foto_url, creado_en").eq("levantamiento_id", lev.id).order("creado_en"),
      // tenant-ok: cliente_id sale de `lev`, ya cargado con
      // .eq("empresa_id", req.empresaId!) en buscarLevantamiento() —
      // no puede apuntar a un cliente de otra empresa.
      supabase.from("clientes").select("id, nombre").eq("id", lev.cliente_id).maybeSingle(),
      // tenant-ok: tecnico_id sale de `lev`, y solo se pudo haber
      // guardado ahí tras pasar esTecnicoAsignable(empresaId, ...) en
      // POST / — ya acotado a la empresa.
      lev.tecnico_id ? supabase.from("usuarios").select("id, nombre").eq("id", lev.tecnico_id).maybeSingle() : Promise.resolve({ data: null }),
      // trabajo_id, no solo el id de ordenes_servicio, porque la ficha
      // web de una OS vive en /dashboard/ordenes/[trabajo_id].
      // tenant-ok: orden_servicio_id sale de `lev` y solo lo escribe
      // POST /:id/aprobar, que crea la OS dentro de req.empresaId! —
      // nunca puede apuntar a la OS de otra empresa.
      lev.orden_servicio_id ? supabase.from("ordenes_servicio").select("trabajo_id, folio").eq("id", lev.orden_servicio_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    const fotos = await Promise.all((fotosRaw ?? []).map(async (f) => ({ id: f.id, creado_en: f.creado_en, url: await urlFirmada(f.foto_url, 15) })));

    res.json({ ...lev, cliente, tecnico, materiales: materiales ?? [], fotos, trabajo_id: orden?.trabajo_id ?? null, folio_os: orden?.folio ?? null });
  })
);

// ------------------------------------------------------------
// POST / — crear (Admin). tecnico_id opcional: si viene, arranca
// 'asignado' y se notifica; si no, queda 'creado' para asignar después.
// ------------------------------------------------------------
levantamientosRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede crear un levantamiento" });
      return;
    }
    const { cliente_id, tecnico_id, descripcion_requerimiento } = req.body ?? {};
    if (typeof cliente_id !== "string" || !cliente_id) {
      res.status(400).json({ error: "Falta cliente_id" });
      return;
    }
    const { data: cliente } = await supabase.from("clientes").select("id").eq("empresa_id", req.empresaId!).eq("id", cliente_id).maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    let tecnicoValido: string | null = null;
    if (tecnico_id) {
      if (typeof tecnico_id !== "string" || !(await esTecnicoAsignable(req.empresaId!, tecnico_id))) {
        res.status(400).json({ error: "tecnico_id inválido — el usuario debe tener función Técnico o Chofer" });
        return;
      }
      tecnicoValido = tecnico_id;
    }

    const { data, error } = await supabase
      .from("levantamientos")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        tecnico_id: tecnicoValido,
        creado_por: req.userId!,
        estado: tecnicoValido ? "asignado" : "creado",
        descripcion_requerimiento: typeof descripcion_requerimiento === "string" ? descripcion_requerimiento.trim() || null : null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (tecnicoValido) {
      await notificar(req.empresaId!, tecnicoValido, "levantamiento_asignado", {
        cuerpo: "Tienes un nuevo levantamiento asignado.",
        entidadTipo: "levantamiento",
        entidadId: data.id,
      });
    }

    res.status(201).json(data);
  })
);

// ------------------------------------------------------------
// PATCH /:id/completar — el técnico asignado completa lo observado en
// terreno: descripción + materiales (reemplaza los existentes) + pasa a
// 'completado_tecnico'. No toca stock. El Admin también puede (por si
// hay que corregir algo desde la web).
// ------------------------------------------------------------
levantamientosRouter.patch(
  "/:id/completar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    const esElTecnico = lev.tecnico_id === req.userId && (await esTecnicoAsignable(req.empresaId!, req.userId!));
    if (!esAdmin(req) && !esElTecnico) {
      res.status(403).json({ error: "No puedes completar este levantamiento" });
      return;
    }
    if (["aprobado", "rechazado"].includes(lev.estado)) {
      res.status(409).json({ error: "Este levantamiento ya fue cerrado" });
      return;
    }

    const { descripcion_tecnico, materiales } = req.body ?? {};
    if (materiales !== undefined && !Array.isArray(materiales)) {
      res.status(400).json({ error: "materiales debe ser un arreglo" });
      return;
    }
    const materialesParseados: { catalogo_item_id: string; cantidad: number }[] = [];
    for (const m of materiales ?? []) {
      const catalogoItemId = m?.catalogo_item_id;
      const cantidad = Number(m?.cantidad);
      if (typeof catalogoItemId !== "string" || !catalogoItemId || !(cantidad > 0)) {
        res.status(400).json({ error: "Cada material necesita catalogo_item_id y una cantidad mayor a 0" });
        return;
      }
      materialesParseados.push({ catalogo_item_id: catalogoItemId, cantidad });
    }

    const { error: errorUpdate } = await supabase
      .from("levantamientos")
      .update({
        descripcion_tecnico: typeof descripcion_tecnico === "string" ? descripcion_tecnico.trim() || null : lev.descripcion_tecnico,
        estado: "completado_tecnico" as EstadoLevantamiento,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", lev.id);
    if (errorUpdate) {
      res.status(500).json({ error: errorUpdate.message });
      return;
    }

    if (materiales !== undefined) {
      await supabase.from("levantamiento_materiales").delete().eq("levantamiento_id", lev.id);
      if (materialesParseados.length > 0) {
        await supabase.from("levantamiento_materiales").insert(
          materialesParseados.map((m) => ({
            empresa_id: req.empresaId!,
            levantamiento_id: lev.id,
            catalogo_item_id: m.catalogo_item_id,
            cantidad: m.cantidad,
          }))
        );
      }
    }

    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// POST /:id/fotos — subir una foto (multipart, campo "foto").
// ------------------------------------------------------------
levantamientosRouter.post(
  "/:id/fotos",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!req.file) {
      res.status(400).json({ error: "Falta la foto" });
      return;
    }
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    const esElTecnico = lev.tecnico_id === req.userId && (await esTecnicoAsignable(req.empresaId!, req.userId!));
    if (!esAdmin(req) && !esElTecnico) {
      res.status(403).json({ error: "No puedes subir fotos a este levantamiento" });
      return;
    }
    if (["aprobado", "rechazado"].includes(lev.estado)) {
      res.status(409).json({ error: "Este levantamiento ya fue cerrado" });
      return;
    }

    const key = await subirFotoLevantamiento(req.empresaId!, lev.id, req.file.buffer, req.file.mimetype);
    const { data, error } = await supabase
      .from("levantamiento_fotos")
      .insert({ empresa_id: req.empresaId!, levantamiento_id: lev.id, foto_url: key, subida_por: req.userId ?? null })
      .select("id, creado_en")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ id: data.id, creado_en: data.creado_en, url: await urlFirmada(key, 15) });
  })
);

// ------------------------------------------------------------
// PATCH /:id/cotizado — Admin marca que ya cotizó fuera de Bitácora
// (referencia_externa opcional: folio/número del ERP externo).
// ------------------------------------------------------------
levantamientosRouter.patch(
  "/:id/cotizado",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede marcar la cotización" });
      return;
    }
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    if (lev.estado !== "completado_tecnico") {
      res.status(409).json({ error: "El técnico todavía no completó este levantamiento" });
      return;
    }
    const { referencia_externa } = req.body ?? {};
    const { error } = await supabase
      .from("levantamientos")
      .update({
        estado: "cotizado_externo" as EstadoLevantamiento,
        referencia_externa: typeof referencia_externa === "string" ? referencia_externa.trim() || null : null,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", lev.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// POST /:id/rechazar — Admin. No crea OS, no toca stock.
// ------------------------------------------------------------
levantamientosRouter.post(
  "/:id/rechazar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede rechazar un levantamiento" });
      return;
    }
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    if (["aprobado", "rechazado"].includes(lev.estado)) {
      res.status(409).json({ error: "Este levantamiento ya fue cerrado" });
      return;
    }
    const { error } = await supabase
      .from("levantamientos")
      .update({ estado: "rechazado" as EstadoLevantamiento, actualizado_en: new Date().toISOString() })
      .eq("id", lev.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// POST /:id/aprobar — Admin. Crea la OS (mismo camino que una manual:
// trabajos + crearOrdenServicio + os_items) copiando los materiales del
// levantamiento, y vincula orden_servicio_id. El descuento de stock NO
// se dispara acá — ocurre solo, más adelante, cuando esa OS pase por la
// transición de estado_os que la empresa tenga configurada (igual que
// cualquier otra OS), vía aplicarDescuentoInventarioSiCorresponde.
// ------------------------------------------------------------
levantamientosRouter.post(
  "/:id/aprobar",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede aprobar un levantamiento" });
      return;
    }
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    if (lev.estado !== "cotizado_externo") {
      res.status(409).json({ error: "Este levantamiento todavía no está cotizado" });
      return;
    }

    const { data: cliente } = await supabase.from("clientes").select("nombre").eq("id", lev.cliente_id).maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "El cliente de este levantamiento ya no existe" });
      return;
    }
    const { data: materiales } = await supabase
      .from("levantamiento_materiales")
      .select("catalogo_item_id, cantidad, catalogo_item:catalogo_items(nombre, precio_base)")
      .eq("levantamiento_id", lev.id);

    await verificarLimiteOS(req.empresaId!);

    const { data: trabajo, error: errorTrabajo } = await supabase
      .from("trabajos")
      .insert({
        empresa_id: req.empresaId!,
        cliente: cliente.nombre,
        cliente_id: lev.cliente_id,
        fecha: new Date().toISOString().slice(0, 10),
        monto: 0,
        estado: "en_curso",
        descripcion: lev.descripcion_requerimiento ? `Levantamiento aprobado — ${lev.descripcion_requerimiento}` : "Levantamiento aprobado",
        prioridad: "media",
        datos: {},
        responsable_id: lev.tecnico_id ?? req.userId!,
      })
      .select()
      .single();
    if (errorTrabajo) {
      res.status(500).json({ error: errorTrabajo.message });
      return;
    }

    const orden = await crearOrdenServicio(req.empresaId!, trabajo.id);

    const itemsOS = (materiales ?? []).map((m) => {
      // Join singular pese al tipado de array que a veces infiere
      // supabase-js — mismo patrón usado en el resto del backend.
      const item = Array.isArray(m.catalogo_item) ? m.catalogo_item[0] : m.catalogo_item;
      return {
        empresa_id: req.empresaId!,
        trabajo_id: trabajo.id,
        catalogo_item_id: m.catalogo_item_id,
        descripcion: item?.nombre ?? "Material del levantamiento",
        cantidad: m.cantidad,
        precio_unitario: item?.precio_base ?? 0,
      };
    });
    if (itemsOS.length > 0) {
      await supabase.from("os_items").insert(itemsOS);
    }

    const { error: errorLev } = await supabase
      .from("levantamientos")
      .update({
        estado: "aprobado" as EstadoLevantamiento,
        orden_servicio_id: orden.id,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", lev.id);
    if (errorLev) {
      res.status(500).json({ error: errorLev.message });
      return;
    }

    res.json({ ok: true, trabajo_id: trabajo.id, orden_servicio_id: orden.id, folio: orden.folio });
  })
);
