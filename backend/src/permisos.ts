// ============================================================
// BITÁCORA — Guards de permisos reutilizables. Usan la misma matriz
// centralizada de @bitacora/shared (packages/shared/src/permisos.ts)
// que también consume el frontend para ocultar navegación — nunca
// hay que repetir la regla de "quién ve qué" en dos lugares.
//
// requiereModulo: para proteger un módulo entero (ej. todo Financiero).
// requiereRol: para una acción puntual más fina dentro de un módulo
// que Supervisor sí puede ver pero no ejecutar (ej. "Facturar").
// ============================================================
import type { Modulo, Rol } from "@bitacora/shared";
import { puedeVerModulo } from "@bitacora/shared";
import type { RequestConEmpresa } from "./empresa";
import { ah } from "./asyncHandler";

export function requiereModulo(modulo: Modulo) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!puedeVerModulo((req.rol ?? "colaborador") as Rol, modulo)) {
      res.status(403).json({ error: "No tienes permiso para acceder a este módulo" });
      return;
    }
    next();
  });
}

export function requiereRol(...roles: Rol[]) {
  return ah<RequestConEmpresa>(async (req, res, next) => {
    if (!roles.includes((req.rol ?? "colaborador") as Rol)) {
      res.status(403).json({ error: "No tienes permiso para realizar esta acción" });
      return;
    }
    next();
  });
}
