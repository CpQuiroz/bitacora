"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Empresa, Usuario, Vehiculo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell } from "@/components/DashboardShell";
import { Card, PageHeader } from "@/components/ui";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconTruck } from "@/components/icons";

type UsuarioConEmpresa = Usuario & { empresa: Empresa };

export default function PerfilPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioConEmpresa | null>(null);
  const [vehiculo, setVehiculo] = useState<Vehiculo | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resVehiculo] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/usuarios/me/vehiculo")]);
      if (resMe.ok) {
        const body = await resMe.json();
        if (body.usuario) setUsuario(body.usuario);
      }
      if (resVehiculo.ok) setVehiculo(await resVehiculo.json());
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
      <PageHeader title="Perfil" subtitle="Tus datos, tu vehículo asignado y tus documentos" />
      <Card className="my-6">
        <p className="text-sm text-muted">
          Todavía no puedes editar tu perfil desde acá — por ahora tu nombre y rol los administra un admin desde Equipo.
        </p>
      </Card>

      <Card className="my-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <IconTruck className="h-4 w-4 text-brand" />
          Vehículo asignado
        </h2>
        {vehiculo ? (
          <p className="text-sm text-foreground">
            {vehiculo.patente} — {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "sin marca/modelo registrados"}
          </p>
        ) : (
          <p className="text-sm text-muted">No tienes un vehículo asignado por ahora.</p>
        )}
      </Card>

      <DocumentoForm entidadTipo="colaborador" entidadId={usuario.id} />
    </DashboardShell>
  );
}
