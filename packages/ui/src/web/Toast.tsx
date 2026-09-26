"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { ConDeshacer, MostrarToast, OpcionesToast, TonoToast } from "../tipos";
import { crearConDeshacer } from "../compartido/deshacer";

const DURACION_MS = 3000;
const DURACION_CON_ACCION_MS = 5000;

type Item = { id: number; mensaje: string } & OpcionesToast;

const ICONO: Record<TonoToast, typeof Info> = { exito: CheckCircle2, error: AlertTriangle, info: Info };
const FONDO: Record<TonoToast, string> = {
  exito: "bg-ds-neutral-900 text-ds-neutral-100",
  info: "bg-ds-neutral-900 text-ds-neutral-100",
  error: "bg-ds-danger text-ds-surface",
};

const ToastContext = createContext<MostrarToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);

  const quitar = useCallback((id: number) => setItems((actuales) => actuales.filter((i) => i.id !== id)), []);

  const mostrar = useCallback<MostrarToast>(
    (mensaje, opciones = {}) => {
      const id = ++idRef.current;
      setItems((actuales) => [...actuales, { id, mensaje, ...opciones }]);
      setTimeout(() => quitar(id), opciones.duracionMs ?? (opciones.accion ? DURACION_CON_ACCION_MS : DURACION_MS));
    },
    [quitar]
  );

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-ds-6 z-[100] flex flex-col items-center gap-ds-2 px-ds-4">
        {items.map((item) => {
          const tono = item.tono ?? "info";
          const Icono = ICONO[tono];
          return (
            <div
              key={item.id}
              role={tono === "error" ? "alert" : "status"}
              className={`pointer-events-auto flex max-w-md items-center gap-ds-2 rounded-ds-pill px-ds-4 py-ds-2 text-ds-small font-ds-body shadow-ds-md ${FONDO[tono]}`}
            >
              <Icono size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
              <span>{item.mensaje}</span>
              {item.accion ? (
                <button
                  type="button"
                  onClick={() => {
                    item.accion!.onPress();
                    quitar(item.id);
                  }}
                  className="ml-ds-2 shrink-0 rounded-ds-pill px-ds-2 py-ds-1 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {item.accion.etiqueta}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): MostrarToast {
  return useContext(ToastContext);
}

/** Acción con "Deshacer" (5 s) — ver compartido/deshacer.ts. */
export function useDeshacer(): ConDeshacer {
  const toast = useToast();
  return useMemo(() => crearConDeshacer(toast), [toast]);
}
