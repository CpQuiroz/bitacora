import { Router } from "express";
import type { CotizacionViajeDatos, EstadoPresupuesto, Presupuesto } from "@bitacora/shared";
import { ROLES_SUPERVISION, sustituirVariables, sustituirVariablesEnBloques } from "@bitacora/shared";
import { supabase } from "../supabase";
import { crearOrdenServicio } from "../ordenes";
import type { DatosCotizacionPdf } from "../generarPdfCotizacion";
import { generarPdfEnWorker } from "../pdfWorkerPool";
import { enviarCotizacionPdf } from "../email";
import { subirPdfCotizacion, descargarPdfCotizacion, urlFirmadaPdfCotizacion } from "../storage";
import { notificarCliente } from "../notificarCliente";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { verificarLimiteOS } from "../limites";
import { camposPrecio, leerPedidoPrecio } from "../viajesPrecio";
import { calcularMontos } from "../viajesMontos";
import { modulosVisiblesDeUsuario } from "../permisos";
import { siguienteFolioViaje } from "../folios";

export const cotizacionesRouter = Router();

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aprobado", "rechazado", "expirado"];
const IVA_TASA = 0.19;

type ItemEntrada = {
  catalogo_item_id?: string | null;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  // Solo si la empresa tiene precios_avanzados_activado (migración
  // 116) — opcionales aunque lo tenga.
  costo?: number | null;
  precio_mayorista?: number | null;
  precio_minorista?: number | null;
};

function calcularTotales(items: ItemEntrada[]) {
  const subtotal = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  const iva = Math.round(subtotal * IVA_TASA);
  return { subtotal: Math.round(subtotal), iva, total: Math.round(subtotal) + iva };
}

// "" / null / undefined → null; NaN si viene un valor no numérico.
function numeroOpcional(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  return Number(v);
}

function parsearItems(raw: unknown): ItemEntrada[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ItemEntrada[] = [];
  for (const it of raw) {
    const descripcion = String(it?.descripcion ?? "").trim();
    const cantidad = Number(it?.cantidad);
    const precioUnitario = Number(it?.precio_unitario);
    const costo = numeroOpcional(it?.costo);
    const precioMayorista = numeroOpcional(it?.precio_mayorista);
    const precioMinorista = numeroOpcional(it?.precio_minorista);
    if (
      !descripcion ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      !Number.isFinite(precioUnitario) ||
      precioUnitario < 0 ||
      (costo !== null && Number.isNaN(costo)) ||
      (precioMayorista !== null && Number.isNaN(precioMayorista)) ||
      (precioMinorista !== null && Number.isNaN(precioMinorista))
    ) {
      return null;
    }
    items.push({
      catalogo_item_id: it?.catalogo_item_id || null,
      descripcion,
      cantidad,
      precio_unitario: precioUnitario,
      costo,
      precio_mayorista: precioMayorista,
      precio_minorista: precioMinorista,
    });
  }
  return items;
}

async function guardarItems(empresaId: string, presupuestoId: string, items: ItemEntrada[]) {
  await supabase.from("presupuesto_items").delete().eq("empresa_id", empresaId).eq("presupuesto_id", presupuestoId);
  if (items.length === 0) return;
  await supabase.from("presupuesto_items").insert(
    items.map((it) => ({
      empresa_id: empresaId,
      presupuesto_id: presupuestoId,
      catalogo_item_id: it.catalogo_item_id || null,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
      costo: it.costo ?? null,
      precio_mayorista: it.precio_mayorista ?? null,
      precio_minorista: it.precio_minorista ?? null,
    }))
  );
}

// Sin cron en este proyecto: cada vez que admin/supervisor abre el
// listado, se revisa rápido si alguna cotización enviada está por
// vencer y todavía no se le avisó al cliente — dedupe contra los
// envíos ya exitosos en notificaciones_cliente_log.
async function revisarCotizacionesPorVencer(empresaId: string) {
  const { data: config } = await supabase.from("notificaciones_config").select("dias_aviso_vencimiento").eq("empresa_id", empresaId).maybeSingle();
  const dias = config?.dias_aviso_vencimiento ?? 3;

  const hoy = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: porVencer } = await supabase
    .from("presupuestos")
    .select("id, numero, monto, fecha_vencimiento, cliente_id, cliente_info:clientes(nombre, correo)")
    .eq("empresa_id", empresaId)
    .eq("estado", "enviado")
    .gte("fecha_vencimiento", hoy)
    .lte("fecha_vencimiento", limite);

  const { data: empresa } = await supabase.from("empresas").select("nombre").eq("id", empresaId).single();

  for (const c of porVencer ?? []) {
    const clienteInfo = (c as unknown as { cliente_info: { nombre: string; correo: string | null } | null }).cliente_info;
    if (!clienteInfo?.correo || !c.cliente_id) continue;

    const { data: yaEnviado } = await supabase
      .from("notificaciones_cliente_log")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("tipo", "cotizacion_por_vencer")
      .eq("entidad_id", c.id)
      .eq("exito", true)
      .limit(1)
      .maybeSingle();
    if (yaEnviado) continue;

    await notificarCliente(empresaId, "cotizacion_por_vencer", clienteInfo.correo, {
      clienteId: c.cliente_id,
      entidadTipo: "cotizacion",
      entidadId: c.id,
      variables: {
        cliente: clienteInfo.nombre,
        fecha: c.fecha_vencimiento ?? "",
        monto: `$${Math.round(c.monto).toLocaleString("es-CL")}`,
        empresa: empresa?.nombre ?? "",
      },
    });
  }
}

// Bloque I: "expirado" es un estado real y persistido (no solo un
// cálculo del frontend, como era antes — ver docs/5_Estados_Cotizacion.mermaid).
// Sin cron en este proyecto: se revisa cada vez que se carga el
// listado, mismo patrón que revisarCotizacionesPorVencer() de acá
// abajo — a diferencia de esa, esta SÍ se espera (await) antes de
// responder, para que el listado que se devuelve ya refleje el estado
// correcto en vez de quedar un tick atrás.
async function marcarCotizacionesExpiradas(empresaId: string) {
  const hoy = new Date().toISOString().slice(0, 10);
  await supabase
    .from("presupuestos")
    .update({ estado: "expirado" })
    .eq("empresa_id", empresaId)
    .in("estado", ["borrador", "enviado"])
    .not("fecha_vencimiento", "is", null)
    .lt("fecha_vencimiento", hoy);
}

cotizacionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    await marcarCotizacionesExpiradas(req.empresaId!);
    if (ROLES_SUPERVISION.includes(req.rol ?? "")) {
      revisarCotizacionesPorVencer(req.empresaId!).catch((err) => console.error("Error revisando cotizaciones por vencer:", err));
    }

    const { data, error } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(nombre)")
      .eq("empresa_id", req.empresaId!)
      .order("numero", { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);

cotizacionesRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    await marcarCotizacionesExpiradas(req.empresaId!);
    const { data: cotizacion, error } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(id, nombre, correo, telefono, direccion)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!cotizacion) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }

    const { data: items } = await supabase
      .from("presupuesto_items")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("presupuesto_id", req.params.id)
      .order("creado_en");

    // Folio real de la OS ya generada — antes solo se sabía justo al
    // convertir (estado en memoria del frontend), así que al volver a
    // entrar más tarde solo se veía "ya fue convertida", sin el N°.
    let osFolio: number | null = null;
    if (cotizacion.trabajo_id) {
      const { data: orden } = await supabase
        .from("ordenes_servicio")
        .select("folio")
        .eq("empresa_id", req.empresaId!)
        .eq("trabajo_id", cotizacion.trabajo_id)
        .maybeSingle();
      osFolio = orden?.folio ?? null;
    }

    res.json({ ...cotizacion, items: items ?? [], os_folio: osFolio });
  })
);

cotizacionesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { cliente_id, descripcion, fecha_vencimiento, estado, items: itemsRaw, tipo, viaje } = req.body ?? {};

    if (typeof cliente_id !== "string" || !cliente_id.trim()) {
      res.status(400).json({ error: "Selecciona un cliente" });
      return;
    }
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", cliente_id)
      .maybeSingle();
    if (!cliente) {
      res.status(400).json({ error: "El cliente indicado no existe" });
      return;
    }

    // Cotización de viaje (tarea 135): el recorrido y la forma de cobro
    // se guardan en viaje_datos y se cotiza como un ítem "Viaje …".
    let viajeDatos: CotizacionViajeDatos | null = null;
    let itemsEntrada: unknown = itemsRaw ?? [];
    if (tipo === "viaje") {
      const armado = await armarCotizacionViaje(req, cliente_id, viaje);
      if ("error" in armado) {
        res.status(armado.status).json({ error: armado.error });
        return;
      }
      viajeDatos = armado.datos;
      itemsEntrada = [armado.item];
    }
    const items = parsearItems(itemsEntrada);
    if (!items || (tipo === "viaje" && items.length !== 1)) {
      res.status(400).json({ error: "Ítems inválidos — cada uno necesita descripción, cantidad y precio válidos" });
      return;
    }
    const estadoFinal: EstadoPresupuesto = ESTADOS.includes(estado) ? estado : "borrador";
    const { subtotal, iva, total } = calcularTotales(items);

    const { data: numero, error: errorNumero } = await supabase.rpc("siguiente_numero_cotizacion", {
      p_empresa_id: req.empresaId!,
    });
    if (errorNumero) {
      res.status(500).json({ error: errorNumero.message });
      return;
    }

    const { data, error } = await supabase
      .from("presupuestos")
      .insert({
        empresa_id: req.empresaId!,
        cliente_id,
        descripcion: descripcion?.trim() || null,
        monto: total,
        subtotal,
        iva,
        fecha: new Date().toISOString().slice(0, 10),
        fecha_vencimiento: fecha_vencimiento || null,
        estado: estadoFinal,
        numero,
        tipo: viajeDatos ? "viaje" : "servicio",
        viaje_datos: viajeDatos,
      })
      .select("*, cliente_info:clientes(nombre)")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    await guardarItems(req.empresaId!, data.id, items);
    res.status(201).json({ ...data, items });
  })
);

cotizacionesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { descripcion, fecha_vencimiento, estado, etapa_id, items: itemsRaw } = req.body ?? {};
    const cambios: Partial<Presupuesto> = {};

    if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
    if (fecha_vencimiento !== undefined) cambios.fecha_vencimiento = fecha_vencimiento || null;
    if (estado !== undefined) {
      if (!ESTADOS.includes(estado)) {
        res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(", ")}` });
        return;
      }
      cambios.estado = estado;
    }
    // Etapa de seguimiento interno a medida (migración 107) — capa
    // cosmética, sin ningún efecto sobre `estado` ni sobre el paso a OS.
    if (etapa_id !== undefined) cambios.etapa_id = etapa_id || null;

    let items: ItemEntrada[] | null = null;
    if (itemsRaw !== undefined) {
      items = parsearItems(itemsRaw);
      if (!items) {
        res.status(400).json({ error: "Ítems inválidos — cada uno necesita descripción, cantidad y precio válidos" });
        return;
      }
      const { subtotal, iva, total } = calcularTotales(items);
      cambios.subtotal = subtotal;
      cambios.iva = iva;
      cambios.monto = total;
    }

    // Invalida el PDF cacheado si cambió algo que se ve en el
    // documento — no por solo cambiar el estado administrativo.
    if (descripcion !== undefined || fecha_vencimiento !== undefined || itemsRaw !== undefined) {
      cambios.pdf_url = null;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("presupuestos")
      .update(cambios)
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .select("*, cliente_info:clientes(nombre)")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }

    if (items) await guardarItems(req.empresaId!, data.id, items);

    // Al marcar la cotización como "enviada", si el cliente tiene
    // correo, se le manda con el PDF adjunto — no bloquea la
    // respuesta si el envío falla (notificarCliente nunca lanza).
    if (cambios.estado === "enviado") {
      void (async () => {
        const datosPdf = await armarDatosPdfCotizacion(req.empresaId!, data.id);
        if (!datosPdf?.clienteCorreo || !datosPdf.clienteId) return;
        const pdf = await obtenerPdfCotizacion(req.empresaId!, data.id, datosPdf);
        await notificarCliente(req.empresaId!, "cotizacion_enviada", datosPdf.clienteCorreo, {
          clienteId: datosPdf.clienteId,
          entidadTipo: "cotizacion",
          entidadId: data.id,
          variables: {
            cliente: datosPdf.clienteNombre,
            fecha: datosPdf.fecha,
            monto: `$${Math.round(datosPdf.total).toLocaleString("es-CL")}`,
            empresa: datosPdf.empresaNombre,
          },
          adjunto: { filename: `${datosPdf.numeroTexto}.pdf`, buffer: pdf },
        });
      })();
    }

    res.json(data);
  })
);

// Convierte una cotización aprobada en un trabajo + orden de servicio
// real, arrastrando sus ítems como os_items (mismo formato que ya usa
// el flujo manual de creación de OS) — así el Catálogo termina siendo
// la fuente real de precios de una OS, sin duplicar esa lógica acá.
// No se puede eliminar una cotización ya convertida en OS — perdería
// la trazabilidad del trabajo real que generó (mismo criterio que
// trabajos.ts bloqueando el delete de una OS finalizada).
cotizacionesRouter.delete(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: cotizacion } = await supabase
      .from("presupuestos")
      .select("id, trabajo_id")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!cotizacion) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    if (cotizacion.trabajo_id) {
      res.status(403).json({ error: "Esta cotización ya fue convertida en una orden de servicio y no se puede eliminar" });
      return;
    }

    // presupuesto_items cae por ON DELETE CASCADE — no hace falta
    // borrarlos a mano acá.
    const { error } = await supabase.from("presupuestos").delete().eq("empresa_id", req.empresaId!).eq("id", req.params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.status(204).end();
  })
);

// Cotización de viaje aprobada → viaje en borrador con el mismo precio y
// forma de cobro (tarea 135). El Admin después le asigna chofer y guía.
cotizacionesRouter.post(
  "/:id/convertir-a-viaje",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!ROLES_SUPERVISION.includes(req.rol ?? "") || !(await modulosVisiblesDeUsuario(req.rol ?? "", req.empresaId!)).includes("viajes")) {
      res.status(403).json({ error: "Convertir en viaje requiere el módulo Viajes (administrador o supervisor)" });
      return;
    }
    const { data: cot } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!cot) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    if (cot.tipo !== "viaje" || !cot.viaje_datos) {
      res.status(400).json({ error: "Solo una cotización de viaje se convierte en viaje" });
      return;
    }
    if (cot.estado !== "aprobado") {
      res.status(400).json({ error: "Solo una cotización aprobada puede convertirse en viaje" });
      return;
    }
    if (cot.viaje_id) {
      res.status(409).json({ error: "Esta cotización ya fue convertida en un viaje", viaje_id: cot.viaje_id });
      return;
    }
    const d = cot.viaje_datos as CotizacionViajeDatos;
    const neto = Number(cot.subtotal ?? 0);
    const { subtotal, iva, total } = calcularMontos(neto, true);
    const folio = await siguienteFolioViaje(req.empresaId!);
    const { data: viajeCreado, error: errorViaje } = await supabase
      .from("viajes")
      .insert({
        empresa_id: req.empresaId!,
        fecha: d.fecha ?? new Date().toISOString().slice(0, 10),
        // La guía real se pone al despachar; mientras, la de la cotización.
        numero_guia: `COT-${cot.numero ?? folio}`,
        folio,
        cliente: (cot as { cliente_info?: { nombre?: string } }).cliente_info?.nombre ?? "Cliente",
        cliente_id: cot.cliente_id,
        origen: d.origen,
        destino: d.destino,
        subtotal,
        aplica_iva: true,
        iva,
        total,
        estado: "borrador",
        origen_captura: "manual",
        modo_precio: d.modo_precio,
        distancia_km: d.distancia_km,
        precio_km: d.precio_km,
        tramos_detalle: d.tramos_detalle,
        comentarios: `Desde la cotización N° ${cot.numero ?? "—"}`,
      })
      .select("id")
      .single();
    if (errorViaje || !viajeCreado) {
      res.status(500).json({ error: errorViaje?.message ?? "No se pudo crear el viaje" });
      return;
    }
    // Marcado atómico: si otro pedido convirtió primero, se deshace este viaje.
    const { data: marcada } = await supabase
      .from("presupuestos")
      .update({ viaje_id: viajeCreado.id })
      .eq("empresa_id", req.empresaId!)
      .eq("id", cot.id)
      .is("viaje_id", null)
      .select("id");
    if (!marcada?.length) {
      await supabase.from("viajes").delete().eq("empresa_id", req.empresaId!).eq("id", viajeCreado.id);
      res.status(409).json({ error: "Esta cotización ya fue convertida en un viaje" });
      return;
    }
    res.status(201).json({ viaje_id: viajeCreado.id });
  })
);

cotizacionesRouter.post(
  "/:id/convertir-a-os",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: cotizacion, error } = await supabase
      .from("presupuestos")
      .select("*, cliente_info:clientes(nombre)")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!cotizacion) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    if (cotizacion.estado !== "aprobado") {
      res.status(400).json({ error: "Solo una cotización aprobada puede convertirse en OS" });
      return;
    }
    if (cotizacion.trabajo_id) {
      res.status(400).json({ error: "Esta cotización ya fue convertida en una OS" });
      return;
    }

    // Convertir crea una OS nueva: cuenta para el tope mensual del plan,
    // igual que POST /api/trabajos.
    await verificarLimiteOS(req.empresaId!);

    const clienteNombre = (cotizacion as { cliente_info?: { nombre?: string } }).cliente_info?.nombre ?? "Cliente";

    const { data: trabajo, error: errorTrabajo } = await supabase
      .from("trabajos")
      .insert({
        empresa_id: req.empresaId!,
        cliente: clienteNombre,
        cliente_id: cotizacion.cliente_id,
        fecha: new Date().toISOString().slice(0, 10),
        monto: cotizacion.monto,
        estado: "en_curso",
        descripcion: cotizacion.descripcion,
        prioridad: "media",
        responsable_id: req.userId!,
      })
      .select()
      .single();

    if (errorTrabajo) {
      res.status(500).json({ error: errorTrabajo.message });
      return;
    }

    const { data: items } = await supabase
      .from("presupuesto_items")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("presupuesto_id", req.params.id);

    if (items && items.length > 0) {
      await supabase.from("os_items").insert(
        items.map((it) => ({
          empresa_id: req.empresaId!,
          trabajo_id: trabajo.id,
          catalogo_item_id: it.catalogo_item_id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precio_unitario: it.precio_unitario,
          costo: it.costo,
          precio_mayorista: it.precio_mayorista,
          precio_minorista: it.precio_minorista,
        }))
      );
    }

    const orden = await crearOrdenServicio(req.empresaId!, trabajo.id);

    await supabase
      .from("presupuestos")
      .update({ trabajo_id: trabajo.id })
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id);

    res.status(201).json({ trabajo_id: trabajo.id, folio: orden.folio });
  })
);

// Junta todo lo necesario para el PDF de una cotización — mismo patrón
// que armarDatosPdf() en trabajos.ts. Lo usan tanto la descarga directa
// como el envío por correo.
export async function armarDatosPdfCotizacion(empresaId: string, cotizacionId: string) {
  const { data: cotizacion } = await supabase
    .from("presupuestos")
    .select("*, cliente_info:clientes(nombre, correo, direccion)")
    .eq("empresa_id", empresaId)
    .eq("id", cotizacionId)
    .maybeSingle();
  if (!cotizacion) return null;

  const { data: empresa } = await supabase
    .from("empresas")
    .select("nombre, logo_url, color_primario")
    .eq("id", empresaId)
    .single();

  const { data: plantilla } = await supabase
    .from("plantillas_documento")
    .select("texto_encabezado, texto_pie, color_primario")
    .eq("empresa_id", empresaId)
    .eq("tipo", "cotizacion")
    .maybeSingle();

  const { data: items } = await supabase
    .from("presupuesto_items")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("presupuesto_id", cotizacionId)
    .order("creado_en");

  const clienteInfo = (cotizacion as unknown as { cliente_info: { nombre: string; correo: string | null; direccion: string | null } | null }).cliente_info;
  const clienteNombre = clienteInfo?.nombre ?? "Cliente";

  const variables = {
    cliente: clienteNombre,
    fecha: cotizacion.fecha,
    monto: `$${Math.round(cotizacion.monto).toLocaleString("es-CL")}`,
    empresa: empresa?.nombre ?? "",
  };

  return {
    empresaNombre: empresa?.nombre ?? "",
    empresaLogoUrl: empresa?.logo_url ?? null,
    colorPrimario: plantilla?.color_primario ?? empresa?.color_primario ?? null,
    textoEncabezado: plantilla?.texto_encabezado ? sustituirVariablesEnBloques(plantilla.texto_encabezado, variables) : null,
    textoPie: plantilla?.texto_pie ? sustituirVariables(plantilla.texto_pie, variables) : null,
    clienteId: cotizacion.cliente_id,
    numero: cotizacion.numero,
    fecha: cotizacion.fecha,
    fechaVencimiento: cotizacion.fecha_vencimiento,
    clienteNombre,
    clienteDireccion: clienteInfo?.direccion ?? null,
    clienteCorreo: clienteInfo?.correo ?? null,
    descripcion: cotizacion.descripcion,
    items: (items ?? []).map((it) => ({
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario,
    })),
    subtotal: cotizacion.subtotal ?? 0,
    iva: cotizacion.iva ?? 0,
    total: cotizacion.monto,
    estado: cotizacion.estado,
    numeroTexto: `Cotizacion-${cotizacion.numero ?? cotizacionId.slice(0, 8)}`,
  };
}

// El PDF se genera una sola vez y se sirve desde storage en los
// pedidos siguientes (pdf_url en presupuestos) — se invalida (vuelve a
// null) en el PATCH de abajo cuando la cotización cambia. Si el objeto
// cacheado no se puede leer (ej. se borró a mano en el bucket), se
// regenera igual en vez de fallar.
async function obtenerPdfCotizacion(
  empresaId: string,
  cotizacionId: string,
  datos: NonNullable<Awaited<ReturnType<typeof armarDatosPdfCotizacion>>>
): Promise<Buffer> {
  const { data: cotizacion } = await supabase.from("presupuestos").select("pdf_url").eq("empresa_id", empresaId).eq("id", cotizacionId).maybeSingle();
  if (cotizacion?.pdf_url) {
    try {
      return await descargarPdfCotizacion(cotizacion.pdf_url);
    } catch (err) {
      console.error("No se pudo leer el PDF cacheado de la cotización, se regenera:", err);
    }
  }
  const pdf = await generarPdfEnWorker<DatosCotizacionPdf>("cotizacion", datos);
  const key = await subirPdfCotizacion(empresaId, cotizacionId, pdf);
  await supabase.from("presupuestos").update({ pdf_url: key }).eq("empresa_id", empresaId).eq("id", cotizacionId);
  return pdf;
}

cotizacionesRouter.get(
  "/:id/pdf",
  ah<RequestConEmpresa>(async (req, res) => {
    const datos = await armarDatosPdfCotizacion(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    const pdf = await obtenerPdfCotizacion(req.empresaId!, req.params.id, datos);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${datos.numeroTexto}.pdf"`);
    res.send(pdf);
  })
);

// URL firmada temporal del PDF, para compartir fuera de la app (ej. link de
// WhatsApp) — a diferencia de /:id/pdf, que exige el header Authorization,
// esta URL es de por sí accesible por cualquiera que la tenga durante su
// validez. 7 días: el máximo que permite una URL firmada de S3, pensado
// para que el destinatario pueda abrirla días después de recibirla.
cotizacionesRouter.get(
  "/:id/pdf/compartir",
  ah<RequestConEmpresa>(async (req, res) => {
    const datos = await armarDatosPdfCotizacion(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    await obtenerPdfCotizacion(req.empresaId!, req.params.id, datos);
    const { data: cotizacion } = await supabase
      .from("presupuestos")
      .select("pdf_url")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();
    if (!cotizacion?.pdf_url) {
      res.status(500).json({ error: "No se pudo generar el PDF para compartir" });
      return;
    }
    const url = await urlFirmadaPdfCotizacion(cotizacion.pdf_url, 60 * 24 * 7);
    res.json({ url });
  })
);

cotizacionesRouter.post(
  "/:id/pdf/enviar",
  ah<RequestConEmpresa>(async (req, res) => {
    const datos = await armarDatosPdfCotizacion(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    const destinatario = typeof req.body?.destinatario === "string" && req.body.destinatario.trim() ? req.body.destinatario.trim() : datos.clienteCorreo;
    if (!destinatario) {
      res.status(400).json({ error: "El cliente no tiene correo registrado — indica un destinatario" });
      return;
    }
    const pdf = await obtenerPdfCotizacion(req.empresaId!, req.params.id, datos);
    await enviarCotizacionPdf(destinatario, datos.empresaNombre, datos.numero ?? 0, pdf);
    res.json({ ok: true });
  })
);

// Valida y arma una cotización de viaje (tarea 135). Precio neto (sin IVA).
async function armarCotizacionViaje(
  req: RequestConEmpresa,
  clienteId: string,
  viaje: unknown
): Promise<{ datos: CotizacionViajeDatos; item: Record<string, unknown> } | { error: string; status: 400 | 403 }> {
  if (!ROLES_SUPERVISION.includes(req.rol ?? "")) return { error: "La cotización de viaje la hace el administrador o un supervisor", status: 403 };
  const v = (viaje ?? {}) as { fecha?: unknown; origen?: unknown; destino?: unknown; paradas?: unknown; modo_precio?: unknown; distancia_km?: unknown; monto?: unknown };
  const origen = typeof v.origen === "string" ? v.origen.trim() : "";
  const destino = typeof v.destino === "string" ? v.destino.trim() : "";
  if (!origen || !destino) return { error: "Indica origen y destino del viaje", status: 400 };
  const paradas = Array.isArray(v.paradas) ? v.paradas.filter((p): p is string => typeof p === "string" && p.trim().length > 0).map((p) => p.trim()) : [];
  const monto = Number(v.monto);
  if (v.monto === "" || v.monto === null || v.monto === undefined || !Number.isFinite(monto) || monto < 0) return { error: "Monto del viaje inválido", status: 400 };
  const fecha = typeof v.fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.fecha) ? v.fecha : null;
  const pedido = leerPedidoPrecio({ modo_precio: v.modo_precio ?? "fijo", paradas: [origen, ...paradas, destino], distancia_km: v.distancia_km });
  if ("error" in pedido) return { error: pedido.error, status: 400 };
  if (!("pedido" in pedido)) return { error: "Forma de cobro inválida", status: 400 };
  const precio = await camposPrecio(req.empresaId!, clienteId, pedido.pedido);
  if ("error" in precio) return { error: precio.error, status: 400 };
  const recorrido = [origen, ...paradas, destino].join(" → ");
  const km = precio.distancia_km != null ? ` (${precio.distancia_km.toLocaleString("es-CL")} km)` : "";
  return {
    datos: {
      fecha,
      origen,
      destino,
      paradas,
      modo_precio: precio.modo_precio,
      distancia_km: precio.distancia_km,
      precio_km: precio.precio_km,
      tramos_detalle: precio.tramos_detalle,
    },
    item: { descripcion: `Viaje ${recorrido}${km}`, cantidad: 1, precio_unitario: Math.round(monto) },
  };
}
