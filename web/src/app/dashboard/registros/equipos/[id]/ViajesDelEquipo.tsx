"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Route } from "lucide-react";
import type { Viaje } from "@bitacora/shared";
import { Table } from "@bitacora/ui/web";
import { StatusBadge } from "@bitacora/ui/web";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";

type ViajeConDatos = Viaje & { cliente_info: { id: string; nombre: string } | null; chofer: { id: string; nombre: string } | null };

// Tarea 148: viajes hechos con este vehículo (pestaña Viajes de la ficha).
// El monto solo lo ven Admin y Supervisor. Clic en la fila abre el viaje.
export function ViajesDelEquipo({ equipoId, verMontos, moneda }: { equipoId: string; verMontos: boolean; moneda?: string }) {
  const router = useRouter();
  const [viajes, setViajes] = useState<ViajeConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    apiFetch(`/api/viajes?equipo_id=${encodeURIComponent(equipoId)}`)
      .then(async (res) => {
        if (!vigente) return;
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "No se pudieron cargar los viajes");
          return;
        }
        setViajes(await res.json());
      })
      .catch(() => {
        if (vigente) setError("No se pudieron cargar los viajes. Revisa tu conexión.");
      });
    return () => {
      vigente = false;
    };
  }, [equipoId]);

  return (
    <Table<ViajeConDatos>
      filas={viajes ?? []}
      cargando={viajes === null && !error}
      error={error}
      claveFila={(v) => v.id}
      vacio={{ titulo: "Este vehículo todavía no tiene viajes", icono: <Route size={28} strokeWidth={2.75} /> }}
      onFilaClick={(v) => router.push(`/dashboard/viajes?editar=${v.id}`)}
      columnas={[
        { encabezado: "Fecha", celda: (v) => <span className="font-mono text-ds-caption">{v.fecha}</span> },
        { encabezado: "Guía", celda: (v) => v.numero_guia || "—" },
        { encabezado: "Ruta", celda: (v) => `${v.origen} → ${v.destino}` },
        { encabezado: "Cliente", celda: (v) => v.cliente_info?.nombre ?? "—" },
        { encabezado: "Chofer", celda: (v) => v.chofer?.nombre ?? "—" },
        { encabezado: "Estado", celda: (v) => <StatusBadge estado={v.estado} /> },
        ...(verMontos ? [{ encabezado: "Total", clase: "text-right tabular-nums", celda: (v: ViajeConDatos) => formatMoneda(v.total, moneda) }] : []),
      ]}
    />
  );
}
