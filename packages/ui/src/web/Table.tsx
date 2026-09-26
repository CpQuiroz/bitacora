"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { Card } from "./Card";
import { LoadingState } from "./LoadingState";
import { ErrorState } from "./ErrorState";
import { EmptyState } from "./EmptyState";

// Solo web — mobile no tiene tablas, usa listas/cards (ver docs/design-audit.md §3).
export type ColumnaTabla<T> = {
  /** Normalmente texto; admite ReactNode para casos como un checkbox "seleccionar todas". */
  encabezado: ReactNode;
  celda: (fila: T) => ReactNode;
  clase?: string;
};

export type AccionFila<T> = {
  etiqueta: string | ((fila: T) => string);
  onPress: (fila: T) => void;
  tono?: "brand" | "muted" | "peligro";
  oculta?: (fila: T) => boolean;
};

export type PropsTable<T> = {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  acciones?: AccionFila<T>[];
  /**
   * Fila entera clickeable (ej. ir al detalle): clic, doble clic y Enter
   * con el teclado hacen lo mismo (convención de la app, tarea 148). Los
   * controles internos (checkbox, acciones) deben frenar la propagación.
   */
  onFilaClick?: (fila: T) => void;
  /** Muestra las acciones en un menú "⋯" en vez de botones sueltos (fila más limpia). */
  accionesEnMenu?: boolean;
  cargando?: boolean;
  error?: string | null;
  onReintentar?: () => void;
  vacio: { titulo: string; mensaje?: string; icono?: ReactNode };
};

const TONO_ACCION: Record<NonNullable<AccionFila<unknown>["tono"]>, string> = {
  brand: "text-ds-brand",
  muted: "text-ds-text/60",
  peligro: "text-ds-accent-700",
};

export function Table<T>({ columnas, filas, claveFila, acciones, onFilaClick, accionesEnMenu, cargando, error, onReintentar, vacio }: PropsTable<T>) {
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuAbierto) return;
    const cerrar = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuAbierto(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAbierto(null);
    };
    document.addEventListener("mousedown", cerrar);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", cerrar);
      document.removeEventListener("keydown", escape);
    };
  }, [menuAbierto]);

  if (cargando) return <LoadingState />;
  if (error) return <ErrorState mensaje={error} onReintentar={onReintentar} />;
  if (filas.length === 0) return <EmptyState titulo={vacio.titulo} mensaje={vacio.mensaje} icono={vacio.icono} />;

  return (
    <Card sinRelleno elevacion="sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-ds-body">
          <thead>
            <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
              {columnas.map((col, i) => (
                <th key={i} className={`px-ds-4 py-ds-3 ${col.clase ?? ""}`}>
                  {col.encabezado}
                </th>
              ))}
              {acciones && acciones.length > 0 ? <th className={`px-ds-4 py-ds-3 ${accionesEnMenu ? "w-12" : ""}`}>{accionesEnMenu ? <span className="sr-only">Acciones</span> : "Acciones"}</th> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={claveFila(fila)}
                onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
                onDoubleClick={onFilaClick ? () => onFilaClick(fila) : undefined}
                onKeyDown={
                  onFilaClick
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onFilaClick(fila);
                      }
                    : undefined
                }
                tabIndex={onFilaClick ? 0 : undefined}
                className={`border-b border-ds-text/[0.08] last:border-0 hover:bg-ds-text/[0.04] ${
                  onFilaClick ? "cursor-pointer focus-visible:bg-ds-text/[0.06] focus-visible:outline-none" : ""
                }`}
              >
                {columnas.map((col, i) => (
                  <td key={i} className={`px-ds-4 py-ds-3 ${col.clase ?? ""}`}>
                    {col.celda(fila)}
                  </td>
                ))}
                {acciones && acciones.length > 0 && accionesEnMenu ? (
                  <td className="px-ds-4 py-ds-3 text-right" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <div className="relative inline-block" ref={menuAbierto === claveFila(fila) ? menuRef : undefined}>
                      <button
                        type="button"
                        aria-label="Más acciones"
                        aria-haspopup="menu"
                        aria-expanded={menuAbierto === claveFila(fila)}
                        onClick={() => setMenuAbierto((m) => (m === claveFila(fila) ? null : claveFila(fila)))}
                        onKeyDown={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-ds-pill text-ds-text/60 hover:bg-ds-brand/[0.08] hover:text-ds-brand"
                      >
                        <MoreHorizontal size={18} strokeWidth={2.5} />
                      </button>
                      {menuAbierto === claveFila(fila) ? (
                        <div role="menu" className="absolute right-0 z-20 mt-1 min-w-[10rem] overflow-hidden rounded-ds-md border border-ds-divider bg-ds-surface py-1 text-left shadow-ds-md">
                          {acciones
                            .filter((a) => !a.oculta?.(fila))
                            .map((a, i) => (
                              <button
                                key={i}
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setMenuAbierto(null);
                                  a.onPress(fila);
                                }}
                                className={`block w-full px-ds-4 py-2 text-left font-ds-body text-ds-small font-medium hover:bg-ds-brand/[0.08] ${TONO_ACCION[a.tono ?? "brand"]}`}
                              >
                                {typeof a.etiqueta === "function" ? a.etiqueta(fila) : a.etiqueta}
                              </button>
                            ))}
                        </div>
                      ) : null}
                    </div>
                  </td>
                ) : acciones && acciones.length > 0 ? (
                  <td className="px-ds-4 py-ds-3">
                    <div className="flex gap-ds-3 text-ds-small font-medium">
                      {acciones
                        .filter((a) => !a.oculta?.(fila))
                        .map((a, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              a.onPress(fila);
                            }}
                            className={`hover:underline ${TONO_ACCION[a.tono ?? "brand"]}`}
                          >
                            {typeof a.etiqueta === "function" ? a.etiqueta(fila) : a.etiqueta}
                          </button>
                        ))}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
