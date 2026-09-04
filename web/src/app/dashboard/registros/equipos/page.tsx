"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Cliente, Equipo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Modal } from "@/components/Modal";
import { DocumentoForm } from "@/components/DocumentoForm";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { IconChartBar, IconPlus, IconWrench } from "@/components/icons";
import { EstadoCargando, EstadoVacio } from "@/components/estados";

type EquipoConCliente = Equipo & {
  cliente: Pick<Cliente, "id" | "nombre"> | null;
  asignacion_vigente: { colaborador_id: string; colaborador_nombre: string } | null;
};
type Filtro = "todos" | "activos" | "inactivos";
type Asignacion = { id: string; colaborador_id: string; desde: string; hasta: string | null; colaborador: { nombre: string } | null };

// Categorías conocidas — "Vehículo" es la única con campos propios
// (patente, tipo, capacidad de carga, año) y asignación a colaborador.
// Cualquier otro valor ya guardado (categoría libre de antes de este
// cambio) se sigue mostrando tal cual, no se pierde.
const CATEGORIAS = ["Vehículo", "Maquinaria", "Herramienta", "Otro"];
const SIN_CLIENTE = "";

export default function EquiposPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [equipos, setEquipos] = useState<EquipoConCliente[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [colaboradores, setColaboradores] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [clienteId, setClienteId] = useState(SIN_CLIENTE);
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [categoria, setCategoria] = useState("");
  const [patente, setPatente] = useState("");
  const [tipoVehiculo, setTipoVehiculo] = useState("");
  const [capacidadCarga, setCapacidadCarga] = useState("");
  const [anio, setAnio] = useState("");
  // Bloque C — no es exclusivo de Vehículo: cualquier equipo puede
  // tener garantía. Alimenta la métrica "garantías por vencer" del
  // dashboard de Equipos.
  const [garantiaVencimiento, setGarantiaVencimiento] = useState("");

  // Modal de asignación (solo equipos categoría "Vehículo"): asignar,
  // reasignar, desasignar e historial, todo en un mismo lugar — antes
  // vivía en la ficha aparte de Vehículos.
  const [equipoAsignando, setEquipoAsignando] = useState<EquipoConCliente | null>(null);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [colaboradorAsignar, setColaboradorAsignar] = useState("");
  const [asignando, setAsignando] = useState(false);

  // Modal de documentos (licencia/revisión técnica/seguro) — solo
  // equipos categoría "Vehículo".
  const [equipoDocumentos, setEquipoDocumentos] = useState<EquipoConCliente | null>(null);

  function abrirNuevo() {
    setEditandoId(null);
    setClienteId(SIN_CLIENTE);
    setNombre("");
    setMarca("");
    setModelo("");
    setNumeroSerie("");
    setCategoria("");
    setPatente("");
    setTipoVehiculo("");
    setCapacidadCarga("");
    setAnio("");
    setGarantiaVencimiento("");
    setFormError(null);
    setFormAbierto(true);
  }

  function abrirEdicion(e: EquipoConCliente) {
    setEditandoId(e.id);
    setClienteId(e.cliente_id ?? SIN_CLIENTE);
    setNombre(e.nombre);
    setMarca(e.marca ?? "");
    setModelo(e.modelo ?? "");
    setNumeroSerie(e.numero_serie ?? "");
    setCategoria(e.categoria ?? "");
    setPatente(e.patente ?? "");
    setTipoVehiculo(e.tipo_vehiculo ?? "");
    setCapacidadCarga(e.capacidad_carga ?? "");
    setAnio(e.anio ? String(e.anio) : "");
    setGarantiaVencimiento(e.garantia_vencimiento ?? "");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onAlternarActivo(e: EquipoConCliente) {
    const res = await apiFetch(`/api/equipos/${e.id}`, { method: "PATCH", body: JSON.stringify({ activo: !e.activo }) });
    if (res.ok) cargar();
  }

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resEquipos, resClientes, resUsuarios] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch("/api/equipos"),
      apiFetch("/api/clientes"),
      apiFetch("/api/usuarios"),
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
    if (resUsuarios.ok) {
      const todos: Usuario[] = await resUsuarios.json();
      setColaboradores(todos.filter((u) => u.rol === "colaborador" && u.activo));
    }
    if (!resEquipos.ok) {
      setError("No se pudieron cargar los equipos");
      return;
    }
    setEquipos(await resEquipos.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setAviso(null);
    setGuardando(true);
    const body = JSON.stringify({
      cliente_id: clienteId || null,
      nombre,
      marca,
      modelo,
      numero_serie: numeroSerie,
      categoria,
      patente: categoria === "Vehículo" ? patente : "",
      tipo_vehiculo: categoria === "Vehículo" ? tipoVehiculo : "",
      capacidad_carga: categoria === "Vehículo" ? capacidadCarga : "",
      anio: categoria === "Vehículo" ? anio || null : null,
      garantia_vencimiento: garantiaVencimiento || null,
    });
    const res = editandoId
      ? await apiFetch(`/api/equipos/${editandoId}`, { method: "PATCH", body })
      : await apiFetch("/api/equipos", { method: "POST", body });
    setGuardando(false);
    if (!res.ok) {
      const respBody = await res.json().catch(() => ({}));
      setFormError(respBody.error ?? "No se pudo guardar el equipo");
      return;
    }
    setAviso(editandoId ? "Equipo actualizado." : "Equipo creado.");
    setFormAbierto(false);
    setEditandoId(null);
    cargar();
  }

  async function abrirAsignacion(e: EquipoConCliente) {
    setEquipoAsignando(e);
    setColaboradorAsignar("");
    setAsignaciones([]);
    const res = await apiFetch(`/api/equipos/${e.id}/asignaciones`);
    if (res.ok) setAsignaciones(await res.json());
  }

  async function onAsignar() {
    if (!equipoAsignando || !colaboradorAsignar) return;
    setAsignando(true);
    const res = await apiFetch(`/api/equipos/${equipoAsignando.id}/asignar`, {
      method: "POST",
      body: JSON.stringify({ colaborador_id: colaboradorAsignar }),
    });
    setAsignando(false);
    if (res.ok) {
      setEquipoAsignando(null);
      cargar();
    }
  }

  async function onDesasignar() {
    if (!equipoAsignando) return;
    const res = await apiFetch(`/api/equipos/${equipoAsignando.id}/desasignar`, { method: "POST" });
    if (res.ok) {
      setEquipoAsignando(null);
      cargar();
    }
  }

  if (!usuario) return null;

  const lista = equipos ?? [];
  const contadores = {
    todos: lista.length,
    activos: lista.filter((e) => e.activo).length,
    inactivos: lista.filter((e) => !e.activo).length,
  };
  const categoriasPresentes = Array.from(new Set(lista.map((e) => e.categoria).filter((c): c is string => Boolean(c)))).sort();

  const filtrados = lista.filter((e) => {
    const q = busqueda.trim().toLowerCase();
    if (
      q &&
      !e.nombre.toLowerCase().includes(q) &&
      !(e.marca ?? "").toLowerCase().includes(q) &&
      !(e.modelo ?? "").toLowerCase().includes(q) &&
      !(e.numero_serie ?? "").toLowerCase().includes(q) &&
      !(e.patente ?? "").toLowerCase().includes(q) &&
      !(e.cliente?.nombre ?? "").toLowerCase().includes(q)
    ) {
      return false;
    }
    if (filtroCategoria && e.categoria !== filtroCategoria) return false;
    if (filtro === "activos") return e.activo;
    if (filtro === "inactivos") return !e.activo;
    return true;
  });

  const CHIPS: { valor: Filtro; etiqueta: string }[] = [
    { valor: "todos", etiqueta: "Todos" },
    { valor: "activos", etiqueta: "Activos" },
    { valor: "inactivos", etiqueta: "Inactivos" },
  ];

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title={`Equipos (${lista.length})`} subtitle="Activos propios de la empresa (ej. vehículos) y de tus clientes" />
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/dashboard/registros/equipos/dashboard")}>
            <IconChartBar className="h-4 w-4" />
            Dashboard
          </Button>
          <Button type="button" variant="outline" onClick={() => alert("Importar equipos desde CSV — próximamente.")}>
            Importar Equipos
          </Button>
          <Button type="button" onClick={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
            <IconPlus className="h-4 w-4" />
            Nuevo Equipo
          </Button>
        </div>
      </div>

      {formAbierto && (
        <Card className="mb-6">
          <h2 className="mb-4 text-sm font-semibold text-foreground">{editandoId ? "Editar equipo" : "Nuevo equipo"}</h2>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Cliente (opcional)</Label>
                <ComboboxCliente
                  value={clienteId}
                  onChange={setClienteId}
                  clientes={clientes}
                  onClienteCreado={(c) => setClientes((prev) => [...prev, c])}
                  opcionVacia="Sin cliente — activo propio de la empresa"
                />
              </div>
              <div>
                <Label>Nombre del equipo</Label>
                <Input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div>
                <Label>Categoría</Label>
                <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  {categoria && !CATEGORIAS.includes(categoria) && <option value={categoria}>{categoria}</option>}
                </Select>
              </div>
              <div>
                <Label>Marca</Label>
                <Input type="text" value={marca} onChange={(e) => setMarca(e.target.value)} />
              </div>
              <div>
                <Label>Modelo</Label>
                <Input type="text" value={modelo} onChange={(e) => setModelo(e.target.value)} />
              </div>
              <div>
                <Label>N° de serie</Label>
                <Input type="text" value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
              </div>
              <div>
                <Label>Vencimiento de garantía (opcional)</Label>
                <Input type="date" value={garantiaVencimiento} onChange={(e) => setGarantiaVencimiento(e.target.value)} />
              </div>
            </div>

            {categoria === "Vehículo" && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-3 text-xs font-semibold text-foreground">Datos del vehículo</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Patente</Label>
                    <Input type="text" value={patente} onChange={(e) => setPatente(e.target.value)} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Input type="text" placeholder="Camión, camioneta…" value={tipoVehiculo} onChange={(e) => setTipoVehiculo(e.target.value)} />
                  </div>
                  <div>
                    <Label>Capacidad de carga</Label>
                    <Input type="text" placeholder="ej. 5.000 kg" value={capacidadCarga} onChange={(e) => setCapacidadCarga(e.target.value)} />
                  </div>
                  <div>
                    <Label>Año</Label>
                    <Input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {formError && <ErrorText>{formError}</ErrorText>}
            <div className="flex gap-2">
              <Button type="submit" disabled={guardando} className="self-start">
                {guardando ? "Guardando…" : editandoId ? "Guardar cambios" : "Agregar equipo"}
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

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Input type="text" placeholder="Buscar equipos..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="max-w-sm" />
          <Select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="max-w-[12rem]">
            <option value="">Todas las categorías</option>
            {categoriasPresentes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                filtro === c.valor ? "border-transparent bg-brand-soft text-brand" : "border-border text-muted"
              }`}
            >
              {c.etiqueta} ({contadores[c.valor]})
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {equipos === null && !error && <EstadoCargando />}

      {equipos?.length === 0 && (
        <EstadoVacio
          icono={IconWrench}
          titulo="Ningún equipo registrado"
          mensaje="Registra el primer equipo — de un cliente, o propio de la empresa (ej. un vehículo)"
          accion={<Button type="button" onClick={abrirNuevo}>
              <IconPlus className="h-4 w-4" />
              Nuevo Equipo
            </Button>}
        />
      )}

      {equipos && equipos.length > 0 && filtrados.length === 0 && (
        <EstadoVacio icono={IconWrench} titulo="Ningún equipo coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-sunken font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                <th className="px-5 py-3 font-medium">Nombre</th>
                <th className="px-5 py-3 font-medium">Cliente</th>
                <th className="px-5 py-3 font-medium">Marca / Modelo</th>
                <th className="px-5 py-3 font-medium">Categoría</th>
                <th className="px-5 py-3 font-medium">Patente</th>
                <th className="px-5 py-3 font-medium">Asignado a</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => (
                <tr key={e.id} className="border-b border-border-soft last:border-0 hover:bg-surface-sunken">
                  <td className="px-5 py-3 font-medium text-foreground">{e.nombre}</td>
                  <td className="px-5 py-3 text-muted">{e.cliente?.nombre ?? "Propio de la empresa"}</td>
                  <td className="px-5 py-3 text-muted">
                    {e.marca || e.modelo ? [e.marca, e.modelo].filter(Boolean).join(" / ") : "—"}
                  </td>
                  <td className="px-5 py-3 text-muted">{e.categoria ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{e.patente ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">
                    {e.categoria === "Vehículo" ? e.asignacion_vigente?.colaborador_nombre ?? "Sin asignar" : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <Badge value={e.activo ? "activo" : "inactivo"} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/registros/equipos/${e.id}`)}>
                        Ver ficha
                      </Button>
                      <Button type="button" variant="outline" onClick={() => abrirEdicion(e)}>
                        Editar
                      </Button>
                      {e.categoria === "Vehículo" && (
                        <>
                          <Button type="button" variant="outline" onClick={() => abrirAsignacion(e)}>
                            Asignación
                          </Button>
                          <Button type="button" variant="outline" onClick={() => setEquipoDocumentos(e)}>
                            Documentos
                          </Button>
                        </>
                      )}
                      <Button type="button" variant="ghost" onClick={() => onAlternarActivo(e)}>
                        {e.activo ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={equipoAsignando !== null} onClose={() => setEquipoAsignando(null)} title={`Asignación — ${equipoAsignando?.nombre ?? ""}`}>
        {equipoAsignando && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1 text-xs font-semibold text-foreground">Colaborador asignado</p>
              {equipoAsignando.asignacion_vigente ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">{equipoAsignando.asignacion_vigente.colaborador_nombre}</p>
                  <Button type="button" variant="outline" onClick={onDesasignar}>
                    Desasignar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted">Sin asignar por ahora.</p>
              )}
            </div>
            <div className="flex items-start gap-2 border-t border-border pt-4">
              <div className="flex-1">
                <ComboboxResponsable
                  value={colaboradorAsignar}
                  onChange={setColaboradorAsignar}
                  equipo={colaboradores}
                  placeholder={equipoAsignando.asignacion_vigente ? "Reasignar a…" : "Asignar a…"}
                />
              </div>
              <Button type="button" onClick={onAsignar} disabled={asignando || !colaboradorAsignar}>
                {asignando ? "…" : "Asignar"}
              </Button>
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold text-foreground">Historial</p>
              {asignaciones.length === 0 ? (
                <p className="text-sm text-muted">Sin historial todavía.</p>
              ) : (
                <div className="flex flex-col gap-2 text-sm">
                  {asignaciones.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-b border-border pb-2 last:border-0">
                      <span className="text-foreground">{a.colaborador?.nombre ?? "—"}</span>
                      <span className="text-xs text-muted">
                        {a.desde} → {a.hasta ?? "hoy"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={equipoDocumentos !== null} onClose={() => setEquipoDocumentos(null)} title={`Documentos — ${equipoDocumentos?.nombre ?? ""}`} wide>
        {equipoDocumentos && <DocumentoForm entidadTipo="vehiculo" entidadId={equipoDocumentos.id} />}
      </Modal>
    </DashboardShell>
  );
}
