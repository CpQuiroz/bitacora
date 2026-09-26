"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Aviso, Button, Card, StatusBadge, Textarea } from "@bitacora/ui/web";
import { IconCalendar, IconClipboardCheck, IconReceipt, IconWallet } from "@/components/icons";
import { EstadoCargando } from "@/components/estados";
import { obtenerConfigPortal, obtenerTokenPortal, portalFetch, type ConfigPortal } from "@/lib/portalApi";
import { tonoPortal } from "./tonoEstado";

type Visita = { id: string; cliente: string; fecha: string; hora_programada: string | null; descripcion: string | null; estado: string };

export default function PortalHomePage() {
  const router = useRouter();
  const [visitas, setVisitas] = useState<Visita[] | null>(null);
  const [config, setConfig] = useState<ConfigPortal | null>(null);
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
      const { secciones } = await obtenerConfigPortal();
      setConfig(secciones);
      if (!secciones.ordenes) {
        setVisitas([]);
        return;
      }
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
      <h1 className="text-xl font-semibold text-ds-text">Hola 👋</h1>
      <p className="mt-1 text-ds-small text-ds-text-secondary">Acá puedes ver tu información con esta empresa.</p>

      {(() => {
        const cards = [
          config?.ordenes !== false && { href: "/portal/ordenes", icon: IconClipboardCheck, label: "Mis OS" },
          config?.cotizaciones !== false && { href: "/portal/cotizaciones", icon: IconReceipt, label: "Cotizaciones" },
          config?.cobros !== false && { href: "/portal/cobros", icon: IconWallet, label: "Cobros" },
          config?.citas !== false && { href: "/portal/citas", icon: IconCalendar, label: "Citas" },
        ].filter(Boolean) as { href: string; icon: typeof IconClipboardCheck; label: string }[];
        if (cards.length === 0) return null;
        return (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {cards.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-ds-divider bg-ds-surface p-3 text-center"
              >
                <c.icon className="h-5 w-5 text-ds-brand" />
                <span className="text-xs font-medium text-ds-text">{c.label}</span>
              </Link>
            ))}
          </div>
        );
      })()}

      {config?.ordenes !== false && (
        <>
          <h2 className="mb-3 mt-8 flex items-center gap-2 text-sm font-semibold text-ds-text">
            <IconCalendar className="h-4 w-4 text-ds-brand" />
            Próximas visitas
          </h2>

          {error && <Aviso tono="error">{error}</Aviso>}
          {visitas === null && !error && <EstadoCargando />}
          {visitas?.length === 0 && <p className="text-sm text-ds-text-secondary">No tienes visitas programadas por ahora.</p>}

          <div className="flex flex-col gap-3">
            {visitas?.map((v) => (
              <Card key={v.id}>
                <div className="flex items-center justify-between">
                  <p className="text-ds-small font-medium text-ds-text">
                    {new Date(v.fecha).toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <StatusBadge estado={v.estado} tonoForzado={tonoPortal(v.estado)} />
                </div>
                {v.hora_programada && <p className="mt-1 text-ds-caption text-ds-text-secondary">Hora estimada: {v.hora_programada}</p>}
                {v.descripcion && <p className="mt-1 text-ds-caption text-ds-text-secondary">{v.descripcion}</p>}
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="mt-10 border-t border-ds-divider pt-6">
        <h2 className="mb-2 text-sm font-semibold text-ds-text">Mis datos personales</h2>
        <button type="button" onClick={descargarMisDatos} className="text-xs text-ds-brand underline">
          Descargar todos mis datos (Ley 21.719)
        </button>

        <label htmlFor="portal-correccion" className="mt-4 mb-2 block text-ds-caption text-ds-text-secondary">
          ¿Hay un dato tuyo mal (nombre, dirección, teléfono)? Pide la corrección:
        </label>
        {corrOk ? (
          <Aviso tono="exito">Listo, le avisamos a la empresa.</Aviso>
        ) : (
          <div className="flex flex-col gap-2">
            <Textarea
              id="portal-correccion"
              valor={correccion}
              onCambio={setCorreccion}
              filas={2}
              placeholder="Ej.: mi dirección correcta es…"
            />
            <div className="self-start">
              <Button tamano="sm" onPress={pedirCorreccion} deshabilitado={enviandoCorr || correccion.trim().length < 5}>
                {enviandoCorr ? "Enviando…" : "Pedir corrección"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
