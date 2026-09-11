"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import type { Cliente, EstadoFactura, Factura, MedioPago, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, Cifra, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge, type TonoEstado } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { Combobox } from "@/components/Combobox";

type CobroConCliente = Factura & { cliente_info: { id: string; nombre: string } | null };

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
function CobrosContenido() {
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

  // Clave de idempotencia: se genera una vez por intento de creación y
  // se mantiene si el request falla y se reintenta (así el backend NUNCA
  // duplica el cobro); se resetea al lograr crear uno.
  const claveIdempotencia = useRef<string>("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    setGuardando(true);

    if (!claveIdempotencia.current) claveIdempotencia.current = crypto.randomUUID();
    const idempotencyKey = claveIdempotencia.current;

    const res =
      modo === "manual"
        ? await apiFetch("/api/cobros", {
            method: "POST",
            idempotencyKey,
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
            idempotencyKey,
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
    claveIdempotencia.current = ""; // cobro creado — el próximo usa clave nueva
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
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Cobros</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Gestiona tus cobros y da seguimiento a los pagos</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          Nuevo Cobro
        </Button>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <div className="mb-ds-4 flex gap-ds-1 border-b border-ds-divider">
              <button
                type="button"
                onClick={() => setModo("manual")}
                className={`px-ds-4 py-2 font-ds-body text-ds-small font-medium transition-colors ${modo === "manual" ? "border-b-2 border-ds-brand text-ds-brand" : "text-ds-text/60"}`}
              >
                Cobro manual
              </button>
              <button
                type="button"
                onClick={() => setModo("trabajos")}
                className={`px-ds-4 py-2 font-ds-body text-ds-small font-medium transition-colors ${modo === "trabajos" ? "border-b-2 border-ds-brand text-ds-brand" : "text-ds-text/60"}`}
              >
                Desde Órdenes de Trabajo/Servicio
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              {modo === "manual" ? (
                <div className="grid gap-ds-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-ds-1">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                    <ComboboxCliente value={clienteId} onChange={setClienteId} clientes={clientes} onClienteCreado={(c) => setClientes((prev) => [...prev, c])} placeholder="Selecciona un cliente…" />
                  </div>
                  <div className="flex flex-col gap-ds-1">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto</label>
                    <InputMonto required value={monto} onChange={setMonto} moneda={usuario.moneda} />
                  </div>
                  <FechaCampo etiqueta="Fecha de emisión" requerido valor={fechaEmision} onCambio={setFechaEmision} />
                  <FechaCampo etiqueta="Fecha de vencimiento" requerido valor={fechaVencimiento} onCambio={setFechaVencimiento} />
                  <Select
                    etiqueta="Medio de pago (opcional)"
                    valor={medioPago}
                    onCambio={(v) => setMedioPago(v as MedioPago)}
                    opciones={[{ valor: "", etiqueta: "Sin definir" }, ...Object.entries(MEDIOS_ETIQUETA).map(([valor, etiqueta]) => ({ valor, etiqueta }))]}
                  />
                </div>
              ) : (
                <>
                  <div className="grid gap-ds-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Input etiqueta="Cliente a facturar" requerido valor={clienteTexto} onCambio={setClienteTexto} />
                    </div>
                    <Input etiqueta="Semana" placeholder="ej: S33" valor={semana} onCambio={setSemana} />
                  </div>
                  <div className="w-40">
                    <Input etiqueta="Plazo de pago (días)" tipo="numero" valor={diasPlazo} onCambio={setDiasPlazo} />
                  </div>
                  <div className="flex flex-col gap-ds-1">
                    <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Órdenes de Trabajo/Servicio a incluir</label>
                    {trabajos.length === 0 && <p className="font-ds-body text-ds-small text-ds-text/70">No hay trabajos todavía.</p>}
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-ds-md border border-ds-divider p-ds-2">
                      {trabajos.map((t) => (
                        <label key={t.id} className="flex cursor-pointer items-center gap-2.5 rounded-ds-md px-ds-2 py-1.5 font-ds-body text-ds-small hover:bg-ds-brand/[0.08]">
                          <input type="checkbox" checked={seleccionados.has(t.id)} onChange={() => toggleTrabajo(t.id)} className="accent-[var(--ds-brand)]" />
                          <span className="text-ds-text">
                            {t.fecha} — {t.cliente}
                          </span>
                          <span className="text-ds-text/60">{formatMoneda(t.monto, usuario.moneda)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  Crear Cobro
                </Button>
                <Button variante="ghost" onPress={() => setFormAbierto(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {aviso ? <p className="mb-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="mb-ds-4 flex flex-wrap items-center gap-ds-3">
        <div className="max-w-sm">
          <Input placeholder="Buscar cobros..." valor={busqueda} onCambio={setBusqueda} />
        </div>
        <Button variante="secundario" onPress={() => setFiltrosAbiertos((v) => !v)}>
          Filtros
        </Button>
      </div>

      {filtrosAbiertos && (
        <div className="mb-ds-4">
          <Card>
            <div className="grid gap-ds-4 sm:grid-cols-4">
              <Select
                etiqueta="Estado"
                valor={filtroEstado}
                onCambio={(v) => setFiltroEstado(v as typeof filtroEstado)}
                opciones={[
                  { valor: "todos", etiqueta: "Todos" },
                  { valor: "pendiente", etiqueta: "Pendiente" },
                  { valor: "pagada", etiqueta: "Pagada" },
                  { valor: "vencida", etiqueta: "Vencida" },
                ]}
              />
              <div className="flex flex-col gap-ds-1">
                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                <Combobox
                  value={filtroClienteId}
                  onChange={setFiltroClienteId}
                  opciones={[{ id: "todos", label: "Todos" }, ...clientes.map((c) => ({ id: c.id, label: c.nombre }))]}
                  placeholder="Todos"
                />
              </div>
              <FechaCampo etiqueta="Desde" valor={filtroDesde} onCambio={setFiltroDesde} />
              <FechaCampo etiqueta="Hasta" valor={filtroHasta} onCambio={setFiltroHasta} />
            </div>
          </Card>
        </div>
      )}

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {errorLink ? <p className="mb-ds-4 font-ds-body text-ds-small text-ds-accent-700">{errorLink}</p> : null}
      {cobros === null && !error ? <LoadingState /> : null}

      {cobros?.length === 0 && (
        <EmptyState
          icono={<Receipt size={28} strokeWidth={2.75} />}
          titulo="Ningún cobro encontrado"
          mensaje="Crea tu primer cobro para comenzar."
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Crear Cobro
            </Button>
          }
        />
      )}

      {cobros && cobros.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<Receipt size={28} strokeWidth={2.75} />} titulo="Ningún cobro coincide con la búsqueda o los filtros" />
      )}

      {filtrados.length > 0 && (
        <Card sinRelleno elevacion="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-ds-body">
              <thead>
                <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                  <th className="px-ds-4 py-ds-3">Cliente</th>
                  <th className="px-ds-4 py-ds-3 text-right">Monto</th>
                  <th className="px-ds-4 py-ds-3">Medio de pago</th>
                  <th className="px-ds-4 py-ds-3">Estado</th>
                  <th className="px-ds-4 py-ds-3">Emisión</th>
                  <th className="px-ds-4 py-ds-3">Pago</th>
                  <th className="px-ds-4 py-ds-3">Link de pago</th>
                  <th className="px-ds-4 py-ds-3">Cambiar estado</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} className="border-b border-ds-text/[0.08] last:border-0 hover:bg-ds-text/[0.04]">
                    <td className="px-ds-4 py-ds-3 font-medium text-ds-text">
                      <Link href={`/dashboard/financiero/cobros/${c.id}`} className="hover:text-ds-brand hover:underline">
                        {c.cliente}
                      </Link>
                    </td>
                    <td className="px-ds-4 py-ds-3 text-right"><Cifra>{formatMoneda(c.monto, usuario.moneda)}</Cifra></td>
                    <td className="px-ds-4 py-ds-3 text-ds-text/70">{c.medio_pago ? MEDIOS_ETIQUETA[c.medio_pago] : "—"}</td>
                    <td className="px-ds-4 py-ds-3">
                      <StatusBadge estado={c.estado} tonoForzado={TONO_FORZADO[c.estado]} />
                    </td>
                    <td className="px-ds-4 py-ds-3 text-ds-text/70">{c.fecha_emision}</td>
                    <td className="px-ds-4 py-ds-3 text-ds-text/70">{c.fecha_pago ?? "—"}</td>
                    <td className="px-ds-4 py-ds-3">
                      {c.link_pago ? (
                        <a href={c.link_pago} target="_blank" rel="noopener noreferrer" className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
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
                              className="text-left font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand disabled:opacity-50"
                            >
                              Generar con {MEDIOS_ETIQUETA[prov]} (simulado)
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-ds-4 py-ds-3">
                      <Select
                        valor={c.estado}
                        onCambio={(v) => cambiarEstado(c.id, v as EstadoFactura)}
                        opciones={[
                          { valor: "pendiente", etiqueta: "Pendiente" },
                          { valor: "pagada", etiqueta: "Pagada" },
                          { valor: "vencida", etiqueta: "Vencida" },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
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

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function CobrosPage() {
  return (
    <Suspense fallback={null}>
      <CobrosContenido />
    </Suspense>
  );
}
