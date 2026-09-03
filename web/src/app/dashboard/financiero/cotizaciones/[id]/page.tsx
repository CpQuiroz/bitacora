"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Cliente, EstadoPresupuesto, Presupuesto, PresupuestoItem } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { abrirPdfCotizacion, urlCompartirPdfCotizacion } from "@/lib/descargarPdf";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconChevronLeft, IconMail, IconMessageShare, IconPlus, IconSettings } from "@/components/icons";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { PanelAcciones } from "@/components/PanelAcciones";

type ClienteInfo = Pick<Cliente, "id" | "nombre" | "correo" | "telefono" | "direccion">;
type CotizacionDetalle = Presupuesto & { cliente_info: ClienteInfo | null; items: PresupuestoItem[]; os_folio: number | null };
type Linea = { catalogo_item_id: string | null; descripcion: string; cantidad: string; precio_unitario: string };

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aprobado", "rechazado"];
const IVA_TASA = 0.19;

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
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [panelAbierto, setPanelAbierto] = useState(false);

  const [descargando, setDescargando] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [errorCompartir, setErrorCompartir] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [avisoEnvio, setAvisoEnvio] = useState<string | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [descEdit, setDescEdit] = useState("");
  const [fechaVencEdit, setFechaVencEdit] = useState("");
  const [lineasEdit, setLineasEdit] = useState<Linea[]>([]);
  const [guardandoEdit, setGuardandoEdit] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);
  const [selectorAbiertoEdit, setSelectorAbiertoEdit] = useState(false);

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
    const detalle: CotizacionDetalle = await resCotizacion.json();
    setCotizacion(detalle);
    setEmail((actual) => actual || detalle.cliente_info?.correo || "");
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

  function abrirEdicion() {
    if (!cotizacion) return;
    setDescEdit(cotizacion.descripcion ?? "");
    setFechaVencEdit(cotizacion.fecha_vencimiento ?? "");
    setLineasEdit(
      cotizacion.items.length > 0
        ? cotizacion.items.map((it) => ({
            catalogo_item_id: it.catalogo_item_id ?? null,
            descripcion: it.descripcion,
            cantidad: String(it.cantidad),
            precio_unitario: String(it.precio_unitario),
          }))
        : [{ catalogo_item_id: null, descripcion: "", cantidad: "1", precio_unitario: "0" }]
    );
    setErrorEdit(null);
    setEditando(true);
  }

  function quitarLineaEdit(idx: number) {
    setLineasEdit((v) => v.filter((_, i) => i !== idx));
  }
  function onAgregarDesdeSelectorEdit(items: ItemSeleccionadoCatalogo[]) {
    setLineasEdit((v) => [
      ...v,
      ...items.map((item) => ({
        catalogo_item_id: item.catalogo_item_id,
        descripcion: item.descripcion,
        cantidad: String(item.cantidad),
        precio_unitario: String(item.precio_unitario),
      })),
    ]);
  }
  function cambiarLineaEdit(idx: number, cambios: Partial<Linea>) {
    setLineasEdit((v) => v.map((l, i) => (i === idx ? { ...l, ...cambios } : l)));
  }

  const totalesEdit = useMemo(() => {
    const sub = lineasEdit.reduce((acc, l) => acc + (Number(l.cantidad) || 0) * (Number(l.precio_unitario) || 0), 0);
    const iva = Math.round(sub * IVA_TASA);
    return { subtotal: Math.round(sub), iva, total: Math.round(sub) + iva };
  }, [lineasEdit]);

  async function guardarEdicion() {
    setErrorEdit(null);
    const lineasValidas = lineasEdit.filter((l) => l.descripcion.trim());
    if (lineasValidas.length === 0) {
      setErrorEdit("Agrega al menos un ítem");
      return;
    }
    setGuardandoEdit(true);
    const res = await apiFetch(`/api/cotizaciones/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        descripcion: descEdit,
        fecha_vencimiento: fechaVencEdit || null,
        items: lineasValidas.map((l) => ({
          catalogo_item_id: l.catalogo_item_id,
          descripcion: l.descripcion,
          cantidad: Number(l.cantidad),
          precio_unitario: Number(l.precio_unitario),
        })),
      }),
    });
    setGuardandoEdit(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEdit(body.error ?? "No se pudo guardar la cotización");
      return;
    }
    setEditando(false);
    setAviso("Cotización actualizada.");
    cargar();
  }

  async function onDescargarPdf() {
    setDescargando(true);
    await abrirPdfCotizacion(params.id);
    setDescargando(false);
  }

  async function onCompartirWhatsapp() {
    if (!cotizacion) return;
    setErrorCompartir(null);
    setCompartiendo(true);
    const url = await urlCompartirPdfCotizacion(params.id);
    setCompartiendo(false);
    if (!url) {
      setErrorCompartir("No se pudo generar el link para compartir");
      return;
    }
    const numeroTexto = cotizacion.numero != null ? `N° ${String(cotizacion.numero).padStart(4, "0")} ` : "";
    const saludo = cotizacion.cliente_info?.nombre ? `Hola ${cotizacion.cliente_info.nombre}, te` : "Te";
    const mensaje = `${saludo} comparto la cotización ${numeroTexto}de ${usuario?.empresaNombre ?? ""} por ${formatMoneda(cotizacion.monto, usuario?.moneda)}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, "_blank");
  }

  async function onEnviarEmail(e: FormEvent) {
    e.preventDefault();
    setAvisoEnvio(null);
    setErrorEnvio(null);
    if (!email.trim()) return;
    setEnviando(true);
    const res = await apiFetch(`/api/cotizaciones/${params.id}/pdf/enviar`, {
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

  async function onEliminar() {
    if (!confirm("¿Eliminar esta cotización? Esta acción no se puede deshacer.")) return;
    setErrorEliminar(null);
    setEliminando(true);
    const res = await apiFetch(`/api/cotizaciones/${params.id}`, { method: "DELETE" });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminar(body.error ?? "No se pudo eliminar la cotización");
      return;
    }
    router.push("/dashboard/financiero/cotizaciones");
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

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/financiero/cotizaciones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Cotizaciones
      </Link>

      <PageHeader
        title={cotizacion.numero != null ? `Cotización N° ${String(cotizacion.numero).padStart(4, "0")}` : "Cotización"}
        subtitle={cotizacion.cliente_info?.nombre ?? "—"}
        action={
          <div className="flex items-center gap-2">
            <Badge value={cotizacion.estado} />
            <Button type="button" variant="outline" onClick={() => setPanelAbierto(true)}>
              <IconSettings className="h-4 w-4" />
              Acciones
            </Button>
          </div>
        }
      />

      {aviso && (
        <div className="my-4">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="my-6 grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {editando ? (
            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Editar cotización</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Fecha de vencimiento (opcional)</Label>
                  <Input type="date" value={fechaVencEdit} onChange={(e) => setFechaVencEdit(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Descripción (opcional)</Label>
                  <Input type="text" value={descEdit} onChange={(e) => setDescEdit(e.target.value)} />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3">
                {lineasEdit.map((l, idx) => (
                  <div key={idx} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <div>
                      {idx === 0 && <Label>Descripción</Label>}
                      <Input type="text" required value={l.descripcion} onChange={(e) => cambiarLineaEdit(idx, { descripcion: e.target.value })} />
                    </div>
                    <div>
                      {idx === 0 && <Label>Cantidad</Label>}
                      <Input type="number" min="0.01" step="0.01" required value={l.cantidad} onChange={(e) => cambiarLineaEdit(idx, { cantidad: e.target.value })} />
                    </div>
                    <div>
                      {idx === 0 && <Label>Precio unitario</Label>}
                      <Input type="number" min="0" step="1" required value={l.precio_unitario} onChange={(e) => cambiarLineaEdit(idx, { precio_unitario: e.target.value })} />
                    </div>
                    <Button type="button" variant="ghost" onClick={() => quitarLineaEdit(idx)} disabled={lineasEdit.length === 1}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" onClick={() => setSelectorAbiertoEdit(true)} className="mt-4">
                <IconPlus className="h-4 w-4" />
                Agregar del catálogo
              </Button>

              <CatalogoSelectorModal
                open={selectorAbiertoEdit}
                onClose={() => setSelectorAbiertoEdit(false)}
                onAgregar={onAgregarDesdeSelectorEdit}
                moneda={usuario.moneda ?? "CLP"}
              />

              <div className="mt-6 flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
                <div className="flex w-56 justify-between">
                  <span className="text-muted">Subtotal</span>
                  <span className="text-foreground">{formatMoneda(totalesEdit.subtotal, usuario.moneda)}</span>
                </div>
                <div className="flex w-56 justify-between">
                  <span className="text-muted">IVA (19%)</span>
                  <span className="text-foreground">{formatMoneda(totalesEdit.iva, usuario.moneda)}</span>
                </div>
                <div className="flex w-56 justify-between text-base font-semibold">
                  <span className="text-foreground">Total</span>
                  <span className="text-foreground">{formatMoneda(totalesEdit.total, usuario.moneda)}</span>
                </div>
              </div>

              {errorEdit && (
                <div className="mt-4">
                  <ErrorText>{errorEdit}</ErrorText>
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <Button type="button" onClick={guardarEdicion} disabled={guardandoEdit}>
                  {guardandoEdit ? "Guardando…" : "Guardar cambios"}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground">Ítems</h2>
                </div>
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

            </>
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
            <div className="grid gap-2 text-sm">
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
                <SuccessText>
                  {folioGenerado != null || cotizacion.os_folio != null
                    ? `Convertida en OS N° ${folioGenerado ?? cotizacion.os_folio}.`
                    : "Esta cotización ya fue convertida en una OS."}
                </SuccessText>
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

      <PanelAcciones
        open={panelAbierto}
        onClose={() => setPanelAbierto(false)}
        titulo={cotizacion.numero != null ? `Cotización N° ${String(cotizacion.numero).padStart(4, "0")}` : "Cotización"}
        subtitulo={cotizacion.cliente_info?.nombre ?? undefined}
        seccionEstado={
          <div className="flex flex-col gap-3">
            <Select value={cotizacion.estado} onChange={(e) => cambiarEstado(e.target.value as EstadoPresupuesto)}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            {cotizacion.estado === "borrador" && (
              <Button type="button" variant="outline" onClick={() => cambiarEstado("enviado")}>
                Marcar como Enviado
              </Button>
            )}
          </div>
        }
        seccionCompartir={
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={onDescargarPdf} disabled={descargando}>
                {descargando ? "Generando…" : "Descargar PDF"}
              </Button>
              <Button type="button" variant="outline" onClick={onCompartirWhatsapp} disabled={compartiendo}>
                <IconMessageShare className="h-4 w-4" />
                {compartiendo ? "Generando link…" : "WhatsApp"}
              </Button>
            </div>
            <form onSubmit={onEnviarEmail} className="flex flex-col gap-2">
              <Label className="flex items-center gap-1">
                <IconMail className="h-3.5 w-3.5" /> Enviar por email
              </Label>
              <div className="flex items-end gap-2">
                <Input
                  type="email"
                  placeholder={cotizacion.cliente_info?.correo || "correo@cliente.cl"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" variant="outline" disabled={enviando || !email.trim()}>
                  {enviando ? "Enviando…" : "Enviar"}
                </Button>
              </div>
            </form>
            {avisoEnvio && <SuccessText>{avisoEnvio}</SuccessText>}
            {errorEnvio && <ErrorText>{errorEnvio}</ErrorText>}
            {errorCompartir && <ErrorText>{errorCompartir}</ErrorText>}
          </div>
        }
        seccionOtras={
          !cotizacion.trabajo_id ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPanelAbierto(false);
                abrirEdicion();
              }}
            >
              Editar
            </Button>
          ) : (
            <p className="text-sm text-muted">Ya fue convertida en OS — no se puede editar.</p>
          )
        }
        seccionPeligro={
          !cotizacion.trabajo_id ? (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="danger" onClick={onEliminar} disabled={eliminando}>
                {eliminando ? "Eliminando…" : "Eliminar cotización"}
              </Button>
              {errorEliminar && <ErrorText>{errorEliminar}</ErrorText>}
            </div>
          ) : (
            <p className="text-sm text-muted">Ya fue convertida en OS — no se puede eliminar.</p>
          )
        }
      />
    </DashboardShell>
  );
}
