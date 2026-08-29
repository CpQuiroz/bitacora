import { Router } from "express";
import type { EstadoViaje, Factura, Viaje } from "@bitacora/shared";
import { supabase } from "../supabase";
import { urlFirmadaFotoGuia } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereRol } from "../permisos";

export const viajesRouter = Router();

const IVA_TASA = 0.19;
const ESTADOS: EstadoViaje[] = ["borrador", "confirmado", "facturado"];

function calcularMontos(subtotalNum: number, aplicaIva: boolean) {
  const iva = aplicaIva ? Math.round(subtotalNum * IVA_TASA) : 0;
  return { subtotal: Math.round(subtotalNum), iva, total: Math.round(subtotalNum) + iva };
}

viajesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta, estado, cliente_id, chofer_id } = req.query;

    let query = supabase
      .from("viajes")
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre), vehiculo:vehiculos(id, patente, marca, modelo)")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false });

    if (typeof desde === "string" && desde) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && hasta) query = query.lte("fecha", hasta);
    if (typeof estado === "string" && ESTADOS.includes(estado as EstadoViaje)) query = query.eq("estado", estado as EstadoViaje);
    if (typeof cliente_id === "string" && cliente_id) query = query.eq("cliente_id", cliente_id);
    if (typeof chofer_id === "string" && chofer_id) query = query.eq("chofer_id", chofer_id);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

// Detalle agrupado por semana o por mes — para la vista semanal/mensual
// de guías pedida explícitamente.
viajesRouter.get(
  "/resumen",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta, agrupar } = req.query;
    const agrupacion = agrupar === "mes" ? "mes" : "semana";

    let query = supabase
      .from("viajes")
      .select("fecha, subtotal, iva, total, km_inicial, km_final")
      .eq("empresa_id", req.empresaId!);
    if (typeof desde === "string" && desde) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && hasta) query = query.lte("fecha", hasta);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const grupos = new Map<string, { clave: string; cantidad_viajes: number; subtotal: number; iva: number; total: number; km_total: number }>();
    for (const v of data ?? []) {
      const fecha = new Date(`${v.fecha}T00:00:00`);
      let clave: string;
      if (agrupacion === "mes") {
        clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      } else {
        const inicioSemana = new Date(fecha);
        const dia = (inicioSemana.getDay() + 6) % 7; // lunes = 0
        inicioSemana.setDate(inicioSemana.getDate() - dia);
        clave = inicioSemana.toISOString().slice(0, 10);
      }
      const actual = grupos.get(clave) ?? { clave, cantidad_viajes: 0, subtotal: 0, iva: 0, total: 0, km_total: 0 };
      actual.cantidad_viajes += 1;
      actual.subtotal += Number(v.subtotal) || 0;
      actual.iva += Number(v.iva) || 0;
      actual.total += Number(v.total) || 0;
      if (v.km_inicial != null && v.km_final != null) actual.km_total += Math.max(0, Number(v.km_final) - Number(v.km_inicial));
      grupos.set(clave, actual);
    }

    res.json(Array.from(grupos.values()).sort((a, b) => (a.clave < b.clave ? 1 : -1)));
  })
);

viajesRouter.get(
  "/:id/foto",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data } = await supabase
      .from("viajes")
      .select("foto_guia_url")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!data?.foto_guia_url) {
      res.status(404).json({ error: "Este viaje no tiene foto de guía" });
      return;
    }
    const url = await urlFirmadaFotoGuia(data.foto_guia_url);
    res.json({ url });
  })
);

async function resolverCliente(empresaId: string, clienteId: unknown) {
  if (typeof clienteId !== "string" || !clienteId.trim()) return { error: "Selecciona un cliente" as const };
  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre")
    .eq("empresa_id", empresaId)
    .eq("id", clienteId)
    .maybeSingle();
  if (!cliente) return { error: "El cliente indicado no existe" as const };
  return { cliente };
}

viajesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const {
      fecha,
      numero_guia,
      cliente_id,
      chofer_id,
      vehiculo_id,
      origen,
      destino,
      km_inicial,
      km_final,
      subtotal,
      aplica_iva,
      comentarios,
    } = req.body ?? {};

    if (typeof fecha !== "string" || !fecha) {
      res.status(400).json({ error: "Falta fecha" });
      return;
    }
    if (typeof numero_guia !== "string" || !numero_guia.trim()) {
      res.status(400).json({ error: "Falta número de guía" });
      return;
    }
    if (typeof origen !== "string" || !origen.trim() || typeof destino !== "string" || !destino.trim()) {
      res.status(400).json({ error: "Falta origen o destino" });
      return;
    }
    const resultado = await resolverCliente(req.empresaId!, cliente_id);
    if ("error" in resultado) {
      res.status(400).json({ error: resultado.error });
      return;
    }
    const subtotalNum = Number(subtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
      res.status(400).json({ error: "monto inválido" });
      return;
    }
    const aplicaIvaBool = aplica_iva !== false;
    const { subtotal: subtotalRedondeado, iva, total } = calcularMontos(subtotalNum, aplicaIvaBool);

    const { data, error } = await supabase
      .from("viajes")
      .insert({
        empresa_id: req.empresaId!,
        fecha,
        numero_guia: numero_guia.trim(),
        cliente: resultado.cliente.nombre,
        cliente_id: resultado.cliente.id,
        chofer_id: typeof chofer_id === "string" && chofer_id ? chofer_id : null,
        vehiculo_id: typeof vehiculo_id === "string" && vehiculo_id ? vehiculo_id : null,
        origen: origen.trim(),
        destino: destino.trim(),
        km_inicial: km_inicial === "" || km_inicial == null ? null : Number(km_inicial),
        km_final: km_final === "" || km_final == null ? null : Number(km_final),
        subtotal: subtotalRedondeado,
        aplica_iva: aplicaIvaBool,
        iva,
        total,
        estado: "confirmado",
        origen_captura: "manual",
        comentarios: typeof comentarios === "string" && comentarios.trim() ? comentarios.trim() : null,
      })
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre), vehiculo:vehiculos(id, patente, marca, modelo)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json(data);
  })
);

viajesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: existente, error: errorExistente } = await supabase
      .from("viajes")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (errorExistente) {
      res.status(500).json({ error: errorExistente.message });
      return;
    }
    if (!existente) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (existente.estado === "facturado") {
      res.status(400).json({ error: "Este viaje ya fue facturado y no se puede editar" });
      return;
    }

    const {
      fecha,
      numero_guia,
      cliente_id,
      chofer_id,
      vehiculo_id,
      origen,
      destino,
      km_inicial,
      km_final,
      subtotal,
      aplica_iva,
      comentarios,
      estado,
    } = req.body ?? {};

    const cambios: Partial<Viaje> = {};

    if (fecha !== undefined) cambios.fecha = fecha;
    if (numero_guia !== undefined) cambios.numero_guia = String(numero_guia).trim();
    if (origen !== undefined) cambios.origen = String(origen).trim();
    if (destino !== undefined) cambios.destino = String(destino).trim();
    if (comentarios !== undefined) cambios.comentarios = comentarios?.trim() || null;
    if (chofer_id !== undefined) cambios.chofer_id = chofer_id || null;
    if (vehiculo_id !== undefined) cambios.vehiculo_id = vehiculo_id || null;
    if (km_inicial !== undefined) cambios.km_inicial = km_inicial === "" || km_inicial == null ? null : Number(km_inicial);
    if (km_final !== undefined) cambios.km_final = km_final === "" || km_final == null ? null : Number(km_final);

    if (cliente_id !== undefined) {
      const resultado = await resolverCliente(req.empresaId!, cliente_id);
      if ("error" in resultado) {
        res.status(400).json({ error: resultado.error });
        return;
      }
      cambios.cliente = resultado.cliente.nombre;
      cambios.cliente_id = resultado.cliente.id;
    }

    if (subtotal !== undefined || aplica_iva !== undefined) {
      const subtotalNum = subtotal !== undefined ? Number(subtotal) : Number(existente.subtotal);
      if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
        res.status(400).json({ error: "monto inválido" });
        return;
      }
      const aplicaIvaBool = aplica_iva !== undefined ? aplica_iva !== false : existente.aplica_iva;
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

    const { data, error } = await supabase
      .from("viajes")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre), vehiculo:vehiculos(id, patente, marca, modelo)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

viajesRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
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

// Agrupa varios viajes confirmados (todos del mismo cliente) en una
// sola factura — reutiliza la tabla "facturas" del módulo Cobros.
viajesRouter.post(
  "/facturar",
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const { viaje_ids, fecha_vencimiento } = req.body ?? {};
    if (!Array.isArray(viaje_ids) || viaje_ids.length === 0) {
      res.status(400).json({ error: "Selecciona al menos un viaje" });
      return;
    }

    const { data: viajes, error } = await supabase
      .from("viajes")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .in("id", viaje_ids);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!viajes || viajes.length !== viaje_ids.length) {
      res.status(400).json({ error: "Alguno de los viajes indicados no existe" });
      return;
    }
    if (viajes.some((v) => v.estado === "facturado")) {
      res.status(400).json({ error: "Alguno de los viajes ya fue facturado" });
      return;
    }
    const clienteIds = new Set(viajes.map((v) => v.cliente_id));
    if (clienteIds.size !== 1 || !viajes[0]!.cliente_id) {
      res.status(400).json({ error: "Todos los viajes deben ser del mismo cliente" });
      return;
    }

    const montoTotal = viajes.reduce((acc, v) => acc + Number(v.total), 0);
    const hoy = new Date().toISOString().slice(0, 10);
    const vencimiento =
      typeof fecha_vencimiento === "string" && fecha_vencimiento
        ? fecha_vencimiento
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: factura, error: errorFactura } = await supabase
      .from("facturas")
      .insert({
        empresa_id: req.empresaId!,
        cliente: viajes[0]!.cliente,
        cliente_id: viajes[0]!.cliente_id,
        monto: montoTotal,
        fecha_emision: hoy,
        fecha_vencimiento: vencimiento,
        estado: "pendiente",
        viaje_ids,
      })
      .select("*, cliente_info:clientes(id, nombre)")
      .single<Factura>();

    if (errorFactura) {
      res.status(500).json({ error: errorFactura.message });
      return;
    }

    const { error: errorActualizar } = await supabase
      .from("viajes")
      .update({ estado: "facturado", factura_id: factura!.id })
      .eq("empresa_id", req.empresaId!)
      .in("id", viaje_ids);
    if (errorActualizar) {
      res.status(500).json({ error: errorActualizar.message });
      return;
    }

    res.status(201).json(factura);
  })
);
