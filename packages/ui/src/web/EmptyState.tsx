import type { PropsEmptyState } from "../tipos";

export function EmptyState({ titulo, mensaje, accion, icono }: PropsEmptyState) {
  return (
    <div className="flex flex-col items-center gap-ds-3 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-ds-accent2-200 text-ds-accent2-800">
        {icono}
      </div>
      <p className="ds-heading text-ds-h4 text-ds-text">{titulo}</p>
      {mensaje ? <p className="max-w-sm text-ds-small font-ds-body text-ds-text/70">{mensaje}</p> : null}
      {accion ? <div className="mt-ds-1">{accion}</div> : null}
    </div>
  );
}
