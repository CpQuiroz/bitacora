import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { cerrarSesionSuperAdmin, obtenerSuperAdminYo, obtenerTokenSuperAdmin, type SuperAdminYo } from "../../services/superadmin";

// Identidad separada del AuthContext de empresa (ver services/superadmin.ts)
// — su propio "fase", su propio storage, nunca se mezclan.
type EstadoSuperAdmin = { fase: "cargando" } | { fase: "sin-sesion" } | { fase: "listo"; yo: SuperAdminYo };

type SuperAdminAuthContexto = EstadoSuperAdmin & {
  refrescar: () => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const Ctx = createContext<SuperAdminAuthContexto | null>(null);

export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoSuperAdmin>({ fase: "cargando" });

  const resolver = useCallback(async () => {
    const token = await obtenerTokenSuperAdmin();
    if (!token) {
      setEstado({ fase: "sin-sesion" });
      return;
    }
    const r = await obtenerSuperAdminYo();
    if (!r.ok) {
      // Token vencido/inválido — no dejar la app "abierta" tirando 401 en cada pantalla.
      if (r.status === 401 || r.status === 403) {
        await cerrarSesionSuperAdmin();
        setEstado({ fase: "sin-sesion" });
        return;
      }
      // Sin señal (red/timeout): no hay caché para super-admin (a
      // propósito, no vale la pena cachear datos de TODOS los clientes
      // en el dispositivo) — se pide reintentar.
      setEstado({ fase: "sin-sesion" });
      return;
    }
    setEstado({ fase: "listo", yo: r.yo });
  }, []);

  useEffect(() => {
    void resolver();
  }, [resolver]);

  const cerrarSesion = useCallback(async () => {
    await cerrarSesionSuperAdmin();
    setEstado({ fase: "sin-sesion" });
  }, []);

  return <Ctx.Provider value={{ ...estado, refrescar: resolver, cerrarSesion }}>{children}</Ctx.Provider>;
}

export function useSuperAdminAuth(): SuperAdminAuthContexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSuperAdminAuth fuera de <SuperAdminAuthProvider>");
  return ctx;
}
