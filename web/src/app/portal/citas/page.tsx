"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Card, ErrorText } from "@/components/ui";
import { IconCalendar } from "@/components/icons";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type CitaListado = { id: string; titulo: string; fecha: string; hora: string | null; estado: string };

export default function PortalCitasPage() {
  const router = useRouter();
  const [citas, setCitas] = useState<CitaListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    (async () => {
      const res = await portalFetch("/api/portal/datos/citas");
      if (res.status === 401) {
        router.replace("/portal/login");
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar tus citas");
        return;
      }
      setCitas(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalShell>
      <h1 className="mb-4 text-xl font-semibold text-foreground">Mis Citas</h1>

      {error && <ErrorText>{error}</ErrorText>}
      {citas === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {citas?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconCalendar className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Todavía no tienes citas agendadas.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {citas?.map((c) => (
          <Link key={c.id} href={`/portal/citas/${c.id}`}>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{c.titulo}</p>
                <Badge value={c.estado} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {new Date(`${c.fecha}T00:00:00`).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                {c.hora ? ` · ${c.hora}` : ""}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </PortalShell>
  );
}
