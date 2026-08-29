"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Card, ErrorText } from "@/components/ui";
import { IconReceipt } from "@/components/icons";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

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
      <h1 className="mb-4 text-xl font-semibold text-foreground">Mis Cotizaciones</h1>

      {error && <ErrorText>{error}</ErrorText>}
      {cotizaciones === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {cotizaciones?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconReceipt className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no tienes cotizaciones.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {cotizaciones?.map((c) => (
          <Link key={c.id} href={`/portal/cotizaciones/${c.id}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Cotización N° {c.numero ?? "—"}</p>
                <Badge value={c.estado} />
              </div>
              <p className="mt-1 text-xs text-muted">{new Date(c.fecha).toLocaleDateString("es-CL")}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">${Math.round(c.monto).toLocaleString("es-CL")}</p>
            </Card>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
