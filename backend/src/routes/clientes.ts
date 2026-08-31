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
    const [{ data: clientes, error }, { data: trabajos }, { data: presupuestos }] = await Promise.all([
      supabase.from("clientes").select("*").eq("empresa_id", req.empresaId!).order("nombre"),
      supabase.from("trabajos").select("cliente_id, fecha").eq("empresa_id", req.empresaId!),
      supabase.from("presupuestos").select("cliente_id").eq("empresa_id", req.empresaId!),
    ]);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const osPorCliente = new Map<string, number>();
    const ultimaActividadPorCliente = new Map<string, string>();
    for (const t of trabajos ?? []) {
      if (!t.cliente_id) continue;
      osPorCliente.set(t.cliente_id, (osPorCliente.get(t.cliente_id) ?? 0) + 1);
      const actual = ultimaActividadPorCliente.get(t.cliente_id);
      if (!actual || t.fecha > actual) ultimaActividadPorCliente.set(t.cliente_id, t.fecha);
    }
    const cotizacionesPorCliente = new Map<string, number>();
    for (const p of presupuestos ?? []) {
      if (!p.cliente_id) continue;
      cotizacionesPorCliente.set(p.cliente_id, (cotizacionesPorCliente.get(p.cliente_id) ?? 0) + 1);
    }

    res.json(
      (clientes ?? []).map((c) => ({
        ...c,
        cantidad_os: osPorCliente.get(c.id) ?? 0,
        cantidad_cotizaciones: cotizacionesPorCliente.get(c.id) ?? 0,
        ultima_actividad: ultimaActividadPorCliente.get(c.id) ?? null,
      }))
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
    const { nombre, rut, direccion, comuna, telefono, correo, notas } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (typeof direccion !== "string" || !direccion.trim()) {
      res.status(400).json({ error: "Falta dirección" });
      return;
    }
    if (rut && !validarRut(rut)) {
      res.status(400).json({ error: "RUT inválido (verifica el dígito verificador)" });
      return;
    }

    const coords = await geocodificarDireccion(direccion.trim());

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        rut: rut ? formatearRut(rut) : null,
        direccion: direccion.trim(),
        comuna: comuna?.trim() || null,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        telefono: telefono?.trim() || null,
        correo: correo?.trim() || null,
        notas: notas?.trim() || null,
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
    const { nombre, rut, direccion, comuna, telefono, correo, notas, activo } = req.body ?? {};
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
    if (activo !== undefined) cambios.activo = Boolean(activo);

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
