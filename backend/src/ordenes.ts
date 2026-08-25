import type { ItemChecklist } from "@bitacora/shared";
import { supabase } from "./supabase";

// Trae la orden de servicio de un trabajo, o la crea si es la primera
// vez que el chofer/técnico interactúa con ese trabajo (check-in, foto).
export async function obtenerOCrearOrden(empresaId: string, trabajoId: string) {
  const { data: existente, error: errorBuscar } = await supabase
    .from("ordenes_servicio")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("trabajo_id", trabajoId)
    .maybeSingle();

  if (errorBuscar) throw new Error(errorBuscar.message);
  if (existente) return existente;

  const checklistInicial: ItemChecklist[] = [
    { item: "Check-in", hecho: false },
    { item: "Check-out", hecho: false },
  ];

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
