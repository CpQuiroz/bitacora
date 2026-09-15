import { Router } from "express";
import type { Cliente } from "@bitacora/shared";
import { formatearRut, validarRut } from "@bitacora/shared";
import { supabase } from "../supabase";
import { geocodificarDireccion } from "../geocodificar";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const clientesRouter = Router();

clientesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    // Los indicadores por cliente (cantidad de OS, última actividad,
    // saldo por cobrar/vencido, cotizaciones, packs) se calculan en SQL
    // vía RPC (GROUP BY sobre índices por cliente_id) — no se traen las
    // filas de trabajos/facturas a Node como antes, algo que crecía sin
    // techo con el historial de la empresa. Ver migración 103.
    const [{ data: clientes, error }, { data: resumen, error: errorResumen }] = await Promise.all([
      supabase.from("clientes").select("*").eq("empresa_id", req.empresaId!).order("nombre"),
      supabase.rpc("clientes_resumen", { p_empresa_id: req.empresaId! }),
    ]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (errorResumen) {
      res.status(500).json({ error: errorResumen.message });
      return;
    }

    const resumenPorCliente = new Map((resumen ?? []).map((r) => [r.cliente_id, r]));

    res.json(
      (clientes ?? []).map((c) => {
        const r = resumenPorCliente.get(c.id);
        return {
          ...c,
          cantidad_os: r?.cantidad_os ?? 0,
          cantidad_cotizaciones: r?.cantidad_cotizaciones ?? 0,
          ultima_actividad: r?.ultima_actividad ?? null,
          total_por_cobrar: r?.total_por_cobrar ?? 0,
          total_vencido: r?.total_vencido ?? 0,
          tiene_pack: r?.tiene_pack ?? false,
        };
      })
    );
  })
);

clientesRouter.get(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: cliente, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .eq("id", req.params.id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!cliente) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }

    const [{ data: trabajos }, { data: presupuestos }, { data: facturas }, { data: facturasPorNombre }, { data: equipos }] = await Promise.all([
      supabase
        .from("trabajos")
        .select("*, orden:ordenes_servicio(folio, estado_os)")
        .eq("empresa_id", req.empresaId!)
        .eq("cliente_id", req.params.id)
        .order("fecha", { ascending: false }),
      supabase
        .from("presupuestos")
        .select("*")
        .eq("empresa_id", req.empresaId!)
        .eq("cliente_id", req.params.id)
        .order("fecha", { ascending: false }),
      // Los cobros creados desde que "facturas" ganó cliente_id
      // (Financiero → Cobros) matchean por esa FK; los más viejos —
      // generados antes, o vía generar_factura() sin cliente_id
      // resuelto — todavía matchean por nombre exacto, best-effort.
      supabase
        .from("facturas")
        .select("*")
        .eq("empresa_id", req.empresaId!)
        .eq("cliente_id", req.params.id)
        .order("fecha_emision", { ascending: false }),
      supabase
        .from("facturas")
        .select("*")
        .eq("empresa_id", req.empresaId!)
        .is("cliente_id", null)
        .eq("cliente", cliente.nombre)
        .order("fecha_emision", { ascending: false }),
      // Bloque A — Vista 360°: equipos de este cliente.
      supabase.from("equipos").select("*").eq("empresa_id", req.empresaId!).eq("cliente_id", req.params.id).order("nombre"),
    ]);

    const trabajosNormalizados = (trabajos ?? []).map((t) => ({
      ...t,
      orden: Array.isArray(t.orden) ? t.orden[0] ?? null : t.orden,
    }));

    res.json({
      ...cliente,
      trabajos: trabajosNormalizados,
      presupuestos: presupuestos ?? [],
      facturas: [...(facturas ?? []), ...(facturasPorNombre ?? [])],
      equipos: equipos ?? [],
    });
  })
);

// Las coordenadas se obtienen solas geocodificando la dirección
// (Nominatim/OpenStreetMap, gratis) — el usuario no las escribe a
// mano. Si la geocodificación no encuentra nada, el cliente igual se
// crea, solo que sin coordenadas (no va a aparecer en el mapa de
// rutas hasta que se corrija la dirección).
clientesRouter.post(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, rut, direccion, comuna, telefono, correo, notas, contacto_nombre, fecha_nacimiento } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    // La dirección es opcional: el "crear cliente al vuelo" del móvil
    // solo pide nombre/teléfono/RUT/correo y la ficha se completa después
    // desde la web. La columna es NOT NULL, así que sin dirección se
    // guarda "" y no se geocodifica (el cliente no sale en el mapa hasta
    // que se complete).
    const dir = typeof direccion === "string" ? direccion.trim() : "";
    if (rut && !validarRut(rut)) {
      res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
      return;
    }

    const coords = dir ? await geocodificarDireccion(dir) : null;

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        rut: rut ? formatearRut(rut) : null,
        direccion: dir,
        comuna: comuna?.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        telefono: telefono?.trim() || null,
        correo: correo?.trim() || null,
        notas: notas?.trim() || null,
        contacto_nombre: contacto_nombre?.trim() || null,
        fecha_nacimiento: fecha_nacimiento || null,
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

clientesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, rut, direccion, comuna, telefono, correo, notas, contacto_nombre, activo, fecha_nacimiento } = req.body ?? {};
    const cambios: Partial<Cliente> = {};
    let reGeocodificar = false;

    if (nombre !== undefined) {
      if (typeof nombre !== "string" || !nombre.trim()) {
        res.status(400).json({ error: "Falta nombre" });
        return;
      }
      cambios.nombre = nombre.trim();
    }
    if (rut !== undefined) {
      if (rut && !validarRut(rut)) {
        res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
        return;
      }
      cambios.rut = rut ? formatearRut(rut) : null;
    }
    if (direccion !== undefined) {
      if (typeof direccion !== "string" || !direccion.trim()) {
        res.status(400).json({ error: "Falta dirección" });
        return;
      }
      cambios.direccion = direccion.trim();
      reGeocodificar = true;
    }
    if (comuna !== undefined) cambios.comuna = comuna?.trim() || null;
    if (telefono !== undefined) cambios.telefono = telefono?.trim() || null;
    if (correo !== undefined) cambios.correo = correo?.trim() || null;
    if (notas !== undefined) cambios.notas = notas?.trim() || null;
    if (contacto_nombre !== undefined) cambios.contacto_nombre = contacto_nombre?.trim() || null;
    if (activo !== undefined) cambios.activo = Boolean(activo);
    if (fecha_nacimiento !== undefined) cambios.fecha_nacimiento = fecha_nacimiento || null;

    if (reGeocodificar) {
      const coords = await geocodificarDireccion(cambios.direccion!);
      cambios.lat = coords?.lat ?? null;
      cambios.lng = coords?.lng ?? null;
    }

    if (Object.keys(cambios).length === 0) {
      res.status(400).json({ error: "Nada que actualizar" });
      return;
    }

    const { data, error } = await supabase
      .from("clientes")
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
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    res.json(data);
  })
);
