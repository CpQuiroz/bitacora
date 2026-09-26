"use client";

import type { ReactNode } from "react";
import { ConfirmarProvider, ToastProvider } from "@bitacora/ui/web";

// Toasts y confirmaciones para toda la web (tarea 156). Va en el layout
// raíz y no en DashboardShell: cada página renderiza su propio shell, así
// que un proveedor adentro del shell quedaría por debajo del componente
// que llama a useToast()/useConfirmar().
export function ProveedoresFeedback({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmarProvider>{children}</ConfirmarProvider>
    </ToastProvider>
  );
}
