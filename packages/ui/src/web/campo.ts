// Piezas compartidas entre Input/Textarea/Select/DatePicker — label,
// mensaje de error/ayuda, mismo look en los 4.
export const LABEL = "text-ds-caption font-ds-body font-medium text-ds-text/70";
export const MENSAJE_ERROR = "text-ds-caption font-ds-body text-ds-accent-700";
export const MENSAJE_AYUDA = "text-ds-caption font-ds-body text-ds-text/60";
// OJO: nada de `outline-none` acá — esa utilidad fija --tw-outline-style
// en "none" de forma incondicional, y como focus-visible:outline-2 SOLO
// pone el ancho (lee la misma variable), el foco terminaba sin outline
// visible nunca (bug real, encontrado corriendo `next dev` al migrar
// Login — verificado con getComputedStyle, no con el CLI de Tailwind).
export const FOCO =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)] [caret-color:var(--ds-brand)]";
export const CAMPO_BASE =
  `w-full bg-ds-surface text-ds-body font-ds-body text-ds-text placeholder:text-ds-text/40 ` +
  `transition-colors disabled:opacity-50 disabled:pointer-events-none ${FOCO}`;

export function bordeDe(error?: string | null): string {
  return error ? "border-ds-accent-700" : "border-ds-divider";
}
