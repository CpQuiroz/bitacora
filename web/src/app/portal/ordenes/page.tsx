"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { EstadoTrabajo } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { PortalShell } from "@/components/PortalShell";
import { Aviso, Card, StatusBadge } from "@bitacora/ui/web";
import { IconClipboardCheck } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";
import { tonoPortal } from "../tonoEstado";

type OrdenListado = {
  id: string;
  fecha: string;
  descripcion: string | null;
  estado: string;
  orden: { folio: number | null; estado_os: string } | null;
};

const estadoDe = (o: OrdenListado) => o.orden?.estado_os ?? estadoOsDeTrabajo(o.estado as EstadoTrabajo);

export default function PortalOrdenesPage() {
  const router = useRouter();
  const [ordenes, setOrdenes] = useState<OrdenListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    (async () => {
      const res = await portalFetch("/api/portal/datos/ordenes");
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
        setError("No se pudieron cargar tus órdenes de servicio");
        return;
      }
      setOrdenes(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalShell>
      <h1 className="mb-4 text-xl font-semibold text-ds-text">Mis Órdenes de Servicio</h1>

      {error && <Aviso tono="error">{error}</Aviso>}
      {ordenes === null && !error && <EstadoCargando />}
      {ordenes?.length === 0 && (
        <EstadoVacio icono={IconClipboardCheck} titulo="Todavía no tienes órdenes de servicio" />
      )}

      <div className="flex flex-col gap-3">
        {ordenes?.map((o) => (
          <Link key={o.id} href={`/portal/ordenes/${o.id}`}>
            <Card>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-ds-text">{o.orden?.folio ? `OS N° ${o.orden.folio}` : "Orden de servicio"}</p>
                <StatusBadge estado={estadoDe(o)} tonoForzado={tonoPortal(estadoDe(o))} />
              </div>
              <p className="mt-1 text-xs text-ds-text-secondary">{new Date(o.fecha).toLocaleDateString("es-CL")}</p>
              {o.descripcion && <p className="mt-1 text-xs text-ds-text-secondary line-clamp-2">{o.descripcion}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
