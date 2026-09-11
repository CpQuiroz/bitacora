"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Mail, Plus, Settings, Share2 } from "lucide-react";
import type { Cliente, EstadoPresupuesto, Presupuesto, PresupuestoItem } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { abrirPdfCotizacion, urlCompartirPdfCotizacion } from "@/lib/descargarPdf";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Input, Select, StatusBadge } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";
import { PanelAcciones } from "@/components/PanelAcciones";

type ClienteInfo = Pick<Cliente, "id" | "nombre" | "correo" | "telefono" | "direccion">;
type CotizacionDetalle = Presupuesto & { cliente_info: ClienteInfo | null; items: PresupuestoItem[]; os_folio: number | null };
type Linea = { catalogo_item_id: string | null; descripcion: string; cantidad: string; precio_unitario: string };

const ESTADOS: EstadoPresupuesto[] = ["borrador", "enviado", "aprobado", "rechazado"];
const IVA_TASA = 0.19;

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
        <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      </DashboardShell>
    );
  }
  if (!cotizacion) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/financiero/cotizaciones" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Cotizaciones
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">
            {cotizacion.numero != null ? `Cotización N° ${String(cotizacion.numero).padStart(4, "0")}` : "Cotización"}
          </p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{cotizacion.cliente_info?.nombre ?? "—"}</p>
        </div>
        <div className="flex items-center gap-ds-2">
          <StatusBadge estado={cotizacion.estado} tonoForzado={cotizacion.estado === "borrador" || cotizacion.estado === "enviado" ? "en_progreso" : undefined} />
          <Button variante="secundario" iconoIzq={<Settings size={16} strokeWidth={2.75} />} onPress={() => setPanelAbierto(true)}>
            Acciones
          </Button>
        </div>
      </div>

      {aviso ? <p className="my-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="my-ds-6 grid gap-ds-6 lg:grid-cols-3">
        <div className="flex flex-col gap-ds-6 lg:col-span-2">
          {editando ? (
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Editar cotización</p>

              <div className="grid gap-ds-4 sm:grid-cols-2">
                <FechaCampo etiqueta="Fecha de vencimiento (opcional)" valor={fechaVencEdit} onCambio={setFechaVencEdit} />
                <div className="sm:col-span-2">
                  <Input etiqueta="Descripción (opcional)" valor={descEdit} onCambio={setDescEdit} />
                </div>
              </div>

              <div className="mt-ds-5 flex flex-col gap-ds-3">
                {lineasEdit.map((l, idx) => (
                  <div key={idx} className="grid items-end gap-ds-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                    <Input etiqueta={idx === 0 ? "Descripción" : undefined} requerido valor={l.descripcion} onCambio={(v) => cambiarLineaEdit(idx, { descripcion: v })} />
                    <Input etiqueta={idx === 0 ? "Cantidad" : undefined} tipo="numero" requerido valor={l.cantidad} onCambio={(v) => cambiarLineaEdit(idx, { cantidad: v })} />
                    <div className="flex flex-col gap-ds-1">
                      {idx === 0 && <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Precio unitario</label>}
                      <InputMonto required value={l.precio_unitario} onChange={(v) => cambiarLineaEdit(idx, { precio_unitario: v })} moneda={usuario.moneda} />
                    </div>
                    <Button variante="ghost" onPress={() => quitarLineaEdit(idx)} deshabilitado={lineasEdit.length === 1}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-ds-4">
                <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => setSelectorAbiertoEdit(true)}>
                  Agregar del catálogo
                </Button>
              </div>

              <CatalogoSelectorModal open={selectorAbiertoEdit} onClose={() => setSelectorAbiertoEdit(false)} onAgregar={onAgregarDesdeSelectorEdit} moneda={usuario.moneda ?? "CLP"} />

              <div className="mt-ds-6 flex flex-col items-end gap-ds-1 border-t border-ds-divider pt-ds-4 font-ds-body text-ds-small">
                <div className="flex w-56 justify-between">
                  <span className="text-ds-text/60">Subtotal</span>
                  <span className="text-ds-text">{formatMoneda(totalesEdit.subtotal, usuario.moneda)}</span>
                </div>
                <div className="flex w-56 justify-between">
                  <span className="text-ds-text/60">IVA (19%)</span>
                  <span className="text-ds-text">{formatMoneda(totalesEdit.iva, usuario.moneda)}</span>
                </div>
                <div className="flex w-56 justify-between text-ds-body font-semibold">
                  <span className="text-ds-text">Total</span>
                  <span className="text-ds-text">{formatMoneda(totalesEdit.total, usuario.moneda)}</span>
                </div>
              </div>

              {errorEdit ? <p className="mt-ds-4 font-ds-body text-ds-small text-ds-accent-700">{errorEdit}</p> : null}
              <div className="mt-ds-4 flex gap-ds-2">
                <Button onPress={guardarEdicion} cargando={guardandoEdit}>
                  Guardar cambios
                </Button>
                <Button variante="ghost" onPress={() => setEditando(false)}>
                  Cancelar
                </Button>
              </div>
            </Card>
          ) : (
            <>
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ítems</p>
                {cotizacion.items.length === 0 ? (
                  <p className="font-ds-body text-ds-small text-ds-text/70">Sin ítems.</p>
                ) : (
                  <table className="w-full text-left text-ds-body">
                    <thead>
                      <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                        <th className="py-ds-2">Descripción</th>
                        <th className="py-ds-2">Cantidad</th>
                        <th className="py-ds-2">Precio unitario</th>
                        <th className="py-ds-2 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotizacion.items.map((it) => (
                        <tr key={it.id} className="border-b border-ds-text/[0.08] last:border-0">
                          <td className="py-2.5 text-ds-text">{it.descripcion}</td>
                          <td className="py-2.5 text-ds-text/70">{it.cantidad}</td>
                          <td className="py-2.5 text-ds-text/70">{formatMoneda(it.precio_unitario, usuario.moneda)}</td>
                          <td className="py-2.5 text-right text-ds-text">{formatMoneda(it.cantidad * it.precio_unitario, usuario.moneda)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <div className="mt-ds-6 flex flex-col items-end gap-ds-1 border-t border-ds-divider pt-ds-4 font-ds-body text-ds-small">
                  <div className="flex w-56 justify-between">
                    <span className="text-ds-text/60">Subtotal</span>
                    <span className="text-ds-text">{formatMoneda(cotizacion.subtotal ?? 0, usuario.moneda)}</span>
                  </div>
                  <div className="flex w-56 justify-between">
                    <span className="text-ds-text/60">IVA (19%)</span>
                    <span className="text-ds-text">{formatMoneda(cotizacion.iva ?? 0, usuario.moneda)}</span>
                  </div>
                  <div className="flex w-56 justify-between text-ds-body font-semibold">
                    <span className="text-ds-text">Total</span>
                    <span className="text-ds-text">{formatMoneda(cotizacion.monto, usuario.moneda)}</span>
                  </div>
                </div>
              </Card>

              {cotizacion.descripcion && (
                <Card>
                  <p className="mb-ds-2 font-ds-body text-ds-small font-semibold text-ds-text">Descripción</p>
                  <p className="font-ds-body text-ds-small text-ds-text/70">{cotizacion.descripcion}</p>
                </Card>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Cliente</p>
            <div className="flex flex-col gap-ds-2 font-ds-body text-ds-small">
              <p className="font-medium text-ds-text">{cotizacion.cliente_info?.nombre ?? "—"}</p>
              {cotizacion.cliente_info?.correo && <p className="text-ds-text/70">{cotizacion.cliente_info.correo}</p>}
              {cotizacion.cliente_info?.telefono && <p className="text-ds-text/70">{cotizacion.cliente_info.telefono}</p>}
              {cotizacion.cliente_info?.direccion && <p className="text-ds-text/70">{cotizacion.cliente_info.direccion}</p>}
            </div>
          </Card>

          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Estado</p>
            <div className="grid gap-ds-2 font-ds-body text-ds-small">
              <div>
                <p className="text-ds-caption text-ds-text/60">Fecha de creación</p>
                <p className="text-ds-text">{cotizacion.fecha}</p>
              </div>
              <div>
                <p className="text-ds-caption text-ds-text/60">Fecha de vencimiento</p>
                <p className="text-ds-text">{cotizacion.fecha_vencimiento ?? "—"}</p>
              </div>
            </div>
          </Card>

          <Card>
            <p className="mb-ds-3 font-ds-body text-ds-small font-semibold text-ds-text">Orden de Servicio</p>
            {cotizacion.trabajo_id ? (
              <div className="flex flex-col gap-ds-2">
                <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">
                  {folioGenerado != null || cotizacion.os_folio != null
                    ? `Convertida en OS N° ${folioGenerado ?? cotizacion.os_folio}.`
                    : "Esta cotización ya fue convertida en una OS."}
                </p>
                <Link href={`/dashboard/ordenes/${cotizacion.trabajo_id}`} className="font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
                  Ver orden de servicio →
                </Link>
              </div>
            ) : cotizacion.estado === "aprobado" ? (
              <>
                <p className="mb-ds-3 font-ds-body text-ds-small text-ds-text/70">La cotización está aprobada — puedes convertirla en una orden de servicio real.</p>
                <Button onPress={convertirAOs} cargando={convirtiendo}>
                  Convertir a OS
                </Button>
                {errorConversion ? <p className="mt-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorConversion}</p> : null}
              </>
            ) : (
              <p className="font-ds-body text-ds-small text-ds-text/70">Aprueba la cotización para poder convertirla en una orden de servicio.</p>
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
          <div className="flex flex-col gap-ds-3">
            <Select valor={cotizacion.estado} onCambio={(v) => cambiarEstado(v as EstadoPresupuesto)} opciones={ESTADOS.map((e) => ({ valor: e, etiqueta: e }))} />
            {cotizacion.estado === "borrador" && (
              <Button variante="secundario" onPress={() => cambiarEstado("enviado")}>
                Marcar como Enviado
              </Button>
            )}
          </div>
        }
        seccionCompartir={
          <div className="flex flex-col gap-ds-3">
            <div className="flex flex-wrap gap-ds-2">
              <Button onPress={onDescargarPdf} cargando={descargando}>
                Descargar PDF
              </Button>
              <Button variante="secundario" iconoIzq={<Share2 size={16} strokeWidth={2.75} />} onPress={onCompartirWhatsapp} cargando={compartiendo}>
                WhatsApp
              </Button>
            </div>
            <form onSubmit={onEnviarEmail} className="flex flex-col gap-ds-2">
              <label className="flex items-center gap-1 font-ds-body text-ds-caption font-medium text-ds-text/70">
                <Mail size={14} strokeWidth={2.75} /> Enviar por email
              </label>
              <div className="flex items-end gap-ds-2">
                <div className="flex-1">
                  <Input tipo="email" placeholder={cotizacion.cliente_info?.correo || "correo@cliente.cl"} valor={email} onCambio={setEmail} />
                </div>
                <Button tipo="submit" variante="secundario" deshabilitado={enviando || !email.trim()} cargando={enviando}>
                  Enviar
                </Button>
              </div>
            </form>
            {avisoEnvio ? <p className="font-ds-body text-ds-small font-medium text-ds-accent2-800">{avisoEnvio}</p> : null}
            {errorEnvio ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorEnvio}</p> : null}
            {errorCompartir ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorCompartir}</p> : null}
          </div>
        }
        seccionOtras={
          !cotizacion.trabajo_id ? (
            <Button
              variante="secundario"
              onPress={() => {
                setPanelAbierto(false);
                abrirEdicion();
              }}
            >
              Editar
            </Button>
          ) : (
            <p className="font-ds-body text-ds-small text-ds-text/70">Ya fue convertida en OS — no se puede editar.</p>
          )
        }
        seccionPeligro={
          !cotizacion.trabajo_id ? (
            <div className="flex flex-col gap-ds-2">
              <Button variante="peligro" onPress={onEliminar} cargando={eliminando}>
                Eliminar cotización
              </Button>
              {errorEliminar ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorEliminar}</p> : null}
            </div>
          ) : (
            <p className="font-ds-body text-ds-small text-ds-text/70">Ya fue convertida en OS — no se puede eliminar.</p>
          )
        }
      />
    </DashboardShell>
  );
}

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
