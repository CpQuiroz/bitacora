import { Router } from "express";
import type { PlantillaDocumento, PosicionLogo, TipoPlantilla } from "@bitacora/shared";
import { supabase } from "../supabase";
import type { RequestConEmpresa } from "../empresa";
import { ah } from "../asyncHandler";
import { requiereModulo } from "../permisos";

export const plantillasRouter = Router();

const TIPOS: TipoPlantilla[] = ["cotizacion", "orden_servicio", "cobranza", "terminos_aceptacion"];
const POSICIONES: PosicionLogo[] = ["izquierda", "centro", "derecha"];

function tipoValido(tipo: string): tipo is TipoPlantilla {
  return (TIPOS as string[]).includes(tipo);
}

// Crea la plantilla con valores por defecto la primera vez que se pide
// o se edita un tipo de documento — igual que obtenerOCrearOrden.
async function obtenerOCrearPlantilla(empresaId: string, tipo: TipoPlantilla): Promise<PlantillaDocumento> {
  const { data: existente, error: errorBuscar } = await supabase
    .from("plantillas_documento")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("tipo", tipo)
    .maybeSingle();

  if (errorBuscar) throw new Error(errorBuscar.message);
  if (existente) return existente;

  const { data: creada, error: errorCrear } = await supabase
    .from("plantillas_documento")
    .insert({ empresa_id: empresaId, tipo })
    .select()
    .single();

  if (errorCrear) throw new Error(errorCrear.message);
  return creada;
}

plantillasRouter.get(
  "/",
  ah<RequestConEmpresa>(async (req, res) => {
    const plantillas = await Promise.all(TIPOS.map((tipo) => obtenerOCrearPlantilla(req.empresaId!, tipo)));
    res.json(plantillas);
  })
);

plantillasRouter.get(
  "/:tipo",
  ah<RequestConEmpresa>(async (req, res) => {
    if (!tipoValido(req.params.tipo)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS.join(", ")}` });
      return;
    }
    const plantilla = await obtenerOCrearPlantilla(req.empresaId!, req.params.tipo);
    res.json(plantilla);
  })
);

plantillasRouter.patch(
  "/:tipo",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!tipoValido(req.params.tipo)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS.join(", ")}` });
      return;
    }
    const actual = await obtenerOCrearPlantilla(req.empresaId!, req.params.tipo);

    const {
      mostrar_logo,
      posicion_logo,
      color_primario,
      color_secundario,
      texto_encabezado,
      texto_pie,
      mensaje_predeterminado,
      terminos_condiciones,
      mostrar_firma,
    } = req.body ?? {};
    const cambios: Partial<PlantillaDocumento> = {};

    if (mostrar_logo !== undefined) cambios.mostrar_logo = Boolean(mostrar_logo);
    if (posicion_logo !== undefined) {
      if (!POSICIONES.includes(posicion_logo)) {
        res.status(400).json({ error: `posicion_logo debe ser una de: ${POSICIONES.join(", ")}` });
        return;
      }
      cambios.posicion_logo = posicion_logo;
    }
    if (color_primario !== undefined) {
      if (color_primario !== null && !/^#[0-9a-fA-F]{6}$/.test(color_primario)) {
        res.status(400).json({ error: "color_primario debe ser un hex válido (#rrggbb)" });
        return;
      }
      cambios.color_primario = color_primario;
    }
    if (color_secundario !== undefined) {
      if (color_secundario !== null && !/^#[0-9a-fA-F]{6}$/.test(color_secundario)) {
        res.status(400).json({ error: "color_secundario debe ser un hex válido (#rrggbb)" });
        return;
      }
      cambios.color_secundario = color_secundario;
    }
    if (texto_encabezado !== undefined) cambios.texto_encabezado = texto_encabezado?.trim() || null;
    if (texto_pie !== undefined) cambios.texto_pie = texto_pie?.trim() || null;
    if (mensaje_predeterminado !== undefined) cambios.mensaje_predeterminado = mensaje_predeterminado?.trim() || null;
    if (terminos_condiciones !== undefined) cambios.terminos_condiciones = terminos_condiciones?.trim() || null;
    if (mostrar_firma !== undefined) cambios.mostrar_firma = Boolean(mostrar_firma);

    const { data, error } = await supabase
      .from("plantillas_documento")
      .update({ ...cambios, actualizado_en: new Date().toISOString() })
      .eq("id", actual.id)
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json(data);
  })
);

// "Restaurar predeterminado": borra la fila personalizada — la próxima
// lectura la vuelve a crear con los valores por defecto de la tabla.
plantillasRouter.post(
  "/:tipo/restaurar",
  requiereModulo("configuracion"),
  ah<RequestConEmpresa>(async (req, res) => {
    if (!tipoValido(req.params.tipo)) {
      res.status(400).json({ error: `tipo debe ser uno de: ${TIPOS.join(", ")}` });
      return;
    }
    await supabase.from("plantillas_documento").delete().eq("empresa_id", req.empresaId!).eq("tipo", req.params.tipo);
    const nueva = await obtenerOCrearPlantilla(req.empresaId!, req.params.tipo);
    res.json(nueva);
  })
);
