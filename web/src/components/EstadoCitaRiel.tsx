"use client";

import type { EstadoTarea } from "@bitacora/shared";
import { CAMINO_ESTADOS_TAREA, ETIQUETA_ESTADO_TAREA, grupoDeEstadoTarea, pasoDelRielTarea } from "@bitacora/shared";
import { Badge } from "./ui";

// Estados de cita en 3+2 (mismo componente conceptual que
// mobile/src/features/agenda/EstadoCitaRiel.tsx — misma fuente de
// etiquetas en packages/shared/src/estadosCita.ts, no debe desviarse).
export function EstadoCitaRiel({
  estado,
  puedeConfirmar,
  guardando,
  onConfirmar,
  onNoAsistio,
  onCancelar,
}: {
  estado: EstadoTarea;
  // Confirmar (pendiente→confirmada) requiere Agenda Pro, igual que
  // antes con el <select> — algunas empresas no usan ese paso.
  puedeConfirmar: boolean;
  guardando: boolean;
  onConfirmar: () => void;
  onNoAsistio: () => void;
  onCancelar: () => void;
}) {
  const grupo = grupoDeEstadoTarea(estado);

  if (grupo === "salida") {
    return (
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Estado</p>
        <Badge value={estado} label={ETIQUETA_ESTADO_TAREA[estado]} />
      </div>
    );
  }

  const paso = pasoDelRielTarea(estado) ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Estado</p>
        <div className="flex items-center">
          {CAMINO_ESTADOS_TAREA.map((e, i) => {
            const recorrido = i < paso;
            const activo = i === paso;
            return (
              <div key={e} className={`flex items-center ${i < CAMINO_ESTADOS_TAREA.length - 1 ? "flex-1" : ""}`}>
                <div className={`flex items-center justify-center rounded-full ${activo ? "bg-brand-soft p-1.5" : ""}`}>
                  <div
                    className={`rounded-full ${activo ? "h-4 w-4 bg-brand" : recorrido ? "h-3 w-3 bg-brand" : "h-3 w-3 border-[1.5px] border-border"}`}
                  />
                </div>
                {i < CAMINO_ESTADOS_TAREA.length - 1 && (
                  <div className={`h-0.5 flex-1 ${i < paso ? "bg-brand" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-muted">
          {CAMINO_ESTADOS_TAREA.map((e, i) => (
            <span key={e} className={i === paso ? "font-semibold text-brand" : ""}>
              {ETIQUETA_ESTADO_TAREA[e]}
            </span>
          ))}
        </div>
      </div>

      {estado === "pendiente" && puedeConfirmar && (
        <button
          type="button"
          onClick={onConfirmar}
          disabled={guardando}
          className="self-start rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-sunken disabled:opacity-50"
        >
          Confirmar cita
        </button>
      )}

      <div className="flex items-center gap-2 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        <span>o cerrar como</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNoAsistio}
          disabled={guardando}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-surface-sunken disabled:opacity-50"
        >
          No asistió
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted hover:bg-surface-sunken disabled:opacity-50"
        >
          Cancelado
        </button>
      </div>
      <p className="text-center text-[11px] text-muted">Asistió y No asistió descuentan 1 sesión del pack. Cancelado no.</p>
    </div>
  );
}
