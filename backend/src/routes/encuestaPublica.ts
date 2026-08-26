import { Router } from "express";
import { supabase } from "../supabase";
import { ah } from "../asyncHandler";

// Sin requiereAuth/requiereEmpresa a propósito: lo abre un cliente
// anónimo desde el link del correo de la encuesta. Solo acepta una
// calificación 1-5 y no expone ningún otro dato del trabajo.
export const encuestaPublicaRouter = Router();

encuestaPublicaRouter.post(
  "/:trabajoId",
  ah(async (req, res) => {
    const valor = Number(req.body?.valor);
    if (!Number.isInteger(valor) || valor < 1 || valor > 5) {
      res.status(400).json({ error: "valor debe ser un entero entre 1 y 5" });
      return;
    }

    const { data, error } = await supabase
      .from("trabajos")
      .update({
        calificacion_satisfaccion: valor,
        encuesta_respondida_en: new Date().toISOString(),
      })
      .eq("id", req.params.trabajoId)
      .select("id")
      .maybeSingle();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    if (!data) {
      res.status(404).json({ error: "No encontramos esa encuesta" });
      return;
    }
    res.json({ ok: true });
  })
);
