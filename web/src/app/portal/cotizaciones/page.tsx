"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Aviso, Card, StatusBadge } from "@bitacora/ui/web";
import { IconReceipt } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";
import { tonoPortal } from "../tonoEstado";

type CotizacionListado = { id: string; numero: number | null; descripcion: string | null; monto: number; fecha: string; fecha_vencimiento: string | null; estado: string };

export default function PortalCotizacionesPage() {
  const router = useRouter();
  const [cotizaciones, setCotizaciones] = useState<CotizacionListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    (async () => {
      const res = await portalFetch("/api/portal/datos/cotizaciones");
      if (res.status === 401) {
        router.replace("/portal/login");
        return;
      }
      if (res.status === 403) {
        // La empresa apagó esta sección en el portal.
        router.replace("/portal");
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar tus cotizaciones");
        return;
      }
      setCotizaciones(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalShell>
      <h1 className="mb-4 text-xl font-semibold text-ds-text">Mis Cotizaciones</h1>

      {error && <Aviso tono="error">{error}</Aviso>}
      {cotizaciones === null && !error && <EstadoCargando />}
      {cotizaciones?.length === 0 && (
        <EstadoVacio icono={IconReceipt} titulo="Todavía no tienes cotizaciones" />
      )}

      <div className="flex flex-col gap-3">
        {cotizaciones?.map((c) => (
          <Link key={c.id} href={`/portal/cotizaciones/${c.id}`}>
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ds-text">Cotización N° {c.numero ?? "—"}</p>
                <StatusBadge estado={c.estado} tonoForzado={tonoPortal(c.estado)} />
              </div>
              <p className="mt-1 text-xs text-ds-text-secondary">{new Date(c.fecha).toLocaleDateString("es-CL")}</p>
              <p className="mt-1 text-sm font-semibold text-ds-text">${Math.round(c.monto).toLocaleString("es-CL")}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
