"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Documento, EntidadDocumento, EstadoDocumento } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, ErrorText } from "@/components/ui";
import { DataTable } from "@/components/DataTable";
import { IconClock } from "@/components/icons";

type DocumentoPorVencer = Documento & { tipo: { nombre: string } | null; estado: EstadoDocumento | null; entidad_nombre: string };

type Filtro = "todos" | "por_vencer" | "vencidos";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "por_vencer", etiqueta: "Por vencer" },
  { valor: "vencidos", etiqueta: "Vencidos" },
];

// Vehículos ya no tienen ficha propia (viven en Equipos, sin ruta por
// id) — se manda a la lista y ahí se busca/filtra por patente.
const RUTA_POR_ENTIDAD: Record<EntidadDocumento, (id: string) => string> = {
  colaborador: (id) => `/dashboard/flota/colaboradores/${id}`,
  vehiculo: () => `/dashboard/registros/equipos`,
};

// Color de urgencia sobre la fecha — mismo criterio que el Badge de estado.
const COLOR_ESTADO: Record<EstadoDocumento, string> = {
  vencido: "text-danger font-medium",
  por_vencer: "text-warning font-medium",
  vigente: "text-muted",
};

export default function DocumentosPorVencerPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [documentos, setDocumentos] = useState<DocumentoPorVencer[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todos");
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
      setError("No se pudieron cargar los documentos");
      return;
    }
    setDocumentos(await resDocs.json());
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const todos = documentos ?? [];
    if (filtro === "por_vencer") return todos.filter((d) => d.estado === "por_vencer");
    if (filtro === "vencidos") return todos.filter((d) => d.estado === "vencido");
    return todos;
  }, [documentos, filtro]);

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Documentos</h1>
        <p className="mt-1 text-sm text-muted">Colaboradores y vehículos, ordenados por fecha de vencimiento (vencidos primero)</p>
      </div>

      {error && <ErrorText>{error}</ErrorText>}

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`rounded-lg border px-3 py-1.5 text-sm transition ${
              filtro === f.valor ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted"
            }`}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <DataTable
        rows={visibles}
        rowKey={(d) => d.id}
        loading={documentos === null && !error}
        columns={[
          { header: "Quién/Qué", cell: (d) => <span className="font-medium text-foreground">{d.entidad_nombre}</span> },
          { header: "Tipo", cell: (d) => <span className="text-muted">{d.tipo?.nombre ?? "—"}</span> },
          {
            header: "Vence",
            cell: (d) => <span className={d.estado ? COLOR_ESTADO[d.estado] : "text-muted"}>{d.fecha_vencimiento ?? "Sin vencimiento"}</span>,
          },
          { header: "Estado", cell: (d) => (d.estado ? <Badge value={d.estado} /> : "—") },
        ]}
        actions={[
          {
            label: "Ver ficha",
            onClick: (d) => router.push(RUTA_POR_ENTIDAD[d.entidad_tipo](d.entidad_id)),
            variant: "brand",
          },
        ]}
        emptyState={{
          icon: IconClock,
          message:
            filtro === "por_vencer"
              ? "Nada por vencer en los próximos 30 días."
              : filtro === "vencidos"
                ? "Ningún documento vencido."
                : "Todavía no hay documentos registrados.",
        }}
      />
    </DashboardShell>
  );
}
