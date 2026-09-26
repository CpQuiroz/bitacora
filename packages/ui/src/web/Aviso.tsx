import type { PropsAviso, TonoAviso } from "../tipos";

const CLASE: Record<TonoAviso, string> = {
  error: "bg-ds-danger-soft text-ds-danger",
  exito: "bg-ds-accent2-soft text-ds-accent2-strong",
  advertencia: "bg-ds-warning-soft text-ds-warning",
  info: "bg-ds-neutral-100 text-ds-text",
};

// Reemplaza ErrorText/SuccessText/WarningText del components/ui.tsx
// antiguo (tarea 157). El error se anuncia al lector de pantalla.
export function Aviso({ tono = "info", children }: PropsAviso) {
  return (
    <p
      role={tono === "error" ? "alert" : "status"}
      className={`rounded-ds-md border-l-[3px] border-current px-ds-3 py-ds-2 font-ds-body text-ds-small font-medium ${CLASE[tono]}`}
    >
      {children}
    </p>
  );
}
