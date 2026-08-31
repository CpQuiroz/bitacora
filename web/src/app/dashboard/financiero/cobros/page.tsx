"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Cliente, EstadoFactura, Factura, MedioPago, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconPlus, IconReceipt } from "@/components/icons";
import { ComboboxCliente } from "@/components/ComboboxCliente";

type CobroConCliente = Factura & { cliente_info: { id: string; nombre: string } | null };

const MEDIOS_ETIQUETA: Record<MedioPago, string> = {
  webpay: "Webpay",
  flow: "Flow",
  mercadopago: "Mercado Pago",
  transferencia: "Transferencia",
  efectivo: "Efectivo",
  otro: "Otro",
};

const HOY = () => new Date().toISOString().slice(0, 10);

export default function CobrosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [cobros, setCobros] = useState<CobroConCliente[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoFactura>("todos");
  const [filtroClienteId, setFiltroClienteId] = useState("todos");
  const [filtroDesde, setFiltroDesde] = useState("");
  const [filtroHasta, setFiltroHasta] = useState("");

  const [formAbierto, setFormAbierto] = useState(false);
  const [modo, setModo] = useState<"manual" | "trabajos">("manual");
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [fechaEmision, setFechaEmision] = useState(() => HOY());
  const [fechaVencimiento, setFechaVencimiento] = useState("");
  const [medioPago, setMedioPago] = useState<MedioPago | "">("");

  const [clienteTexto, setClienteTexto] = useState("");
  const [semana, setSemana] = useState("");
  const [diasPlazo, setDiasPlazo] = useState("30");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resCobros, resClientes, resTrabajos] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/cobros"),
      apiFetch("/api/clientes"),
      apiFetch("/api/trabajos"),
    ]);
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
    if (resClientes.ok) setClientes(await resClientes.json());
    if (resTrabajos.ok) setTrabajos(await resTrabajos.json());
    if (!resCobros.ok) {
      setError("No se pudieron cargar los cobros");
      return;
    }
    setCobros(await resCobros.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bloque A — "+ Nuevo Cobro" en la Vista 360° del Cliente manda acá
  // con ?nuevo=1&cliente_id=X (Cobros no tiene una ruta "nueva" propia,
  // es un form inline) — abre el formulario ya con el cliente puesto.
  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    setModo("manual");
    setClienteId(searchParams.get("cliente_id") ?? "");
    setMonto("");
    setFechaEmision(HOY());
    setFechaVencimiento("");
    setMedioPago("");
    setFormError(null);
    setFormAbierto(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    setModo("manual");
    setClienteId("");
    setMonto("");
    setFechaEmision(HOY());
    setFechaVencimiento("");
    setMedioPago("");
    setClienteTexto("");
    setSemana("");
    setDiasPlazo("30");
    setSeleccionados(new Set());
    setFormError(null);
    setFormAbierto(true);
  }

  function toggleTrabajo(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    setGuardando(true);

    const res =
      modo === "manual"
        ? await apiFetch("/api/cobros", {
            method: "POST",
            body: JSON.stringify({
              cliente_id: clienteId,
              monto: Number(monto),
              fecha_emision: fechaEmision,
              fecha_vencimiento: fechaVencimiento,
              medio_pago: medioPago || null,
            }),
          })
        : await apiFetch("/api/cobros/desde-trabajos", {
            method: "POST",
            body: JSON.stringify({
              cliente: clienteTexto,
              semana,
              dias_plazo: Number(diasPlazo || 30),
              trabajo_ids: Array.from(seleccionados),
            }),
          });

    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear el cobro");
      return;
    }
    setAviso("Cobro creado.");
    setFormAbierto(false);
    cargar();
  }

  async function cambiarEstado(id: string, estado: EstadoFactura) {
    const res = await apiFetch(`/api/cobros/${id}`, { method: "PATCH", body: JSON.stringify({ estado }) });
    if (res.ok) cargar();
  }

  const [generandoLink, setGenerandoLink] = useState<string | null>(null);
  const [errorLink, setErrorLink] = useState<string | null>(null);

  async function generarLinkPago(id: string, proveedor: "webpay" | "flow" | "mercadopago") {
    setGenerandoLink(id);
    setErrorLink(null);
    const res = await apiFetch(`/api/cobros/${id}/generar-link-pago`, { method: "POST", body: JSON.stringify({ proveedor }) });
    setGenerandoLink(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorLink(body.error ?? "No se pudo generar el link de pago");
      return;
    }
    cargar();
  }

  if (!usuario) return null;

  const lista = cobros ?? [];
  const filtrados = lista.filter((c) => {
    const q = busqueda.trim().toLowerCase();
    if (q && !c.cliente.toLowerCase().includes(q)) return false;
    if (filtroEstado !== "todos" && c.estado !== filtroEstado) return false;
    if (filtroClienteId !== "todos" && c.cliente_info?.id !== filtroClienteId) return false;
    if (filtroDesde && c.fecha_emision < filtroDesde) return false;
    if (filtroHasta && c.fecha_emision > filtroHasta) return false;
    return true;
  });

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Cobros" subtitle="Gestiona tus cobros y da seguimiento a los pagos" />
        <Button type="button" onClick={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          <IconPlus className="h-4 w-4" />
          Nuevo Cobro
        </Button>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <div className="mb-4 flex gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => setModo("manual")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${modo === "manual" ? "border-b-2 border-brand text-brand" : "text-muted"}`}
            >
              Cobro manual
            </button>
            <button
              type="button"
              onClick={() => setModo("trabajos")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${modo === "trabajos" ? "border-b-2 border-brand text-brand" : "text-muted"}`}
            >
              Desde Órdenes de Trabajo/Servicio
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {modo === "manual" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Cliente</Label>
                  <ComboboxCliente
                    value={clienteId}
                    onChange={setClienteId}
                    clientes={clientes}
                    onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                    placeholder="Selecciona un cliente…"
                  />
                </div>
                <div>
                  <Label>Monto</Label>
                  <Input type="number" min="0" step="1" required value={monto} onChange={(e) => setMonto(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha de emisión</Label>
                  <Input type="date" required value={fechaEmision} onChange={(e) => setFechaEmision(e.target.value)} />
                </div>
                <div>
                  <Label>Fecha de vencimiento</Label>
                  <Input type="date" required value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
                </div>
                <div>
                  <Label>Medio de pago (opcional)</Label>
                  <Select value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)}>
                    <option value="">Sin definir</option>
                    {Object.entries(MEDIOS_ETIQUETA).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <Label>Cliente a facturar</Label>
                    <Input type="text" required value={clienteTexto} onChange={(e) => setClienteTexto(e.target.value)} />
                  </div>
                  <div>
                    <Label>Semana</Label>
                    <Input type="text" placeholder="ej: S33" value={semana} onChange={(e) => setSemana(e.target.value)} />
                  </div>
                </div>
                <div className="w-40">
                  <Label>Plazo de pago (días)</Label>
                  <Input type="number" min="1" value={diasPlazo} onChange={(e) => setDiasPlazo(e.target.value)} />
                </div>
                <div>
                  <Label>Órdenes de Trabajo/Servicio a incluir</Label>
                  {trabajos.length === 0 && <p className="text-sm text-muted">No hay trabajos todavía.</p>}
                  <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-2">
                    {trabajos.map((t) => (
                      <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-brand-soft">
                        <input type="checkbox" checked={seleccionados.has(t.id)} onChange={() => toggleTrabajo(t.id)} className="accent-brand" />
                        <span className="text-foreground">
                          {t.fecha} — {t.cliente}
                        </span>
                        <span className="text-muted">{formatMoneda(t.monto, usuario.moneda)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : "Crear Cobro"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setFormAbierto(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}
      {aviso && (
        <div className="mb-6">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input type="text" placeholder="Buscar cobros..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        <Button type="button" variant="outline" onClick={() => setFiltrosAbiertos((v) => !v)}>
          Filtros
        </Button>
      </div>

      {filtrosAbiertos && (
        <Card className="mb-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <Label>Estado</Label>
              <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)}>
                <option value="todos">Todos</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="vencida">Vencida</option>
              </Select>
            </div>
            <div>
              <Label>Cliente</Label>
              <Select value={filtroClienteId} onChange={(e) => setFiltroClienteId(e.target.value)}>
                <option value="todos">Todos</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Desde</Label>
              <Input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} />
            </div>
            <div>
              <Label>Hasta</Label>
              <Input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} />
            </div>
          </div>
        </Card>
      )}

      {error && <ErrorText>{error}</ErrorText>}
      {errorLink && (
        <div className="mb-4">
          <ErrorText>{errorLink}</ErrorText>
        </div>
      )}
      {cobros === null && !error && <p className="text-sm text-muted">Cargando…</p>}

      {cobros?.length === 0 && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <IconReceipt className="h-6 w-6" />
            </div>
            <p className="font-medium text-foreground">Ningún cobro encontrado</p>
            <p className="text-sm text-muted">Crea tu primer cobro para comenzar</p>
            <Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Crear Cobro
            </Button>
          </div>
        </Card>
      )}

      {cobros && cobros.length > 0 && filtrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <IconReceipt className="h-8 w-8 text-muted" />
          <p className="text-sm text-muted">Ningún cobro coincide con la búsqueda o los filtros.</p>
        </div>
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Medio de pago</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Emisión</th>
                <th className="px-5 py-3 font-medium">Pago</th>
                <th className="px-5 py-3 font-medium">Link de pago</th>
                <th className="px-5 py-3 font-medium">Cambiar estado</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-brand-soft/40">
                  <td className="px-5 py-3 font-medium text-foreground">{c.cliente}</td>
                  <td className="px-5 py-3">{formatMoneda(c.monto, usuario.moneda)}</td>
                  <td className="px-5 py-3 text-muted">{c.medio_pago ? MEDIOS_ETIQUETA[c.medio_pago] : "—"}</td>
                  <td className="px-5 py-3">
                    <Badge value={c.estado} />
                  </td>
                  <td className="px-5 py-3 text-muted">{c.fecha_emision}</td>
                  <td className="px-5 py-3 text-muted">{c.fecha_pago ?? "—"}</td>
                  <td className="px-5 py-3">
                    {c.link_pago ? (
                      <a href={c.link_pago} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-brand hover:underline">
                        Ver link (simulado)
                      </a>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(["webpay", "flow", "mercadopago"] as const).map((prov) => (
                          <button
                            key={prov}
                            type="button"
                            disabled={generandoLink === c.id}
                            onClick={() => generarLinkPago(c.id, prov)}
                            title="Genera un link simulado — no se conecta con la pasarela real todavía"
                            className="text-left text-xs font-medium text-muted hover:text-brand disabled:opacity-50"
                          >
                            Generar con {MEDIOS_ETIQUETA[prov]} (simulado)
                          </button>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Select value={c.estado} onChange={(e) => cambiarEstado(c.id, e.target.value as EstadoFactura)} className="w-32">
                      <option value="pendiente">Pendiente</option>
                      <option value="pagada">Pagada</option>
                      <option value="vencida">Vencida</option>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
