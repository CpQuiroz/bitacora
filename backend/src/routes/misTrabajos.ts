import { Router } from "express";
import type { EstadoLevantamiento, EstadoOS } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

// Fase 5.3 (23-sep-2026, pedido explícito): "Mis trabajos" — historial
// de levantamientos/OS TERMINADOS para el colaborador (self-service,
// sin requiereModulo — mismo criterio que /api/mis-viajes: no depende
// de si la empresa tiene el módulo completo activado, solo de que el
// colaborador tenga trabajos/levantamientos propios). Solo lectura:
// no hay POST/PATCH acá, es una vista sobre datos que ya existen en
// /api/trabajos y /api/levantamientos.
export const misTrabajosRouter = Router();

const esGestion = (req: RequestConEmpresa) => req.rol !== "colaborador";

const DIAS_DEFAULT = 30;
const DIAS_MAX = 90;
const LIMITE_DEFAULT = 20;
const LIMITE_MAX = 100;

// "Terminado" desde el punto de vista del colaborador: su parte del
// trabajo ya está hecha, aunque la oficina no haya cerrado el ciclo
// completo (ej. cotizado_externo: el técnico ya evaluó, falta que
// Admin cotice afuera de Bitácora).
const OS_TERMINADAS: EstadoOS[] = ["completada", "firmada", "cancelada"];
const LEVANTAMIENTOS_TERMINADOS: EstadoLevantamiento[] = ["completado_tecnico", "cotizado_externo", "aprobado", "rechazado"];

type ItemHistorial = {
  tipo: "os" | "levantamiento";
  id: string;
  folio: number | null;
  fecha: string;
  cliente_nombre: string;
  estado: string;
};

misTrabajosRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    // Un colaborador ve lo suyo; gestión ve lo suyo por defecto y puede
    // pedir lo de cualquier otro colaborador (?colaborador_id=), ej.
    // desde su ficha de Equipo (mismo patrón que /api/rendiciones).
    const colaboradorIdParam = typeof req.query.colaborador_id === "string" ? req.query.colaborador_id : "";
    const colaboradorId = esGestion(req) && colaboradorIdParam ? colaboradorIdParam : req.userId!;

    const diasParam = Number(req.query.dias);
    const dias = Number.isFinite(diasParam) && diasParam > 0 ? Math.min(diasParam, DIAS_MAX) : DIAS_DEFAULT;
    const cutoff = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const tipo = req.query.tipo === "os" || req.query.tipo === "levantamiento" ? req.query.tipo : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const paginaParam = Number(req.query.pagina);
    const pagina = Number.isInteger(paginaParam) && paginaParam > 0 ? paginaParam : 1;
    const limiteParam = Number(req.query.limite);
    const limite = Number.isInteger(limiteParam) && limiteParam > 0 ? Math.min(limiteParam, LIMITE_MAX) : LIMITE_DEFAULT;

    const items: ItemHistorial[] = [];

    if (!tipo || tipo === "os") {
      let query = supabase
        .from("trabajos")
        .select("id, cliente, fecha, orden:ordenes_servicio(folio, estado_os)")
        .eq("empresa_id", req.empresaId!)
        .eq("responsable_id", colaboradorId)
        .gte("fecha", cutoff)
        .order("fecha", { ascending: false })
        .limit(500);
      if (q) query = query.ilike("cliente", `%${q}%`);
      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      for (const t of data ?? []) {
        const orden = Array.isArray(t.orden) ? t.orden[0] : t.orden;
        if (!orden || !OS_TERMINADAS.includes(orden.estado_os)) continue;
        items.push({ tipo: "os", id: t.id, folio: orden.folio, fecha: t.fecha, cliente_nombre: t.cliente, estado: orden.estado_os });
      }
    }

    if (!tipo || tipo === "levantamiento") {
      let query = supabase
        .from("levantamientos")
        .select("id, folio, fecha_visita, creado_en, estado, cliente:clientes(nombre)")
        .eq("empresa_id", req.empresaId!)
        .eq("tecnico_id", colaboradorId)
        .in("estado", LEVANTAMIENTOS_TERMINADOS)
        .order("creado_en", { ascending: false })
        .limit(500);
      const { data, error } = await query;
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      for (const l of data ?? []) {
        const fecha = l.fecha_visita ?? l.creado_en.slice(0, 10);
        if (fecha < cutoff) continue;
        const clienteNombre = (l as unknown as { cliente: { nombre: string } | null }).cliente?.nombre ?? "—";
        if (q && !clienteNombre.toLowerCase().includes(q.toLowerCase())) continue;
        items.push({ tipo: "levantamiento", id: l.id, folio: l.folio, fecha, cliente_nombre: clienteNombre, estado: l.estado });
      }
    }

    items.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));

    const total = items.length;
    const desde = (pagina - 1) * limite;
    res.json({ items: items.slice(desde, desde + limite), total, pagina, limite });
  })
);
