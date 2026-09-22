import { Router } from "express";
import multer from "multer";
import type { EstadoRendicion, PeriodoRendicion, Rendicion } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirComprobante } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { siguienteFolioRendicion } from "../folios";
import { resolverCategoria, existeEnTabla } from "./gastos";

// Mismos límites/formatos que gastos.ts — un comprobante de rendición
// es el mismo tipo de archivo que uno de gasto normal.
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

// Fondo por rendir / caja chica (migración 120, 21-sep-2026): plata
// entregada en efectivo a un colaborador para gastos de terreno,
// reconciliada contra sus gastos reales al cerrar el período. Montado
// detrás de requiereModulo("financiero") igual que /api/gastos (mismo
// criterio: la propia empresa puede delegarle ese módulo al rol
// colaborador si quiere que sus técnicos/choferes lo usen desde el
// celular — no hay ningún gate especial nuevo acá).
export const rendicionesRouter = Router();

const PERIODOS: PeriodoRendicion[] = ["diario", "semanal"];

const esGestion = (req: RequestConEmpresa) => req.rol !== "colaborador";

async function obtenerRendicion(empresaId: string, id: string) {
  const { data } = await supabase.from("rendiciones").select("*").eq("empresa_id", empresaId).eq("id", id).maybeSingle();
  return data as Rendicion | null;
}

rendicionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("rendiciones")
      .select("*, colaborador:usuarios!rendiciones_colaborador_id_fkey(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("creado_en", { ascending: false });

    // Colaborador ve solo las propias; gestión ve todas (y puede filtrar
    // por ?colaborador_id= para revisar a un técnico puntual).
    if (!esGestion(req)) {
      query = query.eq("colaborador_id", req.userId!);
    } else if (typeof req.query.colaborador_id === "string" && req.query.colaborador_id) {
      query = query.eq("colaborador_id", req.query.colaborador_id);
    }
    const { estado } = req.query;
    if (typeof estado === "string" && ["borrador", "enviada", "aprobada", "rechazada"].includes(estado)) {
      query = query.eq("estado", estado as EstadoRendicion);
    }

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Saldo por fila (mismo cálculo que GET /:id) — una sola query
    // agregada en vez de N+1, para que el listado lo muestre sin tener
    // que abrir cada rendición.
    const ids = (data ?? []).map((r) => r.id);
    const { data: gastos } = ids.length
      ? await supabase.from("gastos").select("rendicion_id, monto").eq("empresa_id", req.empresaId!).in("rendicion_id", ids)
      : { data: [] };
    const totalPorRendicion = new Map<string, number>();
    for (const g of gastos ?? []) {
      if (!g.rendicion_id) continue;
      totalPorRendicion.set(g.rendicion_id, (totalPorRendicion.get(g.rendicion_id) ?? 0) + Number(g.monto));
    }

    res.json(
      (data ?? []).map((r) => {
        const totalGastado = totalPorRendicion.get(r.id) ?? 0;
        return { ...r, total_gastado: totalGastado, saldo: Number(r.monto_entregado) - totalGastado };
      })
    );
  })
);

rendicionesRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    let query = supabase
      .from("rendiciones")
      .select("*, colaborador:usuarios!rendiciones_colaborador_id_fkey(id, nombre), aprobador:usuarios!rendiciones_aprobado_por_fkey(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);
    if (!esGestion(req)) query = query.eq("colaborador_id", req.userId!);

    const { data: rendicion, error } = await query.maybeSingle();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }

    const { data: gastos } = await supabase
      .from("gastos")
      .select("*, categoria_info:categorias_gasto(id, nombre, color), proveedor_info:proveedores(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("rendicion_id", req.params.id)
      .order("fecha", { ascending: true });

    // El saldo NUNCA se guarda — se calcula acá siempre que se pide el
    // detalle, así nunca queda desincronizado de la suma real de gastos.
    const totalGastado = (gastos ?? []).reduce((acc, g) => acc + Number(g.monto), 0);
    res.json({
      ...rendicion,
      gastos: gastos ?? [],
      total_gastado: totalGastado,
      saldo: Number(rendicion.monto_entregado) - totalGastado,
    });
  })
);

rendicionesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { colaborador_id, periodo, fecha_inicio, fecha_termino, monto_entregado } = req.body ?? {};

    // Un colaborador solo registra su propia rendición; asignarla a
    // otro (ej. el admin la carga por él) es tarea de gestión.
    const colaboradorFinal = colaborador_id || req.userId!;
    if (colaboradorFinal !== req.userId && !esGestion(req)) {
      res.status(403).json({ error: "Solo puedes crear rendiciones para ti mismo" });
      return;
    }
    if (!(await existeEnTabla("usuarios", req.empresaId!, colaboradorFinal))) {
      res.status(400).json({ error: "El colaborador indicado no existe" });
      return;
    }
    if (!PERIODOS.includes(periodo)) {
      res.status(400).json({ error: `periodo debe ser uno de: ${PERIODOS.join(", ")}` });
      return;
    }
    if (typeof fecha_inicio !== "string" || !fecha_inicio || typeof fecha_termino !== "string" || !fecha_termino) {
      res.status(400).json({ error: "Falta fecha_inicio o fecha_termino" });
      return;
    }
    const montoNum = Number(monto_entregado);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      res.status(400).json({ error: "monto_entregado inválido" });
      return;
    }

    const folio = await siguienteFolioRendicion(req.empresaId!);

    const { data, error } = await supabase
      .from("rendiciones")
      .insert({
        empresa_id: req.empresaId!,
        folio,
        colaborador_id: colaboradorFinal,
        // Quién hizo el POST, no a quién pertenece — divergen cuando
        // gestión la carga por otro (ver migración 121).
        creado_por: req.userId!,
        periodo,
        fecha_inicio,
        fecha_termino,
        monto_entregado: montoNum,
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

// Crea un gasto asociado a esta rendición — misma validación que POST
// /api/gastos, solo que el rendicion_id queda fijo (el del parámetro,
// no lo que mande el body).
//
// upload.single acá es opcional a propósito: el mobile sigue con su
// patrón propio (crearGasto en services/gastos.ts) — crea el gasto por
// JSON primero y encola el comprobante APARTE contra PATCH
// /api/gastos/:id (mismo mecanismo de reintento offline que ya usa
// Nuevo Gasto), porque ahí sí hay que tolerar señal mala. La web no
// tiene ese problema (misma request, sin cola) — puede mandar el
// archivo inline, igual que POST /api/gastos. El comprobante SÍ es
// obligatorio — pero se exige recién al enviar la rendición (POST
// /:id/enviar), que es el punto donde ya tiene sentido haber esperado
// a que termine cualquier subida pendiente (mobile) o haberlo pedido
// en el mismo formulario (web).
rendicionesRouter.post(
  "/:id/items",
  upload.single("comprobante"),
  ah<RequestConEmpresa>(async (req, res) => {
    const rendicion = await obtenerRendicion(req.empresaId!, req.params.id);
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }
    if (!esGestion(req) && rendicion.colaborador_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes agregar gastos a tus propias rendiciones" });
      return;
    }
    if (rendicion.estado !== "borrador") {
      res.status(409).json({ error: "Esta rendición ya fue enviada — no se pueden agregar más gastos" });
      return;
    }

    const { categoria, categoria_gasto_id, centro_costo_id, proveedor_id, trabajo_id, viaje_id, descripcion, monto, fecha } = req.body ?? {};

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
    if (viaje_id && !(await existeEnTabla("viajes", req.empresaId!, viaje_id))) {
      res.status(400).json({ error: "El viaje indicado no existe" });
      return;
    }

    const { data, error } = await supabase
      .from("gastos")
      .insert({
        empresa_id: req.empresaId!,
        rendicion_id: rendicion.id,
        categoria: categoriaFinal,
        categoria_gasto_id: resuelta.categoria_gasto_id,
        centro_costo_id: centro_costo_id || null,
        proveedor_id: proveedor_id || null,
        trabajo_id: trabajo_id || null,
        viaje_id: viaje_id || null,
        descripcion: descripcion?.trim() || null,
        monto: montoNum,
        fecha,
        estado: "pendiente",
        folio: null,
      })
      .select("*, categoria_info:categorias_gasto(id, nombre, color), proveedor_info:proveedores(id, nombre)")
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
        .select("*, categoria_info:categorias_gasto(id, nombre, color), proveedor_info:proveedores(id, nombre)")
        .single();
      res.status(201).json(actualizado);
      return;
    }

    res.status(201).json(data);
  })
);

// Quita un gasto de una rendición todavía en borrador (ej. se cargó
// por error antes de enviar) — hard delete a propósito: el gasto se
// creó específicamente como ítem de ESTA rendición (POST /:id/items,
// arriba), no es un registro financiero que ya viva en otro lado; una
// vez enviada/aprobada queda bloqueado igual que la edición (ver
// PATCH /api/gastos/:id).
rendicionesRouter.delete(
  "/:id/items/:gastoId",
  ah<RequestConEmpresa>(async (req, res) => {
    const rendicion = await obtenerRendicion(req.empresaId!, req.params.id);
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }
    if (!esGestion(req) && rendicion.colaborador_id !== req.userId && rendicion.creado_por !== req.userId) {
      res.status(403).json({ error: "Solo puedes editar tus propias rendiciones" });
      return;
    }
    if (rendicion.estado !== "borrador") {
      res.status(409).json({ error: "Esta rendición ya fue enviada — no se pueden quitar gastos" });
      return;
    }

    const { data: gasto } = await supabase
      .from("gastos")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.gastoId)
      .eq("rendicion_id", rendicion.id)
      .maybeSingle();
    if (!gasto) {
      res.status(404).json({ error: "Gasto no encontrado en esta rendición" });
      return;
    }

    const { error } = await supabase.from("gastos").delete().eq("id", gasto.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).send();
  })
);

rendicionesRouter.post(
  "/:id/enviar",
  ah<RequestConEmpresa>(async (req, res) => {
    const rendicion = await obtenerRendicion(req.empresaId!, req.params.id);
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }
    if (!esGestion(req) && rendicion.colaborador_id !== req.userId) {
      res.status(403).json({ error: "Solo puedes enviar tus propias rendiciones" });
      return;
    }
    if (rendicion.estado !== "borrador") {
      res.status(409).json({ error: "Esta rendición ya fue enviada" });
      return;
    }

    // El comprobante se sube aparte (cola offline) después de crear
    // cada gasto — recién acá, al enviar, tiene sentido exigir que
    // todos hayan terminado de subir. Si alguno todavía no tiene foto
    // (subida en curso o el usuario nunca la sacó), se bloquea el envío
    // en vez de dejar pasar una rendición sin respaldo.
    const { data: gastosSinComprobante } = await supabase
      .from("gastos")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("rendicion_id", rendicion.id)
      .is("comprobante_url", null);
    if (gastosSinComprobante && gastosSinComprobante.length > 0) {
      res.status(409).json({
        error: `${gastosSinComprobante.length} gasto(s) todavía no tienen foto del comprobante — espera a que terminen de subir antes de enviar.`,
      });
      return;
    }

    const { data, error } = await supabase.from("rendiciones").update({ estado: "enviada" }).eq("id", rendicion.id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Un solo endpoint para dos cosas distintas, separadas por quién puede
// tocar qué: (1) gestión aprueba/rechaza/marca saldo liquidado — igual
// que antes; (2) el dueño de una rendición en 'borrador' (colaborador_id
// o creado_por) edita los datos base que puso al crearla, antes de
// enviarla. Nunca se mezclan en la misma request (si viene `accion` o
// `saldo_liquidado`, son 1); si no, es 2.
rendicionesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const rendicion = await obtenerRendicion(req.empresaId!, req.params.id);
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }

    const { accion, motivo_rechazo, saldo_liquidado, colaborador_id, periodo, fecha_inicio, fecha_termino, monto_entregado } = req.body ?? {};
    const esRevision = accion !== undefined || saldo_liquidado !== undefined;
    const cambios: Partial<Rendicion> = {};

    if (esRevision) {
      if (!esGestion(req)) {
        res.status(403).json({ error: "Solo un rol de gestión puede aprobar/rechazar rendiciones" });
        return;
      }
      if (accion !== undefined) {
        if (rendicion.estado !== "enviada") {
          res.status(409).json({ error: "Solo se puede aprobar/rechazar una rendición enviada" });
          return;
        }
        if (accion === "aprobar") {
          cambios.estado = "aprobada";
          cambios.aprobado_por = req.userId!;
          cambios.fecha_aprobacion = new Date().toISOString();
        } else if (accion === "rechazar") {
          if (typeof motivo_rechazo !== "string" || !motivo_rechazo.trim()) {
            res.status(400).json({ error: "Falta el motivo del rechazo" });
            return;
          }
          cambios.estado = "borrador";
          cambios.motivo_rechazo = motivo_rechazo.trim();
        } else {
          res.status(400).json({ error: "accion debe ser 'aprobar' o 'rechazar'" });
          return;
        }
      }
      if (saldo_liquidado !== undefined) {
        cambios.saldo_liquidado = Boolean(saldo_liquidado);
        cambios.fecha_liquidacion = saldo_liquidado ? new Date().toISOString().slice(0, 10) : null;
      }
    } else {
      if (!esGestion(req) && rendicion.colaborador_id !== req.userId && rendicion.creado_por !== req.userId) {
        res.status(403).json({ error: "Solo puedes editar tus propias rendiciones" });
        return;
      }
      if (rendicion.estado !== "borrador") {
        res.status(409).json({ error: "Esta rendición ya fue enviada — no se puede editar" });
        return;
      }
      if (colaborador_id !== undefined) {
        if (colaborador_id !== rendicion.colaborador_id && !esGestion(req)) {
          res.status(403).json({ error: "Solo gestión puede reasignar el colaborador" });
          return;
        }
        if (!(await existeEnTabla("usuarios", req.empresaId!, colaborador_id))) {
          res.status(400).json({ error: "El colaborador indicado no existe" });
          return;
        }
        cambios.colaborador_id = colaborador_id;
      }
      if (periodo !== undefined) {
        if (!PERIODOS.includes(periodo)) {
          res.status(400).json({ error: `periodo debe ser uno de: ${PERIODOS.join(", ")}` });
          return;
        }
        cambios.periodo = periodo;
      }
      if (fecha_inicio !== undefined) {
        if (typeof fecha_inicio !== "string" || !fecha_inicio) {
          res.status(400).json({ error: "fecha_inicio inválida" });
          return;
        }
        cambios.fecha_inicio = fecha_inicio;
      }
      if (fecha_termino !== undefined) {
        if (typeof fecha_termino !== "string" || !fecha_termino) {
          res.status(400).json({ error: "fecha_termino inválida" });
          return;
        }
        cambios.fecha_termino = fecha_termino;
      }
      if (monto_entregado !== undefined) {
        const montoNum = Number(monto_entregado);
        if (!Number.isFinite(montoNum) || montoNum <= 0) {
          res.status(400).json({ error: "monto_entregado inválido" });
          return;
        }
        cambios.monto_entregado = montoNum;
      }
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase.from("rendiciones").update(cambios).eq("id", rendicion.id).select().single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// Elimina una rendición completa — solo mientras sigue en 'borrador'
// (nada enviado ni aprobado todavía, cero riesgo de perder un registro
// ya en revisión). Sus gastos son parte de la rendición, no registros
// independientes (se crearon vía POST /:id/items) — se borran con ella
// en vez de quedar huérfanos con rendicion_id apuntando a nada.
rendicionesRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const rendicion = await obtenerRendicion(req.empresaId!, req.params.id);
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }
    if (!esGestion(req) && rendicion.colaborador_id !== req.userId && rendicion.creado_por !== req.userId) {
      res.status(403).json({ error: "Solo puedes eliminar tus propias rendiciones" });
      return;
    }
    if (rendicion.estado !== "borrador") {
      res.status(409).json({ error: "Solo se puede eliminar una rendición en borrador" });
      return;
    }

    const { error: errorGastos } = await supabase.from("gastos").delete().eq("empresa_id", req.empresaId!).eq("rendicion_id", rendicion.id);
    if (errorGastos) {
      res.status(500).json({ error: errorGastos.message });
      return;
    }
    const { error } = await supabase.from("rendiciones").delete().eq("id", rendicion.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).send();
  })
);
