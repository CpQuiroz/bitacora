"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { Confirmar, OpcionesConfirmar } from "../tipos";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

// Reemplaza window.confirm() (tarea 156): mismo uso en una línea,
//   if (!(await confirmar({ titulo: "¿Eliminar este viaje?", accion: "Eliminar", destructivo: true }))) return;
// pero con el diálogo del sistema de diseño (botón rojo para lo
// destructivo, Escape y clic afuera cancelan).
const ConfirmarContext = createContext<Confirmar>(async () => false);
const CancelarContext = createContext<() => void>(() => {});

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<OpcionesConfirmar | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>((opciones) => {
    resolverRef.current?.(false);
    setPedido(opciones);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const responder = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setPedido(null);
  }, []);

  const cancelar = useCallback(() => {
    if (resolverRef.current) responder(false);
  }, [responder]);

  return (
    <ConfirmarContext.Provider value={confirmar}>
      <CancelarContext.Provider value={cancelar}>
        {children}
        {/* Por encima de cualquier modal de la página (mismo z-50). */}
        <div className="relative z-[90]">
          <Dialog abierto={pedido != null} onCerrar={() => responder(false)} titulo={pedido?.titulo ?? ""}>
            <div className="flex flex-col gap-ds-4">
              {pedido?.mensaje ? <p className="font-ds-body text-ds-body text-ds-text">{pedido.mensaje}</p> : null}
              <div className="flex flex-wrap justify-end gap-ds-2">
                <Button variante="secundario" onPress={() => responder(false)}>
                  {pedido?.cancelar ?? "Cancelar"}
                </Button>
                <Button variante={pedido?.destructivo ? "peligro" : "primario"} onPress={() => responder(true)}>
                  {pedido?.accion ?? "Confirmar"}
                </Button>
              </div>
            </div>
          </Dialog>
        </div>
      </CancelarContext.Provider>
    </ConfirmarContext.Provider>
  );
}

export function useConfirmar(): Confirmar {
  return useContext(ConfirmarContext);
}

/** Cierra la confirmación abierta (si hay) como si se cancelara. */
export function useCancelarConfirmacion(): () => void {
  return useContext(CancelarContext);
}
