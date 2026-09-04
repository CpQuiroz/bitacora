"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Button, Card, ErrorText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { EstadoCargando } from "@/components/estados";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type OrdenDetalle = {
  id: string;
  cliente: string;
  fecha: string;
  descripcion: string | null;
  estado: string;
  orden: { folio: number | null; estado_os: string; observaciones_cierre: string | null; finalizada_en: string | null } | null;
};

export default function PortalOrdenDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    (async () => {
      const res = await portalFetch(`/api/portal/datos/ordenes/${params.id}`);
      if (res.status === 401) {
        router.replace("/portal/login");
        return;
      }
      if (!res.ok) {
        setError("No se pudo cargar esta orden de servicio");
        return;
      }
      setOrden(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function descargarPdf() {
    setDescargando(true);
    const res = await portalFetch(`/api/portal/datos/ordenes/${params.id}/pdf`);
    setDescargando(false);
    if (!res.ok) return;
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  }

  return (
    <PortalShell>
      <Link href="/portal/ordenes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Mis Órdenes de Servicio
      </Link>

      {error && <ErrorText>{error}</ErrorText>}
      {!orden && !error && <EstadoCargando />}

      {orden && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">{orden.orden?.folio ? `OS N° ${orden.orden.folio}` : "Orden de servicio"}</h1>
              <Badge value={orden.orden?.estado_os ?? orden.estado} />
            </div>
            <p className="mt-2 text-sm text-muted">{new Date(orden.fecha).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</p>
            {orden.descripcion && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Descripción del servicio</p>
                <p className="mt-1 text-sm text-foreground">{orden.descripcion}</p>
              </div>
            )}
            {orden.orden?.observaciones_cierre && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Observaciones de cierre</p>
                <p className="mt-1 text-sm text-foreground">{orden.orden.observaciones_cierre}</p>
              </div>
            )}
          </Card>

          {orden.orden?.finalizada_en && (
            <Button type="button" onClick={descargarPdf} disabled={descargando}>
              {descargando ? "Generando…" : "Descargar PDF"}
            </Button>
          )}
        </div>
      )}
    </PortalShell>
  );
}
