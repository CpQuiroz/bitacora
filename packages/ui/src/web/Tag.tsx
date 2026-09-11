import type { PropsTag, TonoTag } from "../tipos";

const BASE = "inline-flex items-center rounded-ds-pill px-ds-2 py-[3px] text-[11px] font-medium tracking-[0.02em]";

const TONO: Record<TonoTag, string> = {
  accent: "bg-ds-accent-200 text-ds-accent-800",
  accent2: "bg-ds-accent2-200 text-ds-accent2-800",
  neutral: "bg-ds-neutral-200 text-ds-neutral-800",
  outline: "border border-ds-divider text-ds-text bg-transparent",
};

export function Tag({ children, tono = "neutral" }: PropsTag) {
  return <span className={`${BASE} ${TONO[tono]}`}>{children}</span>;
}
