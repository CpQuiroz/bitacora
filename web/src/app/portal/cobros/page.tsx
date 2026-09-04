"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Card, ErrorText } from "@/components/ui";
import { IconWallet } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type Cobro = { id: string; monto: number; fecha_emision: string; fecha_vencimiento: string; fecha_pago: string | null; estado: string };

export default function PortalCobrosPage() {
  const router = useRouter();
  const [cobros, setCobros] = useState<Cobro[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    (async () => {
      const res = await portalFetch("/api/portal/datos/cobros");
      if (res.status === 401) {
        router.replace("/portal/login");
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar tus cobros");
        return;
      }
      setCobros(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalShell>
      <h1 className="mb-4 text-xl font-semibold text-foreground">Mis Cobros</h1>

      {error && <ErrorText>{error}</ErrorText>}
      {cobros === null && !error && <EstadoCargando />}
      {cobros?.length === 0 && (
        <EstadoVacio icono={IconWallet} titulo="No tienes cobros registrados" />
      )}

      <div className="flex flex-col gap-3">
        {cobros?.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">${Math.round(c.monto).toLocaleString("es-CL")}</p>
              <Badge value={c.estado} />
            </div>
            <p className="mt-1 text-xs text-muted">Vence {new Date(c.fecha_vencimiento).toLocaleDateString("es-CL")}</p>
            {c.fecha_pago && <p className="mt-1 text-xs text-muted">Pagado el {new Date(c.fecha_pago).toLocaleDateString("es-CL")}</p>}
          </Card>
        ))}
      </div>
    </PortalShell>
  );
}
