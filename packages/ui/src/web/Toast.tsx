"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { MostrarToast } from "../tipos";

const DURACION_MS = 2600;

type Item = { id: number; mensaje: string };

const ToastContext = createContext<MostrarToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);

  const mostrar = useCallback<MostrarToast>((mensaje) => {
    const id = ++idRef.current;
    setItems((actuales) => [...actuales, { id, mensaje }]);
    setTimeout(() => setItems((actuales) => actuales.filter((i) => i.id !== id)), DURACION_MS);
  }, []);

  return (
    <ToastContext.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-ds-6 z-[100] flex flex-col items-center gap-ds-2">
        {items.map((item) => (
          <div
            key={item.id}
            role="status"
            className="rounded-ds-pill bg-ds-neutral-900 px-ds-4 py-ds-2 text-ds-small font-ds-body text-ds-neutral-100 shadow-ds-md"
          >
            {item.mensaje}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): MostrarToast {
  return useContext(ToastContext);
}
