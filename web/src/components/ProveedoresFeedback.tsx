"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ConfirmarProvider, ToastProvider, useCancelarConfirmacion } from "@bitacora/ui/web";

// Toasts y confirmaciones para toda la web (tarea 156). Va en el layout
// raíz y no en DashboardShell: cada página renderiza su propio shell, así
// que un proveedor adentro del shell quedaría por debajo del componente
// que llama a useToast()/useConfirmar().
export function ProveedoresFeedback({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmarProvider>
        <CancelarAlNavegar />
        {children}
      </ConfirmarProvider>
    </ToastProvider>
  );
}

// Si se navega (ej. "atrás" del navegador) con una confirmación abierta,
// se cancela: no debe quedar flotando sobre otra página.
function CancelarAlNavegar() {
  const ruta = usePathname();
  const cancelar = useCancelarConfirmacion();
  useEffect(() => cancelar(), [ruta, cancelar]);
  return null;
}
