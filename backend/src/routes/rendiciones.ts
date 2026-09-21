import { Router } from "express";
import type { EstadoRendicion, PeriodoRendicion, Rendicion } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { siguienteFolioRendicion } from "../folios";
import { resolverCategoria, existeEnTabla } from "./gastos";

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
      .select("*, colaborador:usuarios(id, nombre)")
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
// A propósito, este endpoint NO recibe la foto inline (sin
// upload.single acá): el mobile ya tiene un patrón probado para esto
// (crearGasto en services/gastos.ts) — crea el gasto por JSON primero
// (rápido, confiable) y encola el comprobante APARTE contra
// PATCH /api/gastos/:id (mismo mecanismo de reintento offline que ya
// usa Nuevo Gasto). Meter el archivo en esta misma request duplicaría
// ese código y reintroduciría el bug ya documentado en crearViaje: dos
// multipart del mismo comprobante viajando a la vez si el primero
// "cuelga" en señal mala. El comprobante SÍ es obligatorio — pero se
// exige recién al enviar la rendición (POST /:id/enviar), que es el
// punto donde ya tiene sentido haber esperado a que la cola termine.
rendicionesRouter.post(
  "/:id/items",
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
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
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

// Aprobar/rechazar (gestión) y marcar el saldo como liquidado —
// aprobar no dispara nada automático, ninguna pasarela real detrás
// (mismo criterio que Cobros): solo cambia estado + aprobado_por +
// fecha. Rechazar exige motivo y deja la rendición en 'borrador' de
// nuevo para que el colaborador la corrija.
rendicionesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!esGestion(req)) {
      res.status(403).json({ error: "Solo un rol de gestión puede aprobar/rechazar rendiciones" });
      return;
    }
    const rendicion = await obtenerRendicion(req.empresaId!, req.params.id);
    if (!rendicion) {
      res.status(404).json({ error: "Rendición no encontrada" });
      return;
    }

    const { accion, motivo_rechazo, saldo_liquidado } = req.body ?? {};
    const cambios: Partial<Rendicion> = {};

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
