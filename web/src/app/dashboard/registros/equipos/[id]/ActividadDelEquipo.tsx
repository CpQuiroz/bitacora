"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Route } from "lucide-react";
import type { OrdenServicio, Trabajo, Viaje } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { StatusBadge, Table, Tag } from "@bitacora/ui/web";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";

export type TrabajoConOrden = Trabajo & { orden: Pick<OrdenServicio, "folio" | "estado_os"> | null };
type ViajeConDatos = Viaje & { cliente_info: { id: string; nombre: string } | null; chofer: { id: string; nombre: string } | null };
type Filtro = "todo" | "os" | "viajes";

type FilaActividad = {
  clave: string;
  tipo: "os" | "viaje";
  id: string;
  fecha: string;
  titulo: string;
  detalle: string | null;
  cliente: string;
  estado: string;
  total: number | null;
};

// Tarea 150: pestaña Actividad de la ficha del equipo — OS y viajes en una
// sola lista por fecha (no "Trabajos": en Bitácora eso ya es sinónimo de OS).
// El monto de los viajes solo lo ven Admin y Supervisor. Clic abre el objeto.
export function ActividadDelEquipo({
  equipoId,
  os,
  incluirViajes,
  verMontos,
  moneda,
}: {
  equipoId: string;
  os: TrabajoConOrden[];
  incluirViajes: boolean;
  verMontos: boolean;
  moneda?: string;
}) {
  const router = useRouter();
  const [viajes, setViajes] = useState<ViajeConDatos[] | null>(incluirViajes ? null : []);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>("todo");

  useEffect(() => {
    if (!incluirViajes) return;
    let vigente = true;
    apiFetch(`/api/viajes?equipo_id=${encodeURIComponent(equipoId)}`)
      .then(async (res) => {
        if (!vigente) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "No se pudieron cargar los viajes");
          setViajes([]);
          return;
        }
        setViajes(await res.json());
      })
      .catch(() => {
        if (!vigente) return;
        setError("No se pudieron cargar los viajes. Revisa tu conexión.");
        setViajes([]);
      });
    return () => {
      vigente = false;
    };
  }, [equipoId, incluirViajes]);

  const filas = useMemo<FilaActividad[]>(() => {
    const deOs: FilaActividad[] = os.map((t) => ({
      clave: `os-${t.id}`,
      tipo: "os",
      id: t.id,
      fecha: t.fecha,
      titulo: t.orden?.folio != null ? `OS N° ${t.orden.folio}` : "OS sin folio",
      detalle: t.descripcion || null,
      cliente: t.cliente || "—",
      estado: t.orden?.estado_os ?? estadoOsDeTrabajo(t.estado),
      total: null,
    }));
    const deViajes: FilaActividad[] = (viajes ?? []).map((v) => ({
      clave: `viaje-${v.id}`,
      tipo: "viaje",
      id: v.id,
      fecha: v.fecha,
      titulo: v.numero_guia ? `Viaje · Guía ${v.numero_guia}` : "Viaje",
      detalle: [`${v.origen} → ${v.destino}`, v.chofer?.nombre].filter(Boolean).join(" · "),
      cliente: v.cliente_info?.nombre ?? v.cliente ?? "—",
      estado: v.estado,
      total: v.total ?? null,
    }));
    const todas = filtro === "os" ? deOs : filtro === "viajes" ? deViajes : [...deOs, ...deViajes];
    return todas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  }, [os, viajes, filtro]);

  const conMontos = verMontos && incluirViajes && filtro !== "os";

  return (
    <div className="flex flex-col gap-ds-4">
      {incluirViajes ? (
        <div className="flex gap-ds-1" role="group" aria-label="Filtrar actividad">
          {(
            [
              { valor: "todo", etiqueta: "Todo" },
              { valor: "os", etiqueta: "OS" },
              { valor: "viajes", etiqueta: "Viajes" },
            ] as const
          ).map((o) => (
            <button
              key={o.valor}
              type="button"
              aria-pressed={filtro === o.valor}
              onClick={() => setFiltro(o.valor)}
              className={`rounded-ds-pill border px-ds-3 py-ds-1 font-ds-body text-ds-small font-medium ${
                filtro === o.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-brand"
              }`}
            >
              {o.etiqueta}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      <Table<FilaActividad>
        filas={filas}
        cargando={viajes === null}
        claveFila={(f) => f.clave}
        vacio={{ titulo: "Todavía no hay actividad para este equipo", icono: <ClipboardCheck size={28} strokeWidth={2.75} /> }}
        onFilaClick={(f) => router.push(f.tipo === "os" ? `/dashboard/ordenes/${f.id}` : `/dashboard/viajes?editar=${f.id}`)}
        columnas={[
          {
            encabezado: "Tipo",
            celda: (f) => (
              <span className="flex items-center gap-1.5">
                {f.tipo === "os" ? <ClipboardCheck size={16} strokeWidth={2.75} className="text-ds-text-secondary" /> : <Route size={16} strokeWidth={2.75} className="text-ds-text-secondary" />}
                <Tag>{f.tipo === "os" ? "OS" : "Viaje"}</Tag>
              </span>
            ),
          },
          { encabezado: "Fecha", celda: (f) => <span className="font-mono text-ds-caption">{f.fecha}</span> },
          {
            encabezado: "Detalle",
            celda: (f) => (
              <>
                <p className="font-medium text-ds-text">{f.titulo}</p>
                {f.detalle ? <p className="font-ds-body text-ds-caption text-ds-text-secondary">{f.detalle}</p> : null}
              </>
            ),
          },
          { encabezado: "Cliente", celda: (f) => f.cliente },
          { encabezado: "Estado", celda: (f) => <StatusBadge estado={f.estado} /> },
          ...(conMontos
            ? [{ encabezado: "Total viaje", clase: "text-right tabular-nums", celda: (f: FilaActividad) => (f.tipo === "viaje" && f.total != null ? formatMoneda(f.total, moneda) : "—") }]
            : []),
        ]}
      />
    </div>
  );
}
