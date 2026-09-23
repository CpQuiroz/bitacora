"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { HistorialTrabajos } from "@/components/HistorialTrabajos";

// Fase 5.3 — "Mis trabajos": historial de levantamientos/OS
// terminados, self-service (ver GET /api/mis-trabajos). Solo lectura.
export default function MisTrabajosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const { usuario: u } = await res.json();
        if (u) {
          setUsuario({
            nombre: u.nombre,
            rol: u.rol,
            empresaNombre: u.empresa?.nombre ?? "",
            empresaLogoUrl: u.empresa?.logo_url ?? null,
            colorPrimario: u.empresa?.color_primario ?? null,
            tema: u.empresa?.tema ?? "faena",
            colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
            colorSecundario: u.empresa?.color_secundario ?? null,
            fuente: u.empresa?.fuente ?? null,
            moneda: u.empresa?.moneda ?? "CLP",
          });
        }
      }
    })();
  }, [router]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-4">
        <h1 className="font-ds-heading text-ds-h2 text-ds-text">Mis trabajos</h1>
        <p className="font-ds-body text-ds-small text-ds-text/70">Levantamientos y órdenes de servicio terminados.</p>
      </div>
      <HistorialTrabajos />
    </DashboardShell>
  );
}
