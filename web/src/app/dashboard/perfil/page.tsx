"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Empresa, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, PageHeader } from "@/components/ui";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

export default function PerfilPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const body = await res.json();
        if (body.usuario) setUsuario(body.usuario);
      }
    })();
  }, [router]);

  if (!usuario) return null;

  return (
    <DashboardShell
      usuario={{
        nombre: usuario.nombre,
        rol: usuario.rol,
        empresaNombre: usuario.empresa.nombre,
        empresaLogoUrl: usuario.empresa.logo_url,
        colorPrimario: usuario.empresa.color_primario,
        colorPrimarioForeground: usuario.empresa.color_primario_foreground, colorSecundario: usuario.empresa.color_secundario, fuente: usuario.empresa.fuente,
        moneda: usuario.empresa.moneda,
      }}
    >
      <PageHeader title="Perfil" subtitle="Próximamente: edición de tu perfil" />
      <Card className="my-6">
        <p className="text-sm text-muted">
          Todavía no puedes editar tu perfil desde acá — por ahora tu nombre y rol los administra un admin desde Equipo.
        </p>
      </Card>
    </DashboardShell>
  );
}
