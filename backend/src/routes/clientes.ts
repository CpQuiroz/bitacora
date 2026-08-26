import { Router } from "express";
import { supabase } from "../supabase";
import { geocodificarDireccion } from "../geocodificar";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";

export const clientesRouter = Router();

clientesRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("empresa_id", req.empresaId!)
      .order("nombre");

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
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
    const { nombre, direccion, telefono, notas } = req.body ?? {};

    if (typeof nombre !== "string" || !nombre.trim()) {
      res.status(400).json({ error: "Falta nombre" });
      return;
    }
    if (typeof direccion !== "string" || !direccion.trim()) {
      res.status(400).json({ error: "Falta dirección" });
      return;
    }

    const coords = await geocodificarDireccion(direccion.trim());

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        empresa_id: req.empresaId!,
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        telefono: telefono?.trim() || null,
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
