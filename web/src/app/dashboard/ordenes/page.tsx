"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardCheck, Plus, Receipt } from "lucide-react";
import type { Cliente, EstadoOS, OrdenServicio, Trabajo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { abrirPdfOS } from "@/lib/descargarPdf";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Combobox } from "@/components/Combobox";
import { Button, Card, Cifra, DatePicker, Dialog, Input, Select, StatusBadge, Table } from "@bitacora/ui/web";

type OrdenListado = Trabajo & {
  cliente_info: { nombre: string } | null;
  responsable: { nombre: string } | null;
  orden: OrdenServicio | null;
};

const ESTADOS_OS: EstadoOS[] = ["enviada", "en_proceso", "completada", "firmada", "cancelada"];

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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// Seam conocido: DashboardShell (sidebar/header) sigue Faena — no está en
// este bucket, lo usan ~38 pantallas más.
export default function OrdenesServicioPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipo, setEquipo] = useState<Usuario[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenListado[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [estadoOs, setEstadoOs] = useState("");
  // "Documento" = la OS tiene folio emitido. "sin documento" son los
  // trabajos rápidos que todavía no generaron una orden formal.
  const [documento, setDocumento] = useState<"" | "con" | "sin">("");
  const [responsableId, setResponsableId] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const claveCobro = useRef<string>(""); // idempotencia al generar el cobro
  const [semanaCobro, setSemanaCobro] = useState("");
  const [diasPlazoCobro, setDiasPlazoCobro] = useState("30");
  const [guardandoCobro, setGuardandoCobro] = useState(false);
  const [errorCobro, setErrorCobro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargarOrdenes = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (estadoOs) params.set("estado_os", estadoOs);
    if (responsableId) params.set("responsable_id", responsableId);
    if (clienteId) params.set("cliente_id", clienteId);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);

    const res = await apiFetch(`/api/ordenes-servicio?${params.toString()}`);
    if (!res.ok) {
      setError("No se pudieron cargar las órdenes de servicio");
      return;
    }
    setOrdenes(await res.json());
  }, [estadoOs, responsableId, clienteId, desde, hasta]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resEquipo, resClientes] = await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/usuarios"),
        apiFetch("/api/clientes"),
      ]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) setUsuario({ nombre: u.nombre, rol: u.rol, empresaNombre: u.empresa?.nombre ?? "", empresaLogoUrl: u.empresa?.logo_url ?? null, colorPrimario: u.empresa?.color_primario ?? null, colorPrimarioForeground: u.empresa?.color_primario_foreground ?? null, colorSecundario: u.empresa?.color_secundario ?? null, fuente: u.empresa?.fuente ?? null, moneda: u.empresa?.moneda ?? "CLP" });
      }
      if (resEquipo.ok) setEquipo(await resEquipo.json());
      if (resClientes.ok) setClientes(await resClientes.json());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarOrdenes();
  }, [cargarOrdenes]);

  function toggleSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const ordenesFiltradas = (ordenes ?? []).filter((o) => {
    if (documento === "con") return o.orden?.folio != null;
    if (documento === "sin") return o.orden?.folio == null;
    return true;
  });

  function toggleSeleccionTodos() {
    setSeleccionados((prev) =>
      prev.size === ordenesFiltradas.length ? new Set() : new Set(ordenesFiltradas.map((o) => o.id))
    );
  }

  const ordenesSeleccionadas = (ordenes ?? []).filter((o) => seleccionados.has(o.id));
  const nombresClientesSeleccion = new Set(ordenesSeleccionadas.map((o) => o.cliente_info?.nombre ?? o.cliente));
  const montoTotalSeleccion = ordenesSeleccionadas.reduce((acc, o) => acc + o.monto, 0);

  function abrirModalCobro() {
    setSemanaCobro("");
    setDiasPlazoCobro("30");
    setErrorCobro(null);
    setModalCobroAbierto(true);
  }

  async function generarCobro() {
    if (nombresClientesSeleccion.size !== 1) {
      setErrorCobro("Las OS seleccionadas deben ser todas del mismo cliente.");
      return;
    }
    setErrorCobro(null);
    setGuardandoCobro(true);
    if (!claveCobro.current) claveCobro.current = crypto.randomUUID();
    const res = await apiFetch("/api/cobros/desde-trabajos", {
      method: "POST",
      idempotencyKey: claveCobro.current,
      body: JSON.stringify({
        cliente: [...nombresClientesSeleccion][0],
        semana: semanaCobro,
        dias_plazo: Number(diasPlazoCobro || 30),
        trabajo_ids: [...seleccionados],
      }),
    });
    setGuardandoCobro(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorCobro(body.error ?? "No se pudo generar el cobro");
      return;
    }
    claveCobro.current = "";
    setModalCobroAbierto(false);
    setSeleccionados(new Set());
    setAviso("Cobro generado a partir de las OS seleccionadas.");
    cargarOrdenes();
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <p className="ds-heading flex items-center gap-ds-2 text-ds-h2 text-ds-text">
          <ClipboardCheck size={24} strokeWidth={2.75} className="text-ds-brand" />
          Órdenes de servicio
        </p>
        <Link href="/dashboard/ordenes/nueva">
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />}>Nueva OS</Button>
        </Link>
      </div>

      <div className="mb-ds-6">
        <Card>
          <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-6">
            <Select
              etiqueta="Documento"
              valor={documento}
              onCambio={(v) => setDocumento(v as "" | "con" | "sin")}
              opciones={[
                { valor: "", etiqueta: "Todas" },
                { valor: "con", etiqueta: "Con documento" },
                { valor: "sin", etiqueta: "Sin documento" },
              ]}
            />
            <Select
              etiqueta="Estado"
              valor={estadoOs}
              onCambio={setEstadoOs}
              opciones={[{ valor: "", etiqueta: "Todos" }, ...ESTADOS_OS.map((e) => ({ valor: e, etiqueta: e.replace("_", " ") }))]}
            />
            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Colaborador</label>
              <Combobox
                value={responsableId}
                onChange={setResponsableId}
                opciones={[{ id: "", label: "Todos" }, ...equipo.map((u) => ({ id: u.id, label: u.nombre }))]}
                placeholder="Todos"
              />
            </div>
            <div className="flex flex-col gap-ds-1">
              <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
              <Combobox
                value={clienteId}
                onChange={setClienteId}
                opciones={[{ id: "", label: "Todos" }, ...clientes.map((c) => ({ id: c.id, label: c.nombre }))]}
                placeholder="Todos"
              />
            </div>
            <DatePicker etiqueta="Desde" valor={aFecha(desde)} onCambio={(f) => setDesde(aTexto(f))} />
            <DatePicker etiqueta="Hasta" valor={aFecha(hasta)} onCambio={(f) => setHasta(aTexto(f))} />
          </div>
        </Card>
      </div>

      {aviso ? <p className="mb-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      {seleccionados.size > 0 ? (
        <div className="mb-ds-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-ds-3">
              <p className="font-ds-body text-ds-small text-ds-text">
                {seleccionados.size} OS seleccionada{seleccionados.size === 1 ? "" : "s"} —{" "}
                <Cifra>{formatMoneda(montoTotalSeleccion, usuario.moneda)}</Cifra>
              </p>
              <div className="flex gap-ds-2">
                <Button variante="ghost" onPress={() => setSeleccionados(new Set())}>
                  Limpiar selección
                </Button>
                <Button onPress={abrirModalCobro} iconoIzq={<Receipt size={16} strokeWidth={2.75} />}>
                  Generar Cobro
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      <Table<OrdenListado>
        cargando={ordenes === null && !error}
        error={error}
        onReintentar={cargarOrdenes}
        onFilaClick={(o) => router.push(`/dashboard/ordenes/${o.id}`)}
        filas={ordenesFiltradas}
        claveFila={(o) => o.id}
        vacio={{ icono: <ClipboardCheck size={28} strokeWidth={2.75} />, titulo: "No hay órdenes de servicio con estos filtros" }}
        columnas={[
          {
            encabezado: (
              <input
                type="checkbox"
                checked={seleccionados.size > 0 && seleccionados.size === ordenesFiltradas.length}
                onChange={toggleSeleccionTodos}
                className="accent-[var(--ds-brand)]"
                aria-label="Seleccionar todas"
              />
            ),
            celda: (o) => (
              <input
                type="checkbox"
                checked={seleccionados.has(o.id)}
                onChange={() => toggleSeleccion(o.id)}
                onClick={(e) => e.stopPropagation()}
                className="accent-[var(--ds-brand)]"
                aria-label={`Seleccionar OS de ${o.cliente_info?.nombre ?? o.cliente}`}
              />
            ),
          },
          { encabezado: "Folio", celda: (o) => (o.orden?.folio != null ? <Cifra>{`N° ${o.orden.folio}`}</Cifra> : "—") },
          { encabezado: "Cliente", celda: (o) => o.cliente_info?.nombre ?? o.cliente },
          { encabezado: "Colaborador", celda: (o) => o.responsable?.nombre ?? "—" },
          {
            encabezado: "Fecha",
            celda: (o) => <Cifra>{`${o.fecha}${o.hora_programada ? ` ${o.hora_programada}` : ""}`}</Cifra>,
          },
          { encabezado: "Estado", celda: (o) => <StatusBadge estado={o.orden?.estado_os ?? "pendiente"} /> },
          {
            encabezado: "PDF",
            celda: (o) =>
              o.orden?.estado_os === "firmada" ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    abrirPdfOS(o.id);
                  }}
                  className="font-ds-body font-medium text-ds-brand hover:underline"
                >
                  Ver PDF
                </button>
              ) : (
                <span className="text-ds-text/50">—</span>
              ),
          },
        ]}
      />

      <Dialog abierto={modalCobroAbierto} onCerrar={() => setModalCobroAbierto(false)} titulo="Generar Cobro">
        <div className="flex flex-col gap-ds-4">
          <p className="font-ds-body text-ds-small text-ds-text/70">
            Se agruparán {seleccionados.size} OS de <strong className="text-ds-text">{[...nombresClientesSeleccion].join(", ")}</strong> por un
            total de <Cifra>{formatMoneda(montoTotalSeleccion, usuario.moneda)}</Cifra>.
          </p>
          {nombresClientesSeleccion.size > 1 ? (
            <p className="font-ds-body text-ds-small text-ds-accent-700">
              Las OS seleccionadas deben ser todas del mismo cliente — ajusta la selección.
            </p>
          ) : null}
          <div className="grid gap-ds-4 sm:grid-cols-2">
            <Input etiqueta="Semana (opcional)" placeholder="ej: S33" valor={semanaCobro} onCambio={setSemanaCobro} />
            <Input etiqueta="Plazo de pago (días)" tipo="numero" valor={diasPlazoCobro} onCambio={setDiasPlazoCobro} />
          </div>
          {errorCobro ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorCobro}</p> : null}
          <div className="flex gap-ds-2">
            <Button onPress={generarCobro} deshabilitado={guardandoCobro || nombresClientesSeleccion.size !== 1} cargando={guardandoCobro}>
              Generar Cobro
            </Button>
            <Button variante="ghost" onPress={() => setModalCobroAbierto(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Dialog>
    </DashboardShell>
  );
}
