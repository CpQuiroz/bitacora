import type { ItemChecklist } from "@bitacora/shared";
import { supabase } from "./supabase";

// Crea la orden de servicio (con folio correlativo) en el mismo
// momento en que se crea el trabajo — a diferencia de
// obtenerOCrearOrden, que la crea perezosamente en el primer
// check-in/foto/firma. Se necesita el folio disponible de inmediato
// para mostrarlo en el panel de administración al crear la OS.
export async function crearOrdenServicio(empresaId: string, trabajoId: string) {
  const { data: folio, error: errorFolio } = await supabase.rpc("siguiente_folio_os", {
    p_empresa_id: empresaId,
  });
  if (errorFolio) throw new Error(errorFolio.message);

  const checklistInicial: ItemChecklist[] = [
    { item: "Check-in", hecho: false },
    { item: "Check-out", hecho: false },
  ];

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
