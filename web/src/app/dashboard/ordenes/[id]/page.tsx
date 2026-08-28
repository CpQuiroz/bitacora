"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AnalisisFoto, Cliente, OrdenServicio, OsItem, Trabajo, TipoTrabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { abrirPdfOS } from "@/lib/descargarPdf";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconCamera, IconChevronLeft, IconClipboardCheck, IconMail } from "@/components/icons";

type OrdenConFirma = OrdenServicio & { firma_url_firmada: string | null };
type AnalisisFotoConUrl = AnalisisFoto & { url: string };
type DetalleOS = Trabajo & {
  cliente_info: Cliente | null;
  responsable: Usuario | null;
  tipo_trabajo: TipoTrabajo | null;
  orden: OrdenConFirma | null;
  items: OsItem[];
  fotos: AnalisisFotoConUrl[];
};

const monto = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

export default function DetalleOrdenServicioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [detalle, setDetalle] = useState<DetalleOS | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descargando, setDescargando] = useState(false);

  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resDetalle] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/ordenes-servicio/${params.id}`),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
    }
    if (!resDetalle.ok) {
      setError("No se pudo cargar la orden de servicio");
      return;
    }
    setDetalle(await resDetalle.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onDescargarPdf() {
    setDescargando(true);
    const ok = await abrirPdfOS(params.id);
    setDescargando(false);
    if (!ok) setError("No se pudo generar el PDF");
  }

  async function onEnviarEmail(e: FormEvent) {
    e.preventDefault();
    setAvisoEnvio(null);
    setErrorEnvio(null);
    if (!email.trim()) return;
    setEnviando(true);
    const res = await apiFetch(`/api/trabajos/${params.id}/pdf/enviar`, {
      method: "POST",
      body: JSON.stringify({ destinatario: email.trim() }),
    });
    setEnviando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEnvio(body.error ?? "No se pudo enviar el correo");
      return;
    }
    setAvisoEnvio(`PDF enviado a ${email.trim()}`);
    setEmail("");
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/ordenes" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Órdenes de Servicio
      </Link>

      {error && !detalle && <ErrorText>{error}</ErrorText>}

      {detalle && (
        <>
          <PageHeader
            title={detalle.orden?.folio != null ? `OS N° ${detalle.orden.folio}` : "Orden de servicio"}
            subtitle={`${detalle.cliente_info?.nombre ?? detalle.cliente} · ${detalle.fecha}${detalle.hora_programada ? ` ${detalle.hora_programada}` : ""}`}
            action={<Badge value={detalle.orden?.estado_os ?? "pendiente"} />}
          />

          <Card className="my-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconClipboardCheck className="h-4 w-4 text-brand" />
              Detalle
            </h2>
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted">Colaborador asignado</p>
                <p className="font-medium text-foreground">{detalle.responsable?.nombre ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted">Dirección</p>
                <p className="font-medium text-foreground">{detalle.ubicacion ?? detalle.cliente_info?.direccion ?? "—"}</p>
              </div>
              {detalle.descripcion && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted">Descripción</p>
                  <p className="text-foreground">{detalle.descripcion}</p>
                </div>
              )}
              {detalle.orden?.observaciones_cierre && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted">Observaciones de cierre</p>
                  <p className="text-foreground">{detalle.orden.observaciones_cierre}</p>
                </div>
              )}
            </div>
          </Card>

          {detalle.items.length > 0 && (
            <Card className="my-6 overflow-x-auto p-0">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="px-5 py-3 font-medium">Ítem</th>
                    <th className="px-5 py-3 font-medium">Cant.</th>
                    <th className="px-5 py-3 font-medium">P. unitario</th>
                    <th className="px-5 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((it) => (
                    <tr key={it.id} className="border-b border-border last:border-0">
                      <td className="px-5 py-3">{it.descripcion}</td>
                      <td className="px-5 py-3">{it.cantidad}</td>
                      <td className="px-5 py-3">{monto(it.precio_unitario)}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{monto(it.cantidad * it.precio_unitario)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="px-5 py-3 text-right text-xs font-medium text-muted">
                      Total
                    </td>
                    <td className="px-5 py-3 font-semibold text-foreground">
                      {monto(detalle.items.reduce((acc, it) => acc + it.cantidad * it.precio_unitario, 0))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </Card>
          )}

          {detalle.fotos.length > 0 && (
            <Card className="my-6">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconCamera className="h-4 w-4 text-brand" />
                Fotos
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {detalle.fotos.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div key={f.id} className="overflow-hidden rounded-xl border border-border">
                    <img src={f.url} alt={f.resumen ?? "Foto de la OS"} className="h-40 w-full object-cover" />
                    {f.resumen && <p className="p-2 text-xs text-muted">{f.resumen}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card className="my-6">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Firma de conformidad</h2>
            {detalle.orden?.firma_url_firmada ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={detalle.orden.firma_url_firmada}
                  alt="Firma"
                  className="h-24 w-48 rounded border border-border bg-white object-contain"
                />
                <div className="text-sm">
                  {detalle.orden.firmante_nombre && (
                    <p className="text-foreground">
                      <span className="text-muted">Nombre:</span> {detalle.orden.firmante_nombre}
                    </p>
                  )}
                  {detalle.orden.firmante_documento && (
                    <p className="text-foreground">
                      <span className="text-muted">RUT/Documento:</span> {detalle.orden.firmante_documento}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Todavía no se ha registrado la firma.</p>
            )}
          </Card>

          {detalle.orden && (
            <Card className="my-6">
              <h2 className="mb-4 text-sm font-semibold text-foreground">PDF de la OS</h2>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <Button type="button" onClick={onDescargarPdf} disabled={descargando}>
                  {descargando ? "Generando…" : "Descargar PDF"}
                </Button>
                <form onSubmit={onEnviarEmail} className="flex w-full max-w-sm items-end gap-2">
                  <div className="flex-1">
                    <Label className="flex items-center gap-1">
                      <IconMail className="h-3.5 w-3.5" /> Enviar por email
                    </Label>
                    <Input
                      type="email"
                      placeholder="correo@cliente.cl"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={enviando || !email.trim()}>
                    {enviando ? "Enviando…" : "Enviar"}
                  </Button>
                </form>
              </div>
              {avisoEnvio && (
                <div className="mt-3">
                  <SuccessText>{avisoEnvio}</SuccessText>
                </div>
              )}
              {errorEnvio && (
                <div className="mt-3">
                  <ErrorText>{errorEnvio}</ErrorText>
                </div>
              )}
            </Card>
          )}

          {error && (
            <div className="my-4">
              <ErrorText>{error}</ErrorText>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
