// Folios con prefijo por tipo (18-sep-2026): "OS-0042", "LEV-0004",
// "VIA-0012", "CIT-0031" — cada uno resuelve de un vistazo qué tipo de
// ítem es (pedido real: en la Pizarra móvil no se distinguía OS de
// viaje de levantamiento) y da una referencia citable, además del
// folio/número plano que ya existía (OS) o se agregó (migración 108:
// citas, viajes, levantamientos). El prefijo NUNCA se guarda en la
// base de datos — se arma acá, siempre en el punto de mostrarlo.
// COB (no FAC): "facturas" acá es un registro interno de cobro, no una
// factura tributaria real con folio SII/CAF — el prefijo evita esa
// confusión (migración 112, 20-sep-2026). Persona (usuarios) queda
// deliberadamente sin folio propio — ya tiene RUT como identificador
// único.
export type PrefijoFolio = "OS" | "CIT" | "VIA" | "LEV" | "CLI" | "PACK" | "GTO" | "PROV" | "COB" | "REND";

/**
 * @param folio null = todavía sin folio (fila creada antes de que
 *   existiera el mecanismo, o falla al asignarlo) — devuelve null para
 *   que el llamador decida cómo mostrarlo (nada, "—", etc.).
 */
export function formatearFolio(prefijo: PrefijoFolio, folio: number | null | undefined): string | null {
  if (folio == null) return null;
  return `${prefijo}-${String(folio).padStart(4, "0")}`;
}
