"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CategoriaGasto, CentroCosto, EstadoGasto, Gasto, Proveedor, Trabajo } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { SelectCrear } from "@/components/SelectCrear";
import { Badge, Button, Card, Cifra, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconPaperclip, IconPlus, IconWallet } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Gastos" subtitle="Gestiona tus cuentas por pagar" />
        <Button type="button" onClick={() => (formAbierto || editandoId ? cerrarFormulario() : abrirNuevo())}>
          <IconPlus className="h-4 w-4" />
          Nuevo Gasto
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Total</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatMoneda(totales.total, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Pendiente</p>
          <p className="mt-1 text-xl font-semibold text-warning">{formatMoneda(totales.pendiente, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Pagado</p>
          <p className="mt-1 text-xl font-semibold text-success">{formatMoneda(totales.pagado, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Atrasado</p>
          <p className="mt-1 text-xl font-semibold text-danger">{formatMoneda(totales.vencido, usuario.moneda)}</p>
        </Card>
      </div>

      {(formAbierto || editandoId) && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar gasto" : "Nuevo gasto"}</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Descripción</Label>
                <Input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </div>
              <div>
                <Label>Monto</Label>
                <Input type="number" min="0" step="1" required value={monto} onChange={(e) => setMonto(e.target.value)} />
              </div>
              <div>
                <Label>Categoría</Label>
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
              <div>
                <Label>Centro de costo (opcional)</Label>
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
              <div>
                <Label>Proveedor (opcional)</Label>
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
              <div>
                <Label>Orden de Servicio (opcional)</Label>
                <Select value={trabajoId} onChange={(e) => setTrabajoId(e.target.value)}>
                  <option value="">Sin vincular a una OS</option>
                  {trabajos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fecha} — {t.cliente}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Fecha</Label>
                <Input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div>
                <Label>Estado</Label>
                <Select value={estado} onChange={(e) => setEstado(e.target.value as EstadoGasto)}>
                  <option value="pendiente">Pendiente</option>
                  <option value="pagado">Pagado</option>
                </Select>
              </div>
              {estado === "pagado" && (
                <div>
                  <Label>Fecha de pago</Label>
                  <Input type="date" required value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <Label>Comprobante / factura (opcional)</Label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-surface file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-foreground"
                />
              </div>
            </div>
            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar gasto"}
              </Button>
              <Button type="button" variant="ghost" onClick={cerrarFormulario}>
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

      <div className="mb-4 flex flex-wrap gap-3">
        <Input type="text" placeholder="Buscar por descripción..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
        <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as typeof filtroEstado)} className="w-48">
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pagado">Pagado</option>
          <option value="vencido">Atrasado</option>
        </Select>
        <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="w-56">
          <option value="todos">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {gastos === null && !error && <EstadoCargando />}

      {gastos?.length === 0 && (
        <EstadoVacio
          icono={IconWallet}
          titulo="Ningún gasto registrado"
          mensaje="Registra tu primer gasto para comenzar"
          accion={<Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Gasto
            </Button>}
        />
      )}

      {gastos && gastos.length > 0 && filtrados.length === 0 && (
        <EstadoVacio icono={IconWallet} titulo="Ningún gasto coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Descripción</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Centro de costo</th>
                <th className="px-5 py-3 font-medium">Proveedor</th>
                <th className="px-5 py-3 text-right font-medium">Monto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((g) => (
                <tr key={g.id} className="border-b border-border-soft last:border-0 hover:bg-surface-sunken">
                  <td className="px-5 py-3 text-muted">{g.fecha}</td>
                  <td className="px-5 py-3 font-medium text-foreground">
                    <Link href={`/dashboard/gastos/${g.id}`} className="hover:text-brand hover:underline">
                      {g.descripcion || "—"}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {g.categoria_info ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: g.categoria_info.color }}>
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.categoria_info.color }} />
                        {g.categoria_info.nombre}
                      </span>
                    ) : (
                      <span className="text-muted">{g.categoria}</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-muted">{g.centro_costo_info?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{g.proveedor_info?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-right"><Cifra>{formatMoneda(g.monto, usuario.moneda)}</Cifra></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge value={estadoMostrado(g)} />
                      {g.editado_en && (
                        <span className="text-[11px] text-muted" title={`Editado el ${new Date(g.editado_en).toLocaleString("es-CL")} después de estar pagado`}>
                          (editado)
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => abrirEdicion(g)} className="text-xs font-medium text-brand hover:underline">
                        Editar
                      </button>
                      {g.estado === "pendiente" && (
                        <button type="button" onClick={() => marcarPagado(g.id)} className="text-xs font-medium text-brand hover:underline">
                          Marcar pagado
                        </button>
                      )}
                      {g.comprobante_url && (
                        <button type="button" onClick={() => verComprobante(g.id)} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-brand">
                          <IconPaperclip className="h-3.5 w-3.5" />
                          Comprobante
                        </button>
                      )}
                    </div>
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
