import { Router } from "express";
import multer from "multer";
import type { ConfigViaticos, EstadoViaje, Factura, Viaje } from "@bitacora/shared";
import { supabase } from "../supabase";
import { subirFotoGuiaConNombre, urlFirmadaFotoGuia } from "../storage";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereAccion, requiereRol } from "../permisos";
import { ROLES_EDITAN_MONTO_VIAJE, calcularMontos, normalizarHora, nuevosMontosViaje } from "../viajesMontos";
import { registrarAuditoriaEmpresa } from "../auditoriaEmpresa";
import { cobroDeViaje } from "../viajesCobros";
import { camposPrecio, leerPedidoPrecio, mismaFormaDeCobro, paradasDelViaje, sinCostos, type CamposPrecio, type PedidoPrecio } from "../viajesPrecio";
import { avisarViajeAsignado, validarChofer } from "../viajesAsignacion";
import { siguienteFolioCobro, siguienteFolioViaje } from "../folios";
import {
  borrarViajeConViatico,
  errorViaticoPagado,
  gastoViaticoDe,
  leerConfigViaticos,
  leerViatico,
  mismoViatico,
  sincronizarGastoViatico,
  viaticoDeViaje,
} from "../viajesViaticos";

export const viajesRouter = Router();

const ESTADOS: EstadoViaje[] = ["borrador", "confirmado", "facturado"];

// Este router entero ya está montado detrás de requiereModulo("viajes")
// (server.ts) — solo admin/supervisor tienen ese módulo (packages/shared/
// src/permisos.ts), nunca colaborador. Por eso las rutas de fotos de abajo
// no necesitan un guard de rol propio: el chofer llega por /api/mis-viajes,
// no por acá.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

// Montos por defecto de viático (tarea 137): se precargan al elegir el
// tipo en un viaje. Leerlos: cualquiera con el módulo; cambiarlos: Admin.
viajesRouter.get(
  "/config",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("empresas")
      .select("viatico_local_monto, viatico_interregional_monto")
      .eq("id", req.empresaId!)
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// requiereRol y no requiereAccion: no hay una acción delegable para la
// configuración de Viajes (ACCIONES en packages/shared/src/permisos.ts),
// y los montos por defecto son configuración de la empresa, del Admin —
// mismo criterio que eliminar clientes (tarea 131).
viajesRouter.patch(
  "/config",
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const leido = leerConfigViaticos(req.body);
    if ("error" in leido) {
      res.status(400).json({ error: leido.error });
      return;
    }
    const cambios = leido.cambios;
    const { data, error } = await supabase
      .from("empresas")
      .update(cambios)
      .eq("id", req.empresaId!)
      .select("viatico_local_monto, viatico_interregional_monto")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

viajesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { desde, hasta, estado, cliente_id, chofer_id, equipo_id } = req.query;

    let query = supabase
      .from("viajes")
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre), equipo:equipos(id, patente, marca, modelo)")
      .eq("empresa_id", req.empresaId!)
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false });

    if (typeof desde === "string" && desde) query = query.gte("fecha", desde);
    if (typeof hasta === "string" && hasta) query = query.lte("fecha", hasta);
    if (typeof estado === "string" && ESTADOS.includes(estado as EstadoViaje)) query = query.eq("estado", estado as EstadoViaje);
    if (typeof cliente_id === "string" && cliente_id) query = query.eq("cliente_id", cliente_id);
    if (typeof chofer_id === "string" && chofer_id) query = query.eq("chofer_id", chofer_id);
    // Tarea 148: viajes de un equipo (pestaña Viajes de la ficha del vehículo).
    if (typeof equipo_id === "string" && equipo_id) query = query.eq("equipo_id", equipo_id);

    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json((data ?? []).map((v) => sinCostos(req, v)));
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

// Fotos adicionales del viaje — las sube el chofer desde la app
// (POST /api/mis-viajes/:id/fotos) o, desde acá, un admin/supervisor.
viajesRouter.get(
  "/:id/fotos",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data } = await supabase
      .from("viaje_fotos")
      .select("id, foto_url, creado_en")
      .eq("empresa_id", req.empresaId!)
      .eq("viaje_id", req.params.id)
      .order("creado_en");
    const fotos = await Promise.all(
      (data ?? []).map(async (f) => ({ id: f.id, creado_en: f.creado_en, url: await urlFirmadaFotoGuia(f.foto_url, 15) }))
    );
    res.json(fotos);
  })
);

// Subir una foto desde el panel de admin/supervisor — mismo storage y
// mismo patrón que POST /api/mis-viajes/:id/fotos (subirFotoGuiaConNombre
// + insert en viaje_fotos), pero sin el guard de "solo mis viajes" porque
// este router ya está scopeado a rol de gestión.
viajesRouter.post(
  "/:id/fotos",
  upload.single("foto"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "Falta la foto" });
      return;
    }
    const { data: viaje } = await supabase
      .from("viajes")
      .select("id, numero_guia, estado")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!viaje) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    if (viaje.estado === "facturado") {
      res.status(409).json({ error: "Este viaje ya fue facturado y no se puede editar" });
      return;
    }
    const fotoKey = await subirFotoGuiaConNombre(req.empresaId!, viaje.numero_guia, req.file.buffer, req.file.mimetype);
    const { data, error } = await supabase
      .from("viaje_fotos")
      .insert({
        empresa_id: req.empresaId!,
        viaje_id: req.params.id,
        foto_url: fotoKey,
        subida_por: req.userId ?? null,
      })
      .select("id, creado_en")
      .single();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(201).json({ id: data.id, creado_en: data.creado_en, url: await urlFirmadaFotoGuia(fotoKey, 15) });
  })
);

// Eliminar una foto puntual. Borrado real — a diferencia de las fotos de
// OS (analisis_fotos), no hay regla de inmutabilidad para fotos de viaje.
// Bloqueado solo si el viaje ya fue facturado, igual que el resto de las
// ediciones de este router.
viajesRouter.delete(
  "/:id/fotos/:fotoId",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: viaje } = await supabase
      .from("viajes")
      .select("id, estado")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!viaje) {
      res.status(404).json({ error: "Viaje no encontrado" });
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
      equipo_id,
      origen,
      destino,
      km_inicial,
      km_final,
      subtotal,
      aplica_iva,
      comentarios,
      hora,
      viatico_tipo,
      viatico_monto,
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
    // Tarea 133: chofer de la misma empresa, activo, función chofer.
    let chofer: { id: string; nombre: string } | null = null;
    if (typeof chofer_id === "string" && chofer_id) {
      const c = await validarChofer(req.empresaId!, chofer_id);
      if ("error" in c) {
        res.status(400).json({ error: c.error });
        return;
      }
      chofer = c;
    }
    const horaNorm = normalizarHora(hora);
    if ("error" in horaNorm) {
      res.status(400).json({ error: horaNorm.error });
      return;
    }
    // Viático (tarea 137): solo Admin/Supervisor y siempre con chofer.
    const pedidoViatico = leerViatico(viatico_tipo, viatico_monto);
    if ("error" in pedidoViatico) {
      res.status(400).json({ error: pedidoViatico.error });
      return;
    }
    const viatico = "viatico" in pedidoViatico ? pedidoViatico.viatico : null;
    if (viatico) {
      if (!ROLES_EDITAN_MONTO_VIAJE.includes(req.rol ?? "")) {
        res.status(403).json({ error: "Solo el administrador o un supervisor pueden asignar viático" });
        return;
      }
      if (!chofer) {
        res.status(400).json({ error: "Asigna un chofer: el viático es del chofer del viaje" });
        return;
      }
    }
    // Forma de cobro (tarea 135): fijo, por tramos o por km. Solo quienes
    // editan el monto; el detalle lo arma el servidor con las tarifas.
    const pedidoPrecio = leerPedidoPrecio(req.body ?? {});
    if ("error" in pedidoPrecio) {
      res.status(400).json({ error: pedidoPrecio.error });
      return;
    }
    let precio: CamposPrecio | null = null;
    if ("pedido" in pedidoPrecio && pedidoPrecio.pedido.modo !== "fijo") {
      if (!ROLES_EDITAN_MONTO_VIAJE.includes(req.rol ?? "")) {
        res.status(403).json({ error: "Solo el administrador o un supervisor pueden cobrar por tramos o por km" });
        return;
      }
      const c = await camposPrecio(req.empresaId!, resultado.cliente.id, pedidoPrecio.pedido);
      if ("error" in c) {
        res.status(400).json({ error: c.error });
        return;
      }
      precio = c;
    }
    const subtotalNum = Number(subtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum < 0) {
      res.status(400).json({ error: "monto inválido" });
      return;
    }
    const aplicaIvaBool = aplica_iva !== false;
    const { subtotal: subtotalRedondeado, iva, total } = calcularMontos(subtotalNum, aplicaIvaBool);
    const folio = await siguienteFolioViaje(req.empresaId!);

    const { data, error } = await supabase
      .from("viajes")
      .insert({
        empresa_id: req.empresaId!,
        fecha,
        numero_guia: numero_guia.trim(),
        folio,
        cliente: resultado.cliente.nombre,
        cliente_id: resultado.cliente.id,
        hora: horaNorm.hora,
        chofer_id: chofer?.id ?? null,
        equipo_id: typeof equipo_id === "string" && equipo_id ? equipo_id : null,
        origen: precio?.origen ?? origen.trim(),
        destino: precio?.destino ?? destino.trim(),
        ...(precio ? { modo_precio: precio.modo_precio, tramos_detalle: precio.tramos_detalle, distancia_km: precio.distancia_km, precio_km: precio.precio_km } : {}),
        km_inicial: km_inicial === "" || km_inicial == null ? null : Number(km_inicial),
        km_final: km_final === "" || km_final == null ? null : Number(km_final),
        subtotal: subtotalRedondeado,
        aplica_iva: aplicaIvaBool,
        iva,
        total,
        estado: "confirmado",
        origen_captura: "manual",
        comentarios: typeof comentarios === "string" && comentarios.trim() ? comentarios.trim() : null,
        viatico_tipo: viatico?.tipo ?? null,
        viatico_monto: viatico?.monto ?? null,
      })
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre), equipo:equipos(id, patente, marca, modelo)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (viatico) {
      const sync = await sincronizarGastoViatico(req.empresaId!, data, viatico);
      if (!("ok" in sync)) {
        // Sin el gasto no queda el viaje: si no, volver a guardar lo
        // duplicaría. Se deshace y se informa como error normal.
        await supabase.from("viajes").delete().eq("empresa_id", req.empresaId!).eq("id", data.id);
        res.status(500).json({ error: `No se pudo registrar el viático, así que el viaje no se guardó. Intenta de nuevo.` });
        return;
      }
    }
    // Aviso al chofer (no a quien se asigna a sí mismo).
    if (chofer && chofer.id !== req.userId) await avisarViajeAsignado(req.empresaId!, chofer.id, data);
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
      const cobro = await cobroDeViaje(req.empresaId!, existente.factura_id);
      res.status(409).json({
        error: cobro?.folio != null ? `Este viaje ya está en el cobro N° ${cobro.folio} y no se puede editar` : "Este viaje ya fue cobrado y no se puede editar",
        cobro,
      });
      return;
    }

    const {
      fecha,
      numero_guia,
      cliente_id,
      chofer_id,
      equipo_id,
      origen,
      destino,
      km_inicial,
      km_final,
      subtotal,
      aplica_iva,
      comentarios,
      estado,
      hora,
      viatico_tipo,
      viatico_monto,
    } = req.body ?? {};

    const cambios: Partial<Viaje> = {};

    if (fecha !== undefined) cambios.fecha = fecha;
    if (numero_guia !== undefined) cambios.numero_guia = String(numero_guia).trim();
    if (origen !== undefined) cambios.origen = String(origen).trim();
    if (destino !== undefined) cambios.destino = String(destino).trim();
    if (comentarios !== undefined) cambios.comentarios = comentarios?.trim() || null;
    // Solo se valida si el chofer CAMBIA: un viaje antiguo asignado a
    // alguien sin la función Chofer se puede seguir editando igual.
    if (chofer_id !== undefined && (chofer_id || null) !== existente.chofer_id) {
      if (chofer_id) {
        const c = await validarChofer(req.empresaId!, chofer_id);
        if ("error" in c) {
          res.status(400).json({ error: c.error });
          return;
        }
        cambios.chofer_id = c.id;
      } else {
        cambios.chofer_id = null;
      }
    }
    if (hora !== undefined) {
      const h = normalizarHora(hora);
      if ("error" in h) {
        res.status(400).json({ error: h.error });
        return;
      }
      cambios.hora = h.hora;
    }
    if (equipo_id !== undefined) cambios.equipo_id = equipo_id || null;
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

    // Monto (tarea 132): solo Admin y Supervisor; queda en el historial.
    const montos = nuevosMontosViaje(existente, subtotal, aplica_iva);
    if ("error" in montos) {
      res.status(400).json({ error: montos.error });
      return;
    }
    if (montos.cambio) {
      if (!ROLES_EDITAN_MONTO_VIAJE.includes(req.rol ?? "")) {
        res.status(403).json({ error: "Solo el administrador o un supervisor pueden cambiar el monto del viaje" });
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

    // Forma de cobro (tarea 135). El detalle se recalcula solo si cambia la
    // forma de cobro, las paradas, los km o el cliente; si no, queda fijo.
    const pedidoPrecio = leerPedidoPrecio(req.body ?? {});
    if ("error" in pedidoPrecio) {
      res.status(400).json({ error: pedidoPrecio.error });
      return;
    }
    const clienteCambia = cambios.cliente_id !== undefined && cambios.cliente_id !== existente.cliente_id;
    let pedidoAplicar: PedidoPrecio | null = null;
    if ("pedido" in pedidoPrecio) {
      if (!mismaFormaDeCobro(existente, pedidoPrecio.pedido) || (clienteCambia && pedidoPrecio.pedido.modo !== "fijo")) pedidoAplicar = pedidoPrecio.pedido;
    } else if (existente.modo_precio !== "fijo") {
      const recorridoCambia =
        (cambios.origen !== undefined && cambios.origen !== existente.origen) || (cambios.destino !== undefined && cambios.destino !== existente.destino);
      if (recorridoCambia) {
        res.status(409).json({ error: "Este viaje se cobra por tramos o por km: al cambiar el recorrido, vuelve a calcular la forma de cobro" });
        return;
      }
      if (clienteCambia) {
        pedidoAplicar =
          existente.modo_precio === "tramos"
            ? { modo: "tramos", paradas: paradasDelViaje(existente) }
            : { modo: "km", distanciaKm: Number(existente.distancia_km ?? 0) };
      }
    }
    if (pedidoAplicar) {
      if (!ROLES_EDITAN_MONTO_VIAJE.includes(req.rol ?? "") && (pedidoAplicar.modo !== "fijo" || existente.modo_precio !== "fijo")) {
        res.status(403).json({ error: "Solo el administrador o un supervisor pueden cambiar la forma de cobro" });
        return;
      }
      const c = await camposPrecio(req.empresaId!, cambios.cliente_id ?? existente.cliente_id, pedidoAplicar);
      if ("error" in c) {
        res.status(400).json({ error: c.error });
        return;
      }
      const { origen: o, destino: d, ...resto } = c;
      Object.assign(cambios, resto, o ? { origen: o } : {}, d ? { destino: d } : {});
    }

    // Viático (tarea 137).
    const pedidoViatico = leerViatico(viatico_tipo, viatico_monto);
    if ("error" in pedidoViatico) {
      res.status(400).json({ error: pedidoViatico.error });
      return;
    }
    const viaticoAnterior = viaticoDeViaje(existente);
    const viaticoFinal = "viatico" in pedidoViatico ? pedidoViatico.viatico : viaticoAnterior;
    const cambiaViatico = !mismoViatico(viaticoAnterior, viaticoFinal);
    if (cambiaViatico && !ROLES_EDITAN_MONTO_VIAJE.includes(req.rol ?? "")) {
      res.status(403).json({ error: "Solo el administrador o un supervisor pueden cambiar el viático" });
      return;
    }
    const choferFinal = cambios.chofer_id !== undefined ? cambios.chofer_id : existente.chofer_id;
    if (viaticoFinal && !choferFinal) {
      res.status(400).json({ error: "Asigna un chofer: el viático es del chofer del viaje" });
      return;
    }
    const gastoViatico = viaticoAnterior ? await gastoViaticoDe(req.empresaId!, existente.id) : null;
    if (gastoViatico?.estado === "pagado" && (cambiaViatico || choferFinal !== existente.chofer_id)) {
      res.status(409).json({ error: errorViaticoPagado(gastoViatico) });
      return;
    }
    if (cambiaViatico) {
      cambios.viatico_tipo = viaticoFinal?.tipo ?? null;
      cambios.viatico_monto = viaticoFinal?.monto ?? null;
    }

    const { data, error } = await supabase
      .from("viajes")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(id, nombre), chofer:usuarios(id, nombre), equipo:equipos(id, patente, marca, modelo)")
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
    // El gasto del viático sigue al viaje (monto, fecha, guía y chofer).
    if (viaticoFinal || viaticoAnterior) {
      // Se sincroniza con lo que quedó guardado en el viaje (no con lo que
      // traía este pedido) y se verifica: con dos guardados a la vez, el
      // último en sincronizar deja el gasto igual al viaje.
      const leerGuardado = async () =>
        (await supabase.from("viajes").select("viatico_tipo, viatico_monto").eq("empresa_id", req.empresaId!).eq("id", existente.id).single()).data;
      let guardado = await leerGuardado();
      let sync = await sincronizarGastoViatico(req.empresaId!, data, guardado ? viaticoDeViaje(guardado) : viaticoFinal);
      for (let intento = 0; intento < 3 && "ok" in sync; intento++) {
        const ahora = await leerGuardado();
        if (!ahora || !guardado || mismoViatico(viaticoDeViaje(ahora), viaticoDeViaje(guardado))) break;
        guardado = ahora;
        sync = await sincronizarGastoViatico(req.empresaId!, data, viaticoDeViaje(ahora));
      }
      if ("pagado" in sync) {
        // Se pagó mientras se guardaba: el viaje vuelve al viático y chofer
        // del gasto pagado, que manda.
        if (cambiaViatico || choferFinal !== existente.chofer_id) {
          await supabase
            .from("viajes")
            .update({ viatico_tipo: existente.viatico_tipo, viatico_monto: existente.viatico_monto, chofer_id: existente.chofer_id })
            .eq("empresa_id", req.empresaId!)
            .eq("id", existente.id);
          res.status(409).json({ error: errorViaticoPagado(sync.pagado) });
          return;
        }
      } else if ("error" in sync) {
        res.status(500).json({ error: `El viaje se guardó, pero no se pudo actualizar el viático: ${sync.error}. Vuelve a guardarlo.` });
        return;
      }
    }
    // Reasignación (tarea 133): el viaje sale de la pizarra/agenda del
    // chofer anterior solo (se lista por chofer_id) y se avisa al nuevo.
    if (cambios.chofer_id && cambios.chofer_id !== existente.chofer_id && cambios.chofer_id !== req.userId) {
      await avisarViajeAsignado(req.empresaId!, cambios.chofer_id, data);
    }
    res.json(data);
  })
);

// Historial de cambios de monto de un viaje (tarea 132): monto anterior,
// monto nuevo, quién y cuándo, del más reciente al más antiguo.
viajesRouter.get(
  "/:id/historial-monto",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: viaje } = await supabase.from("viajes").select("id").eq("empresa_id", req.empresaId!).eq("id", req.params.id).maybeSingle();
    if (!viaje) {
      res.status(404).json({ error: "Viaje no encontrado" });
      return;
    }
    const { data, error } = await supabase
      .from("auditoria_empresa")
      .select("id, detalle, creado_en, usuario:usuarios(id, nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("entidad", "viaje")
      .eq("entidad_id", viaje.id)
      .eq("accion", "cambiar_monto")
      .order("creado_en", { ascending: false })
      .limit(100);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
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

// Agrupa varios viajes confirmados (todos del mismo cliente) en una
// sola factura — reutiliza la tabla "facturas" del módulo Cobros.
viajesRouter.post(
  "/facturar",
  requiereAccion("facturar"),
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
      res.status(409).json({ error: "Alguno de los viajes ya fue facturado" });
      return;
    }
    // Solo viajes confirmados (un borrador todavía no lo aprueba la
    // oficina) — la web ya lo exigía; ahora también el backend.
    if (viajes.some((v) => v.estado !== "confirmado")) {
      res.status(400).json({ error: "Solo se pueden cobrar viajes confirmados" });
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

    // Folio COB, igual que los cobros manuales y desde OS (tarea 134:
    // antes el cobro desde viajes quedaba sin folio).
    const folio = await siguienteFolioCobro(req.empresaId!);

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
        folio,
      })
      .select("*, cliente_info:clientes(id, nombre)")
      .single<Factura>();

    if (errorFactura) {
      res.status(500).json({ error: errorFactura.message });
      return;
    }

    // Marca los viajes SOLO si siguen sin cobro: si dos pedidos llegan a
    // la vez con los mismos viajes, uno gana y el otro deshace su cobro
    // (un viaje nunca queda en dos cobros).
    const { data: marcados, error: errorActualizar } = await supabase
      .from("viajes")
      .update({ estado: "facturado", factura_id: factura!.id })
      .eq("empresa_id", req.empresaId!)
      .in("id", viaje_ids)
      .eq("estado", "confirmado")
      .is("factura_id", null)
      .select("id");
    if (errorActualizar || (marcados?.length ?? 0) !== viaje_ids.length) {
      if (marcados?.length) {
        await supabase
          .from("viajes")
          .update({ estado: "confirmado", factura_id: null })
          .eq("empresa_id", req.empresaId!)
          .eq("factura_id", factura!.id);
      }
      await supabase.from("facturas").delete().eq("empresa_id", req.empresaId!).eq("id", factura!.id);
      res.status(409).json({ error: errorActualizar ? errorActualizar.message : "Alguno de los viajes ya fue incluido en otro cobro. Actualiza la lista y vuelve a intentarlo." });
      return;
    }

    res.status(201).json(factura);
  })
);
