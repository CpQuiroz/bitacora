import type { PropsErrorState } from "../tipos";
import { Button } from "./Button";

export function ErrorState({ titulo = "No se pudo cargar", mensaje, onReintentar, icono }: PropsErrorState) {
  return (
    <div className="flex flex-col items-center gap-ds-3 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-ds-accent-200 text-ds-accent-800">
        {icono}
      </div>
      <p className="ds-heading text-ds-h4 text-ds-text">{titulo}</p>
      {mensaje ? <p className="max-w-sm text-ds-small font-ds-body text-ds-text/70">{mensaje}</p> : null}
      {onReintentar ? (
        <div className="mt-ds-1">
          <Button variante="secundario" tamano="sm" onPress={onReintentar}>
            Reintentar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
