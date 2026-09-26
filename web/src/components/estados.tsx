import type { ComponentType, ReactNode } from "react";
import { EmptyState, ErrorState } from "@bitacora/ui/web";
import { IconAlertTriangle } from "./icons";

/* Estados compartidos — cargando / vacío / error. Capa fina sobre las
   primitivas de @bitacora/ui/web (tarea 157: antes dependía del
   components/ui.tsx antiguo). La API pública se mantiene para no tocar
   a quienes lo importan (portal, agendar). */

// Spinner + texto (no LoadingState): quien lo usa pasa un `mensaje` que
// se lee en pantalla, y LoadingState no tiene texto.
export function EstadoCargando({ mensaje = "Cargando" }: { mensaje?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-ds-3 py-16 text-center" aria-busy="true" aria-live="polite">
      <span aria-hidden className="h-6 w-6 animate-spin rounded-ds-pill border-2 border-ds-divider border-t-ds-brand" />
      <p className="font-ds-body text-ds-micro uppercase tracking-[0.12em] text-ds-text-secondary">{mensaje}…</p>
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
    <EmptyState titulo={titulo} mensaje={mensaje} accion={accion} icono={Icono ? <Icono className="h-5 w-5" /> : undefined} />
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
    <ErrorState titulo={titulo} mensaje={mensaje} onReintentar={onReintentar} icono={<IconAlertTriangle className="h-5 w-5" />} />
  );
}
