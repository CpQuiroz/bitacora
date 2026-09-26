"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Empresa, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Card } from "@bitacora/ui/web";
import { PageHeader } from "@/components/PageHeader";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

export default function AyudaPage() {
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
        tema: usuario.empresa.tema,
        colorPrimarioForeground: usuario.empresa.color_primario_foreground, colorSecundario: usuario.empresa.color_secundario, fuente: usuario.empresa.fuente,
        moneda: usuario.empresa.moneda,
      }}
    >
      <PageHeader title="Ayuda" subtitle="Próximamente: centro de ayuda" />
      <div className="my-ds-6">
        <Card>
          <p className="font-ds-body text-ds-small text-ds-text-secondary">Todavía no hay una base de ayuda — mientras tanto, escríbele directo a tu proveedor.</p>
        </Card>
      </div>
    </DashboardShell>
  );
}
