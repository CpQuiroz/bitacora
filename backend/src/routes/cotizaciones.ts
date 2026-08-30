import { Router } from "express";
import type { EstadoPresupuesto, Presupuesto } from "@bitacora/shared";
import { sustituirVariables } from "@bitacora/shared";
import { supabase } from "../supabase";
import { crearOrdenServicio } from "../ordenes";
import { generarPdfCotizacion } from "../generarPdfCotizacion";
import { enviarCotizacionPdf } from "../email";
import { notificarCliente } from "../notificarCliente";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const cotizacionesRouter = Router();

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aprobado", "rechazado", "expirado"];
const IVA_TASA = 0.19;

type ItemEntrada = { catalogo_item_id?: string | null; descripcion: string; cantidad: number; precio_unitario: number };

function calcularTotales(items: ItemEntrada[]) {
  const subtotal = items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0);
  const iva = Math.round(subtotal * IVA_TASA);
  return { subtotal: Math.round(subtotal), iva, total: Math.round(subtotal) + iva };
}

function parsearItems(raw: unknown): ItemEntrada[] | null {
  if (!Array.isArray(raw)) return null;
  const items: ItemEntrada[] = [];
  for (const it of raw) {
    const descripcion = String(it?.descripcion ?? "").trim();
    const cantidad = Number(it?.cantidad);
    const precioUnitario = Number(it?.precio_unitario);
    if (!descripcion || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      return null;
    }
    items.push({ catalogo_item_id: it?.catalogo_item_id || null, descripcion, cantidad, precio_unitario: precioUnitario });
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

cotizacionesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    if (req.rol === "admin" || req.rol === "supervisor") {
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
    const { cliente_id, descripcion, fecha_vencimiento, estado, items: itemsRaw } = req.body ?? {};

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

    const items = parsearItems(itemsRaw ?? []);
    if (!items) {
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
    const { descripcion, fecha_vencimiento, estado, items: itemsRaw } = req.body ?? {};
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
        const pdf = await generarPdfCotizacion(datosPdf);
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
    textoEncabezado: plantilla?.texto_encabezado ? sustituirVariables(plantilla.texto_encabezado, variables) : null,
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

cotizacionesRouter.get(
  "/:id/pdf",
  ah<RequestConEmpresa>(async (req, res) => {
    const datos = await armarDatosPdfCotizacion(req.empresaId!, req.params.id);
    if (!datos) {
      res.status(404).json({ error: "Cotización no encontrada" });
      return;
    }
    const pdf = await generarPdfCotizacion(datos);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${datos.numeroTexto}.pdf"`);
    res.send(pdf);
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
    const pdf = await generarPdfCotizacion(datos);
    await enviarCotizacionPdf(destinatario, datos.empresaNombre, datos.numero ?? 0, pdf);
    res.json({ ok: true });
  })
);
