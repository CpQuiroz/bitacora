"use client";

import { Fragment, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente, EstadoViaje, Usuario, Viaje } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { IconPlus, IconTruck } from "@/components/icons";
import { EstadoCargando, EstadoError, EstadoVacio } from "@/components/estados";

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

  async function verFoto(id: string) {
    const res = await apiFetch(`/api/viajes/${id}/foto`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Viajes" subtitle="Guías de despacho, kilometraje y facturación" />
        <Button type="button" onClick={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
          <IconPlus className="h-4 w-4" />
          Nuevo Viaje
        </Button>
      </div>

      <Card className="mb-6 overflow-x-auto p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold text-foreground">Resumen</h2>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setAgrupacion("semana")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                agrupacion === "semana" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Semanal
            </button>
            <button
              type="button"
              onClick={() => setAgrupacion("mes")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                agrupacion === "mes" ? "bg-brand-soft text-brand" : "text-muted"
              }`}
            >
              Mensual
            </button>
          </div>
        </div>
        {resumen && resumen.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-2.5 font-medium">{agrupacion === "semana" ? "Semana de" : "Mes"}</th>
                <th className="px-5 py-2.5 font-medium">Guías</th>
                <th className="px-5 py-2.5 font-medium">Km recorridos</th>
                <th className="px-5 py-2.5 font-medium">Subtotal</th>
                <th className="px-5 py-2.5 font-medium">IVA</th>
                <th className="px-5 py-2.5 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {resumen.map((r) => (
                <tr key={r.clave} className="border-b border-border text-sm last:border-0">
                  <td className="px-5 py-2.5 font-medium text-foreground">{r.clave}</td>
                  <td className="px-5 py-2.5">{r.cantidad_viajes}</td>
                  <td className="px-5 py-2.5 tabular-nums">{r.km_total.toLocaleString("es-CL")} km</td>
                  <td className="px-5 py-2.5">{formatMoneda(r.subtotal, usuario.moneda)}</td>
                  <td className="px-5 py-2.5">{formatMoneda(r.iva, usuario.moneda)}</td>
                  <td className="px-5 py-2.5 font-medium text-foreground">{formatMoneda(r.total, usuario.moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="px-5 py-6 text-sm text-muted">Sin viajes registrados todavía.</p>
        )}
      </Card>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Nuevo viaje</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Fecha</Label>
                <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <Label>Número de guía</Label>
                <Input type="text" required value={numeroGuia} onChange={(e) => setNumeroGuia(e.target.value)} />
              </div>
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
                <Label>Chofer (opcional)</Label>
                <ComboboxResponsable
                  value={choferId}
                  onChange={setChoferId}
                  equipo={choferes}
                  opcionVacia="Sin asignar"
                  placeholder="Sin asignar"
                />
              </div>
              <div>
                <Label>Origen</Label>
                <Input type="text" required value={origen} onChange={(e) => setOrigen(e.target.value)} />
              </div>
              <div>
                <Label>Destino</Label>
                <Input type="text" required value={destino} onChange={(e) => setDestino(e.target.value)} />
              </div>
              <div>
                <Label>Km inicial (opcional)</Label>
                <Input type="number" min="0" step="0.1" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} />
              </div>
              <div>
                <Label>Km final (opcional)</Label>
                <Input type="number" min="0" step="0.1" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} />
              </div>
              <div>
                <Label>Monto del viaje</Label>
                <Input type="number" min="0" step="1" required value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
              </div>
              <div className="flex items-end pb-2.5">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={aplicaIva} onChange={(e) => setAplicaIva(e.target.checked)} />
                  Aplicar IVA (19%)
                </label>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Comentarios (opcional)</Label>
                <Input type="text" value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
              </div>
            </div>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : "Agregar viaje"}
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

      {usuario.rol === "admin" && (
        <label className="mb-4 flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={aprobAuto} onChange={(e) => cambiarAprobAuto(e.target.checked)} />
          Aprobar automáticamente los viajes que registran los choferes desde la app
        </label>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className="w-48">
          <option value="todos">Todos los estados</option>
          <option value="borrador">Borrador</option>
          <option value="confirmado">Confirmado</option>
          <option value="facturado">Facturado</option>
        </Select>
        {seleccionados.size > 0 && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted">
              {seleccionados.size} seleccionado{seleccionados.size > 1 ? "s" : ""} · {formatMoneda(totalSeleccionado, usuario.moneda)}
            </span>
            <Button type="button" onClick={facturarSeleccionados} disabled={!puedeFacturar}>
              Facturar seleccionados
            </Button>
          </div>
        )}
      </div>
      {seleccionados.size > 0 && !puedeFacturar && (
        <p className="-mt-2 mb-4 text-xs text-muted">
          Para facturar, todos los viajes seleccionados deben ser del mismo cliente y estar en estado "confirmado".
        </p>
      )}

      {error && <EstadoError mensaje={error} onReintentar={cargar} />}
      {viajes === null && !error && <EstadoCargando />}

      {viajes?.length === 0 && (
        <EstadoVacio
          icono={IconTruck}
          titulo="Ningún viaje registrado"
          mensaje="Registra tu primer viaje para comenzar."
          accion={
            <Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Viaje
            </Button>
          }
        />
      )}

      {lista.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium"></th>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Guía</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Chofer</th>
                <th className="px-5 py-3 font-medium">Ruta</th>
                <th className="px-5 py-3 font-medium">Km</th>
                <th className="px-5 py-3 font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((v) => {
                const kilometros = km(v);
                const esBorrador = v.estado === "borrador";
                return (
                  <Fragment key={v.id}>
                    <tr
                      className={`border-b border-border last:border-0 hover:bg-brand-soft/40 ${esBorrador ? "bg-warning-soft/40" : ""}`}
                    >
                      <td className="px-5 py-3">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(v.id)}
                          disabled={v.estado === "facturado"}
                          onChange={() => alternarSeleccion(v.id)}
                        />
                      </td>
                      <td className="px-5 py-3 text-muted">{v.fecha}</td>
                      <td className="px-5 py-3 font-medium text-foreground">{v.numero_guia}</td>
                      <td className="px-5 py-3">{v.cliente_info?.nombre ?? v.cliente}</td>
                      <td className="px-5 py-3 text-muted">{v.chofer?.nombre ?? "—"}</td>
                      <td className="px-5 py-3 text-muted">
                        {v.origen} → {v.destino}
                        {v.origen && v.destino && (
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(v.origen)}&destination=${encodeURIComponent(v.destino)}&travelmode=driving`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-xs font-medium text-brand hover:underline"
                            title="Ver la ruta en Google Maps"
                          >
                            ruta
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-muted">{kilometros != null ? `${kilometros.toLocaleString("es-CL")} km` : "—"}</td>
                      <td className="px-5 py-3">
                        {formatMoneda(v.total, usuario.moneda)}
                        {v.aplica_iva && <span className="ml-1 text-xs text-muted">+IVA</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={v.estado} />
                        {v.origen_captura === "whatsapp" && (
                          <span className="ml-1.5 text-xs text-muted" title="Capturado por WhatsApp">
                            📱
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          {esBorrador && (
                            <button type="button" onClick={() => abrirEdicion(v)} className="text-xs font-medium text-brand hover:underline">
                              Revisar y confirmar
                            </button>
                          )}
                          {v.foto_guia_url && (
                            <button type="button" onClick={() => verFoto(v.id)} className="text-xs font-medium text-muted hover:text-brand">
                              Ver foto
                            </button>
                          )}
                          {v.estado !== "facturado" && (
                            <button type="button" onClick={() => eliminar(v.id)} className="text-xs font-medium text-danger hover:underline">
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editId === v.id && (
                      <tr className="border-b border-border bg-brand-soft/30">
                        <td colSpan={10} className="px-5 py-4">
                          <div className="mb-3 flex flex-wrap items-end gap-3">
                            <div className="w-32">
                              <Label>Número de guía</Label>
                              <Input type="text" value={editNumeroGuia} onChange={(e) => setEditNumeroGuia(e.target.value)} />
                            </div>
                            <div className="min-w-[180px] flex-1">
                              <Label>Origen</Label>
                              <Input type="text" value={editOrigen} onChange={(e) => setEditOrigen(e.target.value)} />
                            </div>
                            <div className="min-w-[180px] flex-1">
                              <Label>Destino</Label>
                              <Input type="text" value={editDestino} onChange={(e) => setEditDestino(e.target.value)} />
                            </div>
                          </div>
                          <div className="flex flex-wrap items-end gap-3">
                            <div className="min-w-[220px]">
                              <Label>Cliente</Label>
                              <ComboboxCliente
                                value={editClienteId}
                                onChange={setEditClienteId}
                                clientes={clientes}
                                onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                                placeholder="Selecciona un cliente…"
                              />
                            </div>
                            <div className="w-32">
                              <Label>Km inicial</Label>
                              <Input type="number" min="0" step="0.1" value={editKmInicial} onChange={(e) => setEditKmInicial(e.target.value)} />
                            </div>
                            <div className="w-32">
                              <Label>Km final</Label>
                              <Input type="number" min="0" step="0.1" value={editKmFinal} onChange={(e) => setEditKmFinal(e.target.value)} />
                            </div>
                            <div className="w-36">
                              <Label>Monto del viaje</Label>
                              <Input type="number" min="0" step="1" value={editSubtotal} onChange={(e) => setEditSubtotal(e.target.value)} />
                            </div>
                            <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
                              <input type="checkbox" checked={editAplicaIva} onChange={(e) => setEditAplicaIva(e.target.checked)} />
                              Aplicar IVA
                            </label>
                            <div className="flex gap-2 pb-0.5">
                              <Button type="button" onClick={() => guardarEdicion(v.id, true)} disabled={confirmando}>
                                {confirmando ? "Guardando…" : "Confirmar viaje"}
                              </Button>
                              <Button type="button" variant="outline" onClick={() => guardarEdicion(v.id, false)} disabled={confirmando}>
                                Guardar sin confirmar
                              </Button>
                              <Button type="button" variant="ghost" onClick={() => setEditId(null)}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                          {editError && (
                            <div className="mt-2">
                              <ErrorText>{editError}</ErrorText>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </DashboardShell>
  );
}
