import { Router } from "express";
import multer from "multer";
import type { EstadoViaje, Viaje } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFotoGuiaConNombre, urlFirmadaFotoGuia } from "../storage";
import { calcularMontos } from "../viajesMontos";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

// Viajes desde la app móvil / el bot de WhatsApp.
//
//  - Un colaborador (chofer) registra y ve LOS SUYOS, sin necesitar el
//    módulo "viajes" completo. Sus viajes entran en 'borrador' (o
//    'confirmado' si la empresa activó la aprobación automática).
//  - Un rol de gestión (admin/supervisor/…) puede además ver los de todo
//    el equipo (?equipo=true), aprobarlos, editarlos y eliminarlos desde
//    la app — todo scopeado a su empresa. Esto va acá y no en /api/viajes
//    a propósito: así el admin gestiona viajes desde el celular aunque la
//    empresa no tenga el módulo "viajes" de la web activado.
export const misViajesRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

const esGestion = (req: RequestConEmpresa) => req.rol !== "colaborador";

misViajesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const verEquipo = req.query.equipo === "true" && esGestion(req);

    let query = supabase
      .from("viajes")
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false })
      .limit(100);

    if (!verEquipo) query = query.eq("chofer_id", req.userId!);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// Un viaje puntual, con la foto de la guía firmada. El chofer solo ve los
// suyos; un rol de gestión ve cualquiera de su empresa.
misViajesRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("viajes")
      .select("*, cliente_info:clientes(id, nombre), equipo_info:equipos(nombre, patente), chofer:usuarios(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);
    if (!esGestion(req)) query = query.eq("chofer_id", req.userId!);

    const { data, error } = await query.maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    const foto_guia_url_firmada = data.foto_guia_url ? await urlFirmadaFotoGuia(data.foto_guia_url, 15) : null;
    res.json({ ...data, foto_guia_url_firmada });
  })
);

misViajesRouter.post(
  "/",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, numero_guia, origen, destino, equipo_id, km_inicial, km_final, subtotal, aplica_iva } = req.body ?? {};

    if (typeof numero_guia !== "string" || !numero_guia.trim()) {
      res.status(400).json({ error: "Falta el número de guía" });
      return;
    }
    if (typeof origen !== "string" || !origen.trim() || typeof destino !== "string" || !destino.trim()) {
      res.status(400).json({ error: "Falta origen o destino" });
      return;
    }
    const subtotalNum = Number(subtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
      res.status(400).json({ error: "Monto inválido" });
      return;
    }

    // Cliente: obligatorio y de la misma empresa.
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nombre")
      .eq("empresa_id", req.empresaId!)
      .eq("id", typeof cliente_id === "string" ? cliente_id : "")
      .maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "Selecciona un cliente válido" });
      return;
    }

    // Equipo opcional, validado contra la empresa.
    let equipoId: string | null = null;
    if (typeof equipo_id === "string" && equipo_id) {
      const { data: equipo } = await supabase
        .from("equipos")
        .select("id")
        .eq("empresa_id", req.empresaId!)
        .eq("id", equipo_id)
        .maybeSingle();
      equipoId = equipo?.id ?? null;
    }

    let fotoKey: string | null = null;
    if (req.file) {
      fotoKey = await subirFotoGuiaConNombre(req.empresaId!, numero_guia.trim(), req.file.buffer, req.file.mimetype);
    }

    const aplicaIva = aplica_iva === "false" || aplica_iva === false ? false : true;
    const { subtotal: sub, iva, total } = calcularMontos(subtotalNum, aplicaIva);
    const aNum = (v: unknown) => (v === "" || v == null ? null : Number(v));

    // Si la empresa activó la aprobación automática, el viaje entra
    // directo como "confirmado" en vez de esperar al admin.
    const { data: empresa } = await supabase
      .from("empresas")
      .select("viajes_aprobacion_automatica")
      .eq("id", req.empresaId!)
      .maybeSingle();
    const estado: EstadoViaje = empresa?.viajes_aprobacion_automatica ? "confirmado" : "borrador";

    const { data, error } = await supabase
      .from("viajes")
      .insert({
        empresa_id: req.empresaId!,
        fecha: new Date().toISOString().slice(0, 10),
        numero_guia: numero_guia.trim(),
        cliente: cliente.nombre,
        cliente_id: cliente.id,
        chofer_id: req.userId!,
        equipo_id: equipoId,
        origen: origen.trim(),
        destino: destino.trim(),
        km_inicial: aNum(km_inicial),
        km_final: aNum(km_final),
        subtotal: sub,
        aplica_iva: aplicaIva,
        iva,
        total,
        estado,
        origen_captura: "app",
        foto_guia_url: fotoKey,
      })
      .select("*, cliente_info:clientes(id, nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

// Editar un viaje desde la app.
//  - Gestión: cualquier viaje de la empresa, y además puede aprobarlo
//    (cambiar el estado a "confirmado").
//  - Colaborador: solo los suyos y solo mientras no estén facturados; no
//    puede cambiar el estado (aprobar es de la oficina).
misViajesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const gestion = esGestion(req);

    const { data: existente } = await supabase
      .from("viajes")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existente) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (!gestion && existente.chofer_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes editar tus propios viajes" });
      return;
    }
    if (existente.estado === "facturado") {
      res.status(400).json({ error: "Este viaje ya fue facturado y no se puede editar" });
      return;
    }

    const { numero_guia, origen, destino, cliente_id, km_inicial, km_final, subtotal, aplica_iva, comentarios, estado } = req.body ?? {};

    if (!gestion && (estado !== undefined || comentarios !== undefined)) {
      res.status(403).json({ error: "Aprobar y comentar el viaje es tarea de la oficina" });
      return;
    }
    const cambios: Partial<Viaje> = {};

    if (numero_guia !== undefined) {
      if (typeof numero_guia !== "string" || !numero_guia.trim()) {
        res.status(400).json({ error: "Falta el número de guía" });
        return;
      }
      cambios.numero_guia = numero_guia.trim();
    }
    if (origen !== undefined) cambios.origen = String(origen).trim();
    if (destino !== undefined) cambios.destino = String(destino).trim();
    if (comentarios !== undefined) cambios.comentarios = comentarios?.trim() || null;
    if (km_inicial !== undefined) cambios.km_inicial = km_inicial === "" || km_inicial == null ? null : Number(km_inicial);
    if (km_final !== undefined) cambios.km_final = km_final === "" || km_final == null ? null : Number(km_final);

    if (cliente_id !== undefined && cliente_id) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("id, nombre")
        .eq("empresa_id", req.empresaId!)
        .eq("id", cliente_id)
        .maybeSingle();
      if (!cliente) {
        res.status(400).json({ error: "Selecciona un cliente válido" });
        return;
      }
      cambios.cliente = cliente.nombre;
      cambios.cliente_id = cliente.id;
    }

    if (subtotal !== undefined || aplica_iva !== undefined) {
      const subtotalNum = subtotal !== undefined ? Number(subtotal) : Number(existente.subtotal);
      if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
        res.status(400).json({ error: "Monto inválido" });
        return;
      }
      const aplicaIvaBool = aplica_iva !== undefined ? aplica_iva !== false && aplica_iva !== "false" : existente.aplica_iva;
      const montos = calcularMontos(subtotalNum, aplicaIvaBool);
      cambios.subtotal = montos.subtotal;
      cambios.aplica_iva = aplicaIvaBool;
      cambios.iva = montos.iva;
      cambios.total = montos.total;
    }

    if (estado !== undefined) {
      if (!["borrador", "confirmado"].includes(estado)) {
        res.status(400).json({ error: "estado debe ser borrador o confirmado" });
        return;
      }
      cambios.estado = estado;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("viajes")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Rechazar (eliminar) un viaje desde la app. Solo roles de gestión y solo
// si todavía no se facturó.
misViajesRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!esGestion(req)) {
      res.status(403).json({ error: "No puedes eliminar viajes del equipo" });
      return;
    }
    const { data: existente } = await supabase
      .from("viajes")
      .select("estado")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!existente) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (existente.estado === "facturado") {
      res.status(400).json({ error: "Este viaje ya fue facturado y no se puede eliminar" });
      return;
    }
    const { error } = await supabase.from("viajes").delete().eq("empresa_id", req.empresaId!).eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);
