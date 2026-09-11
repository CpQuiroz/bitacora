"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import type { Documento, EntidadDocumento, EstadoDocumento } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { StatusBadge, type TonoEstado } from "@bitacora/ui/web";
import { DataTable } from "@/components/DataTable";

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
  colaborador: (id) => `/dashboard/personas/${id}`,
  vehiculo: () => `/dashboard/registros/equipos`,
};

// "por_vencer" no está en MAPA_ESTADO_TONO (ambiguo a propósito) — mismo
// criterio que DocumentoForm.tsx.
const TONO_FORZADO: Partial<Record<EstadoDocumento, TonoEstado>> = { por_vencer: "en_progreso" };

// Color de urgencia sobre la fecha — mismo criterio que el badge de estado.
const COLOR_ESTADO: Record<EstadoDocumento, string> = {
  vencido: "text-ds-accent-700 font-medium",
  por_vencer: "text-ds-accent-700 font-medium",
  vigente: "text-ds-text/60",
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <div className="mb-ds-6">
        <p className="ds-heading text-ds-h2 text-ds-text">Documentos</p>
        <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Colaboradores y vehículos, ordenados por fecha de vencimiento (vencidos primero)</p>
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      <div className="mb-ds-4 flex flex-wrap gap-ds-2">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`rounded-ds-md border px-ds-3 py-1.5 font-ds-body text-ds-small transition-colors ${
              filtro === f.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
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
          { header: "Quién/Qué", cell: (d) => <span className="font-medium text-ds-text">{d.entidad_nombre}</span> },
          { header: "Tipo", cell: (d) => <span className="text-ds-text/60">{d.tipo?.nombre ?? "—"}</span> },
          {
            header: "Vence",
            cell: (d) => <span className={d.estado ? COLOR_ESTADO[d.estado] : "text-ds-text/60"}>{d.fecha_vencimiento ?? "Sin vencimiento"}</span>,
          },
          { header: "Estado", cell: (d) => (d.estado ? <StatusBadge estado={d.estado} tonoForzado={TONO_FORZADO[d.estado]} /> : "—") },
        ]}
        actions={[
          {
            label: "Ver ficha",
            onClick: (d) => router.push(RUTA_POR_ENTIDAD[d.entidad_tipo](d.entidad_id)),
            variant: "brand",
          },
        ]}
        emptyState={{
          icon: Clock,
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
