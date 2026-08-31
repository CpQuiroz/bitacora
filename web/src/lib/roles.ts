import type { Rol } from "@bitacora/shared";

// Etiquetas de rol en español — compartidas entre Gestión y Control
// (invitar/editar miembro), Nueva OS y ComboboxResponsable, para no
// mantener la misma lista de a copias sueltas.
export const ROLES: { value: Rol; label: string }[] = [
  { value: "colaborador", label: "Colaborador / técnico" },
  { value: "supervisor", label: "Supervisor" },
  { value: "contador", label: "Contador" },
  { value: "admin", label: "Admin" },
];
