import type { ReactNode } from "react";
import { Card } from "@bitacora/ui/web";

// Encabezado de página y "sin autorización" (tarea 157): salieron del
// components/ui.tsx antiguo al sistema de diseño (tokens ds-).
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-ds-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="ds-heading text-ds-h2 text-ds-text">{title}</h1>
        {subtitle ? <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text-secondary">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SinAutorizacion({ mensaje }: { mensaje?: string }) {
  return (
    <div className="mx-auto max-w-md text-center">
      <Card>
        <h2 className="ds-heading text-ds-h4 text-ds-text">Sin autorización</h2>
        <p className="mt-ds-2 font-ds-body text-ds-small text-ds-text-secondary">
          {mensaje ?? "No tienes permiso para acceder a esta sección. Si crees que es un error, contacta a un administrador."}
        </p>
      </Card>
    </div>
  );
}
