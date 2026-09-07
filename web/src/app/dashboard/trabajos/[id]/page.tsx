"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AnalisisFoto, Anexo, ItemChecklist, OrdenServicio, Trabajo, TipoTrabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { comprimirImagen } from "@/lib/comprimirImagen";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, PageHeader } from "@/components/ui";
import { IconCamera, IconChevronLeft, IconClipboardCheck } from "@/components/icons";

type TrabajoConTipo = Trabajo & { tipo_trabajo: TipoTrabajo | null };
type AnalisisFotoConUrl = AnalisisFoto & { url: string };
type OrdenConFirma = OrdenServicio & { firma_url_firmada: string | null };
type AnexoConUrl = Anexo & { url: string };

export default function TrabajoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const anexoInputRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [trabajo, setTrabajo] = useState<TrabajoConTipo | null>(null);
  const [orden, setOrden] = useState<OrdenConFirma | null>(null);
  const [fotos, setFotos] = useState<AnalisisFotoConUrl[]>([]);
  const [anexos, setAnexos] = useState<AnexoConUrl[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [subiendoAnexo, setSubiendoAnexo] = useState(false);
  const [borrandoFotoId, setBorrandoFotoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resTrabajo, resOrden, resFotos, resAnexos] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/trabajos/${params.id}`),
      apiFetch(`/api/trabajos/${params.id}/orden`),
      apiFetch(`/api/trabajos/${params.id}/fotos`),
      apiFetch(`/api/trabajos/${params.id}/anexos`),
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
    if (resAnexos.ok) setAnexos(await resAnexos.json());
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
    // foto_id estable: si apiFetch reintenta por timeout, el backend
    // devuelve la foto ya creada en vez de duplicarla.
    formData.append("foto_id", crypto.randomUUID());
    const res = await apiFetch(`/api/trabajos/${params.id}/fotos`, { method: "POST", body: formData });
    setSubiendo(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir la foto");
      return;
    }
    // El análisis con IA corre en segundo plano en el backend; refrescamos
    // un par de veces para traer el resumen cuando esté listo.
    cargar();
    setTimeout(cargar, 6000);
    setTimeout(cargar, 15000);
  }

  async function onEliminarFoto(fotoId: string) {
    if (!window.confirm("¿Eliminar esta foto? No se puede deshacer.")) return;
    setError(null);
    setBorrandoFotoId(fotoId);
    const res = await apiFetch(`/api/trabajos/${params.id}/fotos/${fotoId}`, { method: "DELETE" });
    setBorrandoFotoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo eliminar la foto");
      return;
    }
    cargar();
  }

  async function onSubirAnexo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(e.target.files ?? []);
    if (archivos.length === 0) return;
    setError(null);
    setSubiendoAnexo(true);
    const formData = new FormData();
    for (const a of archivos.slice(0, 5)) formData.append("anexos", a);
    const res = await apiFetch(`/api/trabajos/${params.id}/anexos`, { method: "POST", body: formData });
    setSubiendoAnexo(false);
    if (anexoInputRef.current) anexoInputRef.current.value = "";
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo subir el archivo");
      return;
    }
    cargar();
  }

  if (!usuario) return null;

  // Mismo criterio que el guard del backend (trabajoBloqueado): una vez
  // finalizada/firmada la OS, las fotos originales son inmutables.
  const osBloqueada = Boolean(orden?.finalizada_en);

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
            {osBloqueada ? (
              <p className="text-sm text-muted">
                La OS está firmada — estas son las fotos originales y no se pueden modificar.
              </p>
            ) : (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={onSubirFoto}
                  className="hidden"
                  id="input-foto"
                />
                <label htmlFor="input-foto">
                  <Button type="button" disabled={subiendo} className="cursor-pointer" onClick={() => inputRef.current?.click()}>
                    {subiendo ? "Subiendo foto…" : "Subir foto"}
                  </Button>
                </label>
                <p className="mt-2 text-xs text-muted">Para reemplazar una foto, eliminá la actual y subí la nueva.</p>
              </>
            )}
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
                  <div key={f.id} className="overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.url} alt={f.resumen ?? "Foto del trabajo"} className="h-48 w-full object-cover" />
                    <div className="p-3">
                      {f.alerta && <p className="mb-1 text-sm font-medium text-danger">⚠ {f.detalle_alerta}</p>}
                      <p className="text-sm text-muted">
                        {f.estado === "procesando"
                          ? "Analizando la foto…"
                          : f.estado === "error"
                            ? "No se pudo analizar automáticamente."
                            : f.resumen}
                      </p>
                      {!osBloqueada && (
                        <button
                          type="button"
                          onClick={() => onEliminarFoto(f.id)}
                          disabled={borrandoFotoId === f.id}
                          className="mt-2 text-xs font-medium text-danger hover:underline disabled:opacity-50"
                        >
                          {borrandoFotoId === f.id ? "Eliminando…" : "Eliminar"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(osBloqueada || anexos.length > 0) && (
            <Card className="my-6">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconCamera className="h-4 w-4 text-brand" />
                Fotos agregadas después del cierre
              </h2>
              <p className="mb-4 text-xs text-muted">
                Evidencia agregada después de firmar la OS. No reemplazan las fotos originales ni el PDF ya emitido.
              </p>
              {osBloqueada && (
                <>
                  <input
                    ref={anexoInputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={onSubirAnexo}
                    className="hidden"
                    id="input-anexo"
                  />
                  <label htmlFor="input-anexo">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={subiendoAnexo}
                      className="cursor-pointer"
                      onClick={() => anexoInputRef.current?.click()}
                    >
                      {subiendoAnexo ? "Subiendo…" : "Agregar archivo"}
                    </Button>
                  </label>
                </>
              )}

              {anexos.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Sin archivos agregados después del cierre.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {anexos.map((a) => (
                    <li key={a.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-brand hover:underline">
                        {a.nombre}
                      </a>
                      {a.creado_en && <span className="shrink-0 text-xs text-muted">{a.creado_en.slice(0, 10)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </>
      )}
    </DashboardShell>
  );
}
