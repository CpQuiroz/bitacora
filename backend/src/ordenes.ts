import type { ItemChecklist } from "@bitacora/shared";
import { supabase } from "./supabase";

// Arma el checklist inicial de una OS: Check-in / Check-out fijos (los
// usa el check-in geolocalizado por nombre exacto) más los ítems de la
// plantilla del Tipo de OS, si tiene una.
function armarChecklistInicial(itemsPlantilla: string[] = []): ItemChecklist[] {
  return [
    { item: "Check-in", hecho: false },
    ...itemsPlantilla.map((item) => ({ item, hecho: false })),
    { item: "Check-out", hecho: false },
  ];
}

// Aplana la plantilla de checklist (secciones → preguntas) a la lista
// de textos que se copian al checklist de la OS. Devuelve [] si el tipo
// de OS no tiene plantilla o no se encuentra.
export async function checklistDeTipoOs(empresaId: string, tipoOsId: string | null | undefined): Promise<string[]> {
  if (!tipoOsId) return [];
  const { data: tipo } = await supabase
    .from("tipos_os")
    .select("checklist_template_id")
    .eq("empresa_id", empresaId)
    .eq("id", tipoOsId)
    .maybeSingle();
  if (!tipo?.checklist_template_id) return [];
  const { data: plantilla } = await supabase
    .from("checklist_templates")
    .select("secciones")
    .eq("empresa_id", empresaId)
    .eq("id", tipo.checklist_template_id)
    .maybeSingle();
  if (!plantilla) return [];
  return (plantilla.secciones ?? []).flatMap((s) => (s.preguntas ?? []).map((p) => p.texto)).filter((t): t is string => Boolean(t?.trim()));
}

// Crea la orden de servicio (con folio correlativo) en el mismo
// momento en que se crea el trabajo — a diferencia de
// obtenerOCrearOrden, que la crea perezosamente en el primer
// check-in/foto/firma. Se necesita el folio disponible de inmediato
// para mostrarlo en el panel de administración al crear la OS.
export async function crearOrdenServicio(empresaId: string, trabajoId: string, checklistPlantilla: string[] = []) {
  const { data: folio, error: errorFolio } = await supabase.rpc("siguiente_folio_os", {
    p_empresa_id: empresaId,
  });
  if (errorFolio) throw new Error(errorFolio.message);

  const checklistInicial = armarChecklistInicial(checklistPlantilla);

  const { data, error } = await supabase
    .from("ordenes_servicio")
    .insert({
      empresa_id: empresaId,
      trabajo_id: trabajoId,
      checklist: checklistInicial,
      fotos: [],
      folio,
      estado_os: "enviada",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Trae la orden de servicio de un trabajo, o la crea si es la primera
// vez que el chofer/técnico interactúa con ese trabajo (check-in, foto).
// Respaldo para trabajos creados antes de que existiera la OS eager
// (crearOrdenServicio) — a esas órdenes no les asigna folio.
export async function obtenerOCrearOrden(empresaId: string, trabajoId: string) {
  const { data: existente, error: errorBuscar } = await supabase
    .from("ordenes_servicio")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("trabajo_id", trabajoId)
    .maybeSingle();

  if (errorBuscar) throw new Error(errorBuscar.message);
  if (existente) return existente;

  const checklistInicial = armarChecklistInicial();

  const { data: creada, error: errorCrear } = await supabase
    .from("ordenes_servicio")
    .insert({
      empresa_id: empresaId,
      trabajo_id: trabajoId,
      checklist: checklistInicial,
      fotos: [],
    })
    .select()
    .single();

  if (errorCrear) throw new Error(errorCrear.message);
  return creada;
}
