import { MAPA_ESTADO_TONO, type PropsStatusBadge, type TonoEstado } from "../tipos";

const BASE = "inline-flex items-center rounded-ds-pill px-ds-2 py-[3px] text-[11px] font-medium tracking-[0.02em] capitalize";

// En progreso / Completado / Convertido-Cerrado / Cancelado.
const CLASE: Record<TonoEstado, string> = {
  en_progreso: "bg-ds-accent-200 text-ds-accent-800",
  completado: "bg-ds-accent2-200 text-ds-accent2-800",
  cerrado: "bg-ds-neutral-300 text-ds-neutral-900",
  cancelado: "bg-ds-neutral-200 text-ds-neutral-700",
};

export function StatusBadge({ estado, etiqueta, tonoForzado }: PropsStatusBadge) {
  const tono = tonoForzado ?? MAPA_ESTADO_TONO[estado] ?? "cerrado";
  return <span className={`${BASE} ${CLASE[tono]}`}>{etiqueta ?? estado.replaceAll("_", " ")}</span>;
}
