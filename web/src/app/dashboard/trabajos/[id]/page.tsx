"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { AnalisisFoto, Anexo, ItemChecklist, OrdenServicio, Trabajo, TipoOsTrabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch, exigirOk } from "@/lib/api";
import { Aviso, Button, Card, StatusBadge, useDeshacer } from "@bitacora/ui/web";
import { comprimirImagen } from "@/lib/comprimirImagen";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { PageHeader } from "@/components/PageHeader";
import { IconCamera, IconChevronLeft, IconClipboardCheck } from "@/components/icons";
import { useOcultos } from "@/lib/useOcultos";

type TrabajoConTipo = Trabajo & { tipo: TipoOsTrabajo | null };
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
  const conDeshacer = useDeshacer();
  const ocultos = useOcultos();

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
      if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, tema: u.empresa?.tema ?? "faena", colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
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

  function onEliminarFoto(foto: AnalisisFotoConUrl) {
    conDeshacer({
      mensaje: "Foto eliminada",
      ocultar: () => ocultos.ocultar(foto.id),
      restaurar: () => ocultos.mostrar(foto.id),
      ejecutar: async () => exigirOk(await apiFetch(`/api/trabajos/${params.id}/fotos/${foto.id}`, { method: "DELETE" }), "No se pudo eliminar la foto"),
      alTerminar: () => void cargar().then(() => ocultos.mostrar(foto.id)),
    });
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
      <Link href="/dashboard/trabajos" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Trabajos
      </Link>

      {error && !trabajo && <Aviso tono="error">{error}</Aviso>}

      {trabajo && (
        <>
          <PageHeader
            title={trabajo.cliente}
            subtitle={`${trabajo.fecha} · $${trabajo.monto.toLocaleString("es-CL")}${trabajo.ubicacion ? ` · ${trabajo.ubicacion}` : ""}`}
            action={<StatusBadge estado={trabajo.estado} />}
          />

          <div className="my-ds-6">
            <Card>
              <h2 className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                <IconClipboardCheck className="h-4 w-4 text-ds-brand" />
                Orden de servicio
              </h2>
              {(() => {
                const checklist: ItemChecklist[] = orden?.checklist ?? [];
                const checkIn = checklist.find((c) => c.item === "Check-in");
                const checkOut = checklist.find((c) => c.item === "Check-out");
                return (
                  <div className="grid gap-ds-4 sm:grid-cols-3">
                    <div>
                      <p className="font-ds-body text-ds-caption text-ds-text-secondary">Check-in</p>
                      <p className="font-ds-body text-ds-small font-medium text-ds-text">
                        {checkIn?.hecho ? `✓ ${checkIn.hora?.slice(11, 16) ?? ""}` : "Pendiente"}
                      </p>
                    </div>
                    <div>
                      <p className="font-ds-body text-ds-caption text-ds-text-secondary">Check-out</p>
                      <p className="font-ds-body text-ds-small font-medium text-ds-text">
                        {checkOut?.hecho ? `✓ ${checkOut.hora?.slice(11, 16) ?? ""}` : "Pendiente"}
                      </p>
                    </div>
                    <div>
                      <p className="font-ds-body text-ds-caption text-ds-text-secondary">Firma del cliente o encargado</p>
                      {orden?.firma_url_firmada ? (
                        // URL firmada (vence) — sin optimizer, con lazy-load igual.
                        <Image
                          src={orden.firma_url_firmada}
                          alt="Firma del cliente o encargado"
                          width={160}
                          height={40}
                          unoptimized
                          className="mt-ds-1 h-10 w-auto rounded-ds-sm border border-ds-divider bg-white"
                        />
                      ) : (
                        <p className="font-ds-body text-ds-small font-medium text-ds-text-secondary">Pendiente</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </Card>
          </div>

          <div className="my-ds-6">
            <Card>
              <h2 className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                <IconCamera className="h-4 w-4 text-ds-brand" />
                Fotos
              </h2>
              {osBloqueada ? (
                <p className="font-ds-body text-ds-small text-ds-text-secondary">
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
                  <Button deshabilitado={subiendo} onPress={() => inputRef.current?.click()}>
                    {subiendo ? "Subiendo foto…" : "Subir foto"}
                  </Button>
                  <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text-secondary">Para reemplazar una foto, eliminá la actual y subí la nueva.</p>
                </>
              )}
              {error && (
                <div className="mt-ds-3">
                  <Aviso tono="error">{error}</Aviso>
                </div>
              )}

              {ocultos.filtrar(fotos).length === 0 ? (
                <p className="mt-ds-4 font-ds-body text-ds-small text-ds-text-secondary">Todavía no hay fotos de este trabajo.</p>
              ) : (
                <div className="mt-ds-4 grid gap-ds-4 sm:grid-cols-2">
                  {ocultos.filtrar(fotos).map((f) => (
                    <div key={f.id} className="overflow-hidden rounded-ds-md border border-ds-divider">
                      <div className="relative h-48 w-full">
                        {/* URL firmada (vence) — sin optimizer, con lazy-load igual. */}
                        <Image src={f.url} alt={f.resumen ?? "Foto del trabajo"} fill unoptimized className="object-cover" />
                      </div>
                      <div className="p-ds-3">
                        {f.alerta && <p className="mb-ds-1 font-ds-body text-ds-small font-medium text-ds-danger">⚠ {f.detalle_alerta}</p>}
                        <p className="font-ds-body text-ds-small text-ds-text-secondary">
                          {f.estado === "procesando"
                            ? "Analizando la foto…"
                            : f.estado === "error"
                              ? "No se pudo analizar automáticamente."
                              : f.resumen}
                        </p>
                        {!osBloqueada && (
                          <div className="mt-ds-2">
                            <Button variante="peligro" tamano="sm" onPress={() => onEliminarFoto(f)}>
                              Eliminar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {(osBloqueada || anexos.length > 0) && (
            <div className="my-ds-6">
              <Card>
                <h2 className="mb-ds-1 flex items-center gap-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">
                  <IconCamera className="h-4 w-4 text-ds-brand" />
                  Fotos agregadas después del cierre
                </h2>
                <p className="mb-ds-4 font-ds-body text-ds-caption text-ds-text-secondary">
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
                    <Button variante="secundario" deshabilitado={subiendoAnexo} onPress={() => anexoInputRef.current?.click()}>
                      {subiendoAnexo ? "Subiendo…" : "Agregar archivo"}
                    </Button>
                  </>
                )}

                {anexos.length === 0 ? (
                  <p className="mt-ds-4 font-ds-body text-ds-small text-ds-text-secondary">Sin archivos agregados después del cierre.</p>
                ) : (
                  <ul className="mt-ds-4 divide-y divide-ds-divider">
                    {anexos.map((a) => (
                      <li key={a.key} className="flex items-center justify-between gap-ds-3 py-ds-2 font-ds-body text-ds-small">
                        <a href={a.url} target="_blank" rel="noopener noreferrer" className="truncate font-medium text-ds-brand hover:underline">
                          {a.nombre}
                        </a>
                        {a.creado_en && <span className="shrink-0 text-ds-caption text-ds-text-secondary">{a.creado_en.slice(0, 10)}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
