import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import { apiFetch } from "./api";
import type { UsuarioShell } from "@/components/DashboardShell";

// Bootstrap común de una página del dashboard: valida sesión y arma el
// UsuarioShell desde /api/me. Devuelve null mientras carga.
export function useUsuarioShell(): { usuario: UsuarioShell | null; rol: string | null } {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [rol, setRol] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (!res.ok) {
        router.replace("/login");
        return;
      }
      const { usuario: u } = await res.json();
      if (!u) return;
      setRol(u.rol);
      setUsuario({
        nombre: u.nombre,
        rol: u.rol,
        empresaNombre: u.empresa?.nombre ?? "",
        empresaLogoUrl: u.empresa?.logo_url ?? null,
        colorPrimario: u.empresa?.color_primario ?? null,
        colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
        colorSecundario: u.empresa?.color_secundario ?? null,
        fuente: u.empresa?.fuente ?? null,
        moneda: u.empresa?.moneda ?? "CLP",
      });
    })();
  }, [router]);

  return { usuario, rol };
}
