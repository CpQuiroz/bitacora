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
import type { EstadoLevantamiento, FuncionColaborador, Levantamiento } from "@bitacora/shared";
import { ESTADOS_LEVANTAMIENTO, FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { empresaTieneModulo } from "../permisos";
import { verificarLimiteOS } from "../limites";
import { crearOrdenServicio } from "../ordenes";
import { subirFotoLevantamiento, urlFirmada } from "../storage";
import { notificar } from "../notificar";
import { siguienteFolioLevantamiento } from "../folios";

export const levantamientosRouter = Router();

// Mismo criterio que tareas.ts (Agenda) para hora_visita (migración 114).
const HORA_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

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

// El shape crudo de la fila ya está en @bitacora/shared (`Levantamiento`)
// — antes se redeclaraba acá aparte (mismo hallazgo en mobile y web).
async function buscarLevantamiento(empresaId: string, id: string): Promise<Levantamiento | null> {
  const { data } = await supabase.from("levantamientos").select("*").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  return (data as Levantamiento) ?? null;
}

// Admin ve cualquiera de su empresa; el técnico solo los suyos.
async function puedeVer(req: RequestConEmpresa, lev: Levantamiento): Promise<boolean> {
  if (esAdmin(req)) return true;
  return lev.tecnico_id === req.userId && (await esTecnicoAsignable(req.empresaId!, req.userId!));
}

// ------------------------------------------------------------
// GET / — listar. Admin: todos (filtro opcional ?estado=). Técnico:
// solo los suyos asignados. ?desde=&hasta= (YYYY-MM-DD) acota por
// fecha_visita — lo usa la Agenda web para traer solo el rango visible
// (sin esos params, mismo comportamiento de siempre).
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
      .select("*, cliente:clientes(id, nombre, direccion), tecnico:usuarios!tecnico_id(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false });

    const { desde, hasta } = req.query;
    if (typeof desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(desde)) query = query.gte("fecha_visita", desde);
    if (typeof hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) query = query.lte("fecha_visita", hasta);

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
        .select("id, catalogo_item_id, cantidad, agregado_por_admin, catalogo_item:catalogo_items(id, nombre, precio_base, unidad)")
        .eq("levantamiento_id", lev.id),
      supabase.from("levantamiento_fotos").select("id, foto_url, descripcion, creado_en").eq("levantamiento_id", lev.id).order("creado_en"),
      // tenant-ok: cliente_id sale de `lev`, ya cargado con
      // .eq("empresa_id", req.empresaId!) en buscarLevantamiento() —
      // no puede apuntar a un cliente de otra empresa.
      supabase.from("clientes").select("id, nombre, direccion").eq("id", lev.cliente_id).maybeSingle(),
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

    const fotos = await Promise.all(
      (fotosRaw ?? []).map(async (f) => ({ id: f.id, creado_en: f.creado_en, descripcion: f.descripcion ?? null, url: await urlFirmada(f.foto_url, 15) }))
    );

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
    const { cliente_id, tecnico_id, descripcion_requerimiento, fecha_visita, hora_visita } = req.body ?? {};
    if (typeof cliente_id !== "string" || !cliente_id) {
      res.status(400).json({ error: "Falta cliente_id" });
      return;
    }
    if (hora_visita !== undefined && hora_visita !== null && hora_visita !== "" && !HORA_REGEX.test(hora_visita)) {
      res.status(400).json({ error: "hora_visita inválida (usa HH:MM)" });
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

    // Folio propio (migración 108), formateado como "LEV-000X" solo al
    // mostrarlo (formatearFolio, @bitacora/shared). Tolerante a error —
    // ver folios.ts.
    const folio = await siguienteFolioLevantamiento(req.empresaId!);

    const { data, error } = await supabase
      .from("levantamientos")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        tecnico_id: tecnicoValido,
        creado_por: req.userId!,
        estado: tecnicoValido ? "asignado" : "creado",
        descripcion_requerimiento: typeof descripcion_requerimiento === "string" ? descripcion_requerimiento.trim() || null : null,
        // Postgres rechaza un formato de fecha inválido (mismo criterio
        // que trabajos.fecha, sin regex acá) — hora_visita sí se valida
        // arriba (HORA_REGEX, migración 114).
        fecha_visita: typeof fecha_visita === "string" && fecha_visita ? fecha_visita : null,
        hora_visita: typeof hora_visita === "string" && hora_visita ? hora_visita : null,
        folio,
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
// PATCH /:id — Admin edita los datos de creación (cliente, técnico
// asignado, qué pidió evaluar). Si cambia el técnico y el levantamiento
// seguía en 'creado', pasa a 'asignado' y se notifica — mismo criterio
// que POST /.
// ------------------------------------------------------------
levantamientosRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede editar un levantamiento" });
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

    const { cliente_id, tecnico_id, descripcion_requerimiento, fecha_visita, hora_visita } = req.body ?? {};
    const cambios: Partial<Levantamiento> = { actualizado_en: new Date().toISOString() };

    if (hora_visita !== undefined && hora_visita !== null && hora_visita !== "" && !HORA_REGEX.test(hora_visita)) {
      res.status(400).json({ error: "hora_visita inválida (usa HH:MM)" });
      return;
    }

    if (cliente_id !== undefined) {
      if (typeof cliente_id !== "string" || !cliente_id) {
        res.status(400).json({ error: "cliente_id inválido" });
        return;
      }
      const { data: cliente } = await supabase.from("clientes").select("id").eq("empresa_id", req.empresaId!).eq("id", cliente_id).maybeSingle();
      if (!cliente) {
        res.status(400).json({ error: "cliente_id inválido" });
        return;
      }
      cambios.cliente_id = cliente_id;
    }

    let notificarNuevoTecnico: string | null = null;
    if (tecnico_id !== undefined) {
      if (tecnico_id === null || tecnico_id === "") {
        cambios.tecnico_id = null;
        if (lev.estado === "asignado") cambios.estado = "creado";
      } else {
        if (typeof tecnico_id !== "string" || !(await esTecnicoAsignable(req.empresaId!, tecnico_id))) {
          res.status(400).json({ error: "tecnico_id inválido — el usuario debe tener función Técnico o Chofer" });
          return;
        }
        cambios.tecnico_id = tecnico_id;
        if (tecnico_id !== lev.tecnico_id) {
          if (lev.estado === "creado") cambios.estado = "asignado";
          notificarNuevoTecnico = tecnico_id;
        }
      }
    }

    if (descripcion_requerimiento !== undefined) {
      cambios.descripcion_requerimiento = typeof descripcion_requerimiento === "string" ? descripcion_requerimiento.trim() || null : null;
    }

    if (fecha_visita !== undefined) {
      cambios.fecha_visita = typeof fecha_visita === "string" && fecha_visita ? fecha_visita : null;
    }

    if (hora_visita !== undefined) {
      cambios.hora_visita = typeof hora_visita === "string" && hora_visita ? hora_visita : null;
    }

    const { error } = await supabase.from("levantamientos").update(cambios).eq("id", lev.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (notificarNuevoTecnico) {
      await notificar(req.empresaId!, notificarNuevoTecnico, "levantamiento_asignado", {
        cuerpo: "Tienes un nuevo levantamiento asignado.",
        entidadTipo: "levantamiento",
        entidadId: lev.id,
      });
    }

    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// DELETE /:id — Admin. Borrado real (levantamiento_materiales y
// levantamiento_fotos caen en cascada) — bloqueado solo si ya está
// 'aprobado' (perdería la trazabilidad de por qué nació esa OS); un
// 'rechazado' sí se puede borrar, no deja nada corriendo.
// ------------------------------------------------------------
levantamientosRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede eliminar un levantamiento" });
      return;
    }
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    if (lev.estado === "aprobado") {
      res.status(409).json({ error: "Un levantamiento aprobado no se puede eliminar — ya generó una orden de servicio" });
      return;
    }
    const { error } = await supabase.from("levantamientos").delete().eq("empresa_id", req.empresaId!).eq("id", lev.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
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
      // Fase 4 (23-sep-2026, pedido explícito): este reemplazo es del
      // TÉCNICO — solo borra SUS propios materiales (agregado_por_admin
      // = false). Los que el Admin haya sumado después (ver POST
      // /:id/materiales, más abajo) sobreviven aunque el técnico vuelva
      // a guardar — antes de esta fase esto era un delete total, que
      // hubiera borrado también lo que agregara el Admin.
      await supabase.from("levantamiento_materiales").delete().eq("levantamiento_id", lev.id).eq("agregado_por_admin", false);
      if (materialesParseados.length > 0) {
        await supabase.from("levantamiento_materiales").insert(
          materialesParseados.map((m) => ({
            empresa_id: req.empresaId!,
            levantamiento_id: lev.id,
            catalogo_item_id: m.catalogo_item_id,
            cantidad: m.cantidad,
            agregado_por: req.userId ?? null,
            agregado_por_admin: false,
          }))
        );
      }
    }

    res.json({ ok: true });
  })
);

// ------------------------------------------------------------
// POST /:id/materiales — Fase 4 (23-sep-2026, pedido explícito): el
// Admin puede sumar más materiales a un levantamiento YA completado
// por el técnico (o en cualquier estado, salvo cerrado). Distinto del
// reemplazo de arriba (que es del técnico, sus propios materiales) —
// esto siempre AGREGA una fila nueva, nunca borra ni reemplaza las
// del técnico. agregado_por_admin=true queda para distinguirla en la
// UI (web y mobile).
// ------------------------------------------------------------
levantamientosRouter.post(
  "/:id/materiales",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    if (!esAdmin(req)) {
      res.status(403).json({ error: "Solo un Admin puede agregar materiales acá" });
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
    const { catalogo_item_id, cantidad } = req.body ?? {};
    const cantidadNum = Number(cantidad);
    if (typeof catalogo_item_id !== "string" || !catalogo_item_id || !(cantidadNum > 0)) {
      res.status(400).json({ error: "Falta catalogo_item_id y una cantidad mayor a 0" });
      return;
    }
    const { data, error } = await supabase
      .from("levantamiento_materiales")
      .insert({
        empresa_id: req.empresaId!,
        levantamiento_id: lev.id,
        catalogo_item_id,
        cantidad: cantidadNum,
        agregado_por: req.userId ?? null,
        agregado_por_admin: true,
      })
      .select("id, catalogo_item_id, cantidad, agregado_por_admin, catalogo_item:catalogo_items(id, nombre, precio_base, unidad)")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
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

    // descripcion viaje como campo de texto del mismo multipart (no es
    // un archivo) — multer la deja en req.body igual que cualquier
    // form-data sin archivo. Opcional: mobile la manda al elegir la
    // foto (ver encolarFotoLevantamiento), web la deja vacía al subir y
    // la agrega después con el PATCH de más abajo.
    const descripcion = typeof req.body?.descripcion === "string" ? req.body.descripcion.trim() || null : null;

    const key = await subirFotoLevantamiento(req.empresaId!, lev.id, req.file.buffer, req.file.mimetype);
    const { data, error } = await supabase
      .from("levantamiento_fotos")
      .insert({ empresa_id: req.empresaId!, levantamiento_id: lev.id, foto_url: key, descripcion, subida_por: req.userId ?? null })
      .select("id, descripcion, creado_en")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ id: data.id, creado_en: data.creado_en, descripcion: data.descripcion, url: await urlFirmada(key, 15) });
  })
);

// ------------------------------------------------------------
// PATCH /:id/fotos/:fotoId — editar la descripción de una foto ya
// subida (23-sep-2026, pedido explícito). Mismo criterio de permiso
// que subir/borrar: Admin o el técnico asignado, y solo mientras el
// levantamiento no esté cerrado.
// ------------------------------------------------------------
levantamientosRouter.patch(
  "/:id/fotos/:fotoId",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    const esElTecnico = lev.tecnico_id === req.userId && (await esTecnicoAsignable(req.empresaId!, req.userId!));
    if (!esAdmin(req) && !esElTecnico) {
      res.status(403).json({ error: "No puedes editar fotos de este levantamiento" });
      return;
    }
    if (["aprobado", "rechazado"].includes(lev.estado)) {
      res.status(409).json({ error: "Este levantamiento ya fue cerrado" });
      return;
    }
    const { descripcion } = req.body ?? {};
    if (typeof descripcion !== "string") {
      res.status(400).json({ error: "Falta descripcion" });
      return;
    }
    const { data, error } = await supabase
      .from("levantamiento_fotos")
      .update({ descripcion: descripcion.trim() || null })
      .eq("empresa_id", req.empresaId!)
      .eq("levantamiento_id", lev.id)
      .eq("id", req.params.fotoId)
      .select("id, descripcion")
      .maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Foto no encontrada" });
      return;
    }
    res.json(data);
  })
);

// ------------------------------------------------------------
// DELETE /:id/fotos/:fotoId — Admin o el técnico asignado (se
// equivocó de foto o salió borrosa). Borrado real de la fila — mismo
// criterio que registro_mantencion_fotos, no borra el objeto de S3.
// ------------------------------------------------------------
levantamientosRouter.delete(
  "/:id/fotos/:fotoId",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!(await moduloActivo(req, res))) return;
    const lev = await buscarLevantamiento(req.empresaId!, req.params.id);
    if (!lev) {
      res.status(404).json({ error: "Levantamiento no encontrado" });
      return;
    }
    const esElTecnico = lev.tecnico_id === req.userId && (await esTecnicoAsignable(req.empresaId!, req.userId!));
    if (!esAdmin(req) && !esElTecnico) {
      res.status(403).json({ error: "No puedes eliminar fotos de este levantamiento" });
      return;
    }
    if (["aprobado", "rechazado"].includes(lev.estado)) {
      res.status(409).json({ error: "Este levantamiento ya fue cerrado" });
      return;
    }
    const { data: foto } = await supabase
      .from("levantamiento_fotos")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("levantamiento_id", lev.id)
      .eq("id", req.params.fotoId)
      .maybeSingle();
    if (!foto) {
      res.status(404).json({ error: "Foto no encontrada" });
      return;
    }
    const { error } = await supabase.from("levantamiento_fotos").delete().eq("empresa_id", req.empresaId!).eq("id", foto.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
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
      .select("catalogo_item_id, cantidad, catalogo_item:catalogo_items(nombre, precio_base, costo, precio_mayorista, precio_minorista)")
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
        // Migración 116 — mismo criterio que "Convertir a OS" en
        // cotizaciones.ts: se copian si la empresa los tiene cargados.
        costo: item?.costo ?? null,
        precio_mayorista: item?.precio_mayorista ?? null,
        precio_minorista: item?.precio_minorista ?? null,
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
