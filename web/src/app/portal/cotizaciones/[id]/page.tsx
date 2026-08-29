"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PortalShell } from "@/components/PortalShell";
import { Badge, Button, Card, ErrorText, SuccessText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { obtenerTokenPortal, portalFetch } from "@/lib/portalApi";

type Item = { id: string; descripcion: string; cantidad: number; precio_unitario: number };
type CotizacionDetalle = {
  id: string;
  numero: number | null;
  descripcion: string | null;
  monto: number;
  subtotal: number | null;
  iva: number | null;
  fecha: string;
  fecha_vencimiento: string | null;
  estado: string;
  items: Item[];
};

const monto = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export default function PortalCotizacionDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);
  const [decidiendo, setDecidiendo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    const res = await portalFetch(`/api/portal/datos/cotizaciones/${params.id}`);
    if (res.status === 401) {
      router.replace("/portal/login");
      return;
    }
    if (!res.ok) {
      setError("No se pudo cargar esta cotización");
      return;
    }
    setCotizacion(await res.json());
  }

  useEffect(() => {
    if (!obtenerTokenPortal()) {
      router.replace("/portal/login");
      return;
    }
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function descargarPdf() {
    setDescargando(true);
    const res = await portalFetch(`/api/portal/datos/cotizaciones/${params.id}/pdf`);
    setDescargando(false);
    if (!res.ok) return;
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), "_blank");
  }

  async function decidir(accion: "aprobar" | "rechazar") {
    setDecidiendo(true);
    setError(null);
    const res = await portalFetch(`/api/portal/datos/cotizaciones/${params.id}/${accion}`, { method: "POST" });
    setDecidiendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo registrar tu respuesta");
      return;
    }
    setAviso(accion === "aprobar" ? "Aprobaste esta cotización — te contactaremos para agendar." : "Rechazaste esta cotización.");
    cargar();
  }

  return (
    <PortalShell>
      <Link href="/portal/cotizaciones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Mis Cotizaciones
      </Link>

      {error && <ErrorText>{error}</ErrorText>}
      {!cotizacion && !error && <p className="text-sm text-muted">Cargando…</p>}

      {cotizacion && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">Cotización N° {cotizacion.numero ?? "—"}</h1>
              <Badge value={cotizacion.estado} />
            </div>
            {cotizacion.fecha_vencimiento && <p className="mt-1 text-xs text-muted">Válida hasta {new Date(cotizacion.fecha_vencimiento).toLocaleDateString("es-CL")}</p>}
            {cotizacion.descripcion && <p className="mt-3 text-sm text-foreground">{cotizacion.descripcion}</p>}

            {cotizacion.items.length > 0 && (
              <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                {cotizacion.items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm">
                    <span className="text-foreground">
                      {it.descripcion} <span className="text-muted">× {it.cantidad}</span>
                    </span>
                    <span className="text-foreground">{monto(it.cantidad * it.precio_unitario)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4 text-sm">
              {cotizacion.subtotal != null && (
                <div className="flex justify-between text-muted">
                  <span>Subtotal</span>
                  <span>{monto(cotizacion.subtotal)}</span>
                </div>
              )}
              {cotizacion.iva != null && (
                <div className="flex justify-between text-muted">
                  <span>IVA</span>
                  <span>{monto(cotizacion.iva)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{monto(cotizacion.monto)}</span>
              </div>
            </div>
          </Card>

          {aviso && <SuccessText>{aviso}</SuccessText>}

          {cotizacion.estado === "enviado" && (
            <div className="flex gap-3">
              <Button type="button" onClick={() => decidir("aprobar")} disabled={decidiendo} className="flex-1">
                Aprobar
              </Button>
              <Button type="button" variant="outline" onClick={() => decidir("rechazar")} disabled={decidiendo} className="flex-1">
                Rechazar
              </Button>
            </div>
          )}

          <Button type="button" variant="outline" onClick={descargarPdf} disabled={descargando}>
            {descargando ? "Generando…" : "Descargar PDF"}
          </Button>
        </div>
      )}
    </PortalShell>
  );
}
