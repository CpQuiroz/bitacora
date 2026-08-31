// ============================================================
// BITÁCORA — Bloque E: sugerencias iniciales de categorías/tipos según
// el rubro de la empresa (empresas.rubro) — mecanismo genérico basado
// en datos, en vez de las listas "SUGERIDOS" hardcodeadas que vivían
// repetidas en 4 pantallas (Tipos de OS, Categorías de gasto,
// Catálogo, Tipos de documento). Devuelve el listado plano para el
// rubro de la empresa — cada pantalla filtra por su propio
// tipo_sugerencia.
//
// TODO: decisión pendiente — solo hay contenido real cargado para el
// rubro "transporte" (ver migración 54). Para "servicio_tecnico" y
// "otro" esto devuelve un arreglo vacío hasta que se defina el
// contenido — las pantallas ya están armadas para no romperse en ese
// caso (siguen mostrando su fallback genérico anterior).
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
      .select("*")
      .eq("rubro", empresa.rubro)
      .order("tipo_sugerencia")
      .order("orden");
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data ?? []);
  })
);
