"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Settings } from "lucide-react";
import type { EstadoFactura, Factura, MedioPago } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Input, Select, StatusBadge, Textarea, type TonoEstado } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { Modal } from "@/components/Modal";
import { PanelAcciones } from "@/components/PanelAcciones";

type ClienteInfo = { id: string; nombre: string; correo: string | null; telefono: string | null };
type CobroDetalle = Factura & { cliente_info: ClienteInfo | null };

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
  const [aviso, setAviso] = useState<string | null>(null);

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
    setCobro(await resCobro.json());
  }, [params.id, router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(estado: EstadoFactura) {
    const res = await apiFetch(`/api/cobros/${params.id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
    if (res.ok) {
      setAviso("Estado actualizado.");
      cargar();
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
    setAviso("Pago registrado.");
    cargar();
  }

  async function onEliminar() {
    if (!confirm("¿Eliminar este cobro? Esta acción no se puede deshacer.")) return;
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

      {aviso ? <p className="my-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

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
              <p className="text-ds-caption text-ds-text/60">Emisión</p>
              <p className="text-ds-text">{cobro.fecha_emision}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text/60">Vencimiento</p>
              <p className="text-ds-text">{cobro.fecha_vencimiento}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text/60">Medio de pago</p>
              <p className="text-ds-text">{cobro.medio_pago ? MEDIOS_ETIQUETA[cobro.medio_pago] : "—"}</p>
            </div>
            <div>
              <p className="text-ds-caption text-ds-text/60">Fecha de pago</p>
              <p className="text-ds-text">{cobro.fecha_pago ?? "—"}</p>
            </div>
          </div>
        </Card>

        {cobro.estado === "pagada" && (cobro.valor_recibido != null || cobro.observaciones_pago) && (
          <div className="lg:col-span-2">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Registro de pago</p>
              <div className="grid gap-ds-3 font-ds-body text-ds-small sm:grid-cols-2">
                {cobro.valor_recibido != null && (
                  <div>
                    <p className="text-ds-caption text-ds-text/60">Valor recibido</p>
                    <p className="text-ds-text">{formatMoneda(cobro.valor_recibido, usuario.moneda)}</p>
                  </div>
                )}
                {cobro.observaciones_pago && (
                  <div className="sm:col-span-2">
                    <p className="text-ds-caption text-ds-text/60">Observaciones</p>
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
          <FechaCampo etiqueta="Fecha del pago" requerido valor={fechaPago} onCambio={setFechaPago} />
          <div className="flex flex-col gap-ds-1">
            <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Valor recibido</label>
            <InputMonto required value={valorRecibido} onChange={setValorRecibido} moneda={usuario.moneda} />
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

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio, requerido }: { etiqueta: string; valor: string; onCambio: (v: string) => void; requerido?: boolean }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        required={requerido}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
