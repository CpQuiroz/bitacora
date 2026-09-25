// ============================================================
// BITÁCORA — Bloque E: sugerencias iniciales de categorías/tipos según
// el rubro de la empresa (empresas.rubro) — mecanismo genérico basado
// en datos, en vez de las listas "SUGERIDOS" hardcodeadas que vivían
// repetidas en 4 pantallas (Tipos de OS, Categorías de gasto,
// Catálogo, Tipos de documento). Devuelve el listado plano para el
// rubro de la empresa — cada pantalla filtra por su propio
// tipo_sugerencia.
//
// Tarea 144: hay contenido para los 4 rubros (migración 144), también
// para servicios y tipos de pack. Una empresa nueva parte vacía y crea
// desde estas sugerencias.
// ============================================================
import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const sugerenciasRubroRouter = Router();

sugerenciasRubroRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data: empresa } = await supabase.from("empresas").select("rubro").eq("id", req.empresaId!).maybeSingle();
    if (!empresa) {
      res.json([]);
      return;
    }
    const { data, error } = await supabase
      .from("sugerencias_rubro")
      // "*" a propósito: la columna `datos` llega con la migración 144 y
      // pedirla por nombre rompería esto si el código sale antes.
      .select("*")
      .eq("rubro", empresa.rubro)
      .order("tipo_sugerencia")
      .order("orden")
      .limit(500);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);
