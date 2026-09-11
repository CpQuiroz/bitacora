"use client";

import type { ReactNode } from "react";
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
  /** Fila entera clickeable (ej. ir al detalle). Los controles internos (checkbox, acciones) deben frenar la propagación. */
  onFilaClick?: (fila: T) => void;
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

export function Table<T>({ columnas, filas, claveFila, acciones, onFilaClick, cargando, error, onReintentar, vacio }: PropsTable<T>) {
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
              {acciones && acciones.length > 0 ? <th className="px-ds-4 py-ds-3">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={claveFila(fila)}
                onClick={onFilaClick ? () => onFilaClick(fila) : undefined}
                className={`border-b border-ds-text/[0.08] last:border-0 hover:bg-ds-text/[0.04] ${onFilaClick ? "cursor-pointer" : ""}`}
              >
                {columnas.map((col, i) => (
                  <td key={i} className={`px-ds-4 py-ds-3 ${col.clase ?? ""}`}>
                    {col.celda(fila)}
                  </td>
                ))}
                {acciones && acciones.length > 0 ? (
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
