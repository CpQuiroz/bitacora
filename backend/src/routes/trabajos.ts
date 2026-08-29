import { Router } from "express";
import multer from "multer";
import type { EstadoOS, EstadoTrabajo, ItemChecklist, OrdenServicio, Prioridad, TipoCheckin, TipoTrabajo, Trabajo } from "@bitacora/shared";
import { sustituirVariables } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFirma, subirFoto, urlFirmada } from "../storage";
import { analizarFoto, generarInformeOS } from "../claude";
import { crearOrdenServicio, obtenerOCrearOrden } from "../ordenes";
import { enviarEncuestaSatisfaccion, enviarPdfOS } from "../email";
import { generarPdfOS } from "../generarPdfOS";
import { notificar, notificarGerencia } from "../notificar";
import { notificarCliente } from "../notificarCliente";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const trabajosRouter = Router();

const ESTADOS: EstadoTrabajo[] = ["en_curso", "completado", "cancelado"];
const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const TIPOS_CHECKIN: TipoCheckin[] = ["manual", "ubicacion"];

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

async function tipoOsExiste(empresaId: string, tipoOsId: string) {
  const { data } = await supabase.from("tipos_os").select("id").eq("empresa_id", empresaId).eq("id", tipoOsId).maybeSingle();
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

async function ordenDeTrabajo(empresaId: string, trabajoId: string) {
  const { data } = await supabase
    .from("ordenes_servicio")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("trabajo_id", trabajoId)
    .maybeSingle();
  return data;
}

// Una OS finalizada bloquea checklist/fotos/firma/edición — el botón
// "Finalizar OS" del celular es la única forma de deshacerlo (no hay
// forma de deshacerlo: es intencional, es la garantía de que el PDF
// ya entregado no cambia por debajo).
async function trabajoBloqueado(empresaId: string, trabajoId: string) {
  const orden = await ordenDeTrabajo(empresaId, trabajoId);
  return Boolean(orden?.finalizada_en);
}

trabajosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("trabajos")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false });

    // Un colaborador SIEMPRE ve solo lo suyo — regla del servidor, no una
    // opción que decida el cliente. Cualquier otro rol puede además pedir
    // "propio=true" (lo usa la app móvil) o filtrar por otro responsable.
    if (req.rol === "colaborador") {
      query = query.eq("responsable_id", req.userId!);
    } else if (req.query.propio === "true") {
      query = query.eq("responsable_id", req.userId!);
    } else if (typeof req.query.responsable_id === "string" && req.query.responsable_id) {
      query = query.eq("responsable_id", req.query.responsable_id);
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
    let query = supabase
      .from("trabajos")
      .select("*, tipo_trabajo:tipos_trabajo(*)")
      .eq("empresa_id", req.empresaId!);
    // No revela que el trabajo existe si no es del colaborador — 404, no 403.
    if (req.rol === "colaborador") query = query.eq("responsable_id", req.userId!);
    const { data, error } = await query
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
    const {
      datos,
      estado,
      tipo_trabajo_id,
      ruta_id,
      descripcion,
      prioridad,
      etiquetas,
      duracion_estimada_min,
      tipo_checkin,
      encuesta_email,
    } = req.body ?? {};
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
    // ruta_id: para "incluir tarea ya creada" en una ruta (o
    // desvincularla pasando null).
    if (ruta_id !== undefined) {
      if (ruta_id !== null) {
        const { data: ruta } = await supabase
          .from("rutas_planificadas")
          .select("id")
          .eq("empresa_id", req.empresaId!)
          .eq("id", ruta_id)
          .maybeSingle();
        if (!ruta) {
          res.status(400).json({ error: "ruta_id inválido" });
          return;
        }
      }
      cambios.ruta_id = ruta_id;
    }
    if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
    if (prioridad !== undefined) {
      if (!PRIORIDADES.includes(prioridad)) {
        res.status(400).json({ error: `prioridad debe ser una de: ${PRIORIDADES.join(", ")}` });
        return;
      }
      cambios.prioridad = prioridad;
    }
    if (etiquetas !== undefined) {
      if (!Array.isArray(etiquetas) || !etiquetas.every((e) => typeof e === "string")) {
        res.status(400).json({ error: "etiquetas debe ser un arreglo de texto" });
        return;
      }
      cambios.etiquetas = etiquetas;
    }
    if (duracion_estimada_min !== undefined) {
      const n = Number(duracion_estimada_min);
      if (Number.isNaN(n) || n <= 0) {
        res.status(400).json({ error: "duracion_estimada_min inválido" });
        return;
      }
      cambios.duracion_estimada_min = n;
    }
    if (tipo_checkin !== undefined) {
      if (!TIPOS_CHECKIN.includes(tipo_checkin)) {
        res.status(400).json({ error: `tipo_checkin debe ser uno de: ${TIPOS_CHECKIN.join(", ")}` });
        return;
      }
      cambios.tipo_checkin = tipo_checkin;
    }
    if (encuesta_email !== undefined) cambios.encuesta_email = encuesta_email?.trim() || null;
    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }
    if (await trabajoBloqueado(req.empresaId!, req.params.id)) {
      res.status(403).json({ error: "La orden de servicio ya fue finalizada y no se puede editar" });
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

trabajosRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (await trabajoBloqueado(req.empresaId!, req.params.id)) {
      res.status(403).json({ error: "La orden de servicio ya fue finalizada y no se puede eliminar" });
      return;
    }
    const { error, count } = await supabase
      .from("trabajos")
      .delete({ count: "exact" })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!count) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }
    res.status(204).end();
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
      tipo_os_id,
      responsable_id,
      descripcion,
      prioridad,
      hora_programada,
      items,
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
    if (tipo_os_id && !(await tipoOsExiste(req.empresaId!, tipo_os_id))) {
      res.status(400).json({ error: "tipo_os_id inválido" });
      return;
    }
    // cliente_id vincula a un cliente con coordenadas — lo usa la
    // planificación de rutas. Es opcional, "cliente" (texto) sigue
    // siendo el nombre a mostrar/facturar.
    if (cliente_id && !(await clienteExiste(req.empresaId!, cliente_id))) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    if (hora_programada !== undefined && hora_programada !== null && hora_programada !== "") {
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora_programada)) {
        res.status(400).json({ error: "hora_programada inválida (usa HH:MM)" });
        return;
      }
    }
    let itemsParseados: { descripcion: string; cantidad: number; precio_unitario: number }[] = [];
    if (typeof items === "string" && items.trim()) {
      try {
        const parsed = JSON.parse(items);
        if (!Array.isArray(parsed)) throw new Error();
        itemsParseados = parsed.map((it) => ({
          descripcion: String(it.descripcion ?? "").trim(),
          cantidad: Number(it.cantidad ?? 1),
          precio_unitario: Number(it.precio_unitario ?? 0),
        }));
        if (itemsParseados.some((it) => !it.descripcion || Number.isNaN(it.cantidad) || Number.isNaN(it.precio_unitario))) {
          throw new Error();
        }
      } catch {
        res.status(400).json({ error: "items inválido" });
        return;
      }
    }
    const estadoFinal: EstadoTrabajo = ESTADOS.includes(estado) ? estado : "completado";
    const prioridadFinal: Prioridad = PRIORIDADES.includes(prioridad) ? prioridad : "media";

    const { data, error } = await supabase
      .from("trabajos")
      .insert({
        empresa_id: req.empresaId!,
        cliente: cliente.trim(),
        cliente_id: cliente_id || null,
        fecha,
        hora_programada: hora_programada || null,
        monto: montoNum,
        ubicacion: ubicacion?.trim() || null,
        codigo: codigo?.trim() || null,
        estado: estadoFinal,
        descripcion: descripcion?.trim() || null,
        prioridad: prioridadFinal,
        tipo_trabajo_id: tipo_trabajo_id || null,
        tipo_os_id: tipo_os_id || null,
        responsable_id: responsable_id || req.userId!,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const orden = await crearOrdenServicio(req.empresaId!, data.id);

    if (itemsParseados.length > 0) {
      await supabase.from("os_items").insert(
        itemsParseados.map((it) => ({
          empresa_id: req.empresaId!,
          trabajo_id: data.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
        }))
      );
    }

    if (data.responsable_id && data.responsable_id !== req.userId) {
      await notificar(req.empresaId!, data.responsable_id, "os_asignada", {
        cuerpo: `${data.cliente} — ${data.fecha}`,
        entidadTipo: "trabajo",
        entidadId: data.id,
      });
    }

    res.status(201).json({ ...data, folio: orden.folio });
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
    if (await trabajoBloqueado(req.empresaId!, req.params.id)) {
      res.status(403).json({ error: "La orden de servicio ya fue finalizada y no se puede editar" });
      return;
    }

    const orden = await obtenerOCrearOrden(req.empresaId!, req.params.id);
    const checklist: ItemChecklist[] = orden.checklist ?? [];
    const ahora = new Date().toISOString();
    const yaEstaba = checklist.find((c) => c.item === item);
    const nuevoChecklist = yaEstaba
      ? checklist.map((c) => (c.item === item ? { ...c, hecho: true, hora: ahora } : c))
      : [...checklist, { item, hecho: true, hora: ahora }];

    // Check-in avanza la OS a "en_proceso"; check-out la deja
    // "completada" (queda "firmada" recién al finalizar con la firma).
    const cambios: Partial<OrdenServicio> = { checklist: nuevoChecklist };
    if (item === "Check-in" && (["pendiente", "enviada"] as EstadoOS[]).includes(orden.estado_os)) {
      cambios.estado_os = "en_proceso";
    } else if (item === "Check-out" && orden.estado_os === "en_proceso") {
      cambios.estado_os = "completada";
    }

    // tenant-ok: trabajoExiste() más arriba ya validó empresa_id; orden
    // sale de obtenerOCrearOrden() sobre ese mismo trabajo ya validado.
    const { data, error } = await supabase
      .from("ordenes_servicio")
      .update(cambios)
      .eq("id", orden.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Check-in es el único evento real de "el colaborador arrancó la
    // tarea" que existe hoy — se usa como disparador de "técnico en
    // camino" (no bloquea la respuesta si el envío falla).
    if (item === "Check-in") {
      // tenant-ok: trabajoExiste() al inicio del handler ya validó
      // empresa_id para req.params.id; clienteId sale de ese mismo trabajo.
      void (async () => {
        const { data: tarea } = await supabase
          .from("trabajos")
          .select("cliente, cliente_id, responsable:usuarios(nombre)")
          .eq("id", req.params.id)
          .single();
        const clienteId = tarea?.cliente_id;
        if (!clienteId) return;
        const { data: cliente } = await supabase.from("clientes").select("correo").eq("id", clienteId).maybeSingle();
        if (!cliente?.correo) return;
        const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", req.empresaId!).single();
        const tecnicoNombre = (tarea as unknown as { responsable: { nombre: string } | null })?.responsable?.nombre ?? "Nuestro equipo";
        await notificarCliente(req.empresaId!, "tecnico_en_camino", cliente.correo, {
          clienteId,
          entidadTipo: "trabajo",
          entidadId: req.params.id,
          variables: { cliente: tarea?.cliente ?? "", tecnico: tecnicoNombre, empresa: empresa?.nombre ?? "" },
        });
      })();
    }

    // Al cerrar con check-out, si la tarea tiene email de encuesta y
    // todavía no se le mandó, dispara el correo de satisfacción. No
    // bloquea la respuesta si Resend no está configurado o falla.
    if (item === "Check-out") {
      // tenant-ok: trabajoExiste() al inicio del handler ya validó
      // empresa_id para req.params.id (los 2 .from de acá abajo).
      const { data: tarea } = await supabase
        .from("trabajos")
        .select("cliente, encuesta_email, encuesta_enviada_en")
        .eq("id", req.params.id)
        .single();
      if (tarea?.encuesta_email && !tarea.encuesta_enviada_en) {
        enviarEncuestaSatisfaccion(tarea.encuesta_email, req.params.id, tarea.cliente)
          .then(() =>
            supabase
              .from("trabajos")
              .update({ encuesta_enviada_en: new Date().toISOString() })
              .eq("id", req.params.id)
          )
          .catch((err) => {
            console.error("Error mandando encuesta de satisfacción:", err);
            // Sin esto el fallo solo queda en el log del servidor —
            // nadie del equipo se entera. Avisa a admin/supervisor
            // dentro de la app, con link directo a esta OS.
            notificarGerencia(req.empresaId!, "email_fallido", {
              cuerpo: `No se pudo enviar la encuesta de satisfacción a ${tarea.encuesta_email} (${tarea.cliente}).`,
              entidadTipo: "trabajo",
              entidadId: req.params.id,
            });
          });
      }
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
    const { firma_base64, firmante_nombre, firmante_documento, observaciones_cierre } = req.body ?? {};
    if (typeof firma_base64 !== "string" || !firma_base64) {
      res.status(400).json({ error: "Falta firma_base64" });
      return;
    }
    if (!(await trabajoExiste(req.empresaId!, req.params.id))) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }
    if (await trabajoBloqueado(req.empresaId!, req.params.id)) {
      res.status(403).json({ error: "La orden de servicio ya fue finalizada y no se puede editar" });
      return;
    }

    const orden = await obtenerOCrearOrden(req.empresaId!, req.params.id);
    const buffer = Buffer.from(firma_base64, "base64");
    const key = await subirFirma(req.empresaId!, req.params.id, buffer);

    // tenant-ok: trabajoExiste() arriba ya validó empresa_id; orden sale
    // de obtenerOCrearOrden() sobre ese mismo trabajo ya validado.
    const { data, error } = await supabase
      .from("ordenes_servicio")
      .update({
        firma_url: key,
        firmante_nombre: firmante_nombre?.trim() || null,
        firmante_documento: firmante_documento?.trim() || null,
        observaciones_cierre: observaciones_cierre?.trim() || null,
      })
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
    if (await trabajoBloqueado(req.empresaId!, req.params.id)) {
      res.status(403).json({ error: "La orden de servicio ya fue finalizada y no se puede editar" });
      return;
    }

    const orden = await obtenerOCrearOrden(req.empresaId!, req.params.id);

    const key = await subirFoto(req.empresaId!, req.params.id, req.file.buffer, req.file.mimetype);

    const mediaType = req.file.mimetype as "image/jpeg" | "image/png" | "image/webp";
    const analisis = await analizarFoto(req.empresaId!, req.file.buffer.toString("base64"), mediaType);

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

// Cierra la OS: exige firma ya guardada y check-out ya marcado.
// A partir de acá el trabajo queda de solo lectura (trabajoBloqueado).
trabajosRouter.post(
  "/:id/finalizar",
  ah<RequestConEmpresa>(async (req, res) => {
    const orden = await ordenDeTrabajo(req.empresaId!, req.params.id);
    if (!orden) {
      res.status(404).json({ error: "Este trabajo todavía no tiene una orden de servicio" });
      return;
    }
    if (orden.finalizada_en) {
      res.status(403).json({ error: "La orden de servicio ya estaba finalizada" });
      return;
    }
    if (!orden.firma_url) {
      res.status(400).json({ error: "Falta la firma antes de finalizar la OS" });
      return;
    }
    const checkOutHecho = (orden.checklist as ItemChecklist[]).find(
      (c) => c.item === "Check-out"
    )?.hecho;
    if (!checkOutHecho) {
      res.status(400).json({ error: "Falta marcar el check-out antes de finalizar la OS" });
      return;
    }

    // tenant-ok (los 3 .from de acá abajo): ordenDeTrabajo() arriba ya
    // validó empresa_id para req.params.id/orden.id; trabajoActualizado.
    // cliente_id sale de ese mismo trabajo ya validado.
    const ahora = new Date().toISOString();
    const { data, error } = await supabase
      .from("ordenes_servicio")
      .update({ estado_os: "firmada", finalizada_en: ahora })
      .eq("id", orden.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    const { data: trabajoActualizado } = await supabase
      .from("trabajos")
      .update({ estado: "completado" })
      .eq("id", req.params.id)
      .select("cliente, cliente_id, ruta_id")
      .single();

    await notificarGerencia(req.empresaId!, "os_completada", {
      cuerpo: trabajoActualizado?.cliente ?? undefined,
      entidadTipo: "trabajo",
      entidadId: req.params.id,
    });

    // OS completada Y firmada (esto es "/finalizar", el cierre real —
    // "/firma" solo guarda la firma) — se le manda el PDF al cliente
    // si tiene correo. No bloquea la respuesta si el envío falla.
    if (trabajoActualizado?.cliente_id) {
      // tenant-ok: cliente_id sale de trabajoActualizado, ya validado
      // arriba vía ordenDeTrabajo()/req.params.id.
      void (async () => {
        const { data: cliente } = await supabase.from("clientes").select("correo").eq("id", trabajoActualizado.cliente_id!).maybeSingle();
        if (!cliente?.correo) return;
        const datosPdf = await armarDatosPdf(req.empresaId!, req.params.id);
        if (!datosPdf) return;
        const pdf = await generarPdfOS(datosPdf);
        await notificarCliente(req.empresaId!, "os_completada", cliente.correo, {
          clienteId: trabajoActualizado.cliente_id!,
          entidadTipo: "trabajo",
          entidadId: req.params.id,
          variables: { cliente: datosPdf.clienteNombre, empresa: datosPdf.empresaNombre, tecnico: datosPdf.colaboradorNombre },
          adjunto: { filename: `${datosPdf.folioTexto}.pdf`, buffer: pdf },
        });
      })();
    }

    // Si esta OS era la última tarea pendiente de su ruta, la ruta
    // quedó efectivamente ejecutada — se avisa aparte de "OS completada".
    if (trabajoActualizado?.ruta_id) {
      const { data: pendientes } = await supabase
        .from("trabajos")
        .select("id")
        .eq("ruta_id", trabajoActualizado.ruta_id)
        .eq("estado", "en_curso");
      if (!pendientes || pendientes.length === 0) {
        await notificarGerencia(req.empresaId!, "ruta_finalizada", {
          entidadTipo: "ruta",
          entidadId: trabajoActualizado.ruta_id,
        });
      }
    }

    res.json(data);
  })
);

// Junta todo lo necesario para el PDF de una OS — lo usan tanto la
// descarga directa como el envío por correo.
export async function armarDatosPdf(empresaId: string, trabajoId: string) {
  const { data: trabajo } = await supabase
    .from("trabajos")
    .select("*, responsable:usuarios(nombre)")
    .eq("empresa_id", empresaId)
    .eq("id", trabajoId)
    .maybeSingle();
  if (!trabajo) return null;

  const orden = await ordenDeTrabajo(empresaId, trabajoId);
  if (!orden) return null;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("nombre, logo_url, color_primario")
    .eq("id", empresaId)
    .single();

  const { data: plantilla } = await supabase
    .from("plantillas_documento")
    .select("texto_encabezado, texto_pie, color_primario")
    .eq("empresa_id", empresaId)
    .eq("tipo", "orden_servicio")
    .maybeSingle();

  const { data: items } = await supabase
    .from("os_items")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("trabajo_id", trabajoId)
    .order("creado_en");

  const { data: fotos } = await supabase
    .from("analisis_fotos")
    .select("foto_url")
    .eq("orden_servicio_id", orden.id)
    .order("creado_en", { ascending: false });

  const fotoUrls = await Promise.all((fotos ?? []).map((f) => urlFirmada(f.foto_url, 15)));
  const firmaUrl = orden.firma_url ? await urlFirmada(orden.firma_url, 15) : null;

  const colaboradorNombre = (trabajo as unknown as { responsable: { nombre: string } | null }).responsable?.nombre ?? "—";
  const montoTotal = (items ?? []).reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  const variables = {
    cliente: trabajo.cliente,
    fecha: trabajo.fecha,
    tecnico: colaboradorNombre,
    monto: `$${Math.round(montoTotal).toLocaleString("es-CL")}`,
    folio: String(orden.folio ?? ""),
    direccion: trabajo.ubicacion ?? "",
    empresa: empresa?.nombre ?? "",
  };

  return {
    empresaNombre: empresa?.nombre ?? "",
    empresaLogoUrl: empresa?.logo_url ?? null,
    colorPrimario: plantilla?.color_primario ?? empresa?.color_primario ?? null,
    textoEncabezado: plantilla?.texto_encabezado ? sustituirVariables(plantilla.texto_encabezado, variables) : null,
    textoPie: plantilla?.texto_pie ? sustituirVariables(plantilla.texto_pie, variables) : null,
    clienteId: trabajo.cliente_id,
    folio: orden.folio,
    fecha: trabajo.fecha,
    horaProgramada: trabajo.hora_programada,
    clienteNombre: trabajo.cliente,
    direccion: trabajo.ubicacion,
    colaboradorNombre,
    descripcion: trabajo.descripcion,
    observacionesCierre: orden.observaciones_cierre,
    informeIA: orden.informe_ia,
    items: (items ?? []).map((it) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
    })),
    fotoUrls,
    firmaUrl,
    firmanteNombre: orden.firmante_nombre,
    firmanteDocumento: orden.firmante_documento,
    folioTexto: `OS-${orden.folio ?? trabajoId.slice(0, 8)}`,
  };
}

trabajosRouter.get(
  "/:id/pdf",
  ah<RequestConEmpresa>(async (req, res) => {
    const datos = await armarDatosPdf(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "Trabajo u orden de servicio no encontrada" });
      return;
    }
    const pdf = await generarPdfOS(datos);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${datos.folioTexto}.pdf"`);
    res.send(pdf);
  })
);

trabajosRouter.post(
  "/:id/pdf/enviar",
  ah<RequestConEmpresa>(async (req, res) => {
    const { destinatario } = req.body ?? {};
    if (typeof destinatario !== "string" || !destinatario.trim()) {
      res.status(400).json({ error: "Falta destinatario" });
      return;
    }
    const datos = await armarDatosPdf(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "Trabajo u orden de servicio no encontrada" });
      return;
    }
    const pdf = await generarPdfOS(datos);
    await enviarPdfOS(destinatario.trim(), datos.empresaNombre, datos.folio ?? 0, pdf);
    res.json({ ok: true });
  })
);

// Informe técnico de esta OS puntual (distinto del "Informe IA" de
// negocio): redacta a partir de los campos personalizados del tipo de
// trabajo (ej. pH/cloro/turbidez para mantención de agua), el
// checklist, las observaciones del técnico y el análisis de las fotos.
trabajosRouter.post(
  "/:id/informe-ia",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: trabajo } = await supabase
      .from("trabajos")
      .select("*, tipo_trabajo:tipos_trabajo(*)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!trabajo) {
      res.status(404).json({ error: "Trabajo no encontrado" });
      return;
    }

    const orden = await ordenDeTrabajo(req.empresaId!, req.params.id);
    if (!orden) {
      res.status(400).json({ error: "Este trabajo todavía no tiene una orden de servicio" });
      return;
    }

    const { data: fotos } = await supabase
      .from("analisis_fotos")
      .select("resumen, alerta, detalle_alerta")
      .eq("orden_servicio_id", orden.id);

    const tipoTrabajo = (trabajo as unknown as { tipo_trabajo: TipoTrabajo | null }).tipo_trabajo;
    const datosGuardados = (trabajo.datos ?? {}) as Record<string, unknown>;
    const datosPersonalizados = (tipoTrabajo?.campos ?? [])
      .map((c) => `${c.etiqueta}: ${datosGuardados[c.clave] ?? "sin dato"}`)
      .join("\n");

    const checklistTexto = ((orden.checklist ?? []) as ItemChecklist[])
      .map((i) => `- [${i.hecho ? "x" : " "}] ${i.item}`)
      .join("\n");

    const fotosTexto = (fotos ?? [])
      .map((f, i) => `Foto ${i + 1}: ${f.resumen}${f.alerta ? ` — ALERTA: ${f.detalle_alerta}` : ""}`)
      .join("\n");

    if (!datosPersonalizados && !checklistTexto && !orden.observaciones_cierre && !fotosTexto) {
      res.status(400).json({
        error: "No hay datos suficientes para generar un informe (faltan datos medidos, checklist, observaciones o fotos)",
      });
      return;
    }

    let contexto = `Tipo de servicio: ${tipoTrabajo?.nombre ?? trabajo.descripcion ?? "Servicio en terreno"}\n`;
    contexto += `Cliente: ${trabajo.cliente}\nFecha: ${trabajo.fecha}\n\n`;
    if (datosPersonalizados) contexto += `Datos medidos por el técnico:\n${datosPersonalizados}\n\n`;
    if (checklistTexto) contexto += `Checklist realizado:\n${checklistTexto}\n\n`;
    if (orden.observaciones_cierre) contexto += `Observaciones del técnico:\n${orden.observaciones_cierre}\n\n`;
    if (fotosTexto) contexto += `Fotos tomadas en terreno:\n${fotosTexto}\n\n`;

    const informe = await generarInformeOS(req.empresaId!, contexto);
    if (!informe) {
      res.status(502).json({ error: "No se pudo generar el informe con IA, intenta de nuevo" });
      return;
    }

    const { data: actualizado, error } = await supabase
      .from("ordenes_servicio")
      .update({ informe_ia: informe })
      .eq("empresa_id", req.empresaId!)
      .eq("id", orden.id)
      .select()
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(actualizado);
  })
);
