"use client";

import { useEffect, type ReactNode } from "react";
import { IconX } from "./icons";

// Bloque H — Panel de Acciones: un solo drawer lateral reutilizado
// entre el detalle de Cotización y el de Cobro (antes cada uno tenía
// sus propios botones sueltos repartidos en varias Cards). No impone
// qué acciones exactas mostrar — cada pantalla arma su propio
// contenido para cada sección con sus componentes de siempre
// (Button, Select, etc.), el panel solo da el layout/drawer/agrupación
// común. Una sección se omite si no se pasa esa prop (ej. Cobro no
// tiene "Compartir" con PDF como Cotización).
export function PanelAcciones({
  open,
  onClose,
  titulo,
  subtitulo,
  seccionEstado,
  seccionCompartir,
  seccionOtras,
  seccionPeligro,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  subtitulo?: string;
  seccionEstado?: ReactNode;
  seccionCompartir?: ReactNode;
  seccionOtras?: ReactNode;
  seccionPeligro?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={titulo} className="relative flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-border bg-surface shadow-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{titulo}</h2>
            {subtitulo && <p className="truncate text-xs text-muted">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1 text-muted transition-colors hover:bg-brand-soft hover:text-brand"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
          {seccionEstado && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Estado</h3>
              {seccionEstado}
            </div>
          )}
          {seccionCompartir && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Compartir</h3>
              {seccionCompartir}
            </div>
          )}
          {seccionOtras && (
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Otras acciones</h3>
              {seccionOtras}
            </div>
          )}
          {seccionPeligro && (
            <div className="rounded-xl border border-danger bg-danger-soft p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-danger">Zona de peligro</h3>
              {seccionPeligro}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
