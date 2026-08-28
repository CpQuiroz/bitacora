"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AnalisisFoto, ItemChecklist, OrdenServicio, Trabajo, TipoTrabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { comprimirImagen } from "@/lib/comprimirImagen";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, PageHeader } from "@/components/ui";
import { IconCamera, IconChevronLeft, IconClipboardCheck } from "@/components/icons";

type TrabajoConTipo = Trabajo & { tipo_trabajo: TipoTrabajo | null };
type AnalisisFotoConUrl = AnalisisFoto & { url: string };
type OrdenConFirma = OrdenServicio & { firma_url_firmada: string | null };

export default function TrabajoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [trabajo, setTrabajo] = useState<TrabajoConTipo | null>(null);
  const [orden, setOrden] = useState<OrdenConFirma | null>(null);
  const [fotos, setFotos] = useState<AnalisisFotoConUrl[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resTrabajo, resOrden, resFotos] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/trabajos/${params.id}`),
      apiFetch(`/api/trabajos/${params.id}/orden`),
      apiFetch(`/api/trabajos/${params.id}/fotos`),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
    }
    if (!resTrabajo.ok) {
      setError("No se pudo cargar el trabajo");
      return;
    }
    setTrabajo(await resTrabajo.json());
    if (resOrden.ok) setOrden(await resOrden.json());
    if (resFotos.ok) setFotos(await resFotos.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function onSubirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    const comprimida = await comprimirImagen(archivo);
    const formData = new FormData();
    formData.append("foto", comprimida);
    const res = await apiFetch(`/api/trabajos/${params.id}/fotos`, { method: "POST", body: formData });
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir la foto");
      return;
    }
    cargar();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/trabajos" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Trabajos
      </Link>

      {error && !trabajo && <ErrorText>{error}</ErrorText>}

      {trabajo && (
        <>
          <PageHeader
            title={trabajo.cliente}
            subtitle={`${trabajo.fecha} · $${trabajo.monto.toLocaleString("es-CL")}${trabajo.ubicacion ? ` · ${trabajo.ubicacion}` : ""}`}
            action={<Badge value={trabajo.estado} />}
          />

          <Card className="my-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconClipboardCheck className="h-4 w-4 text-brand" />
              Orden de servicio
            </h2>
            {(() => {
              const checklist: ItemChecklist[] = orden?.checklist ?? [];
              const checkIn = checklist.find((c) => c.item === "Check-in");
              const checkOut = checklist.find((c) => c.item === "Check-out");
              return (
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-muted">Check-in</p>
                    <p className="text-sm font-medium text-foreground">
                      {checkIn?.hecho ? `✓ ${checkIn.hora?.slice(11, 16) ?? ""}` : "Pendiente"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Check-out</p>
                    <p className="text-sm font-medium text-foreground">
                      {checkOut?.hecho ? `✓ ${checkOut.hora?.slice(11, 16) ?? ""}` : "Pendiente"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Firma del cliente</p>
                    {orden?.firma_url_firmada ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={orden.firma_url_firmada}
                        alt="Firma del cliente"
                        className="mt-1 h-10 rounded border border-border bg-white"
                      />
                    ) : (
                      <p className="text-sm font-medium text-muted">Pendiente</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </Card>

          <Card className="my-6">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <IconCamera className="h-4 w-4 text-brand" />
              Fotos
            </h2>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onSubirFoto}
              className="hidden"
              id="input-foto"
            />
            <label htmlFor="input-foto">
              <Button
                type="button"
                disabled={subiendo}
                className="cursor-pointer"
                onClick={() => inputRef.current?.click()}
              >
                {subiendo ? "Subiendo y analizando…" : "Subir foto"}
              </Button>
            </label>
            {error && (
              <div className="mt-3">
                <ErrorText>{error}</ErrorText>
              </div>
            )}

            {fotos.length === 0 ? (
              <p className="mt-4 text-sm text-muted">Todavía no hay fotos de este trabajo.</p>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {fotos.map((f) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div key={f.id} className="overflow-hidden rounded-xl border border-border">
                    <img src={f.url} alt={f.resumen ?? "Foto del trabajo"} className="h-48 w-full object-cover" />
                    <div className="p-3">
                      {f.alerta && (
                        <p className="mb-1 text-sm font-medium text-danger">⚠ {f.detalle_alerta}</p>
                      )}
                      <p className="text-sm text-muted">{f.resumen}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </DashboardShell>
  );
}
