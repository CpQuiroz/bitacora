import type { PropsCifra } from "../tipos";

/** Montos, cantidades, fechas, folios — números que se leen en columna. */
export function Cifra({ children }: PropsCifra) {
  return <span className="tabular-nums">{children}</span>;
}
