import type { FuncionColaborador } from "@bitacora/shared";

// Función / especialidad de un colaborador — más fina que el rol.
// La usa la app móvil para mostrarle solo sus herramientas.
export const FUNCIONES: { value: FuncionColaborador; label: string }[] = [
  { value: "tecnico", label: "Técnico" },
  { value: "chofer", label: "Chofer" },
  { value: "instalador", label: "Instalador" },
  { value: "administrativo", label: "Administrativo" },
  { value: "otro", label: "Otro" },
];

export function etiquetaFuncion(f: FuncionColaborador | null): string {
  return FUNCIONES.find((x) => x.value === f)?.label ?? "—";
}
