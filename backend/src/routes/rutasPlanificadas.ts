import { Router } from "express";
import multer from "multer";
import type { Anexo, DiaSemana, Prioridad, TipoCheckin } from "@bitacora/shared";
import { supabase } from "../supabase";
import { geocodificarDireccion } from "../geocodificar";
import { subirAnexo, urlFirmadaAnexo } from "../storage";
import { asignarHorarios, secuenciarNearestNeighbor } from "../optimizarRuta";
import { crearOrdenServicio } from "../ordenes";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const rutasPlanificadasRouter = Router();

const DIAS_SEMANA: DiaSemana[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];
const PRIORIDADES: Prioridad[] = ["alta", "media", "baja"];
const TIPOS_CHECKIN: TipoCheckin[] = ["manual", "ubicacion"];

const TIPOS_ANEXO_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

const uploadAnexos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_ANEXO_PERMITIDOS.includes(file.mimetype)) {
      cb(new Error("Tipo de archivo no soportado para anexos"));
      return;
    }
    cb(null, true);
  },
});

function horaValida(hora: unknown): hora is string {
  return typeof hora === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(hora);
}

async function rutaExiste(empresaId: string, rutaId: string) {
  const { data } = await supabase
    .from("rutas_planificadas")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("id", rutaId)
    .maybeSingle();
  return data;
}

async function usuarioExiste(empresaId: string, usuarioId: string) {
  const { data } = await supabase
    .from("usuarios")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", usuarioId)
    .maybeSingle();
  return Boolean(data);
}

async function clienteDe(empresaId: string, clienteId: string) {
  const { data } = await supabase
    .from("clientes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("id", clienteId)
    .maybeSingle();
  return data;
}

rutasPlanificadasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("rutas_planificadas")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("fecha_inicio", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

rutasPlanificadasRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const ruta = await rutaExiste(req.empresaId!, req.params.id);
    if (!ruta) {
      res.status(404).json({ error: "Ruta no encontrada" });
      return;
    }

    const { data: tareas, error } = await supabase
      .from("trabajos")
      .select("*, cliente_info:clientes(*)")
      .eq("empresa_id", req.empresaId!)
      .eq("ruta_id", req.params.id)
      .order("orden_en_ruta", { ascending: true, nullsFirst: false })
      .order("creado_en", { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ ...ruta, tareas });
  })
);

// Crea la ruta (solo metadata) — las tareas se agregan una por una
// después con POST /:id/tareas.
rutasPlanificadasRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const {
      responsable_id,
      nombre,
      punto_base_direccion,
      fecha_inicio,
      dias_semana,
      hora_inicio,
      hora_fin,
      almuerzo_inicio,
      almuerzo_fin,
    } = req.body ?? {};

    if (typeof responsable_id !== "string" || !(await usuarioExiste(req.empresaId!, responsable_id))) {
      res.status(400).json({ error: "Selecciona un colaborador válido" });
      return;
    }
    if (typeof punto_base_direccion !== "string" || !punto_base_direccion.trim()) {
      res.status(400).json({ error: "Falta el punto base / origen de la ruta" });
      return;
    }
    if (typeof fecha_inicio !== "string" || !fecha_inicio) {
      res.status(400).json({ error: "Falta la fecha de la primera tarea" });
      return;
    }
    if (!horaValida(hora_inicio) || !horaValida(hora_fin) || hora_fin <= hora_inicio) {
      res.status(400).json({ error: "Horario de trabajo inválido" });
      return;
    }
    if ((almuerzo_inicio && !almuerzo_fin) || (!almuerzo_inicio && almuerzo_fin)) {
      res.status(400).json({ error: "Completa inicio y fin del almuerzo, o deja ambos vacíos" });
      return;
    }
    if (almuerzo_inicio && (!horaValida(almuerzo_inicio) || !horaValida(almuerzo_fin) || almuerzo_fin <= almuerzo_inicio)) {
      res.status(400).json({ error: "Intervalo de almuerzo inválido" });
      return;
    }
    const diasSemanaLimpios: DiaSemana[] = Array.isArray(dias_semana)
      ? dias_semana.filter((d): d is DiaSemana => DIAS_SEMANA.includes(d))
      : [];

    const coords = await geocodificarDireccion(punto_base_direccion.trim());

    const { data, error } = await supabase
      .from("rutas_planificadas")
      .insert({
        empresa_id: req.empresaId!,
        responsable_id,
        nombre: nombre?.trim() || null,
        punto_base_direccion: punto_base_direccion.trim(),
        punto_base_lat: coords?.lat ?? null,
        punto_base_lng: coords?.lng ?? null,
        fecha_inicio,
        dias_semana: diasSemanaLimpios,
        hora_inicio,
        hora_fin,
        almuerzo_inicio: almuerzo_inicio || null,
        almuerzo_fin: almuerzo_fin || null,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ ...data, geocodificado: coords !== null });
  })
);

// Agrega una tarea a la ruta. multipart: campos de texto + hasta 5
// anexos (20MB c/u). El cliente/dirección/nombre a mostrar se toman
// del cliente elegido (cliente_id obligatorio — se crea aparte con
// POST /api/clientes si es nuevo).
rutasPlanificadasRouter.post(
  "/:id/tareas",
  uploadAnexos.array("anexos", 5),
  ah<RequestConEmpresa>(async (req, res) => {
    const ruta = await rutaExiste(req.empresaId!, req.params.id);
    if (!ruta) {
      res.status(404).json({ error: "Ruta no encontrada" });
      return;
    }

    const {
      cliente_id,
      tipo_trabajo_id,
      etiquetas,
      duracion_estimada_min,
      tipo_checkin,
      prioridad,
      descripcion,
      encuesta_email,
      codigo,
      datos,
    } = req.body ?? {};

    if (typeof cliente_id !== "string") {
      res.status(400).json({ error: "Falta el cliente" });
      return;
    }
    const cliente = await clienteDe(req.empresaId!, cliente_id);
    if (!cliente) {
      res.status(400).json({ error: "cliente_id inválido" });
      return;
    }
    const duracionNum = Number(duracion_estimada_min);
    if (!duracion_estimada_min || Number.isNaN(duracionNum) || duracionNum <= 0) {
      res.status(400).json({ error: "Falta la duración estimada (minutos)" });
      return;
    }
    if (typeof descripcion !== "string" || !descripcion.trim()) {
      res.status(400).json({ error: "Falta la descripción de la tarea" });
      return;
    }
    const prioridadFinal: Prioridad = PRIORIDADES.includes(prioridad) ? prioridad : "media";
    const tipoCheckinFinal: TipoCheckin = TIPOS_CHECKIN.includes(tipo_checkin) ? tipo_checkin : "manual";
    const etiquetasArr = typeof etiquetas === "string" && etiquetas.trim()
      ? etiquetas.split(",").map((e: string) => e.trim()).filter(Boolean)
      : [];
    let datosObj: Record<string, unknown> = {};
    if (typeof datos === "string" && datos.trim()) {
      try {
        datosObj = JSON.parse(datos);
      } catch {
        res.status(400).json({ error: "datos debe ser JSON válido" });
        return;
      }
    }

    const archivos = (req.files as Express.Multer.File[] | undefined) ?? [];
    const anexos: Anexo[] = [];
    for (const archivo of archivos) {
      const key = await subirAnexo(req.empresaId!, req.params.id, archivo.originalname, archivo.buffer, archivo.mimetype);
      anexos.push({ nombre: archivo.originalname, key, tamano_bytes: archivo.size });
    }

    const { data, error } = await supabase
      .from("trabajos")
      .insert({
        empresa_id: req.empresaId!,
        ruta_id: ruta.id,
        responsable_id: ruta.responsable_id,
        cliente: cliente.nombre,
        cliente_id: cliente.id,
        ubicacion: cliente.direccion,
        fecha: ruta.fecha_inicio,
        estado: "en_curso",
        tipo_trabajo_id: tipo_trabajo_id || null,
        datos: datosObj,
        descripcion: descripcion.trim(),
        duracion_estimada_min: duracionNum,
        tipo_checkin: tipoCheckinFinal,
        prioridad: prioridadFinal,
        etiquetas: etiquetasArr,
        anexos,
        encuesta_email: encuesta_email?.trim() || null,
        codigo: codigo?.trim() || null,
      })
      .select("*, cliente_info:clientes(*)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await crearOrdenServicio(req.empresaId!, data.id);

    res.status(201).json(data);
  })
);

// "Finalizar ruterización": nearest-neighbor desde el punto base +
// asignación de horarios respetando jornada/almuerzo, y persiste el
// resultado en cada tarea.
rutasPlanificadasRouter.post(
  "/:id/optimizar",
  ah<RequestConEmpresa>(async (req, res) => {
    const ruta = await rutaExiste(req.empresaId!, req.params.id);
    if (!ruta) {
      res.status(404).json({ error: "Ruta no encontrada" });
      return;
    }
    if (ruta.punto_base_lat == null || ruta.punto_base_lng == null) {
      res.status(400).json({
        error: "No se pudo ubicar el punto base en el mapa — corrige la dirección antes de optimizar",
      });
      return;
    }

    const { data: tareas, error } = await supabase
      .from("trabajos")
      .select("id, duracion_estimada_min, cliente_info:clientes(lat, lng)")
      .eq("empresa_id", req.empresaId!)
      .eq("ruta_id", req.params.id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!tareas || tareas.length === 0) {
      res.status(400).json({ error: "Agrega al menos una tarea antes de optimizar" });
      return;
    }

    type TareaConCliente = { id: string; duracion_estimada_min: number | null; cliente_info: { lat: number | null; lng: number | null } | null };
    const tareasTyped = tareas as unknown as TareaConCliente[];

    const secuencia = secuenciarNearestNeighbor(
      { lat: ruta.punto_base_lat, lng: ruta.punto_base_lng },
      tareasTyped.map((t) => ({ id: t.id, lat: t.cliente_info?.lat ?? null, lng: t.cliente_info?.lng ?? null }))
    );

    const duraciones = Object.fromEntries(tareasTyped.map((t) => [t.id, t.duracion_estimada_min]));
    const { asignaciones, duracionTotalMin } = asignarHorarios(
      secuencia.ordenConCoords,
      duraciones,
      ruta.hora_inicio,
      ruta.hora_fin,
      ruta.almuerzo_inicio,
      ruta.almuerzo_fin
    );

    const actualizaciones = [
      ...asignaciones.map((a, i) => ({ id: a.id, orden_en_ruta: i, hora_estimada_llegada: a.hora_estimada_llegada })),
      ...secuencia.sinCoordsIds.map((id, i) => ({
        id,
        orden_en_ruta: asignaciones.length + i,
        hora_estimada_llegada: null,
      })),
    ];

    await Promise.all(
      actualizaciones.map((u) =>
        supabase
          .from("trabajos")
          .update({ orden_en_ruta: u.orden_en_ruta, hora_estimada_llegada: u.hora_estimada_llegada })
          .eq("id", u.id)
      )
    );

    await supabase
      .from("rutas_planificadas")
      .update({
        estado: "finalizada",
        distancia_total_km: Math.round(secuencia.distanciaTotalKm * 100) / 100,
        duracion_total_min: duracionTotalMin,
      })
      .eq("id", ruta.id);

    const { data: detalle, error: errorDetalle } = await supabase
      .from("rutas_planificadas")
      .select("*")
      .eq("id", ruta.id)
      .single();
    const { data: tareasFinal } = await supabase
      .from("trabajos")
      .select("*, cliente_info:clientes(*)")
      .eq("ruta_id", ruta.id)
      .order("orden_en_ruta", { ascending: true, nullsFirst: false });

    if (errorDetalle) {
      res.status(500).json({ error: errorDetalle.message });
      return;
    }
    res.json({ ...detalle, tareas: tareasFinal });
  })
);
