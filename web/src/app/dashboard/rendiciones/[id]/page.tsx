"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Paperclip, Pencil, Plus, Send, Sliders, Trash2 } from "lucide-react";
import type { CategoriaGasto, EstadoRendicion, Gasto, MetodoEntregaRendicion, PeriodoRendicion, Proveedor, Rendicion, Usuario } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { InputMonto } from "@/components/InputMonto";
import { Button, Card, DatePicker, Input, Select, StatusBadge, Table, Textarea, type TonoEstado } from "@bitacora/ui/web";
import { PanelAcciones } from "@/components/PanelAcciones";

type GastoConDatos = Gasto & {
  categoria_info: { id: string; nombre: string; color: string } | null;
  proveedor_info: { id: string; nombre: string } | null;
};

type DetalleRendicion = Rendicion & {
  colaborador: { id: string; nombre: string } | null;
  aprobador: { id: string; nombre: string } | null;
  gastos: GastoConDatos[];
  total_gastado: number;
  saldo: number;
};

const ETIQUETA_ESTADO: Record<EstadoRendicion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const TONO_ESTADO: Record<EstadoRendicion, TonoEstado> = {
  borrador: "cerrado",
  enviada: "en_progreso",
  aprobada: "completado",
  rechazada: "cancelado",
};

const ETIQUETA_PERIODO: Record<string, string> = { diario: "Diario", semanal: "Semanal" };
const ETIQUETA_METODO_ENTREGA: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia" };
const HOY = () => new Date().toISOString().slice(0, 10);

// PASO 6 (sistema de diseño). Aprobar/Rechazar reusa PanelAcciones
// (mismo drawer que Cotizaciones/Cobros) — aprobar no dispara nada
// automático, ninguna pasarela real detrás (mismo criterio que
// Cobros); "saldo liquidado" es un checkbox informativo.
//
// Pedido 22-sep-2026: acá se agrega TODO lo que antes solo existía en
// el celular — editar los datos base, agregar/editar/quitar gastos
// con foto, enviar a revisión y eliminar la rendición — siempre
// limitado a mientras sigue en 'borrador' (mismo gate que el backend).
export default function DetalleRendicionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [miId, setMiId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<DetalleRendicion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [edColaboradorId, setEdColaboradorId] = useState("");
  const [edPeriodo, setEdPeriodo] = useState<PeriodoRendicion>("semanal");
  const [edFechaInicio, setEdFechaInicio] = useState(() => HOY());
  const [edFechaTermino, setEdFechaTermino] = useState(() => HOY());
  const [edMonto, setEdMonto] = useState("");
  const [edMetodoEntrega, setEdMetodoEntrega] = useState<MetodoEntregaRendicion>("efectivo");
  const [edError, setEdError] = useState<string | null>(null);
  const [edGuardando, setEdGuardando] = useState(false);

  const [itemFormAbierto, setItemFormAbierto] = useState(false);
  const [itemEditandoId, setItemEditandoId] = useState<string | null>(null);
  const [itDescripcion, setItDescripcion] = useState("");
  const [itMonto, setItMonto] = useState("");
  const [itCategoriaId, setItCategoriaId] = useState("");
  const [itProveedorId, setItProveedorId] = useState("");
  const [itFecha, setItFecha] = useState(() => HOY());
  const [itComprobante, setItComprobante] = useState<File | null>(null);
  const [itError, setItError] = useState<string | null>(null);
  const [itGuardando, setItGuardando] = useState(false);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resDetalle, resCategorias, resProveedores] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/rendiciones/${params.id}`),
      apiFetch("/api/categorias-gasto"),
      apiFetch("/api/proveedores"),
    ]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) {
        setRol(u.rol);
        setMiId(u.id);
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
        if (u.rol !== "colaborador") {
          const resUsuarios = await apiFetch("/api/usuarios");
          if (resUsuarios.ok) setUsuarios((await resUsuarios.json()).filter((x: Usuario) => x.activo));
        }
      }
    }
    if (resCategorias.ok) setCategorias(await resCategorias.json());
    if (resProveedores.ok) setProveedores(await resProveedores.json());
    if (!resDetalle.ok) {
      setError("No se pudo cargar la rendición");
      return;
    }
    setDetalle(await resDetalle.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function verComprobante(gastoId: string) {
    const res = await apiFetch(`/api/gastos/${gastoId}/comprobante`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function onAprobar() {
    setErrorAccion(null);
    setGuardando(true);
    const res = await apiFetch(`/api/rendiciones/${params.id}`, { method: "PATCH", body: JSON.stringify({ accion: "aprobar" }) });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo aprobar");
      return;
    }
    setPanelAbierto(false);
    await cargar();
  }

  async function onRechazar() {
    setErrorAccion(null);
    if (!motivoRechazo.trim()) {
      setErrorAccion("Falta el motivo del rechazo");
      return;
    }
    setGuardando(true);
    const res = await apiFetch(`/api/rendiciones/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({ accion: "rechazar", motivo_rechazo: motivoRechazo.trim() }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo rechazar");
      return;
    }
    setPanelAbierto(false);
    setRechazando(false);
    setMotivoRechazo("");
    await cargar();
  }

  async function onCambiarSaldoLiquidado(valor: boolean) {
    setErrorAccion(null);
    const res = await apiFetch(`/api/rendiciones/${params.id}`, { method: "PATCH", body: JSON.stringify({ saldo_liquidado: valor }) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo actualizar");
      return;
    }
    await cargar();
  }

  async function onEnviar() {
    if (!window.confirm("¿Enviar esta rendición a revisión? No vas a poder agregar ni editar gastos después.")) return;
    setErrorAccion(null);
    setGuardando(true);
    const res = await apiFetch(`/api/rendiciones/${params.id}/enviar`, { method: "POST" });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo enviar");
      return;
    }
    await cargar();
  }

  function abrirEdicion() {
    if (!detalle) return;
    setEdColaboradorId(detalle.colaborador_id);
    setEdPeriodo(detalle.periodo);
    setEdFechaInicio(detalle.fecha_inicio);
    setEdFechaTermino(detalle.fecha_termino);
    setEdMonto(String(detalle.monto_entregado));
    setEdMetodoEntrega(detalle.metodo_entrega);
    setEdError(null);
    setEditando(true);
  }

  async function onGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    setEdError(null);
    setEdGuardando(true);
    const res = await apiFetch(`/api/rendiciones/${params.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        colaborador_id: edColaboradorId,
        periodo: edPeriodo,
        fecha_inicio: edFechaInicio,
        fecha_termino: edFechaTermino,
        monto_entregado: edMonto,
        metodo_entrega: edMetodoEntrega,
      }),
    });
    setEdGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setEdError(body.error ?? "No se pudo guardar");
      return;
    }
    setEditando(false);
    await cargar();
  }

  async function onEliminarRendicion() {
    if (!window.confirm("¿Eliminar esta rendición y todos sus gastos? Esta acción no se puede deshacer.")) return;
    setErrorAccion(null);
    const res = await apiFetch(`/api/rendiciones/${params.id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo eliminar");
      return;
    }
    router.push("/dashboard/rendiciones");
  }

  function abrirNuevoItem() {
    setItemEditandoId(null);
    setItDescripcion("");
    setItMonto("");
    setItCategoriaId("");
    setItProveedorId("");
    setItFecha(HOY());
    setItComprobante(null);
    setItError(null);
    setItemFormAbierto(true);
  }

  function abrirEdicionItem(g: GastoConDatos) {
    setItemFormAbierto(false);
    setItemEditandoId(g.id);
    setItDescripcion(g.descripcion ?? "");
    setItMonto(String(g.monto));
    setItCategoriaId(g.categoria_gasto_id ?? "");
    setItProveedorId(g.proveedor_id ?? "");
    setItFecha(g.fecha);
    setItComprobante(null);
    setItError(null);
  }

  function cerrarFormularioItem() {
    setItemFormAbierto(false);
    setItemEditandoId(null);
  }

  async function onSubmitItem(e: FormEvent) {
    e.preventDefault();
    setItError(null);
    if (!itCategoriaId) {
      setItError("Selecciona una categoría");
      return;
    }
    setItGuardando(true);
    const body = new FormData();
    body.set("categoria_gasto_id", itCategoriaId);
    body.set("descripcion", itDescripcion);
    body.set("monto", itMonto);
    body.set("fecha", itFecha);
    if (itProveedorId) body.set("proveedor_id", itProveedorId);
    if (itComprobante) body.set("comprobante", itComprobante);

    const res = itemEditandoId
      ? await apiFetch(`/api/gastos/${itemEditandoId}`, { method: "PATCH", body })
      : await apiFetch(`/api/rendiciones/${params.id}/items`, { method: "POST", body });
    setItGuardando(false);
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({}));
      setItError(respBody.error ?? (itemEditandoId ? "No se pudo guardar el gasto" : "No se pudo agregar el gasto"));
      return;
    }
    setItemFormAbierto(false);
    setItemEditandoId(null);
    await cargar();
  }

  async function onEliminarItem(gastoId: string) {
    if (!window.confirm("¿Quitar este gasto de la rendición?")) return;
    const res = await apiFetch(`/api/rendiciones/${params.id}/items/${gastoId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErrorAccion(body.error ?? "No se pudo quitar el gasto");
      return;
    }
    await cargar();
  }

  if (!usuario) return null;

  const permisoEditar =
    Boolean(detalle) &&
    detalle!.estado === "borrador" &&
    (rol !== "colaborador" || detalle!.colaborador_id === miId || detalle!.creado_por === miId);

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/rendiciones" className="mb-ds-4 inline-flex items-center gap-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Rendiciones
      </Link>

      {error && !detalle ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}

      {detalle && (
        <>
          <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
            <div>
              <p className="ds-heading text-ds-h2 text-ds-text">{formatearFolio("REND", detalle.folio) ?? "Rendición"}</p>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
                {detalle.colaborador?.nombre ?? "—"} · {ETIQUETA_PERIODO[detalle.periodo] ?? detalle.periodo} · {detalle.fecha_inicio} a{" "}
                {detalle.fecha_termino} · {ETIQUETA_METODO_ENTREGA[detalle.metodo_entrega] ?? detalle.metodo_entrega}
              </p>
            </div>
            <div className="flex items-center gap-ds-2">
              <StatusBadge estado={detalle.estado} etiqueta={ETIQUETA_ESTADO[detalle.estado]} tonoForzado={TONO_ESTADO[detalle.estado]} />
              {permisoEditar && (
                <>
                  <Button variante="secundario" iconoIzq={<Pencil size={16} strokeWidth={2.75} />} onPress={() => (editando ? setEditando(false) : abrirEdicion())}>
                    Editar
                  </Button>
                  <Button variante="secundario" iconoIzq={<Send size={16} strokeWidth={2.75} />} onPress={onEnviar} cargando={guardando}>
                    Enviar a revisión
                  </Button>
                  <Button variante="peligro" iconoIzq={<Trash2 size={16} strokeWidth={2.75} />} onPress={onEliminarRendicion}>
                    Eliminar
                  </Button>
                </>
              )}
              {detalle.estado === "enviada" && rol !== "colaborador" && (
                <Button variante="secundario" iconoIzq={<Sliders size={16} strokeWidth={2.75} />} onPress={() => setPanelAbierto(true)}>
                  Revisar
                </Button>
              )}
            </div>
          </div>

          {errorAccion ? <p className="mb-ds-4 font-ds-body text-ds-small text-ds-accent-700">{errorAccion}</p> : null}

          {editando && (
            <div className="mb-ds-6">
              <Card>
                <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Editar rendición</p>
                <form onSubmit={onGuardarEdicion} className="flex flex-col gap-ds-4">
                  <div className="grid gap-ds-4 sm:grid-cols-2">
                    {rol !== "colaborador" && (
                      <div className="sm:col-span-2">
                        <Select
                          etiqueta="Colaborador"
                          valor={edColaboradorId}
                          onCambio={setEdColaboradorId}
                          opciones={usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))}
                        />
                      </div>
                    )}
                    <Select
                      etiqueta="Período"
                      valor={edPeriodo}
                      onCambio={(v) => setEdPeriodo(v as PeriodoRendicion)}
                      opciones={[
                        { valor: "diario", etiqueta: "Diario" },
                        { valor: "semanal", etiqueta: "Semanal" },
                      ]}
                    />
                    <Select
                      etiqueta="Método de entrega"
                      valor={edMetodoEntrega}
                      onCambio={(v) => setEdMetodoEntrega(v as MetodoEntregaRendicion)}
                      opciones={[
                        { valor: "efectivo", etiqueta: "Efectivo" },
                        { valor: "transferencia", etiqueta: "Transferencia" },
                      ]}
                    />
                    <div className="flex flex-col gap-ds-1">
                      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto entregado</label>
                      <InputMonto required value={edMonto} onChange={setEdMonto} moneda={usuario.moneda} />
                    </div>
                    <DatePicker etiqueta="Fecha de inicio" valor={aFecha(edFechaInicio)} onCambio={(f) => setEdFechaInicio(aTexto(f))} />
                    <DatePicker etiqueta="Fecha de término" valor={aFecha(edFechaTermino)} onCambio={(f) => setEdFechaTermino(aTexto(f))} />
                  </div>
                  {edError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{edError}</p> : null}
                  <div className="flex gap-ds-2">
                    <Button tipo="submit" cargando={edGuardando}>
                      Guardar cambios
                    </Button>
                    <Button variante="ghost" onPress={() => setEditando(false)}>
                      Cancelar
                    </Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          <div className="mb-ds-6 grid gap-ds-4 sm:grid-cols-3">
            <Card>
              <p className="font-ds-body text-ds-caption text-ds-text/60">Entregado</p>
              <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(detalle.monto_entregado, usuario.moneda)}</p>
            </Card>
            <Card>
              <p className="font-ds-body text-ds-caption text-ds-text/60">Gastado</p>
              <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(detalle.total_gastado, usuario.moneda)}</p>
            </Card>
            <Card>
              <p className="font-ds-body text-ds-caption text-ds-text/60">Saldo</p>
              <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(detalle.saldo, usuario.moneda)}</p>
              {detalle.saldo !== 0 && (detalle.estado === "aprobada" || detalle.estado === "enviada") && rol !== "colaborador" && (
                <label className="mt-ds-2 flex items-center gap-ds-2 font-ds-body text-ds-caption text-ds-text/70">
                  <input type="checkbox" checked={detalle.saldo_liquidado} onChange={(e) => onCambiarSaldoLiquidado(e.target.checked)} />
                  Saldo liquidado
                </label>
              )}
            </Card>
          </div>

          {detalle.motivo_rechazo && (
            <div className="mb-ds-6 rounded-ds-md border border-ds-accent-700 bg-ds-accent-100 p-ds-4">
              <p className="font-ds-body text-ds-caption font-semibold text-ds-accent-700">Motivo del último rechazo</p>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text">{detalle.motivo_rechazo}</p>
            </div>
          )}

          <div className="mb-ds-6">
            <div className="mb-ds-3 flex items-center justify-between">
              <p className="font-ds-body text-ds-small font-semibold text-ds-text">Gastos incluidos</p>
              {permisoEditar && !itemFormAbierto && (
                <Button variante="secundario" iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevoItem}>
                  Agregar gasto
                </Button>
              )}
            </div>

            {(itemFormAbierto || itemEditandoId) && (
              <div className="mb-ds-4">
                <Card>
                  <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{itemEditandoId ? "Editar gasto" : "Nuevo gasto"}</p>
                  <form onSubmit={onSubmitItem} className="flex flex-col gap-ds-4">
                    <div className="grid gap-ds-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Input etiqueta="Descripción" valor={itDescripcion} onCambio={setItDescripcion} />
                      </div>
                      <div className="flex flex-col gap-ds-1">
                        <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto</label>
                        <InputMonto required value={itMonto} onChange={setItMonto} moneda={usuario.moneda} />
                      </div>
                      <div className="flex flex-col gap-ds-1">
                        <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Categoría</label>
                        <SelectCrear
                          value={itCategoriaId}
                          onChange={setItCategoriaId}
                          opciones={categorias}
                          endpoint="/api/categorias-gasto"
                          placeholder="Selecciona una categoría…"
                          etiquetaCrear="+ Crear categoría"
                          onCreado={(nueva) => setCategorias((prev) => [...prev, nueva])}
                          gestionHref="/dashboard/configuracion/categorias-gastos"
                          gestionLabel="Gestionar categorías →"
                        />
                      </div>
                      <div className="flex flex-col gap-ds-1">
                        <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Proveedor (opcional)</label>
                        <SelectCrear
                          value={itProveedorId}
                          onChange={setItProveedorId}
                          opciones={proveedores}
                          endpoint="/api/proveedores"
                          placeholder="Sin proveedor"
                          etiquetaCrear="+ Crear proveedor"
                          onCreado={(nuevo) => setProveedores((prev) => [...prev, nuevo])}
                          gestionHref="/dashboard/registros/proveedores"
                          gestionLabel="Gestionar proveedores →"
                        />
                      </div>
                      <DatePicker etiqueta="Fecha" valor={aFecha(itFecha)} onCambio={(f) => setItFecha(aTexto(f))} />
                      <div className="sm:col-span-2">
                        <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">
                          Comprobante / foto {itemEditandoId ? "(opcional, reemplaza el actual)" : ""}
                        </label>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          onChange={(e) => setItComprobante(e.target.files?.[0] ?? null)}
                          className="block w-full font-ds-body text-ds-small text-ds-text/70 file:mr-ds-3 file:rounded-ds-md file:border file:border-ds-divider file:bg-ds-surface file:px-ds-3 file:py-2 file:font-ds-body file:text-ds-small file:font-medium file:text-ds-text"
                        />
                      </div>
                    </div>
                    {itError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{itError}</p> : null}
                    <div className="flex gap-ds-2">
                      <Button tipo="submit" cargando={itGuardando}>
                        {itemEditandoId ? "Guardar cambios" : "Agregar gasto"}
                      </Button>
                      <Button variante="ghost" onPress={cerrarFormularioItem}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            )}

            {detalle.gastos.length === 0 ? (
              <Card>
                <p className="font-ds-body text-ds-small text-ds-text/60">
                  {permisoEditar ? "Todavía no se agregó ningún gasto." : "Todavía no se agregó ningún gasto (se hace desde el celular)."}
                </p>
              </Card>
            ) : (
              <Table<GastoConDatos>
                filas={detalle.gastos}
                claveFila={(g) => g.id}
                vacio={{ titulo: "Sin gastos" }}
                columnas={[
                  { encabezado: "Fecha", celda: (g) => g.fecha },
                  {
                    encabezado: "Categoría",
                    celda: (g) =>
                      g.categoria_info ? (
                        <span className="inline-flex items-center gap-1.5 text-ds-caption font-medium" style={{ color: g.categoria_info.color }}>
                          <span className="h-2 w-2 rounded-ds-pill" style={{ backgroundColor: g.categoria_info.color }} />
                          {g.categoria_info.nombre}
                        </span>
                      ) : (
                        <span className="text-ds-text/60">{g.categoria}</span>
                      ),
                  },
                  { encabezado: "Descripción", celda: (g) => g.descripcion || "—" },
                  { encabezado: "Proveedor", celda: (g) => g.proveedor_info?.nombre ?? "—" },
                  { encabezado: "Monto", clase: "text-right", celda: (g) => formatMoneda(g.monto, usuario.moneda) },
                  {
                    encabezado: "Comprobante",
                    celda: (g) =>
                      g.comprobante_url ? (
                        <button type="button" onClick={() => verComprobante(g.id)} className="inline-flex items-center gap-1 font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                          <Paperclip size={14} strokeWidth={2.75} />
                          Ver
                        </button>
                      ) : (
                        <span className="text-ds-text/60">—</span>
                      ),
                  },
                  ...(permisoEditar
                    ? [
                        {
                          encabezado: "Acciones",
                          celda: (g: GastoConDatos) => (
                            <div className="flex items-center gap-ds-3">
                              <button type="button" onClick={() => abrirEdicionItem(g)} className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                                Editar
                              </button>
                              <button type="button" onClick={() => onEliminarItem(g.id)} className="font-ds-body text-ds-caption font-medium text-ds-accent-700 hover:underline">
                                Quitar
                              </button>
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            )}
          </div>
        </>
      )}

      <PanelAcciones
        open={panelAbierto}
        onClose={() => {
          setPanelAbierto(false);
          setRechazando(false);
          setMotivoRechazo("");
          setErrorAccion(null);
        }}
        titulo={detalle ? formatearFolio("REND", detalle.folio) ?? "Rendición" : "Rendición"}
        subtitulo={detalle?.colaborador?.nombre ?? undefined}
        seccionEstado={
          <div className="flex flex-col gap-ds-3">
            {!rechazando ? (
              <div className="flex gap-ds-2">
                <Button onPress={onAprobar} cargando={guardando}>
                  Aprobar
                </Button>
                <Button variante="peligro" onPress={() => setRechazando(true)}>
                  Rechazar
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-ds-2">
                <Textarea etiqueta="Motivo del rechazo" filas={3} valor={motivoRechazo} onCambio={setMotivoRechazo} />
                <div className="flex gap-ds-2">
                  <Button variante="peligro" onPress={onRechazar} cargando={guardando}>
                    Confirmar rechazo
                  </Button>
                  <Button variante="ghost" onPress={() => setRechazando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
            {errorAccion ? <p className="font-ds-body text-ds-small text-ds-accent-700">{errorAccion}</p> : null}
          </div>
        }
      />
    </DashboardShell>
  );
}

// DatePicker (packages/ui) trabaja con Date, el estado de este archivo
// con texto ISO — mismo par de helpers que gastos/page.tsx.
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
