import { useEffect, useState } from "react";
import { apiFetch } from "./api";

export type RolDisponible = { value: string; label: string };

// Fallback estático — solo se usa mientras carga el fetch o si falla.
// La verdad son las filas de la tabla `roles` (editables desde el Panel
// de Super-Admin, migración 71), que expone GET /api/usuarios/roles.
export const ROLES_FALLBACK: RolDisponible[] = [
  { value: "colaborador", label: "Colaborador / técnico / chofer" },
  { value: "supervisor", label: "Supervisor" },
  { value: "contador", label: "Contador" },
  { value: "admin", label: "Admin" },
];

let cache: RolDisponible[] | null = null;

// Roles que la empresa del usuario puede asignar. Cachea el resultado a
// nivel de módulo para no re-pedirlo en cada selector de la misma vista.
export function useRolesDisponibles(): RolDisponible[] {
  const [roles, setRoles] = useState<RolDisponible[]>(cache ?? ROLES_FALLBACK);

  useEffect(() => {
    if (cache) {
      setRoles(cache);
      return;
    }
    let vivo = true;
    (async () => {
      const res = await apiFetch("/api/usuarios/roles");
      if (!res.ok || !vivo) return;
      const body = (await res.json()) as { slug: string; nombre: string }[];
      cache = body.map((r) => ({ value: r.slug, label: r.nombre }));
      if (vivo) setRoles(cache);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return roles;
}
