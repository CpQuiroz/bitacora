"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Card, ErrorText } from "@/components/ui";
import { IconCalendar, IconClipboardCheck, IconReceipt, IconWallet } from "@/components/icons";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type Visita = { id: string; cliente: string; fecha: string; hora_programada: string | null; descripcion: string | null; estado: string };

export default function PortalHomePage() {
  const router = useRouter();
  const [visitas, setVisitas] = useState<Visita[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [correccion, setCorreccion] = useState("");
  const [enviandoCorr, setEnviandoCorr] = useState(false);
  const [corrOk, setCorrOk] = useState(false);

  async function descargarMisDatos() {
    const res = await portalFetch("/api/portal/mis-datos");
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pedirCorreccion() {
    if (correccion.trim().length < 5) return;
    setEnviandoCorr(true);
    const res = await portalFetch("/api/portal/solicitar-correccion", {
      method: "POST",
      body: JSON.stringify({ mensaje: correccion }),
    });
    setEnviandoCorr(false);
    if (res.ok) {
      setCorrOk(true);
      setCorreccion("");
    }
  }

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    (async () => {
      const res = await portalFetch("/api/portal/datos/visitas");
      if (res.status === 401) {
        router.replace("/portal/login");
        return;
      }
      if (!res.ok) {
        setError("No se pudieron cargar tus próximas visitas");
        return;
      }
      setVisitas(await res.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PortalShell>
      <h1 className="text-xl font-semibold text-foreground">Hola 👋</h1>
      <p className="mt-1 text-sm text-muted">Acá puedes ver tus visitas, órdenes de servicio, cotizaciones y cobros.</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Link href="/portal/ordenes" className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center">
          <IconClipboardCheck className="h-5 w-5 text-brand" />
          <span className="text-xs font-medium text-foreground">Mis OS</span>
        </Link>
        <Link href="/portal/cotizaciones" className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center">
          <IconReceipt className="h-5 w-5 text-brand" />
          <span className="text-xs font-medium text-foreground">Cotizaciones</span>
        </Link>
        <Link href="/portal/cobros" className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-surface p-3 text-center">
          <IconWallet className="h-5 w-5 text-brand" />
          <span className="text-xs font-medium text-foreground">Cobros</span>
        </Link>
      </div>

      <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-foreground">
        <IconCalendar className="h-4 w-4 text-brand" />
        Próximas visitas
      </h2>

      {error && <ErrorText>{error}</ErrorText>}
      {visitas === null && !error && <p className="text-sm text-muted">Cargando…</p>}
      {visitas?.length === 0 && <p className="text-sm text-muted">No tienes visitas programadas por ahora.</p>}

      <div className="flex flex-col gap-3">
        {visitas?.map((v) => (
          <Card key={v.id} className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">{new Date(v.fecha).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}</p>
              <Badge value={v.estado} />
            </div>
            {v.hora_programada && <p className="mt-1 text-xs text-muted">Hora estimada: {v.hora_programada}</p>}
            {v.descripcion && <p className="mt-1 text-xs text-muted">{v.descripcion}</p>}
          </Card>
        ))}
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Mis datos personales</h2>
        <button type="button" onClick={descargarMisDatos} className="text-xs text-brand underline">
          Descargar todos mis datos (Ley 21.719)
        </button>

        <p className="mt-4 mb-1 text-xs text-muted">¿Hay un dato tuyo mal (nombre, dirección, teléfono)? Pide la corrección:</p>
        {corrOk ? (
          <p className="text-xs text-green-700">Listo, le avisamos a la empresa.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <textarea
              value={correccion}
              onChange={(e) => setCorreccion(e.target.value)}
              rows={2}
              placeholder="Ej.: mi dirección correcta es…"
              className="rounded-lg border border-border bg-surface p-2 text-sm"
            />
            <button
              type="button"
              onClick={pedirCorreccion}
              disabled={enviandoCorr || correccion.trim().length < 5}
              className="self-start rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            >
              {enviandoCorr ? "Enviando…" : "Pedir corrección"}
            </button>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
