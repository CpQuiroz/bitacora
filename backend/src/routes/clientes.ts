import { Router } from "express";
import type { Cliente } from "@bitacora/shared";
import { formatearRut, validarRut, ROLES_SUPERVISION } from "@bitacora/shared";
import { supabase } from "../supabase";
import { geocodificarDireccion } from "../geocodificar";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { siguienteFolioCliente } from "../folios";
import { requiereRol } from "../permisos";
import { registrarAuditoriaEmpresa } from "../auditoriaEmpresa";

export const clientesRouter = Router();

// FASE 2.1 (23-sep-2026, pedido explícito) — un Colaborador (rol
// "colaborador": técnico/chofer/etc., NO Admin/Supervisor/Contador)
// solo debe ver los clientes vinculados a una OS o Levantamiento que
// tuvo asignado, en cualquier momento (activo o ya cerrado — "activos
// + los de su historial"). Mismo eje que ya usa trabajos.ts para su
// propio listado (`if (req.rol === "colaborador") query.eq("responsable_id",
// req.userId!)`) — se reusa ese criterio, no se inventa uno nuevo.
// Único punto de filtro: GET / y GET /:id de ESTE router — web
// (ComboboxCliente, listado) y mobile (listarClientes) pegan los dos
// contra los mismos 2 endpoints, así que alcanza con filtrar acá para
// cubrir listados, detalle, búsquedas (filtran en memoria sobre la
// lista ya acotada) y selectores a la vez, sin duplicar la regla en
// cada frontend.
async function clienteIdsVisiblesParaColaborador(empresaId: string, userId: string): Promise<Set<string>> {
  const [{ data: trabajos }, { data: levantamientos }] = await Promise.all([
    supabase.from("trabajos").select("cliente_id").eq("empresa_id", empresaId).eq("responsable_id", userId),
    supabase.from("levantamientos").select("cliente_id").eq("empresa_id", empresaId).eq("tecnico_id", userId),
  ]);
  const ids = new Set<string>();
  for (const t of trabajos ?? []) if (t.cliente_id) ids.add(t.cliente_id);
  for (const l of levantamientos ?? []) if (l.cliente_id) ids.add(l.cliente_id);
  return ids;
}

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

    let clientesVisibles = clientes ?? [];
    if (req.rol === "colaborador") {
      const visibles = await clienteIdsVisiblesParaColaborador(req.empresaId!, req.userId!);
      clientesVisibles = clientesVisibles.filter((c) => visibles.has(c.id));
    }

    const resumenPorCliente = new Map((resumen ?? []).map((r) => [r.cliente_id, r]));

    res.json(
      clientesVisibles.map((c) => {
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
    if (req.rol === "colaborador") {
      const visibles = await clienteIdsVisiblesParaColaborador(req.empresaId!, req.userId!);
      if (!visibles.has(cliente.id)) {
        res.status(403).json({ error: "No tienes acceso a este cliente" });
        return;
      }
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

    // Folio propio (migración 112), formateado como "CLI-000X" solo al
    // mostrarlo (formatearFolio, @bitacora/shared). Tolerante a error —
    // ver folios.ts. (La importación masiva de /importar NO asigna
    // folio a propósito — mismo criterio que las filas históricas, no
    // se justifica el costo de una reserva atómica por lote para hasta
    // 500 filas de una vez.)
    const folio = await siguienteFolioCliente(req.empresaId!);

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
        folio,
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

type FilaImportCliente = {
  nombre?: unknown;
  rut?: unknown;
  direccion?: unknown;
  comuna?: unknown;
  telefono?: unknown;
  correo?: unknown;
  contacto_nombre?: unknown;
  fecha_nacimiento?: unknown;
};

// POST /importar — alta masiva desde el CSV que bajan de "Exportar CSV"
// o de la plantilla (ver ImportarCsvModal.tsx). Mismas reglas que el
// alta manual (arriba) salvo una: NO geocodifica — Nominatim tiene
// política de 1 request/seg, cientos de filas seguidas la violarían.
// lat/lng quedan null, igual que "crear sin dirección" hoy; se
// completan solas al editar la dirección desde la ficha (PATCH re-
// geocodifica). Dedupe por RUT (no existe en el alta manual — ahí es
// una persona creando una a la vez, acá un archivo puede subirse dos
// veces por error).
clientesRouter.post(
  "/importar",
  ah<RequestConEmpresa>(async (req, res) => {
    const filas = req.body?.filas;
    if (!Array.isArray(filas) || filas.length === 0) {
      res.status(400).json({ error: "Falta el arreglo de filas a importar" });
      return;
    }
    if (filas.length > 500) {
      res.status(400).json({ error: "Máximo 500 filas por importación — dividí el archivo en partes más chicas" });
      return;
    }

    const { data: existentes } = await supabase
      .from("clientes")
      .select("rut")
      .eq("empresa_id", req.empresaId!)
      .not("rut", "is", null);
    const rutsExistentes = new Set((existentes ?? []).map((c) => c.rut));

    const errores: { fila: number; motivo: string }[] = [];
    const omitidos: { fila: number; motivo: string }[] = [];
    const paraCrear: {
      empresa_id: string;
      nombre: string;
      rut: string | null;
      direccion: string;
      comuna: string | null;
      telefono: string | null;
      correo: string | null;
      contacto_nombre: string | null;
      fecha_nacimiento: string | null;
    }[] = [];
    const rutsEnEsteArchivo = new Set<string>();

    (filas as FilaImportCliente[]).forEach((f, i) => {
      const numeroFila = i + 2; // +1 por índice base 0, +1 por la fila de encabezado del CSV
      const nombre = typeof f.nombre === "string" ? f.nombre.trim() : "";
      if (!nombre) {
        errores.push({ fila: numeroFila, motivo: "Falta el nombre" });
        return;
      }
      const rutBruto = typeof f.rut === "string" ? f.rut.trim() : "";
      if (rutBruto && !validarRut(rutBruto)) {
        errores.push({ fila: numeroFila, motivo: `RUT inválido: "${rutBruto}"` });
        return;
      }
      const rut = rutBruto ? formatearRut(rutBruto) : null;
      if (rut && (rutsExistentes.has(rut) || rutsEnEsteArchivo.has(rut))) {
        omitidos.push({ fila: numeroFila, motivo: `Ya existe un cliente con RUT ${rut} — no se creó de nuevo` });
        return;
      }
      if (rut) rutsEnEsteArchivo.add(rut);

      paraCrear.push({
        empresa_id: req.empresaId!,
        nombre,
        rut,
        direccion: typeof f.direccion === "string" ? f.direccion.trim() : "",
        comuna: typeof f.comuna === "string" && f.comuna.trim() ? f.comuna.trim() : null,
        telefono: typeof f.telefono === "string" && f.telefono.trim() ? f.telefono.trim() : null,
        correo: typeof f.correo === "string" && f.correo.trim() ? f.correo.trim() : null,
        contacto_nombre: typeof f.contacto_nombre === "string" && f.contacto_nombre.trim() ? f.contacto_nombre.trim() : null,
        fecha_nacimiento: typeof f.fecha_nacimiento === "string" && f.fecha_nacimiento.trim() ? f.fecha_nacimiento.trim() : null,
      });
    });

    if (paraCrear.length === 0) {
      res.status(400).json({ error: "Ninguna fila es válida", errores, omitidos });
      return;
    }

    const { data, error } = await supabase.from("clientes").insert(paraCrear).select("id");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ creados: data?.length ?? 0, errores, omitidos });
  })
);

clientesRouter.patch(
  "/:id",
  ah<RequestConEmpresa>(async (req, res) => {
    const { nombre, rut, direccion, comuna, telefono, correo, notas, contacto_nombre, activo, fecha_nacimiento, modo_precio_default } = req.body ?? {};
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
    // Tarea 135: forma de cobro por defecto de sus viajes (solo gestión de precios).
    if (modo_precio_default !== undefined) {
      if (modo_precio_default !== null && modo_precio_default !== "" && !["fijo", "tramos", "km"].includes(modo_precio_default)) {
        res.status(400).json({ error: "La forma de cobro debe ser fijo, tramos o km" });
        return;
      }
      if (!ROLES_SUPERVISION.includes(req.rol ?? "")) {
        res.status(403).json({ error: "La forma de cobro la define el administrador o un supervisor" });
        return;
      }
      cambios.modo_precio_default = modo_precio_default || null;
    }

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

// ============================================================
// Eliminar un cliente (tarea 131, 24-sep-2026) — solo el rol admin.
// Solo se borra si el cliente NO tiene historial. Se cuentan también las
// tablas que la base borraría en cascada (equipos, paquetes de sesiones)
// o dejaría huérfanas (viajes, cobros → SET NULL): el borrado nunca se
// lleva historial por delante. Con historial → 409 con el detalle, y la
// pantalla ofrece "Desactivar" en su lugar.
// ============================================================
const HISTORIAL_CLIENTE = [
  { tabla: "viajes", etiqueta: "viajes" },
  { tabla: "trabajos", etiqueta: "órdenes de servicio" },
  { tabla: "presupuestos", etiqueta: "cotizaciones" },
  { tabla: "facturas", etiqueta: "cobros" },
  { tabla: "levantamientos", etiqueta: "levantamientos" },
  { tabla: "ventas", etiqueta: "ventas" },
  { tabla: "paquetes_sesiones", etiqueta: "paquetes de sesiones" },
  { tabla: "equipos", etiqueta: "equipos" },
  // Citas de agenda y consentimientos firmados (Ley 21.719): la base los
  // dejaría huérfanos (SET NULL) — también son historial (review parte A).
  { tabla: "tareas", etiqueta: "citas de agenda" },
  { tabla: "consentimientos", etiqueta: "consentimientos firmados" },
] as const;

type UsoCliente = { etiqueta: string; cantidad: number }[];

async function usoDelCliente(empresaId: string, clienteId: string): Promise<UsoCliente> {
  const conteos = await Promise.all(
    HISTORIAL_CLIENTE.map(async ({ tabla, etiqueta }) => {
      const { count, error } = await supabase
        .from(tabla)
        .select("id", { count: "exact", head: true })
        .eq("empresa_id", empresaId)
        .eq("cliente_id", clienteId);
      if (error) throw new Error(`No se pudo revisar ${etiqueta} del cliente: ${error.message}`);
      return { etiqueta, cantidad: count ?? 0 };
    })
  );
  return conteos.filter((c) => c.cantidad > 0);
}

async function clienteDeEmpresa(empresaId: string, clienteId: string) {
  const { data } = await supabase.from("clientes").select("id, nombre, rut, activo").eq("empresa_id", empresaId).eq("id", clienteId).maybeSingle();
  return data;
}

// Cuántos registros tiene el cliente — la pantalla lo pide antes de
// ofrecer "Eliminar" (si hay historial, ofrece "Desactivar").
clientesRouter.get(
  "/:id/uso",
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const cliente = await clienteDeEmpresa(req.empresaId!, req.params.id);
    if (!cliente) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    const uso = await usoDelCliente(req.empresaId!, cliente.id);
    res.json({ eliminable: uso.length === 0, uso });
  })
);

clientesRouter.delete(
  "/:id",
  requiereRol("admin"),
  ah<RequestConEmpresa>(async (req, res) => {
    const cliente = await clienteDeEmpresa(req.empresaId!, req.params.id);
    if (!cliente) {
      res.status(404).json({ error: "Cliente no encontrado" });
      return;
    }
    const uso = await usoDelCliente(req.empresaId!, cliente.id);
    if (uso.length > 0) {
      res.status(409).json({
        error: `${cliente.nombre} tiene historial (${uso.map((u) => `${u.cantidad} ${u.etiqueta}`).join(", ")}) y no se puede eliminar. Puedes desactivarlo.`,
        code: "CLIENTE_CON_HISTORIAL",
        uso,
      });
      return;
    }

    const { error } = await supabase.from("clientes").delete().eq("empresa_id", req.empresaId!).eq("id", cliente.id);
    if (error) {
      // Carrera: alguien le asoció un registro entre el conteo y el borrado.
      if (error.code === "23503") {
        res.status(409).json({ error: `${cliente.nombre} tiene registros asociados y no se puede eliminar. Puedes desactivarlo.`, code: "CLIENTE_CON_HISTORIAL", uso: [] });
        return;
      }
      res.status(500).json({ error: error.message });
      return;
    }

    await registrarAuditoriaEmpresa({
      empresaId: req.empresaId!,
      usuarioId: req.userId ?? null,
      accion: "eliminar",
      entidad: "cliente",
      entidadId: cliente.id,
      detalle: { nombre: cliente.nombre, rut: cliente.rut },
    });
    res.status(204).end();
  })
);
