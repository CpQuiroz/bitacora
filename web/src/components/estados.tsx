import type { ComponentType, ReactNode } from "react";
import { Button } from "./ui";
import { IconAlertTriangle } from "./icons";

/* Estados compartidos — cargando / vacío / error. Antes cada pantalla
   los resolvía con un <p> suelto; ahora son tres piezas con el look de
   1a (borde firme, sin sombra, etiqueta en mono). */

export function EstadoCargando({ mensaje = "Cargando" }: { mensaje?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span
        aria-hidden
        className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-brand"
      />
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{mensaje}…</p>
    </div>
  );
}

export function EstadoVacio({
  icono: Icono,
  titulo,
  mensaje,
  accion,
}: {
  icono?: ComponentType<{ className?: string }>;
  titulo: string;
  mensaje?: string;
  accion?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-16 text-center">
      {Icono && (
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-surface-sunken text-muted">
          <Icono className="h-5 w-5" />
        </span>
      )}
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {mensaje && <p className="max-w-sm text-[13px] text-muted">{mensaje}</p>}
      {accion && <div className="mt-1">{accion}</div>}
    </div>
  );
}

export function EstadoError({
  titulo = "No se pudo cargar",
  mensaje,
  onReintentar,
}: {
  titulo?: string;
  mensaje?: string;
  onReintentar?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-danger/30 bg-danger-soft py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-danger/10 text-danger">
        <IconAlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      {mensaje && <p className="max-w-sm text-[13px] text-muted">{mensaje}</p>}
      {onReintentar && (
        <Button variant="outline" size="sm" onClick={onReintentar} className="mt-1">
          Reintentar
        </Button>
      )}
    </div>
  );
}
