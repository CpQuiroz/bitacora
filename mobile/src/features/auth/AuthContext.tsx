import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Empresa, Modulo, Usuario } from "@bitacora/shared";
import { supabase } from "../../lib/supabase";
import { apiJson } from "../../services/api";
import { guardarCache, leerCache } from "../../services/sync/cache";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

type EstadoAuth =
  | { fase: "cargando" }
  | { fase: "sin-sesion" }
  | { fase: "mfa-requerido"; usuario: UsuarioConEmpresa }
  | {
      fase: "listo";
      usuario: UsuarioConEmpresa;
      modulosDeshabilitados: Modulo[];
      // Módulos que este usuario realmente ve: rol ∩ contratado (con los
      // ajustes por empresa de Configuración → Perfiles). Lo usa la
      // navegación para decidir pestañas.
      modulosVisibles: Modulo[];
    };

type AuthContexto = EstadoAuth & {
  session: Session | null;
  cerrarSesion: () => Promise<void>;
  refrescar: () => Promise<void>;
};

const Ctx = createContext<AuthContexto | null>(null);

const CACHE_ME = "me";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [estado, setEstado] = useState<EstadoAuth>({ fase: "cargando" });

  const resolverUsuario = useCallback(async () => {
    const [resMe, resMfa] = await Promise.all([
      apiJson<{
        usuario: UsuarioConEmpresa | null;
        modulos_deshabilitados: Modulo[];
        modulos_visibles?: Modulo[];
        rol_exige_2fa?: boolean;
      }>("/api/me"),
      apiJson<{ activado: boolean }>("/api/usuarios/me/mfa"),
    ]);

    if (!resMe.ok) {
      // Sin señal: intentar mostrar lo cacheado para no bloquear al técnico.
      const cache = await leerCache<{ usuario: UsuarioConEmpresa; modulos: Modulo[]; visibles?: Modulo[] }>(CACHE_ME);
      if (cache) {
        setEstado({
          fase: "listo",
          usuario: cache.datos.usuario,
          modulosDeshabilitados: cache.datos.modulos,
          modulosVisibles: cache.datos.visibles ?? [],
        });
      } else {
        setEstado({ fase: "sin-sesion" });
      }
      return;
    }
    if (!resMe.data.usuario) {
      setEstado({ fase: "sin-sesion" });
      return;
    }

    const usuario = resMe.data.usuario;
    const modulos = resMe.data.modulos_deshabilitados ?? [];
    const visibles = resMe.data.modulos_visibles ?? [];
    await guardarCache(CACHE_ME, { usuario, modulos, visibles });

    // La exigencia de 2FA la define roles.requiere_2fa (editable desde el
    // Panel de Super-Admin) — el backend la manda en /api/me.
    const rolExigeMfa = resMe.data.rol_exige_2fa ?? false;
    const mfaActivado = resMfa.ok ? resMfa.data.activado : true; // sin señal, no bloquear
    if (rolExigeMfa && !mfaActivado) {
      setEstado({ fase: "mfa-requerido", usuario });
      return;
    }
    setEstado({ fase: "listo", usuario, modulosDeshabilitados: modulos, modulosVisibles: visibles });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setEstado(s ? { fase: "cargando" } : { fase: "sin-sesion" });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!session) {
      setEstado({ fase: "sin-sesion" });
      return;
    }
    void resolverUsuario();
  }, [session, resolverUsuario]);

  const cerrarSesion = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return (
    <Ctx.Provider
      value={{
        ...estado,
        session: session ?? null,
        cerrarSesion,
        refrescar: resolverUsuario,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth fuera de <AuthProvider>");
  return ctx;
}

/** Atajo: el usuario ya autenticado y listo. Úsalo dentro de pantallas de la app. */
export function useUsuario(): UsuarioConEmpresa {
  const ctx = useAuth();
  if (ctx.fase !== "listo" && ctx.fase !== "mfa-requerido") {
    throw new Error("useUsuario usado antes de que la sesión esté lista");
  }
  return ctx.usuario;
}
