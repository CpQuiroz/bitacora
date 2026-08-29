"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Card, ErrorText } from "@/components/ui";
import { IconClipboardCheck } from "@/components/icons";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type OrdenListado = {
  id: string;
  fecha: string;
  descripcion: string | null;
  estado: string;
  orden: { folio: number | null; estado_os: string } | null;
};

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
      <h1 className="mb-4 text-xl font-semibold text-foreground">Mis Órdenes de Servicio</h1>

      {error && <ErrorText>{error}</ErrorText>}
      {ordenes === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {ordenes?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconClipboardCheck className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no tienes órdenes de servicio.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {ordenes?.map((o) => (
          <Link key={o.id} href={`/portal/ordenes/${o.id}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{o.orden?.folio ? `OS N° ${o.orden.folio}` : "Orden de servicio"}</p>
                <Badge value={o.orden?.estado_os ?? o.estado} />
              </div>
              <p className="mt-1 text-xs text-muted">{new Date(o.fecha).toLocaleDateString("es-CL")}</p>
              {o.descripcion && <p className="mt-1 text-xs text-muted line-clamp-2">{o.descripcion}</p>}
            </Card>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
