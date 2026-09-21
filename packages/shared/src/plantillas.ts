import type { BloqueEncabezado } from "./types";

export type VariablePlantilla = { clave: string; etiqueta: string };

export const VARIABLES_OS: VariablePlantilla[] = [
  { clave: "cliente", etiqueta: "Nombre del cliente" },
  { clave: "fecha", etiqueta: "Fecha de la visita" },
  { clave: "tecnico", etiqueta: "Técnico asignado" },
  { clave: "monto", etiqueta: "Monto total" },
  { clave: "folio", etiqueta: "N° de orden de servicio" },
  { clave: "direccion", etiqueta: "Dirección del servicio" },
  { clave: "empresa", etiqueta: "Nombre de tu empresa" },
];

export const VARIABLES_COTIZACION: VariablePlantilla[] = [
  { clave: "cliente", etiqueta: "Nombre del cliente" },
  { clave: "fecha", etiqueta: "Fecha" },
  { clave: "monto", etiqueta: "Monto total" },
  { clave: "empresa", etiqueta: "Nombre de tu empresa" },
];

export const VARIABLES_COBRANZA: VariablePlantilla[] = VARIABLES_COTIZACION;

// Deja el token {clave} intacto si no hay valor para esa clave — más
// seguro que blanquearlo: un typo en el texto no borra contenido en
// silencio, queda visible para corregirlo.
export function sustituirVariables(texto: string, valores: Partial<Record<string, string>>): string {
  return texto.replace(/\{(\w+)\}/g, (coincidencia, clave: string) => valores[clave] ?? coincidencia);
}

// Mismo reemplazo, aplicado al texto de cada bloque del encabezado
// (migración 113) — usado tanto por los generadores de PDF (backend)
// como por la vista previa en vivo (web), para no duplicar el mapeo.
export function sustituirVariablesEnBloques(
  bloques: BloqueEncabezado[] | null,
  valores: Partial<Record<string, string>>
): BloqueEncabezado[] {
  if (!bloques) return [];
  return bloques.map((b) => ({ ...b, texto: sustituirVariables(b.texto, valores) }));
}
