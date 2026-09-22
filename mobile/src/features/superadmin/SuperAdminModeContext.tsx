import { createContext, useContext } from "react";

// Único propósito: dejar que LoginScreen (flujo normal de empresa)
// pueda activar el modo Super-Admin sin que ninguna de las dos
// identidades sepa nada de la otra. Lo provee SuperAdminGate.tsx.
const Ctx = createContext<(() => void) | null>(null);

export const ProveedorModoSuperAdmin = Ctx.Provider;

export function useActivarModoSuperAdmin(): () => void {
  const activar = useContext(Ctx);
  if (!activar) throw new Error("useActivarModoSuperAdmin fuera de <SuperAdminGate>");
  return activar;
}
