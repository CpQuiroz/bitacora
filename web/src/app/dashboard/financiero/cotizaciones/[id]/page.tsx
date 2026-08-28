"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Cliente, EstadoPresupuesto, Presupuesto, PresupuestoItem } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";

type ClienteInfo = Pick<Cliente, "id" | "nombre" | "correo" | "telefono" | "direccion">;
type CotizacionDetalle = Presupuesto & { cliente_info: ClienteInfo | null; items: PresupuestoItem[] };

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aprobado", "rechazado"];
const HOY = () => new Date().toISOString().slice(0, 10);

export default function CotizacionDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [cotizacion, setCotizacion] = useState<CotizacionDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [convirtiendo, setConvirtiendo] = useState(false);
  const [errorConversion, setErrorConversion] = useState<string | null>(null);
  const [folioGenerado, setFolioGenerado] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resCotizacion] = await Promise.all([apiFetch("/api/me"), apiFetch(`/api/cotizaciones/${params.id}`)]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u)
        setUsuario({
          nombre: u.nombre,
          rol: u.rol,
          empresaNombre: u.empresa?.nombre ?? "",
          empresaLogoUrl: u.empresa?.logo_url ?? null,
          colorPrimario: u.empresa?.color_primario ?? null,
          colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
          colorSecundario: u.empresa?.color_secundario ?? null,
          fuente: u.empresa?.fuente ?? null,
          moneda: u.empresa?.moneda ?? "CLP",
        });
    }
    if (!resCotizacion.ok) {
      setError("No se pudo cargar la cotización");
      return;
    }
    setCotizacion(await resCotizacion.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(estado: EstadoPresupuesto) {
    const res = await apiFetch(`/api/cotizaciones/${params.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
    if (res.ok) {
      setAviso("Estado actualizado.");
      cargar();
    }
  }

  async function convertirAOs() {
    setConvirtiendo(true);
    setErrorConversion(null);
    const res = await apiFetch(`/api/cotizaciones/${params.id}/convertir-a-os`, { method: "POST" });
    setConvirtiendo(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorConversion(body.error ?? "No se pudo convertir la cotización en OS");
      return;
    }
    const { folio } = await res.json();
    setFolioGenerado(folio);
    cargar();
  }

  if (!usuario) return null;
  if (error) {
    return (
      <DashboardShell usuario={usuario}>
        <ErrorText>{error}</ErrorText>
      </DashboardShell>
    );
  }
  if (!cotizacion) return null;

  const vencida = cotizacion.estado === "enviado" && cotizacion.fecha_vencimiento != null && cotizacion.fecha_vencimiento < HOY();
  const estadoMostrado = vencida ? "vencida" : cotizacion.estado;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/financiero/cotizaciones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Cotizaciones
      </Link>

      <PageHeader
        title={cotizacion.numero != null ? `Cotización N° ${String(cotizacion.numero).padStart(4, "0")}` : "Cotización"}
        subtitle={cotizacion.cliente_info?.nombre ?? "—"}
        action={<Badge value={estadoMostrado} />}
      />

      {aviso && (
        <div className="my-4">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="my-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Ítems</h2>
            {cotizacion.items.length === 0 ? (
              <p className="text-sm text-muted">Sin ítems.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="py-2 font-medium">Descripción</th>
                    <th className="py-2 font-medium">Cantidad</th>
                    <th className="py-2 font-medium">Precio unitario</th>
                    <th className="py-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {cotizacion.items.map((it) => (
                    <tr key={it.id} className="border-b border-border last:border-0">
                      <td className="py-2.5 text-foreground">{it.descripcion}</td>
                      <td className="py-2.5 text-muted">{it.cantidad}</td>
                      <td className="py-2.5 text-muted">{formatMoneda(it.precio_unitario, usuario.moneda)}</td>
                      <td className="py-2.5 text-right text-foreground">{formatMoneda(it.cantidad * it.precio_unitario, usuario.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div className="mt-6 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
              <div className="flex w-56 justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="text-foreground">{formatMoneda(cotizacion.subtotal ?? 0, usuario.moneda)}</span>
              </div>
              <div className="flex w-56 justify-between">
                <span className="text-muted">IVA (19%)</span>
                <span className="text-foreground">{formatMoneda(cotizacion.iva ?? 0, usuario.moneda)}</span>
              </div>
              <div className="flex w-56 justify-between text-base font-semibold">
                <span className="text-foreground">Total</span>
                <span className="text-foreground">{formatMoneda(cotizacion.monto, usuario.moneda)}</span>
              </div>
            </div>
          </Card>

          {cotizacion.descripcion && (
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-foreground">Descripción</h2>
              <p className="text-sm text-muted">{cotizacion.descripcion}</p>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Cliente</h2>
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-medium text-foreground">{cotizacion.cliente_info?.nombre ?? "—"}</p>
              {cotizacion.cliente_info?.correo && <p className="text-muted">{cotizacion.cliente_info.correo}</p>}
              {cotizacion.cliente_info?.telefono && <p className="text-muted">{cotizacion.cliente_info.telefono}</p>}
              {cotizacion.cliente_info?.direccion && <p className="text-muted">{cotizacion.cliente_info.direccion}</p>}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-foreground">Estado</h2>
            <Select value={cotizacion.estado} onChange={(e) => cambiarEstado(e.target.value as EstadoPresupuesto)}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            <div className="mt-4 grid gap-2 text-sm">
              <div>
                <Label>Fecha de creación</Label>
                <p className="text-foreground">{cotizacion.fecha}</p>
              </div>
              <div>
                <Label>Fecha de vencimiento</Label>
                <p className="text-foreground">{cotizacion.fecha_vencimiento ?? "—"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Orden de Servicio</h2>
            {cotizacion.trabajo_id ? (
              <div className="flex flex-col gap-2">
                <SuccessText>{folioGenerado != null ? `Convertida en OS N° ${folioGenerado}.` : "Esta cotización ya fue convertida en una OS."}</SuccessText>
                <Link href={`/dashboard/ordenes/${cotizacion.trabajo_id}`} className="text-sm font-medium text-brand hover:underline">
                  Ver orden de servicio →
                </Link>
              </div>
            ) : cotizacion.estado === "aprobado" ? (
              <>
                <p className="mb-3 text-sm text-muted">La cotización está aprobada — puedes convertirla en una orden de servicio real.</p>
                <Button type="button" onClick={convertirAOs} disabled={convirtiendo}>
                  {convirtiendo ? "Convirtiendo…" : "Convertir a OS"}
                </Button>
                {errorConversion && (
                  <div className="mt-3">
                    <ErrorText>{errorConversion}</ErrorText>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Aprueba la cotización para poder convertirla en una orden de servicio.</p>
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
