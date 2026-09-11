"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Plus, Wrench } from "lucide-react";
import type { Cliente, Equipo, Usuario } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Modal } from "@/components/Modal";
import { DocumentoForm } from "@/components/DocumentoForm";
import { Button, Card, EmptyState, ErrorState, Input, LoadingState, Select, StatusBadge, Table } from "@bitacora/ui/web";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";

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

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
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
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Equipos ({lista.length})</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">Activos propios de la empresa (ej. vehículos) y de tus clientes</p>
        </div>
        <div className="flex gap-ds-2">
          <Button variante="secundario" iconoIzq={<BarChart3 size={16} strokeWidth={2.75} />} onPress={() => router.push("/dashboard/registros/equipos/dashboard")}>
            Dashboard
          </Button>
          <Button variante="secundario" onPress={() => alert("Importar equipos desde CSV — próximamente.")}>
            Importar Equipos
          </Button>
          <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNuevo())}>
            Nuevo Equipo
          </Button>
        </div>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">{editandoId ? "Editar equipo" : "Nuevo equipo"}</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Cliente (opcional)</label>
                  <ComboboxCliente value={clienteId} onChange={setClienteId} clientes={clientes} onClienteCreado={(c) => setClientes((prev) => [...prev, c])} opcionVacia="Sin cliente — activo propio de la empresa" />
                </div>
                <Input etiqueta="Nombre del equipo" requerido valor={nombre} onCambio={setNombre} />
                <Select
                  etiqueta="Categoría"
                  valor={categoria}
                  onCambio={setCategoria}
                  opciones={[
                    { valor: "", etiqueta: "Sin categoría" },
                    ...CATEGORIAS.map((c) => ({ valor: c, etiqueta: c })),
                    ...(categoria && !CATEGORIAS.includes(categoria) ? [{ valor: categoria, etiqueta: categoria }] : []),
                  ]}
                />
                <Input etiqueta="Marca" valor={marca} onCambio={setMarca} />
                <Input etiqueta="Modelo" valor={modelo} onCambio={setModelo} />
                <Input etiqueta="N° de serie" valor={numeroSerie} onCambio={setNumeroSerie} />
                <FechaCampo etiqueta="Vencimiento de garantía (opcional)" valor={garantiaVencimiento} onCambio={setGarantiaVencimiento} />
              </div>

              {categoria === "Vehículo" && (
                <div className="rounded-ds-md border border-ds-divider p-ds-3">
                  <p className="mb-ds-3 font-ds-body text-[11px] font-semibold text-ds-text">Datos del vehículo</p>
                  <div className="grid gap-ds-4 sm:grid-cols-2">
                    <Input etiqueta="Patente" valor={patente} onCambio={setPatente} />
                    <Input etiqueta="Tipo" placeholder="Camión, camioneta…" valor={tipoVehiculo} onCambio={setTipoVehiculo} />
                    <Input etiqueta="Capacidad de carga" placeholder="ej. 5.000 kg" valor={capacidadCarga} onCambio={setCapacidadCarga} />
                    <Input etiqueta="Año" tipo="numero" valor={anio} onCambio={setAnio} />
                  </div>
                </div>
              )}

              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  {editandoId ? "Guardar cambios" : "Agregar equipo"}
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

      <div className="mb-ds-4 flex flex-col gap-ds-3">
        <div className="flex flex-wrap gap-ds-3">
          <div className="max-w-sm">
            <Input placeholder="Buscar equipos..." valor={busqueda} onCambio={setBusqueda} />
          </div>
          <Select valor={filtroCategoria} onCambio={setFiltroCategoria} opciones={[{ valor: "", etiqueta: "Todas las categorías" }, ...categoriasPresentes.map((c) => ({ valor: c, etiqueta: c }))]} />
        </div>
        <div className="flex flex-wrap gap-ds-2">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              onClick={() => setFiltro(c.valor)}
              className={`rounded-ds-pill border px-ds-3 py-1 font-ds-body text-ds-caption font-medium transition-colors ${
                filtro === c.valor ? "border-ds-brand bg-ds-brand/[0.08] text-ds-brand" : "border-ds-divider text-ds-text/70 hover:border-ds-text/30"
              }`}
            >
              {c.etiqueta} ({contadores[c.valor]})
            </button>
          ))}
        </div>
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {equipos === null && !error ? <LoadingState /> : null}

      {equipos?.length === 0 && (
        <EmptyState
          icono={<Wrench size={28} strokeWidth={2.75} />}
          titulo="Ningún equipo registrado"
          mensaje="Registra el primer equipo — de un cliente, o propio de la empresa (ej. un vehículo)"
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNuevo}>
              Nuevo Equipo
            </Button>
          }
        />
      )}

      {equipos && equipos.length > 0 && filtrados.length === 0 && (
        <EmptyState icono={<Wrench size={28} strokeWidth={2.75} />} titulo="Ningún equipo coincide con la búsqueda o el filtro" />
      )}

      {filtrados.length > 0 && (
        <Table<EquipoConCliente>
          filas={filtrados}
          claveFila={(e) => e.id}
          vacio={{ titulo: "Ningún equipo coincide con la búsqueda o el filtro" }}
          columnas={[
            { encabezado: "Nombre", celda: (e) => e.nombre },
            { encabezado: "Cliente", celda: (e) => e.cliente?.nombre ?? "Propio de la empresa" },
            { encabezado: "Marca / Modelo", celda: (e) => (e.marca || e.modelo ? [e.marca, e.modelo].filter(Boolean).join(" / ") : "—") },
            { encabezado: "Categoría", celda: (e) => e.categoria ?? "—" },
            { encabezado: "Patente", celda: (e) => e.patente ?? "—" },
            { encabezado: "Asignado a", celda: (e) => (e.categoria === "Vehículo" ? e.asignacion_vigente?.colaborador_nombre ?? "Sin asignar" : "—") },
            { encabezado: "Estado", celda: (e) => <StatusBadge estado={e.activo ? "activo" : "inactivo"} /> },
            {
              encabezado: "Acciones",
              celda: (e) => (
                <div className="flex flex-wrap gap-ds-2">
                  <Button variante="secundario" onPress={() => router.push(`/dashboard/registros/equipos/${e.id}`)}>
                    Ver ficha
                  </Button>
                  <Button variante="secundario" onPress={() => abrirEdicion(e)}>
                    Editar
                  </Button>
                  {e.categoria === "Vehículo" && (
                    <>
                      <Button variante="secundario" onPress={() => abrirAsignacion(e)}>
                        Asignación
                      </Button>
                      <Button variante="secundario" onPress={() => setEquipoDocumentos(e)}>
                        Documentos
                      </Button>
                    </>
                  )}
                  <Button variante="ghost" onPress={() => onAlternarActivo(e)}>
                    {e.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal open={equipoAsignando !== null} onClose={() => setEquipoAsignando(null)} title={`Asignación — ${equipoAsignando?.nombre ?? ""}`}>
        {equipoAsignando && (
          <div className="flex flex-col gap-ds-4">
            <div>
              <p className="mb-ds-1 font-ds-body text-[11px] font-semibold text-ds-text">Colaborador asignado</p>
              {equipoAsignando.asignacion_vigente ? (
                <div className="flex items-center justify-between">
                  <p className="font-ds-body text-ds-small text-ds-text">{equipoAsignando.asignacion_vigente.colaborador_nombre}</p>
                  <Button variante="secundario" onPress={onDesasignar}>
                    Desasignar
                  </Button>
                </div>
              ) : (
                <p className="font-ds-body text-ds-small text-ds-text/70">Sin asignar por ahora.</p>
              )}
            </div>
            <div className="flex items-start gap-ds-2 border-t border-ds-divider pt-ds-4">
              <div className="flex-1">
                <ComboboxResponsable value={colaboradorAsignar} onChange={setColaboradorAsignar} equipo={colaboradores} placeholder={equipoAsignando.asignacion_vigente ? "Reasignar a…" : "Asignar a…"} />
              </div>
              <Button onPress={onAsignar} deshabilitado={asignando || !colaboradorAsignar} cargando={asignando}>
                Asignar
              </Button>
            </div>
            <div className="border-t border-ds-divider pt-ds-4">
              <p className="mb-ds-2 font-ds-body text-[11px] font-semibold text-ds-text">Historial</p>
              {asignaciones.length === 0 ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">Sin historial todavía.</p>
              ) : (
                <div className="flex flex-col gap-ds-2 font-ds-body text-ds-small">
                  {asignaciones.map((a) => (
                    <div key={a.id} className="flex items-center justify-between border-b border-ds-divider pb-ds-2 last:border-0">
                      <span className="text-ds-text">{a.colaborador?.nombre ?? "—"}</span>
                      <span className="font-ds-body text-ds-caption text-ds-text/60">
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

// Input nativo type="date" — ver el mismo helper en rutas/nueva/page.tsx.
function FechaCampo({ etiqueta, valor, onCambio }: { etiqueta: string; valor: string; onCambio: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-ds-1">
      <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{etiqueta}</label>
      <input
        type="date"
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="h-11 w-full rounded-ds-md border border-ds-divider bg-ds-surface px-ds-3 font-ds-body text-ds-body text-ds-text transition-colors hover:border-ds-text/30 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ds-brand)]"
      />
    </div>
  );
}
