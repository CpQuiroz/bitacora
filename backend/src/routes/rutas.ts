import { Router } from "express";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const rutasRouter = Router();

// Ruta del día de un responsable (por defecto, el usuario logueado —
// así la app móvil pide "mi ruta de hoy" sin pasar nada).
// Envuelve trabajos_del_dia() de 05_rutas.sql.
rutasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const responsableId =
      typeof req.query.responsable_id === "string" ? req.query.responsable_id : req.userId!;
    const fecha =
      typeof req.query.fecha === "string" ? req.query.fecha : new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase.rpc("trabajos_del_dia", {
      p_empresa_id: req.empresaId!,
      p_responsable_id: responsableId,
      p_fecha: fecha,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ fecha, responsable_id: responsableId, paradas: data });
  })
);
