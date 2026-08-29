"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Vehiculo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Card, PageHeader } from "@/components/ui";
import { DocumentoForm } from "@/components/DocumentoForm";
import { IconTruck } from "@/components/icons";

export default function MisDocumentosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
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
        const { usuario: u } = await resMe.json();
        if (u) {
          setUsuarioId(u.id);
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
        }
      }
      if (resVehiculo.ok) setVehiculo(await resVehiculo.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!usuario || !usuarioId) return null;

  return (
    <DashboardShell usuario={usuario}>
      <PageHeader title="Mis Documentos" subtitle="Tus documentos y tu vehículo asignado" />

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

      <DocumentoForm entidadTipo="colaborador" entidadId={usuarioId} />
    </DashboardShell>
  );
}
