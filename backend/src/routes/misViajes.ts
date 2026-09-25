import { Router } from "express";
import multer from "multer";
import type { EstadoViaje, Viaje } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFotoGuiaConNombre, urlFirmadaFotoGuia } from "../storage";
import { ROLES_EDITAN_MONTO_VIAJE, calcularMontos, nuevosMontosViaje } from "../viajesMontos";
import { registrarAuditoriaEmpresa } from "../auditoriaEmpresa";
import { cobroDeViaje } from "../viajesCobros";
import { borrarViajeConViatico, sincronizarGastoViatico, viaticoDeViaje } from "../viajesViaticos";
import { sinCostos } from "../viajesPrecio";
import { siguienteFolioViaje } from "../folios";
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
      // Con rango de fechas (Agenda) se permiten más filas: la vista mes
      // del equipo puede pasar de 100 viajes (review parte A, M3).
      .limit(req.query.desde || req.query.hasta ? 1000 : 100);

    if (!verEquipo) query = query.eq("chofer_id", req.userId!);
    // Rango de fechas opcional (Agenda web/mobile, tarea 133). Sin rango
    // se mantiene el comportamiento de siempre (los últimos 100).
    const desde = typeof req.query.desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.desde) ? req.query.desde : null;
    const hasta = typeof req.query.hasta === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.hasta) ? req.query.hasta : null;
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data ?? []).map((v) => sinCostos(req, v)));
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
    const { data: fotosRaw } = await supabase
      .from("viaje_fotos")
      .select("id, foto_url, creado_en")
      .eq("empresa_id", req.empresaId!)
      .eq("viaje_id", req.params.id)
      .order("creado_en");
    const fotos = await Promise.all(
      (fotosRaw ?? []).map(async (f) => ({ id: f.id, creado_en: f.creado_en, url: await urlFirmadaFotoGuia(f.foto_url, 15) }))
    );
    res.json({ ...sinCostos(req, data), foto_guia_url_firmada, fotos });
  })
);

// Fotos adicionales de un viaje — suben por la misma cola offline que la
// firma y el gasto (etiqueta "Foto de viaje" en la app).
misViajesRouter.post(
  "/:id/fotos",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta la foto" });
      return;
    }
    const { data: viaje } = await supabase
      .from("viajes")
      .select("id, numero_guia, chofer_id, estado")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!viaje) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (req.rol === "colaborador" && viaje.chofer_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes editar tus propios viajes" });
      return;
    }
    if (viaje.estado === "facturado") {
      res.status(409).json({ error: "Este viaje ya fue facturado" });
      return;
    }
    const fotoKey = await subirFotoGuiaConNombre(req.empresaId!, viaje.numero_guia, req.file.buffer, req.file.mimetype);
    const { error } = await supabase.from("viaje_fotos").insert({
      empresa_id: req.empresaId!,
      viaje_id: req.params.id,
      foto_url: fotoKey,
      subida_por: req.userId ?? null,
    });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ ok: true });
  })
);

// Eliminar una foto extra puntual — el chofer se equivocó de foto o
// salió borrosa. Borrado real (mismo criterio que DELETE /api/viajes/:id/
// fotos/:fotoId): no hay regla de inmutabilidad para fotos de viaje,
// solo se bloquea si ya fue facturado. NO borra foto_guia_url (esa se
// reemplaza, no se elimina — es la guía oficial del viaje).
misViajesRouter.delete(
  "/:id/fotos/:fotoId",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: viaje } = await supabase
      .from("viajes")
      .select("id, chofer_id, estado")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!viaje) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (req.rol === "colaborador" && viaje.chofer_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes editar tus propios viajes" });
      return;
    }
    if (viaje.estado === "facturado") {
      res.status(409).json({ error: "Este viaje ya fue facturado y no se puede editar" });
      return;
    }
    const { data: foto } = await supabase
      .from("viaje_fotos")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("viaje_id", req.params.id)
      .eq("id", req.params.fotoId)
      .maybeSingle();
    if (!foto) {
      res.status(404).json({ error: "Foto no encontrada" });
      return;
    }
    const { error } = await supabase.from("viaje_fotos").delete().eq("empresa_id", req.empresaId!).eq("id", foto.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
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
    const folio = await siguienteFolioViaje(req.empresaId!);

    const { data, error } = await supabase
      .from("viajes")
      .insert({
        empresa_id: req.empresaId!,
        fecha: new Date().toISOString().slice(0, 10),
        numero_guia: numero_guia.trim(),
        folio,
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
    res.status(201).json(sinCostos(req, data));
  })
);

// Adjuntar / reemplazar la foto de la guía de un viaje YA creado. La app
// guarda primero el viaje (JSON, rápido y confiable) y sube la foto
// aparte — así el viaje nunca se pierde aunque la foto falle o no haya
// señal. Colaborador: solo los suyos. No si ya está facturado.
misViajesRouter.post(
  "/:id/foto-guia",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta la foto" });
      return;
    }
    const { data: viaje } = await supabase
      .from("viajes")
      .select("id, numero_guia, chofer_id, estado")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!viaje) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (req.rol === "colaborador" && viaje.chofer_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes editar tus propios viajes" });
      return;
    }
    if (viaje.estado === "facturado") {
      res.status(409).json({ error: "Este viaje ya fue facturado" });
      return;
    }
    const fotoKey = await subirFotoGuiaConNombre(req.empresaId!, viaje.numero_guia, req.file.buffer, req.file.mimetype);
    const { data, error } = await supabase
      .from("viajes")
      .update({ foto_guia_url: fotoKey })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(id, nombre)")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(sinCostos(req, data));
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
      const cobro = await cobroDeViaje(req.empresaId!, existente.factura_id);
      res.status(409).json({
        error: cobro?.folio != null ? `Este viaje ya está en el cobro N° ${cobro.folio} y no se puede editar` : "Este viaje ya fue cobrado y no se puede editar",
        cobro,
      });
      return;
    }

    const { numero_guia, origen, destino, cliente_id, km_inicial, km_final, subtotal, aplica_iva, comentarios, estado } = req.body ?? {};

    if (!gestion && (estado !== undefined || comentarios !== undefined)) {
      res.status(403).json({ error: "Aprobar y comentar el viaje es tarea de la oficina" });
      return;
    }
    const cambios: Partial<Viaje> = {};

    // Tarea 135: en un viaje por tramos o por km, el recorrido y el cliente
    // definen el precio; se cambian desde la web, recalculando.
    if (existente.modo_precio && existente.modo_precio !== "fijo") {
      const cambiaRecorrido =
        (origen !== undefined && String(origen).trim() !== existente.origen) ||
        (destino !== undefined && String(destino).trim() !== existente.destino) ||
        (cliente_id !== undefined && cliente_id && cliente_id !== existente.cliente_id);
      if (cambiaRecorrido) {
        res.status(409).json({ error: "Este viaje se cobra por tramos o por km: el recorrido y el cliente se cambian desde la web" });
        return;
      }
    }

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

    // Monto (tarea 132): solo Admin y Supervisor. El chofer puede seguir
    // editando lo demás; si la app manda el mismo monto, se ignora.
    const montos = nuevosMontosViaje(existente, subtotal, aplica_iva);
    if ("error" in montos) {
      res.status(400).json({ error: montos.error });
      return;
    }
    if (montos.cambio) {
      if (!ROLES_EDITAN_MONTO_VIAJE.includes(req.rol ?? "")) {
        res.status(403).json({ error: "El monto del viaje lo cambia la oficina (administrador o supervisor)" });
        return;
      }
      Object.assign(cambios, montos.cambio.nuevo);
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
    if (montos.cambio) {
      await registrarAuditoriaEmpresa({
        empresaId: req.empresaId!,
        usuarioId: req.userId ?? null,
        accion: "cambiar_monto",
        entidad: "viaje",
        entidadId: existente.id,
        detalle: { anterior: montos.cambio.anterior, nuevo: montos.cambio.nuevo, numero_guia: existente.numero_guia },
      });
    }
    // Viático (tarea 137): acá no se cambia, pero su gasto sigue la guía.
    // Si falla, el viaje ya quedó guardado: se registra y se reintenta en
    // el próximo guardado (el gasto solo queda con la guía anterior).
    if (data.viatico_tipo) {
      const sync = await sincronizarGastoViatico(req.empresaId!, data, viaticoDeViaje(data));
      if ("error" in sync) console.error(`[viaticos] no se pudo actualizar el gasto del viaje ${data.id}: ${sync.error}`);
    }
    res.json(sinCostos(req, data));
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
      res.status(409).json({ error: "Este viaje ya fue facturado y no se puede eliminar" });
      return;
    }
    // Tarea 137: borra también su viático pendiente (sin dejar gastos sueltos).
    const borrado = await borrarViajeConViatico(req.empresaId!, req.params.id);
    if ("error" in borrado) {
      res.status(borrado.status).json({ error: borrado.error });
      return;
    }
    res.status(204).end();
  })
);
