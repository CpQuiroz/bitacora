"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { EstadoFactura, Factura, MedioPago } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { PanelAcciones } from "@/components/PanelAcciones";
import { IconChevronLeft, IconSettings } from "@/components/icons";

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
const HOY = () => new Date().toISOString().slice(0, 10);

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
        <ErrorText>{error}</ErrorText>
      </DashboardShell>
    );
  }
  if (!cobro) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/financiero/cobros" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Cobros
      </Link>

      <PageHeader
        title={formatMoneda(cobro.monto, usuario.moneda)}
        subtitle={cobro.cliente_info?.nombre ?? cobro.cliente}
        action={
          <div className="flex items-center gap-2">
            <Badge value={cobro.estado} />
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

      <div className="my-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Cliente</h2>
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-medium text-foreground">{cobro.cliente_info?.nombre ?? cobro.cliente}</p>
            {cobro.cliente_info?.correo && <p className="text-muted">{cobro.cliente_info.correo}</p>}
            {cobro.cliente_info?.telefono && <p className="text-muted">{cobro.cliente_info.telefono}</p>}
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-sm font-semibold text-foreground">Fechas y medio de pago</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <Label>Emisión</Label>
              <p className="text-foreground">{cobro.fecha_emision}</p>
            </div>
            <div>
              <Label>Vencimiento</Label>
              <p className="text-foreground">{cobro.fecha_vencimiento}</p>
            </div>
            <div>
              <Label>Medio de pago</Label>
              <p className="text-foreground">{cobro.medio_pago ? MEDIOS_ETIQUETA[cobro.medio_pago] : "—"}</p>
            </div>
            <div>
              <Label>Fecha de pago</Label>
              <p className="text-foreground">{cobro.fecha_pago ?? "—"}</p>
            </div>
          </div>
        </Card>

        {cobro.estado === "pagada" && (cobro.valor_recibido != null || cobro.observaciones_pago) && (
          <Card className="lg:col-span-2">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Registro de pago</h2>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {cobro.valor_recibido != null && (
                <div>
                  <Label>Valor recibido</Label>
                  <p className="text-foreground">{formatMoneda(cobro.valor_recibido, usuario.moneda)}</p>
                </div>
              )}
              {cobro.observaciones_pago && (
                <div className="sm:col-span-2">
                  <Label>Observaciones</Label>
                  <p className="text-foreground">{cobro.observaciones_pago}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      <PanelAcciones
        open={panelAbierto}
        onClose={() => setPanelAbierto(false)}
        titulo={formatMoneda(cobro.monto, usuario.moneda)}
        subtitulo={cobro.cliente_info?.nombre ?? cobro.cliente}
        seccionEstado={
          <div className="flex flex-col gap-3">
            <Select value={cobro.estado} onChange={(e) => cambiarEstado(e.target.value as EstadoFactura)}>
              {ESTADOS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </Select>
            {cobro.estado !== "pagada" && (
              <Button type="button" variant="outline" onClick={abrirRegistrarPago}>
                Marcar como Pagada
              </Button>
            )}
          </div>
        }
        seccionOtras={
          cobro.estado !== "pagada" ? (
            <Button type="button" variant="outline" onClick={abrirRegistrarPago}>
              Registrar Pago
            </Button>
          ) : (
            <p className="text-sm text-muted">Este cobro ya está pagado.</p>
          )
        }
        seccionPeligro={
          cobro.estado !== "pagada" ? (
            <div className="flex flex-col gap-2">
              <Button type="button" variant="danger" onClick={onEliminar} disabled={eliminando}>
                {eliminando ? "Eliminando…" : "Eliminar cobro"}
              </Button>
              {errorEliminar && <ErrorText>{errorEliminar}</ErrorText>}
            </div>
          ) : (
            <p className="text-sm text-muted">Ya fue pagado — no se puede eliminar.</p>
          )
        }
      />

      <Modal open={pagoAbierto} onClose={() => setPagoAbierto(false)} title="Registrar Pago">
        <form onSubmit={onRegistrarPago} className="flex flex-col gap-4">
          <div>
            <Label>Valor original del cobro</Label>
            <p className="text-sm text-foreground">{formatMoneda(cobro.monto, usuario.moneda)}</p>
          </div>
          <div>
            <Label>Fecha del pago</Label>
            <Input type="date" required value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
          </div>
          <div>
            <Label>Valor recibido</Label>
            <Input type="number" min="0" step="1" required value={valorRecibido} onChange={(e) => setValorRecibido(e.target.value)} />
          </div>
          <div>
            <Label>Forma de pago</Label>
            <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
              {Object.entries(MEDIOS_ETIQUETA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Observaciones (opcional)</Label>
            <Textarea rows={2} value={observacionesPago} onChange={(e) => setObservacionesPago(e.target.value)} />
          </div>
          {errorPago && <ErrorText>{errorPago}</ErrorText>}
          <div className="flex gap-2">
            <Button type="submit" disabled={guardandoPago}>
              {guardandoPago ? "Guardando…" : "Registrar pago"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPagoAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Modal>
    </DashboardShell>
  );
}
