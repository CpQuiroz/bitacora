"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import type { DetalleViajesCobro, EstadoFactura, Factura, MedioPago } from "@bitacora/shared";
import { abrirPdfCobro } from "@/lib/descargarPdf";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, DatePicker, Input, Select, StatusBadge, Textarea, useConfirmar, useToast, type TonoEstado } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { Modal } from "@/components/Modal";
import { PanelAcciones } from "@/components/PanelAcciones";

type ClienteInfo = { id: string; nombre: string; correo: string | null; telefono: string | null };
type CobroDetalle = Factura & { cliente_info: ClienteInfo | null; viajes?: DetalleViajesCobro };

const ESTADOS: EstadoFactura[] = ["pendiente", "pagada", "vencida"];
const MEDIOS_ETIQUETA: Record<MedioPago, string> = {
  webpay: "Webpay",
  flow: "Flow",
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  otro: "Otro",
};
// "pendiente" no está en MAPA_ESTADO_TONO (ambiguo a propósito).
const TONO_FORZADO: Partial<Record<EstadoFactura, TonoEstado>> = { pendiente: "en_progreso" };
const HOY = () => new Date().toISOString().slice(0, 10);

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function CobroDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [cobro, setCobro] = useState<CobroDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const confirmar = useConfirmar();

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const [pagoAbierto, setPagoAbierto] = useState(false);
  const [fechaPago, setFechaPago] = useState(HOY());
  const [valorRecibido, setValorRecibido] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago>("transferencia");
  const [observacionesPago, setObservacionesPago] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  // PDF del cobro desde viajes (tarea 134): período editable, por defecto
  // el primer y el último viaje.
  const [periodoDesde, setPeriodoDesde] = useState("");
  const [periodoHasta, setPeriodoHasta] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [errorPdf, setErrorPdf] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resCobro] = await Promise.all([apiFetch("/api/me"), apiFetch(`/api/cobros/${params.id}`)]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u)
        setUsuario({
          nombre: u.nombre,
          rol: u.rol,
          empresaNombre: u.empresa?.nombre ?? "",
          empresaLogoUrl: u.empresa?.logo_url ?? null,
          colorPrimario: u.empresa?.color_primario ?? null,
          tema: u.empresa?.tema ?? "faena",
          colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null,
          colorSecundario: u.empresa?.color_secundario ?? null,
          fuente: u.empresa?.fuente ?? null,
          moneda: u.empresa?.moneda ?? "CLP",
        });
    }
    if (!resCobro.ok) {
      setError("No se pudo cargar el cobro");
      return;
    }
    const cuerpo: CobroDetalle = await resCobro.json();
    setCobro(cuerpo);
    setPeriodoDesde(cuerpo.viajes?.periodo?.desde ?? "");
    setPeriodoHasta(cuerpo.viajes?.periodo?.hasta ?? "");
  }, [params.id, router]);

  async function descargarPdfCobro() {
    setErrorPdf(null);
    if (periodoDesde && periodoHasta && periodoDesde > periodoHasta) {
      setErrorPdf("La fecha de inicio no puede ser posterior a la de término.");
      return;
    }
    setGenerandoPdf(true);
    const r = await abrirPdfCobro(params.id, periodoDesde || undefined, periodoHasta || undefined);
    setGenerandoPdf(false);
    if (!r.ok) setErrorPdf(r.error);
  }

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(estado: EstadoFactura) {
    const res = await apiFetch(`/api/cobros/${params.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
    if (res.ok) {
      toast("Estado actualizado.", { tono: "exito" });
      cargar();
    } else {
      toast((await res.json().catch(() => ({}))).error ?? "No se pudo actualizar el estado", { tono: "error" });
    }
  }

  function abrirRegistrarPago() {
    setFechaPago(HOY());
    setValorRecibido(cobro ? String(cobro.monto) : "");
    setMedioPago("transferencia");
    setObservacionesPago("");
    setErrorPago(null);
    setPagoAbierto(true);
  }

  async function onRegistrarPago(e: FormEvent) {
    e.preventDefault();
    setErrorPago(null);
    setGuardandoPago(true);
    const res = await apiFetch(`/api/cobros/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        estado: "pagada",
        fecha_pago: fechaPago,
        valor_recibido: Number(valorRecibido) || 0,
        medio_pago: medioPago,
        observaciones_pago: observacionesPago || null,
      }),
    });
    setGuardandoPago(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorPago(body.error ?? "No se pudo registrar el pago");
      return;
    }
    setPagoAbierto(false);
    setPanelAbierto(false);
    toast("Pago registrado.", { tono: "exito" });
    cargar();
  }

  async function onEliminar() {
    if (!(await confirmar({ titulo: "¿Eliminar este cobro?", mensaje: "Esta acción no se puede deshacer.", accion: "Eliminar", destructivo: true }))) return;
    setErrorEliminar(null);
    setEliminando(true);
    const res = await apiFetch(`/api/cobros/${params.id}`, { method: "DELETE" });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorEliminar(body.error ?? "No se pudo eliminar el cobro");
      return;
    }
    router.push("/dashboard/financiero/cobros");
  }

  if (!usuario) return null;
  if (error) {
    return (
      <DashboardShell usuario={usuario}>
        <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p>
      </DashboardShell>
    );
  }
  if (!cobro) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/financiero/cobros" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Cobros
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">{formatMoneda(cobro.monto, usuario.moneda)}</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{cobro.cliente_info?.nombre ?? cobro.cliente}</p>
        </div>
        <div className="flex items-center gap-ds-2">
          <StatusBadge estado={cobro.estado} tonoForzado={TONO_FORZADO[cobro.estado]} />
          <Button variante="secundario" iconoIzq={<Settings size={16} strokeWidth={2.75} />} onPress={() => setPanelAbierto(true)}>
            Acciones
          </Button>
        </div>
      </div>


      <div className="my-ds-6 grid gap-ds-6 lg:grid-cols-2">
        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Cliente</p>
          <div className="flex flex-col gap-ds-1 font-ds-body text-ds-small">
            <p className="font-medium text-ds-text">{cobro.cliente_info?.nombre ?? cobro.cliente}</p>
            {cobro.cliente_info?.correo && <p className="text-ds-text/70">{cobro.cliente_info.correo}</p>}
            {cobro.cliente_info?.telefono && <p className="text-ds-text/70">{cobro.cliente_info.telefono}</p>}
          </div>
        </Card>

        <Card>
          <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Fechas y medio de pago</p>
          <div className="grid grid-cols-2 gap-ds-3 font-ds-body text-ds-small">
            <div>
              <p className="text-ds-caption text-ds-text-secondary">Emisión</p>
              <p className="text-ds-text">{cobro.fecha_emision}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text-secondary">Vencimiento</p>
              <p className="text-ds-text">{cobro.fecha_vencimiento}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text-secondary">Medio de pago</p>
              <p className="text-ds-text">{cobro.medio_pago ? MEDIOS_ETIQUETA[cobro.medio_pago] : "—"}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text-secondary">Fecha de pago</p>
              <p className="text-ds-text">{cobro.fecha_pago ?? "—"}</p>
            </div>
          </div>
        </Card>

        {/* Detalle por viaje (tarea 134): cobros generados desde viajes. */}
        {cobro.viajes && cobro.viajes.filas.length > 0 ? (
          <div className="lg:col-span-2">
            <Card>
              <div className="mb-ds-4 flex flex-wrap items-end justify-between gap-ds-3">
                <p className="font-ds-body text-ds-small font-semibold text-ds-text">
                  Detalle de viajes ({cobro.viajes.filas.length})
                </p>
                <div className="flex flex-wrap items-end gap-ds-2">
                  <label className="flex flex-col gap-1 font-ds-body text-ds-caption text-ds-text/70">
                    Período desde
                    <input
                      type="date"
                      value={periodoDesde}
                      onChange={(e) => setPeriodoDesde(e.target.value)}
                      className="rounded-ds-sm border border-ds-divider bg-ds-surface px-ds-2 py-1 font-ds-body text-ds-small text-ds-text"
                    />
                  </label>
                  <label className="flex flex-col gap-1 font-ds-body text-ds-caption text-ds-text/70">
                    hasta
                    <input
                      type="date"
                      value={periodoHasta}
                      onChange={(e) => setPeriodoHasta(e.target.value)}
                      className="rounded-ds-sm border border-ds-divider bg-ds-surface px-ds-2 py-1 font-ds-body text-ds-small text-ds-text"
                    />
                  </label>
                  <Button variante="secundario" onPress={() => void descargarPdfCobro()} cargando={generandoPdf}>
                    Descargar PDF
                  </Button>
                </div>
              </div>
              {errorPdf ? <p className="mb-ds-3 font-ds-body text-ds-small text-ds-accent-700">{errorPdf}</p> : null}
              <div className="overflow-x-auto">
                <table className="w-full font-ds-body text-ds-small">
                  <thead>
                    <tr className="border-b border-ds-divider text-left text-ds-caption uppercase tracking-wide text-ds-text-secondary">
                      <th className="px-ds-2 py-ds-2">N° guía</th>
                      <th className="px-ds-2 py-ds-2">Fecha</th>
                      <th className="px-ds-2 py-ds-2">Chofer</th>
                      <th className="px-ds-2 py-ds-2">Cliente</th>
                      <th className="px-ds-2 py-ds-2">Origen</th>
                      <th className="px-ds-2 py-ds-2">Destino</th>
                      <th className="px-ds-2 py-ds-2 text-right">Neto</th>
                      <th className="px-ds-2 py-ds-2 text-right">IVA</th>
                      <th className="px-ds-2 py-ds-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobro.viajes.filas.map((f) => (
                      <tr key={f.id} className="border-b border-ds-text/[0.06] text-ds-text last:border-0">
                        <td className="px-ds-2 py-ds-2">{f.numero_guia}</td>
                        <td className="px-ds-2 py-ds-2 tabular-nums text-ds-text/70">{f.fecha}</td>
                        <td className="px-ds-2 py-ds-2">{f.chofer ?? "—"}</td>
                        <td className="px-ds-2 py-ds-2">{f.cliente}</td>
                        <td className="px-ds-2 py-ds-2">{f.origen}</td>
                        <td className="px-ds-2 py-ds-2">
                          {f.destino}
                          {f.via?.length ? <span className="block font-ds-body text-ds-caption text-ds-text-secondary">vía {f.via.join(", ")}</span> : null}
                          {f.km != null ? <span className="block font-ds-body text-ds-caption text-ds-text-secondary tabular-nums">{f.km.toLocaleString("es-CL")} km</span> : null}
                        </td>
                        <td className="px-ds-2 py-ds-2 text-right tabular-nums">{formatMoneda(f.neto, usuario.moneda)}</td>
                        <td className="px-ds-2 py-ds-2 text-right tabular-nums">{formatMoneda(f.iva, usuario.moneda)}</td>
                        <td className="px-ds-2 py-ds-2 text-right tabular-nums">{formatMoneda(f.total, usuario.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ds-divider font-semibold text-ds-text">
                      <td className="px-ds-2 py-ds-2" colSpan={6}>
                        Totales
                      </td>
                      <td className="px-ds-2 py-ds-2 text-right tabular-nums">{formatMoneda(cobro.viajes.totales.neto, usuario.moneda)}</td>
                      <td className="px-ds-2 py-ds-2 text-right tabular-nums">{formatMoneda(cobro.viajes.totales.iva, usuario.moneda)}</td>
                      <td className="px-ds-2 py-ds-2 text-right tabular-nums">{formatMoneda(cobro.viajes.totales.total, usuario.moneda)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        ) : null}

        {cobro.estado === "pagada" && (cobro.valor_recibido != null || cobro.observaciones_pago) && (
          <div className="lg:col-span-2">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Registro de pago</p>
              <div className="grid gap-ds-3 font-ds-body text-ds-small sm:grid-cols-2">
                {cobro.valor_recibido != null && (
                  <div>
                    <p className="text-ds-caption text-ds-text-secondary">Valor recibido</p>
                    <p className="text-ds-text">{formatMoneda(cobro.valor_recibido, usuario.moneda)}</p>
                  </div>
                )}
                {cobro.observaciones_pago && (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text-secondary">Observaciones</p>
                    <p className="text-ds-text">{cobro.observaciones_pago}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      <PanelAcciones
        open={panelAbierto}
        onClose={() => setPanelAbierto(false)}
        titulo={formatMoneda(cobro.monto, usuario.moneda)}
        subtitulo={cobro.cliente_info?.nombre ?? cobro.cliente}
        seccionEstado={
          <div className="flex flex-col gap-ds-3">
            <Select valor={cobro.estado} onCambio={(v) => cambiarEstado(v as EstadoFactura)} opciones={ESTADOS.map((e) => ({ valor: e, etiqueta: e }))} />
            {cobro.estado !== "pagada" && (
              <Button variante="secundario" onPress={abrirRegistrarPago}>
                Marcar como Pagada
              </Button>
            )}
          </div>
        }
        seccionOtras={
          cobro.estado !== "pagada" ? (
            <Button variante="secundario" onPress={abrirRegistrarPago}>
              Registrar Pago
            </Button>
          ) : (
            <p className="font-ds-body text-ds-small text-ds-text/70">Este cobro ya está pagado.</p>
          )
        }
        seccionPeligro={
          cobro.estado !== "pagada" ? (
            <div className="flex flex-col gap-ds-2">
              <Button variante="peligro" onPress={onEliminar} cargando={eliminando}>
                Eliminar cobro
              </Button>
              {errorEliminar ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorEliminar}</p> : null}
            </div>
          ) : (
            <p className="font-ds-body text-ds-small text-ds-text/70">Ya fue pagado — no se puede eliminar.</p>
          )
        }
      />

      <Modal open={pagoAbierto} onClose={() => setPagoAbierto(false)} title="Registrar Pago">
        <form onSubmit={onRegistrarPago} className="flex flex-col gap-ds-4">
          <div>
            <p className="font-ds-body text-ds-caption font-medium text-ds-text/70">Valor original del cobro</p>
            <p className="font-ds-body text-ds-small text-ds-text">{formatMoneda(cobro.monto, usuario.moneda)}</p>
          </div>
          <DatePicker etiqueta="Fecha del pago" valor={aFecha(fechaPago)} onCambio={(f) => setFechaPago(aTexto(f))} />
          <div className="flex flex-col gap-ds-1">
            <label htmlFor="pago-valor-recibido" className="font-ds-body text-ds-caption font-medium text-ds-text/70">Valor recibido</label>
            <InputMonto id="pago-valor-recibido" required value={valorRecibido} onChange={setValorRecibido} moneda={usuario.moneda} />
          </div>
          <Select etiqueta="Forma de pago" valor={medioPago} onCambio={(v) => setMedioPago(v as MedioPago)} opciones={Object.entries(MEDIOS_ETIQUETA).map(([valor, etiqueta]) => ({ valor, etiqueta }))} />
          <Textarea etiqueta="Observaciones (opcional)" filas={2} valor={observacionesPago} onCambio={setObservacionesPago} />
          {errorPago ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorPago}</p> : null}
          <div className="flex gap-ds-2">
            <Button tipo="submit" cargando={guardandoPago}>
              Registrar pago
            </Button>
            <Button variante="ghost" onPress={() => setPagoAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}

// DatePicker (packages/ui) trabaja con Date, el estado de este archivo
// con texto ISO — mismo par de helpers que ya usa ordenes/page.tsx.
function aFecha(texto: string): Date | null {
  if (!texto) return null;
  const [y, m, d] = texto.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function aTexto(fecha: Date | null): string {
  if (!fecha) return "";
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  const d = String(fecha.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
