"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Truck } from "lucide-react";
import type { Cliente, EstadoViaje, Usuario, Viaje } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";

type ViajeConDatos = Viaje & {
  cliente_info: Pick<Cliente, "id" | "nombre"> | null;
  chofer: Pick<Usuario, "id" | "nombre"> | null;
};

type Resumen = {
  clave: string;
  cantidad_viajes: number;
  subtotal: number;
  iva: number;
  total: number;
  km_total: number;
};

const HOY = () => new Date().toISOString().slice(0, 10);

function km(v: Viaje) {
  if (v.km_inicial == null || v.km_final == null) return null;
  return Math.max(0, v.km_final - v.km_inicial);
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// La tabla de viajes tiene una fila de edición inline expandible (2do
// <tr> con un form completo, ver editId) — el primitivo <Table> no
// soporta filas expandibles, así que sigue siendo un <table> a mano,
// con las mismas clases que usa <Table> internamente.
export default function ViajesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [viajes, setViajes] = useState<ViajeConDatos[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [choferes, setChoferes] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [agrupacion, setAgrupacion] = useState<"semana" | "mes">("semana");
  const [resumen, setResumen] = useState<Resumen[] | null>(null);

  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoViaje>("todos");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [aprobAuto, setAprobAuto] = useState(false);

  const [formAbierto, setFormAbierto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [fecha, setFecha] = useState(() => HOY());
  const [numeroGuia, setNumeroGuia] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [choferId, setChoferId] = useState("");
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [kmInicial, setKmInicial] = useState("");
  const [kmFinal, setKmFinal] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [aplicaIva, setAplicaIva] = useState(true);
  const [comentarios, setComentarios] = useState("");

  const [fotosViaje, setFotosViaje] = useState<{ id: string; urls: string[]; cargando: boolean } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [editNumeroGuia, setEditNumeroGuia] = useState("");
  const [editOrigen, setEditOrigen] = useState("");
  const [editDestino, setEditDestino] = useState("");
  const [editClienteId, setEditClienteId] = useState("");
  const [editKmInicial, setEditKmInicial] = useState("");
  const [editKmFinal, setEditKmFinal] = useState("");
  const [editSubtotal, setEditSubtotal] = useState("");
  const [editAplicaIva, setEditAplicaIva] = useState(true);

  async function cargarViajes() {
    const res = await apiFetch(`/api/viajes${filtroEstado !== "todos" ? `?estado=${filtroEstado}` : ""}`);
    if (!res.ok) {
      setError("No se pudieron cargar los viajes");
      return;
    }
    setViajes(await res.json());
  }

  async function cargarResumen(agr: "semana" | "mes") {
    const res = await apiFetch(`/api/viajes/resumen?agrupar=${agr}`);
    if (res.ok) setResumen(await res.json());
  }

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resClientes, resUsuarios] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/clientes"),
      apiFetch("/api/usuarios"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) {
        setAprobAuto(Boolean(u.empresa?.viajes_aprobacion_automatica));
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
    }
    if (resClientes.ok) setClientes(await resClientes.json());
    if (resUsuarios.ok) {
      const todos: Usuario[] = await resUsuarios.json();
      setChoferes(todos.filter((u) => u.rol === "colaborador"));
    }
    await Promise.all([cargarViajes(), cargarResumen(agrupacion)]);
  }

  async function cambiarAprobAuto(next: boolean) {
    setAprobAuto(next);
    setAviso(null);
    const res = await apiFetch("/api/empresa", {
      method: "PATCH",
      body: JSON.stringify({ viajes_aprobacion_automatica: next }),
    });
    if (res.ok) {
      setAviso(
        next
          ? "Listo. Los viajes que registren los choferes quedarán confirmados automáticamente."
          : "Listo. Los viajes de los choferes volverán a entrar como borrador para que los revises."
      );
    } else {
      setAprobAuto(!next);
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo guardar el ajuste");
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    cargarViajes();
    setSeleccionados(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroEstado]);

  useEffect(() => {
    cargarResumen(agrupacion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agrupacion]);

  function abrirNuevo() {
    setFecha(HOY());
    setNumeroGuia("");
    setClienteId("");
    setChoferId("");
    setOrigen("");
    setDestino("");
    setKmInicial("");
    setKmFinal("");
    setSubtotal("");
    setAplicaIva(true);
    setComentarios("");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    if (!clienteId) {
      setFormError("Selecciona un cliente");
      return;
    }
    setGuardando(true);
    const res = await apiFetch("/api/viajes", {
      method: "POST",
      body: JSON.stringify({
        fecha,
        numero_guia: numeroGuia,
        cliente_id: clienteId,
        chofer_id: choferId || undefined,
        origen,
        destino,
        km_inicial: kmInicial || undefined,
        km_final: kmFinal || undefined,
        subtotal,
        aplica_iva: aplicaIva,
        comentarios,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear el viaje");
      return;
    }
    setAviso("Viaje creado.");
    setFormAbierto(false);
    cargar();
  }

  function abrirEdicion(v: ViajeConDatos) {
    setEditId(v.id);
    setEditError(null);
    setEditNumeroGuia(v.numero_guia);
    setEditOrigen(v.origen);
    setEditDestino(v.destino);
    setEditClienteId(v.cliente_id ?? "");
    setEditKmInicial(v.km_inicial != null ? String(v.km_inicial) : "");
    setEditKmFinal(v.km_final != null ? String(v.km_final) : "");
    setEditSubtotal(v.subtotal ? String(v.subtotal) : "");
    setEditAplicaIva(v.aplica_iva);
  }

  async function verFotos(id: string) {
    setFotosViaje({ id, urls: [], cargando: true });
    const urls: string[] = [];
    const guia = await apiFetch(`/api/viajes/${id}/foto`);
    if (guia.ok) urls.push((await guia.json()).url);
    const extra = await apiFetch(`/api/viajes/${id}/fotos`);
    if (extra.ok) for (const f of (await extra.json()) as { url: string }[]) urls.push(f.url);
    setFotosViaje({ id, urls, cargando: false });
  }

  async function guardarEdicion(id: string, confirmar: boolean) {
    setEditError(null);
    if (!editNumeroGuia.trim() || !editOrigen.trim() || !editDestino.trim()) {
      setEditError("Completa número de guía, origen y destino");
      return;
    }
    if (!editClienteId) {
      setEditError("Selecciona un cliente");
      return;
    }
    const subtotalNum = Number(editSubtotal);
    if (!Number.isFinite(subtotalNum) || subtotalNum <= 0) {
      setEditError("Ingresa un monto válido");
      return;
    }
    setConfirmando(true);
    const res = await apiFetch(`/api/viajes/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        numero_guia: editNumeroGuia.trim(),
        origen: editOrigen.trim(),
        destino: editDestino.trim(),
        cliente_id: editClienteId,
        km_inicial: editKmInicial || undefined,
        km_final: editKmFinal || undefined,
        subtotal: subtotalNum,
        aplica_iva: editAplicaIva,
        estado: confirmar ? "confirmado" : "borrador",
      }),
    });
    setConfirmando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEditError(body.error ?? "No se pudo guardar");
      return;
    }
    setEditId(null);
    setAviso(confirmar ? "Viaje confirmado." : "Cambios guardados.");
    cargar();
  }

  function alternarSeleccion(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Eliminar este viaje?")) return;
    const res = await apiFetch(`/api/viajes/${id}`, { method: "DELETE" });
    if (res.ok) cargar();
  }

  const viajesSeleccionados = useMemo(
    () => (viajes ?? []).filter((v) => seleccionados.has(v.id)),
    [viajes, seleccionados]
  );
  const clienteIdsSeleccionados = new Set(viajesSeleccionados.map((v) => v.cliente_id));
  const puedeFacturar =
    viajesSeleccionados.length > 0 &&
    clienteIdsSeleccionados.size === 1 &&
    viajesSeleccionados.every((v) => v.estado === "confirmado");
  const totalSeleccionado = viajesSeleccionados.reduce((acc, v) => acc + v.total, 0);

  async function facturarSeleccionados() {
    setAviso(null);
    setError(null);
    const res = await apiFetch("/api/viajes/facturar", {
      method: "POST",
      body: JSON.stringify({ viaje_ids: Array.from(seleccionados) }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo generar la factura");
      return;
    }
    setAviso("Factura generada a partir de los viajes seleccionados.");
    setSeleccionados(new Set());
    cargar();
  }

  if (!usuario) return null;

  const lista = viajes ?? [];

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading flex items-center gap-ds-2 text-ds-h2 text-ds-text">
            <Truck size={24} strokeWidth={2.75} className="text-ds-brand" />
            Viajes
          </p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Guías de despacho, kilometraje y facturación</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          Nuevo Viaje
        </Button>
      </div>

      <div className="mb-ds-6">
        <Card sinRelleno elevacion="sm">
          <div className="flex items-center justify-between gap-ds-3 border-b border-ds-divider px-ds-4 py-ds-3">
            <p className="font-ds-body text-ds-small font-semibold text-ds-text">Resumen</p>
            <div className="flex gap-ds-1">
              <button
                type="button"
                onClick={() => setAgrupacion("semana")}
                className={`rounded-ds-pill px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  agrupacion === "semana" ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text/60"
                }`}
              >
                Semanal
              </button>
              <button
                type="button"
                onClick={() => setAgrupacion("mes")}
                className={`rounded-ds-pill px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                  agrupacion === "mes" ? "bg-ds-brand/[0.08] text-ds-brand" : "text-ds-text/60"
                }`}
              >
                Mensual
              </button>
            </div>
          </div>
          {resumen && resumen.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-ds-body">
                <thead>
                  <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                    <th className="px-ds-4 py-ds-3">{agrupacion === "semana" ? "Semana de" : "Mes"}</th>
                    <th className="px-ds-4 py-ds-3">Guías</th>
                    <th className="px-ds-4 py-ds-3">Km recorridos</th>
                    <th className="px-ds-4 py-ds-3">Subtotal</th>
                    <th className="px-ds-4 py-ds-3">IVA</th>
                    <th className="px-ds-4 py-ds-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen.map((r) => (
                    <tr key={r.clave} className="border-b border-ds-text/[0.08] last:border-0">
                      <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{r.clave}</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{r.cantidad_viajes}</td>
                      <td className="px-ds-4 py-ds-3 tabular-nums text-ds-text">{r.km_total.toLocaleString("es-CL")} km</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{formatMoneda(r.subtotal, usuario.moneda)}</td>
                      <td className="px-ds-4 py-ds-3 text-ds-text">{formatMoneda(r.iva, usuario.moneda)}</td>
                      <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{formatMoneda(r.total, usuario.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-ds-4 py-ds-6 font-ds-body text-ds-small text-ds-text/70">Sin viajes registrados todavía.</p>
          )}
        </Card>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nuevo viaje</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-3">
                <FechaCampo etiqueta="Fecha" valor={fecha} onCambio={setFecha} />
                <Input etiqueta="Número de guía" requerido valor={numeroGuia} onCambio={setNumeroGuia} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                  <ComboboxCliente
                    value={clienteId}
                    onChange={setClienteId}
                    clientes={clientes}
                    onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                    placeholder="Selecciona un cliente…"
                  />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Chofer (opcional)</label>
                  <ComboboxResponsable value={choferId} onChange={setChoferId} equipo={choferes} opcionVacia="Sin asignar" placeholder="Sin asignar" />
                </div>
                <Input etiqueta="Origen" requerido valor={origen} onCambio={setOrigen} />
                <Input etiqueta="Destino" requerido valor={destino} onCambio={setDestino} />
                <Input etiqueta="Km inicial (opcional)" tipo="numero" valor={kmInicial} onCambio={setKmInicial} />
                <Input etiqueta="Km final (opcional)" tipo="numero" valor={kmFinal} onCambio={setKmFinal} />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto del viaje</label>
                  <InputMonto required value={subtotal} onChange={setSubtotal} moneda={usuario.moneda} />
                </div>
                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
                    <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} className="accent-[var(--ds-brand)]" />
                    Aplicar IVA (19%)
                  </label>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Input etiqueta="Comentarios (opcional)" valor={comentarios} onCambio={setComentarios} />
                </div>
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  Agregar viaje
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

      {usuario.rol === "admin" && (
        <label className="mb-ds-4 flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
          <input type="checkbox" checked={aprobAuto} onChange={(e) => cambiarAprobAuto(e.target.checked)} className="accent-[var(--ds-brand)]" />
          Aprobar automáticamente los viajes que registran los choferes desde la app
        </label>
      )}

      <div className="mb-ds-4 flex flex-wrap items-center gap-ds-3">
        <Select
          valor={filtroEstado}
          onCambio={(v) => setFiltroEstado(v as typeof filtroEstado)}
          opciones={[
            { valor: "todos", etiqueta: "Todos los estados" },
            { valor: "borrador", etiqueta: "Borrador" },
            { valor: "confirmado", etiqueta: "Confirmado" },
            { valor: "facturado", etiqueta: "Facturado" },
          ]}
        />
        {seleccionados.size > 0 && (
          <div className="ml-auto flex items-center gap-ds-3">
            <span className="font-ds-body text-ds-small text-ds-text/70">
              {seleccionados.size} seleccionado{seleccionados.size > 1 ? "s" : ""} · {formatMoneda(totalSeleccionado, usuario.moneda)}
            </span>
            <Button onPress={facturarSeleccionados} deshabilitado={!puedeFacturar}>
              Facturar seleccionados
            </Button>
          </div>
        )}
      </div>
      {seleccionados.size > 0 && !puedeFacturar && (
        <p className="-mt-ds-2 mb-ds-4 font-ds-body text-ds-caption text-ds-text/60">
          Para facturar, todos los viajes seleccionados deben ser del mismo cliente y estar en estado &quot;confirmado&quot;.
        </p>
      )}

      {error ? <ErrorState mensaje={error} onReintentar={cargar} /> : null}
      {viajes === null && !error ? <LoadingState /> : null}

      {viajes?.length === 0 && (
        <EmptyState
          icono={<Truck size={28} strokeWidth={2.75} />}
          titulo="Ningún viaje registrado"
          mensaje="Registra tu primer viaje para comenzar."
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Nuevo Viaje
            </Button>
          }
        />
      )}

      {lista.length > 0 && (
        <Card sinRelleno elevacion="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-ds-body">
              <thead>
                <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                  <th className="px-ds-4 py-ds-3"></th>
                  <th className="px-ds-4 py-ds-3">Fecha</th>
                  <th className="px-ds-4 py-ds-3">Guía</th>
                  <th className="px-ds-4 py-ds-3">Cliente</th>
                  <th className="px-ds-4 py-ds-3">Chofer</th>
                  <th className="px-ds-4 py-ds-3">Ruta</th>
                  <th className="px-ds-4 py-ds-3">Km</th>
                  <th className="px-ds-4 py-ds-3">Total</th>
                  <th className="px-ds-4 py-ds-3">Estado</th>
                  <th className="px-ds-4 py-ds-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((v) => {
                  const kilometros = km(v);
                  const esBorrador = v.estado === "borrador";
                  return (
                    <Fragment key={v.id}>
                      <tr className={`border-b border-ds-text/[0.08] last:border-0 hover:bg-ds-text/[0.04] ${esBorrador ? "bg-ds-accent-100/60" : ""}`}>
                        <td className="px-ds-4 py-ds-3">
                          <input
                            type="checkbox"
                            checked={seleccionados.has(v.id)}
                            disabled={v.estado === "facturado"}
                            onChange={() => alternarSeleccion(v.id)}
                            className="accent-[var(--ds-brand)]"
                          />
                        </td>
                        <td className="px-ds-4 py-ds-3 text-ds-text/70">{v.fecha}</td>
                        <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{v.numero_guia}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text">{v.cliente_info?.nombre ?? v.cliente}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text/70">{v.chofer?.nombre ?? "—"}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text/70">
                          {v.origen} → {v.destino}
                          {v.origen && v.destino && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(v.origen)}&destination=${encodeURIComponent(v.destino)}&travelmode=driving`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-ds-2 font-ds-body text-ds-caption font-medium text-ds-brand hover:underline"
                              title="Ver la ruta en Google Maps"
                            >
                              ruta
                            </a>
                          )}
                        </td>
                        <td className="px-ds-4 py-ds-3 tabular-nums text-ds-text/70">{kilometros != null ? `${kilometros.toLocaleString("es-CL")} km` : "—"}</td>
                        <td className="px-ds-4 py-ds-3 text-ds-text">
                          {formatMoneda(v.total, usuario.moneda)}
                          {v.aplica_iva && <span className="ml-ds-1 font-ds-body text-ds-caption text-ds-text/60">+IVA</span>}
                        </td>
                        <td className="px-ds-4 py-ds-3">
                          <StatusBadge estado={v.estado} tonoForzado={v.estado === "confirmado" || v.estado === "facturado" ? "completado" : "en_progreso"} />
                          {v.origen_captura === "whatsapp" && (
                            <span className="ml-1.5 font-ds-body text-ds-caption text-ds-text/60" title="Capturado por WhatsApp">
                              📱
                            </span>
                          )}
                        </td>
                        <td className="px-ds-4 py-ds-3">
                          <div className="flex items-center gap-ds-3">
                            {esBorrador && (
                              <button type="button" onClick={() => abrirEdicion(v)} className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                                Revisar y confirmar
                              </button>
                            )}
                            <button type="button" onClick={() => verFotos(v.id)} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                              Fotos
                            </button>
                            {v.estado !== "facturado" && (
                              <button type="button" onClick={() => eliminar(v.id)} className="font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {editId === v.id && (
                        <tr className="border-b border-ds-divider bg-ds-brand/[0.06]">
                          <td colSpan={10} className="px-ds-4 py-ds-4">
                            <div className="mb-ds-3 flex flex-wrap items-end gap-ds-3">
                              <div className="w-32">
                                <Input etiqueta="Número de guía" valor={editNumeroGuia} onCambio={setEditNumeroGuia} />
                              </div>
                              <div className="min-w-[180px] flex-1">
                                <Input etiqueta="Origen" valor={editOrigen} onCambio={setEditOrigen} />
                              </div>
                              <div className="min-w-[180px] flex-1">
                                <Input etiqueta="Destino" valor={editDestino} onCambio={setEditDestino} />
                              </div>
                            </div>
                            <div className="flex flex-wrap items-end gap-ds-3">
                              <div className="min-w-[220px]">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente</label>
                                <ComboboxCliente
                                  value={editClienteId}
                                  onChange={setEditClienteId}
                                  clientes={clientes}
                                  onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                                  placeholder="Selecciona un cliente…"
                                />
                              </div>
                              <div className="w-32">
                                <Input etiqueta="Km inicial" tipo="numero" valor={editKmInicial} onCambio={setEditKmInicial} />
                              </div>
                              <div className="w-32">
                                <Input etiqueta="Km final" tipo="numero" valor={editKmFinal} onCambio={setEditKmFinal} />
                              </div>
                              <div className="w-36">
                                <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto del viaje</label>
                                <InputMonto value={editSubtotal} onChange={setEditSubtotal} moneda={usuario.moneda} />
                              </div>
                              <label className="flex items-center gap-ds-2 pb-2.5 font-ds-body text-ds-small text-ds-text">
                                <input type="checkbox" checked={editAplicaIva} onChange={(e) => setEditAplicaIva(e.target.checked)} className="accent-[var(--ds-brand)]" />
                                Aplicar IVA
                              </label>
                              <div className="flex gap-ds-2 pb-0.5">
                                <Button onPress={() => guardarEdicion(v.id, true)} cargando={confirmando}>
                                  Confirmar viaje
                                </Button>
                                <Button variante="secundario" onPress={() => guardarEdicion(v.id, false)} deshabilitado={confirmando}>
                                  Guardar sin confirmar
                                </Button>
                                <Button variante="ghost" onPress={() => setEditId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                            {editError ? <p className="mt-ds-2 font-ds-body text-ds-small text-ds-accent-700">{editError}</p> : null}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={fotosViaje != null} onClose={() => setFotosViaje(null)} title="Fotos del viaje" wide>
        {fotosViaje?.cargando ? (
          <p className="font-ds-body text-ds-small text-ds-text/70">Cargando…</p>
        ) : fotosViaje && fotosViaje.urls.length > 0 ? (
          <div className="grid grid-cols-2 gap-ds-3 sm:grid-cols-3">
            {fotosViaje.urls.map((u) => (
              // eslint-disable-next-line @next/next/no-img-element
              <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                <img src={u} alt="Foto del viaje" className="aspect-square w-full rounded-ds-md border border-ds-divider object-cover" />
              </a>
            ))}
          </div>
        ) : (
          <p className="font-ds-body text-ds-small text-ds-text/70">Este viaje no tiene fotos.</p>
        )}
      </Modal>
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
        required
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
