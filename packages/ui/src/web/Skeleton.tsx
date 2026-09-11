import type { PropsSkeleton } from "../tipos";

export function Skeleton({ ancho = "100%", alto = 16, radio }: PropsSkeleton) {
  return (
    <div
      aria-hidden
      className="animate-pulse bg-ds-neutral-200"
      style={{ width: ancho, height: alto, borderRadius: radio ?? 8 }}
    />
  );
}
