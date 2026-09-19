"use client";

import type { EstadoTarea } from "@bitacora/shared";
import { CAMINO_ESTADOS_TAREA, ETIQUETA_ESTADO_TAREA, grupoDeEstadoTarea, pasoDelRielTarea } from "@bitacora/shared";
import { StatusBadge } from "@bitacora/ui/web";

// Estados de cita en 3+2 (mismo componente conceptual que
// mobile/src/features/agenda/EstadoCitaRiel.tsx — misma fuente de
// etiquetas en packages/shared/src/estadosCita.ts, no debe desviarse).
//
// Migrado a ds- (19-sep-2026) junto con agenda/page.tsx, su único
// consumidor.
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
        <p className="mb-ds-1 font-ds-body text-ds-caption font-medium uppercase tracking-wide text-ds-text/60">Estado</p>
        <StatusBadge estado={estado} etiqueta={ETIQUETA_ESTADO_TAREA[estado]} />
      </div>
    );
  }

  const paso = pasoDelRielTarea(estado) ?? 0;

  return (
    <div className="flex flex-col gap-ds-3">
      <div>
        <p className="mb-ds-2 font-ds-body text-ds-caption font-medium uppercase tracking-wide text-ds-text/60">Estado</p>
        <div className="flex items-center">
          {CAMINO_ESTADOS_TAREA.map((e, i) => {
            const recorrido = i < paso;
            const activo = i === paso;
            return (
              <div key={e} className={`flex items-center ${i < CAMINO_ESTADOS_TAREA.length - 1 ? "flex-1" : ""}`}>
                <div className={`flex items-center justify-center rounded-ds-pill ${activo ? "bg-ds-brand/[0.08] p-1.5" : ""}`}>
                  <div
                    className={`rounded-ds-pill ${
                      activo ? "h-4 w-4 bg-ds-brand" : recorrido ? "h-3 w-3 bg-ds-brand" : "h-3 w-3 border-[1.5px] border-ds-divider"
                    }`}
                  />
                </div>
                {i < CAMINO_ESTADOS_TAREA.length - 1 && <div className={`h-0.5 flex-1 ${i < paso ? "bg-ds-brand" : "bg-ds-divider"}`} />}
              </div>
            );
          })}
        </div>
        <div className="mt-1.5 flex justify-between font-ds-body text-[11px] text-ds-text/60">
          {CAMINO_ESTADOS_TAREA.map((e, i) => (
            <span key={e} className={i === paso ? "font-semibold text-ds-brand" : ""}>
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
          className="self-start rounded-ds-md border border-ds-divider px-ds-3 py-1.5 font-ds-body text-ds-small font-medium text-ds-text hover:bg-ds-neutral-100 disabled:opacity-50"
        >
          Confirmar cita
        </button>
      )}

      <div className="flex items-center gap-ds-2 font-ds-body text-ds-caption text-ds-text/60">
        <div className="h-px flex-1 bg-ds-divider" />
        <span>o cerrar como</span>
        <div className="h-px flex-1 bg-ds-divider" />
      </div>
      <div className="flex gap-ds-2">
        <button
          type="button"
          onClick={onNoAsistio}
          disabled={guardando}
          className="flex-1 rounded-ds-md border border-ds-divider px-ds-3 py-ds-2 font-ds-body text-ds-small font-medium text-ds-text/70 hover:bg-ds-neutral-100 disabled:opacity-50"
        >
          No asistió
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={guardando}
          className="flex-1 rounded-ds-md border border-ds-divider px-ds-3 py-ds-2 font-ds-body text-ds-small font-medium text-ds-text/70 hover:bg-ds-neutral-100 disabled:opacity-50"
        >
          Cancelado
        </button>
      </div>
      <p className="text-center font-ds-body text-[11px] text-ds-text/60">Asistió y No asistió descuentan 1 sesión del pack. Cancelado no.</p>
    </div>
  );
}
