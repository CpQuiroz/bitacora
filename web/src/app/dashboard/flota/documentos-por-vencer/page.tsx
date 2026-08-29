"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Documento, EntidadDocumento, EstadoDocumento } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, ErrorText } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconClock } from "@/components/icons";

type DocumentoPorVencer = Documento & { tipo: { nombre: string } | null; estado: EstadoDocumento | null; entidad_nombre: string };

const RUTA_POR_ENTIDAD: Record<EntidadDocumento, (id: string) => string> = {
  colaborador: (id) => `/dashboard/flota/colaboradores/${id}`,
  vehiculo: (id) => `/dashboard/flota/vehiculos/${id}`,
};

export default function DocumentosPorVencerPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoPorVencer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resDocs] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/documentos/por-vencer")]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u)
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
    if (!resDocs.ok) {
      setError("No se pudieron cargar los documentos por vencer");
      return;
    }
    setDocumentos(await resDocs.json());
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documentos por vencer</h1>
        <p className="mt-1 text-sm text-muted">Colaboradores y vehículos, ordenados por urgencia (vencidos primero)</p>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <DataTable
        rows={documentos ?? []}
        rowKey={(d) => d.id}
        loading={documentos === null && !error}
        columns={[
          { header: "Quién/Qué", cell: (d) => <span className="font-medium text-foreground">{d.entidad_nombre}</span> },
          { header: "Tipo", cell: (d) => <span className="text-muted">{d.tipo?.nombre ?? "—"}</span> },
          { header: "Vence", cell: (d) => <span className="text-muted">{d.fecha_vencimiento}</span> },
          { header: "Estado", cell: (d) => (d.estado ? <Badge value={d.estado} /> : "—") },
        ]}
        actions={[
          {
            label: "Ver ficha",
            onClick: (d) => router.push(RUTA_POR_ENTIDAD[d.entidad_tipo](d.entidad_id)),
            variant: "brand",
          },
        ]}
        emptyState={{ icon: IconClock, message: "Nada por vencer en los próximos 30 días." }}
      />
    </DashboardShell>
  );
}
