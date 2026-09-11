"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Wallet } from "lucide-react";
import type { CategoriaGasto, CentroCosto, EstadoGasto, Gasto, Proveedor, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { Button, Card, Cifra, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge, Table, type TonoEstado } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";

type GastoConDatos = Gasto & {
  categoria_info: Pick<CategoriaGasto, "id" | "nombre" | "color"> | null;
  centro_costo_info: Pick<CentroCosto, "id" | "nombre"> | null;
  proveedor_info: Pick<Proveedor, "id" | "nombre"> | null;
  trabajo_info: Pick<Trabajo, "id" | "cliente" | "fecha"> | null;
};

const HOY = () => new Date().toISOString().slice(0, 10);

function estadoMostrado(g: Gasto): "pendiente" | "pagado" | "vencido" {
  if (g.estado === "pendiente" && g.fecha < HOY()) return "vencido";
  return g.estado;
}

// "pendiente"/"vencido" no están en MAPA_ESTADO_TONO como estado de gasto
// (vencido sí existe en el mapa para OTROS dominios, pero acá se calcula
// aparte — se fuerza para no depender de esa coincidencia).
const TONO_ESTADO: Record<ReturnType<typeof estadoMostrado>, TonoEstado> = {
  pendiente: "en_progreso",
  pagado: "completado",
  vencido: "cancelado",
};

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function GastosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [gastos, setGastos] = useState<GastoConDatos[] | null>(null);
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([]);
  const [centrosCosto, setCentrosCosto] = useState<CentroCosto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoGasto | "vencido">("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [categoriaGastoId, setCategoriaGastoId] = useState("");
  const [centroCostoId, setCentroCostoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [trabajoId, setTrabajoId] = useState("");
  const [fecha, setFecha] = useState(() => HOY());
  const [estado, setEstado] = useState<EstadoGasto>("pendiente");
  const [fechaPago, setFechaPago] = useState(() => HOY());
  const [comprobante, setComprobante] = useState<File | null>(null);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resGastos, resCategorias, resCentros, resProveedores, resTrabajos] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/gastos"),
      apiFetch("/api/categorias-gasto"),
      apiFetch("/api/centros-costo"),
      apiFetch("/api/proveedores"),
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
    if (resCategorias.ok) setCategorias(await resCategorias.json());
    if (resCentros.ok) setCentrosCosto(await resCentros.json());
    if (resProveedores.ok) setProveedores(await resProveedores.json());
    if (resTrabajos.ok) setTrabajos(await resTrabajos.json());
    if (!resGastos.ok) {
      setError("No se pudieron cargar los gastos");
      return;
    }
    setGastos(await resGastos.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNuevo() {
    setEditandoId(null);
    setDescripcion("");
    setMonto("");
    setCategoriaGastoId("");
    setCentroCostoId("");
    setProveedorId("");
    setTrabajoId("");
    setFecha(HOY());
    setEstado("pendiente");
    setFechaPago(HOY());
    setComprobante(null);
    setFormError(null);
    setFormAbierto(true);
  }

  function abrirEdicion(g: GastoConDatos) {
    setFormAbierto(false);
    setEditandoId(g.id);
    setDescripcion(g.descripcion ?? "");
    setMonto(String(g.monto));
    setCategoriaGastoId(g.categoria_gasto_id ?? "");
    setCentroCostoId(g.centro_costo_id ?? "");
    setProveedorId(g.proveedor_id ?? "");
    setTrabajoId(g.trabajo_id ?? "");
    setFecha(g.fecha);
    setEstado(g.estado);
    setFechaPago(g.fecha_pago ?? HOY());
    setComprobante(null);
    setFormError(null);
  }

  function cerrarFormulario() {
    setFormAbierto(false);
    setEditandoId(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    if (!categoriaGastoId) {
      setFormError("Selecciona una categoría");
      return;
    }
    setGuardando(true);
    const body = new FormData();
    body.set("categoria_gasto_id", categoriaGastoId);
    body.set("descripcion", descripcion);
    body.set("monto", monto);
    body.set("fecha", fecha);
    body.set("estado", estado);
    if (estado === "pagado") body.set("fecha_pago", fechaPago);
    if (centroCostoId) body.set("centro_costo_id", centroCostoId);
    if (proveedorId) body.set("proveedor_id", proveedorId);
    if (trabajoId) body.set("trabajo_id", trabajoId);
    if (comprobante) body.set("comprobante", comprobante);

    const res = editandoId
      ? await apiFetch(`/api/gastos/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/gastos", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({}));
      setFormError(respBody.error ?? (editandoId ? "No se pudo guardar el gasto" : "No se pudo crear el gasto"));
      return;
    }
    setAviso(editandoId ? "Gasto actualizado." : "Gasto creado.");
    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  }

  async function marcarPagado(id: string) {
    const res = await apiFetch(`/api/gastos/${id}`, { method: "PATCH", body: JSON.stringify({ estado: "pagado" }) });
    if (res.ok) cargar();
  }

  async function verComprobante(id: string) {
    const res = await apiFetch(`/api/gastos/${id}/comprobante`);
    if (!res.ok) return;
    const { url } = await res.json();
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!usuario) return null;

  const lista = gastos ?? [];
  const totales = {
    total: lista.reduce((acc, g) => acc + g.monto, 0),
    pendiente: lista.filter((g) => estadoMostrado(g) === "pendiente").reduce((acc, g) => acc + g.monto, 0),
    pagado: lista.filter((g) => g.estado === "pagado").reduce((acc, g) => acc + g.monto, 0),
    vencido: lista.filter((g) => estadoMostrado(g) === "vencido").reduce((acc, g) => acc + g.monto, 0),
  };

  const filtrados = lista.filter((g) => {
    const q = busqueda.trim().toLowerCase();
    if (q && !(g.descripcion ?? "").toLowerCase().includes(q) && !g.categoria.toLowerCase().includes(q)) return false;
    if (filtroEstado !== "todos" && estadoMostrado(g) !== filtroEstado) return false;
    if (filtroCategoria !== "todos" && g.categoria_gasto_id !== filtroCategoria) return false;
    return true;
  });

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Gastos</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Gestiona tus cuentas por pagar</p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto || editandoId ? cerrarFormulario() : abrirNuevo())}>
          Nuevo Gasto
        </Button>
      </div>

      <div className="mb-ds-6 grid gap-ds-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Total</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.total, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Pendiente</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-accent-700">{formatMoneda(totales.pendiente, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Pagado</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-accent2-800">{formatMoneda(totales.pagado, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text/60">Atrasado</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-accent-800">{formatMoneda(totales.vencido, usuario.moneda)}</p>
        </Card>
      </div>

      {(formAbierto || editandoId) && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar gasto" : "Nuevo gasto"}</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Input etiqueta="Descripción" valor={descripcion} onCambio={setDescripcion} />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto</label>
                  <InputMonto required value={monto} onChange={setMonto} moneda={usuario.moneda} />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Categoría</label>
                  <SelectCrear
                    value={categoriaGastoId}
                    onChange={setCategoriaGastoId}
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
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Centro de costo (opcional)</label>
                  <SelectCrear
                    value={centroCostoId}
                    onChange={setCentroCostoId}
                    opciones={centrosCosto}
                    endpoint="/api/centros-costo"
                    placeholder="Sin centro de costo"
                    etiquetaCrear="+ Crear centro de costo"
                    onCreado={(nuevo) => setCentrosCosto((prev) => [...prev, nuevo])}
                    gestionHref="/dashboard/configuracion/centros-costo"
                    gestionLabel="Gestionar centros de costo →"
                  />
                </div>
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Proveedor (opcional)</label>
                  <SelectCrear
                    value={proveedorId}
                    onChange={setProveedorId}
                    opciones={proveedores}
                    endpoint="/api/proveedores"
                    placeholder="Sin proveedor"
                    etiquetaCrear="+ Crear proveedor"
                    onCreado={(nuevo) => setProveedores((prev) => [...prev, nuevo])}
                    gestionHref="/dashboard/registros/proveedores"
                    gestionLabel="Gestionar proveedores →"
                  />
                </div>
                <Select
                  etiqueta="Orden de Servicio (opcional)"
                  valor={trabajoId}
                  onCambio={setTrabajoId}
                  opciones={[{ valor: "", etiqueta: "Sin vincular a una OS" }, ...trabajos.map((t) => ({ valor: t.id, etiqueta: `${t.fecha} — ${t.cliente}` }))]}
                />
                <FechaCampo etiqueta="Fecha" requerido valor={fecha} onCambio={setFecha} />
                <Select
                  etiqueta="Estado"
                  valor={estado}
                  onCambio={(v) => setEstado(v as EstadoGasto)}
                  opciones={[
                    { valor: "pendiente", etiqueta: "Pendiente" },
                    { valor: "pagado", etiqueta: "Pagado" },
                  ]}
                />
                {estado === "pagado" && <FechaCampo etiqueta="Fecha de pago" requerido valor={fechaPago} onCambio={setFechaPago} />}
                <div className="sm:col-span-2">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Comprobante / factura (opcional)</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                    className="block w-full font-ds-body text-ds-small text-ds-text/70 file:mr-ds-3 file:rounded-ds-md file:border file:border-ds-divider file:bg-ds-surface file:px-ds-3 file:py-2 file:font-ds-body file:text-ds-small file:font-medium file:text-ds-text"
                  />
                </div>
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  {editandoId ? "Guardar cambios" : "Agregar gasto"}
                </Button>
                <Button variante="ghost" onPress={cerrarFormulario}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {aviso ? <p className="mb-ds-6 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      <div className="mb-ds-4 flex flex-wrap gap-ds-3">
        <div className="max-w-sm">
          <Input placeholder="Buscar por descripción..." valor={busqueda} onCambio={setBusqueda} />
        </div>
        <Select
          valor={filtroEstado}
          onCambio={(v) => setFiltroEstado(v as typeof filtroEstado)}
          opciones={[
            { valor: "todos", etiqueta: "Todos los estados" },
            { valor: "pendiente", etiqueta: "Pendiente" },
            { valor: "pagado", etiqueta: "Pagado" },
            { valor: "vencido", etiqueta: "Atrasado" },
          ]}
        />
        <Select
          valor={filtroCategoria}
          onCambio={setFiltroCategoria}
          opciones={[{ valor: "todos", etiqueta: "Todas las categorías" }, ...categorias.map((c) => ({ valor: c.id, etiqueta: c.nombre }))]}
        />
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {gastos === null && !error ? <LoadingState /> : null}

      {gastos?.length === 0 && (
        <EmptyState
          icono={<Wallet size={28} strokeWidth={2.75} />}
          titulo="Ningún gasto registrado"
          mensaje="Registra tu primer gasto para comenzar"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Nuevo Gasto
            </Button>
          }
        />
      )}

      {gastos && gastos.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<Wallet size={28} strokeWidth={2.75} />} titulo="Ningún gasto coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Table<GastoConDatos>
          filas={filtrados}
          claveFila={(g) => g.id}
          vacio={{ titulo: "Ningún gasto coincide con la búsqueda o el filtro" }}
          columnas={[
            { encabezado: "Fecha", celda: (g) => g.fecha },
            {
              encabezado: "Descripción",
              celda: (g) => (
                <Link href={`/dashboard/gastos/${g.id}`} className="font-medium text-ds-text hover:text-ds-brand hover:underline">
                  {g.descripcion || "—"}
                </Link>
              ),
            },
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
            { encabezado: "Centro de costo", celda: (g) => g.centro_costo_info?.nombre ?? "—" },
            { encabezado: "Proveedor", celda: (g) => g.proveedor_info?.nombre ?? "—" },
            { encabezado: "Monto", clase: "text-right", celda: (g) => <Cifra>{formatMoneda(g.monto, usuario.moneda)}</Cifra> },
            {
              encabezado: "Estado",
              celda: (g) => (
                <div className="flex items-center gap-1.5">
                  <StatusBadge estado={estadoMostrado(g)} tonoForzado={TONO_ESTADO[estadoMostrado(g)]} />
                  {g.editado_en && (
                    <span className="text-[11px] text-ds-text/60" title={`Editado el ${new Date(g.editado_en).toLocaleString("es-CL")} después de estar pagado`}>
                      (editado)
                    </span>
                  )}
                </div>
              ),
            },
            {
              encabezado: "Acciones",
              celda: (g) => (
                <div className="flex items-center gap-ds-3">
                  <button type="button" onClick={() => abrirEdicion(g)} className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                    Editar
                  </button>
                  {g.estado === "pendiente" && (
                    <button type="button" onClick={() => marcarPagado(g.id)} className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                      Marcar pagado
                    </button>
                  )}
                  {g.comprobante_url && (
                    <button type="button" onClick={() => verComprobante(g.id)} className="inline-flex items-center gap-1 font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                      <Paperclip size={14} strokeWidth={2.75} />
                      Comprobante
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
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
