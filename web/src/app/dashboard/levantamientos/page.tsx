"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Camera, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type { Cliente, DetalleLevantamiento, EstadoLevantamiento, LevantamientoResumen, Usuario } from "@bitacora/shared";
import { FUNCIONES_LEVANTAMIENTOS, formatearFolio } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, DatePicker, ErrorState, Input, LoadingState, StatusBadge, Table } from "@bitacora/ui/web";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";
import { CatalogoSelectorModal, type ItemSeleccionadoCatalogo } from "@/components/CatalogoSelectorModal";

// LevantamientoResumen/DetalleLevantamiento vivían acá, redeclarados a
// mano (mismo shape que mobile y que el backend volvían a escribir cada
// uno por su lado) — única fuente de verdad ahora en @bitacora/shared.
// `Detalle` queda como alias local: el resto del archivo ya usaba ese
// nombre corto, no hacía falta tocar cada punto de uso.
type Detalle = DetalleLevantamiento;

// Mismo par de helpers que ya usa Agenda (web/src/app/dashboard/agenda/
// page.tsx) para su propio DatePicker — hora LOCAL, no toISOString
// (corre la fecha un día para atrás en husos negativos como Chile).
function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fechaDesdeString(fecha: string): Date {
  return new Date(`${fecha}T00:00:00`);
}

const TONO_ESTADO: Record<EstadoLevantamiento, "en_progreso" | "completado" | "cancelado"> = {
  creado: "en_progreso",
  asignado: "en_progreso",
  en_terreno: "en_progreso",
  completado_tecnico: "en_progreso",
  cotizado_externo: "en_progreso",
  aprobado: "completado",
  rechazado: "cancelado",
};

const ETIQUETA_ESTADO: Record<EstadoLevantamiento, string> = {
  creado: "Creado",
  asignado: "Asignado",
  en_terreno: "En terreno",
  completado_tecnico: "Completado por el técnico",
  cotizado_externo: "Cotizado (externo)",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

// Módulo opt-in (empresa_modulos) — Admin crea, técnico completa en
// terreno (mobile), Admin cotiza fuera de Bitácora y aprueba/rechaza.
function LevantamientosContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [levantamientos, setLevantamientos] = useState<LevantamientoResumen[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaVisita, setFechaVisita] = useState("");
  const [horaVisita, setHoraVisita] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [referenciaExterna, setReferenciaExterna] = useState("");
  const [accionando, setAccionando] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);

  const [editando, setEditando] = useState(false);
  const [editClienteId, setEditClienteId] = useState("");
  const [editTecnicoId, setEditTecnicoId] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editFechaVisita, setEditFechaVisita] = useState("");
  const [editHoraVisita, setEditHoraVisita] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [eliminandoFotoId, setEliminandoFotoId] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Dirección del cliente (23-sep-2026, pedido explícito) — se muestra
  // la que ya tiene en su ficha; si no tiene, se ofrece agregarla acá
  // mismo (PATCH directo a /api/clientes, no es un campo propio del
  // levantamiento).
  const [direccionNueva, setDireccionNueva] = useState("");
  const [guardandoDireccion, setGuardandoDireccion] = useState(false);

  // Descripción por foto (mismo pedido) — texto libre editable debajo
  // de cada miniatura, PATCH al perder el foco. Estado local aparte de
  // `detalle.fotos` para no perder lo tipeado mientras el usuario sigue
  // escribiendo (se resincroniza cada vez que se recarga el detalle).
  const [descripcionesFotos, setDescripcionesFotos] = useState<Record<string, string>>({});
  const [guardandoDescripcionFotoId, setGuardandoDescripcionFotoId] = useState<string | null>(null);

  // Fase 4 (23-sep-2026, pedido explícito): el Admin puede agregar más
  // materiales a un levantamiento que el técnico ya completó. Reusa
  // CatalogoSelectorModal (mismo componente que Cotizaciones/OS) pero
  // solo toma catalogo_item_id + cantidad de cada ítem elegido — este
  // material es una lista de qué se necesita, no lleva precio propio.
  const [catalogoAbierto, setCatalogoAbierto] = useState(false);
  const [agregandoMaterial, setAgregandoMaterial] = useState(false);

  async function cargarLevantamientos() {
    const res = await apiFetch("/api/levantamientos");
    if (!res.ok) {
      setError("No se pudieron cargar los levantamientos");
      return;
    }
    setLevantamientos(await res.json());
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      const [resMe, resClientes, resUsuarios] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/clientes"), apiFetch("/api/usuarios")]);
      if (resMe.ok) {
        const { usuario: u } = await resMe.json();
        if (u) {
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
        }
      }
      if (resClientes.ok) setClientes(await resClientes.json());
      if (resUsuarios.ok) {
        const todos: Usuario[] = await resUsuarios.json();
        setTecnicos(todos.filter((u) => u.funcion && FUNCIONES_LEVANTAMIENTOS.includes(u.funcion)));
      }
      await cargarLevantamientos();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Venimos de un levantamiento en el calendario de Agenda (?id=...):
  // abre su detalle y limpia el query param (mismo criterio que ?crear=1).
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    void abrirDetalle(id);
    router.replace("/dashboard/levantamientos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Venimos del menú "+ Nuevo" de Agenda (?crear=1): abre el form directo
  // y limpia el query param para que un refresh no lo reabra.
  useEffect(() => {
    if (searchParams.get("crear") !== "1") return;
    // Viene de "Crear Levantamiento" en el form rápido de Agenda — lo
    // que ya se había escrito ahí (cliente/descripción/fecha/hora) se
    // precarga acá, no se pierde por saltar de pantalla.
    const clienteIdParam = searchParams.get("cliente_id");
    const descripcionParam = searchParams.get("descripcion");
    const fechaVisitaParam = searchParams.get("fecha_visita");
    const horaVisitaParam = searchParams.get("hora_visita");
    if (clienteIdParam) setClienteId(clienteIdParam);
    if (descripcionParam) setDescripcion(descripcionParam);
    if (fechaVisitaParam) setFechaVisita(fechaVisitaParam);
    if (horaVisitaParam) setHoraVisita(horaVisitaParam);
    setFormAbierto(true);
    router.replace("/dashboard/levantamientos");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function crear() {
    if (!clienteId) return setFormError("Elige un cliente");
    setGuardando(true);
    setFormError(null);
    const res = await apiFetch("/api/levantamientos", {
      method: "POST",
      body: JSON.stringify({
        cliente_id: clienteId,
        tecnico_id: tecnicoId || undefined,
        descripcion_requerimiento: descripcion,
        fecha_visita: fechaVisita || undefined,
        hora_visita: horaVisita || undefined,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear el levantamiento");
      return;
    }
    setFormAbierto(false);
    setClienteId("");
    setTecnicoId("");
    setDescripcion("");
    setFechaVisita("");
    setHoraVisita("");
    await cargarLevantamientos();
  }

  async function abrirDetalle(id: string) {
    setDetalleId(id);
    setDetalle(null);
    setDetalleError(null);
    setReferenciaExterna("");
    const res = await apiFetch(`/api/levantamientos/${id}`);
    if (!res.ok) {
      setDetalleError("No se pudo cargar el detalle");
      return;
    }
    const d: Detalle = await res.json();
    setDetalle(d);
    setReferenciaExterna(d.referencia_externa ?? "");
    setDireccionNueva("");
    setDescripcionesFotos(Object.fromEntries(d.fotos.map((f) => [f.id, f.descripcion ?? ""])));
    setEditando(false);
  }

  function iniciarEdicion() {
    if (!detalle) return;
    setEditClienteId(detalle.cliente?.id ?? "");
    setEditTecnicoId(detalle.tecnico?.id ?? "");
    setEditDescripcion(detalle.descripcion_requerimiento ?? "");
    setEditFechaVisita(detalle.fecha_visita ?? "");
    setEditHoraVisita(detalle.hora_visita ?? "");
    setEditando(true);
  }

  async function guardarEdicion() {
    if (!detalle) return;
    setGuardandoEdicion(true);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        cliente_id: editClienteId,
        tecnico_id: editTecnicoId || null,
        descripcion_requerimiento: editDescripcion,
        fecha_visita: editFechaVisita || null,
        hora_visita: editHoraVisita || null,
      }),
    });
    setGuardandoEdicion(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo guardar");
      return;
    }
    await abrirDetalle(detalle.id);
    await cargarLevantamientos();
  }

  async function subirFoto(archivo: File) {
    if (!detalle) return;
    setSubiendoFoto(true);
    const fd = new FormData();
    fd.append("foto", archivo);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}/fotos`, { method: "POST", body: fd });
    setSubiendoFoto(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo subir la foto");
      return;
    }
    await abrirDetalle(detalle.id);
  }

  async function guardarDireccion() {
    if (!detalle?.cliente || !direccionNueva.trim()) return;
    setGuardandoDireccion(true);
    const res = await apiFetch(`/api/clientes/${detalle.cliente.id}`, { method: "PATCH", body: JSON.stringify({ direccion: direccionNueva.trim() }) });
    setGuardandoDireccion(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo guardar la dirección");
      return;
    }
    await abrirDetalle(detalle.id);
  }

  async function guardarDescripcionFoto(fotoId: string, descripcionAnterior: string | null) {
    if (!detalle) return;
    const nueva = descripcionesFotos[fotoId] ?? "";
    if (nueva === (descripcionAnterior ?? "")) return; // sin cambios — no pegarle a la API al tocar y salir sin escribir nada
    setGuardandoDescripcionFotoId(fotoId);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}/fotos/${fotoId}`, { method: "PATCH", body: JSON.stringify({ descripcion: nueva }) });
    setGuardandoDescripcionFotoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo guardar la descripción");
    }
  }

  async function eliminarFoto(fotoId: string) {
    if (!detalle) return;
    if (!confirm("¿Eliminar esta foto?")) return;
    setEliminandoFotoId(fotoId);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}/fotos/${fotoId}`, { method: "DELETE" });
    setEliminandoFotoId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo eliminar la foto");
      return;
    }
    await abrirDetalle(detalle.id);
  }

  async function eliminarLevantamiento() {
    if (!detalle) return;
    if (!confirm("¿Eliminar este levantamiento? No se puede deshacer.")) return;
    setEliminando(true);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}`, { method: "DELETE" });
    setEliminando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo eliminar");
      return;
    }
    setDetalleId(null);
    await cargarLevantamientos();
  }

  async function marcarCotizado() {
    if (!detalle) return;
    setAccionando(true);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}/cotizado`, {
      method: "PATCH",
      body: JSON.stringify({ referencia_externa: referenciaExterna }),
    });
    setAccionando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo marcar como cotizado");
      return;
    }
    await abrirDetalle(detalle.id);
    await cargarLevantamientos();
  }

  async function aprobar() {
    if (!detalle) return;
    setAccionando(true);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}/aprobar`, { method: "POST" });
    setAccionando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo aprobar");
      return;
    }
    await abrirDetalle(detalle.id);
    await cargarLevantamientos();
  }

  async function rechazar() {
    if (!detalle) return;
    if (!confirm("¿Rechazar este levantamiento? No se creará ninguna orden de servicio.")) return;
    setAccionando(true);
    const res = await apiFetch(`/api/levantamientos/${detalle.id}/rechazar`, { method: "POST" });
    setAccionando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDetalleError(body.error ?? "No se pudo rechazar");
      return;
    }
    await abrirDetalle(detalle.id);
    await cargarLevantamientos();
  }

  const puedeEditar = detalle != null && detalle.estado !== "aprobado" && detalle.estado !== "rechazado";
  const puedeEliminar = detalle != null && detalle.estado !== "aprobado";
  // Mismo estado que puedeEditar (backend rechaza con 409 en aprobado/
  // rechazado) + rol admin (backend rechaza con 403 a cualquier otro).
  const puedeAgregarMaterial = puedeEditar && usuario?.rol === "admin";

  async function onAgregarMateriales(items: ItemSeleccionadoCatalogo[]) {
    if (!detalle) return;
    setAgregandoMaterial(true);
    setDetalleError(null);
    for (const it of items) {
      if (!it.catalogo_item_id) continue; // el ítem "manual" del selector no aplica acá
      const res = await apiFetch(`/api/levantamientos/${detalle.id}/materiales`, {
        method: "POST",
        body: JSON.stringify({ catalogo_item_id: it.catalogo_item_id, cantidad: it.cantidad }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDetalleError(body.error ?? "No se pudo agregar el material");
        break;
      }
    }
    setAgregandoMaterial(false);
    setCatalogoAbierto(false);
    await abrirDetalle(detalle.id);
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <div className="flex flex-col gap-ds-4">
        <div className="flex items-center justify-between gap-ds-3">
          <div>
            <h1 className="text-ds-h2 font-ds-heading text-ds-text">Levantamientos</h1>
            <p className="text-ds-small text-ds-text/70">
              Evaluación en terreno antes de cotizar. La cotización se hace fuera de Bitácora — al aprobar, nace la orden de servicio.
            </p>
          </div>
          <Button variante="primario" iconoIzq={<Plus size={16} />} onPress={() => setFormAbierto(true)}>
            Nuevo levantamiento
          </Button>
        </div>

        {error ? <ErrorState mensaje={error} /> : null}
        {levantamientos === null && !error ? <LoadingState /> : null}

        {levantamientos !== null ? (
          <Table
            columnas={[
              { encabezado: "Folio", celda: (l) => formatearFolio("LEV", l.folio) ?? "—" },
              { encabezado: "Creado", celda: (l) => new Date(l.creado_en).toLocaleDateString("es-CL") },
              {
                encabezado: "Fecha de visita",
                celda: (l) =>
                  l.fecha_visita
                    ? new Date(`${l.fecha_visita}T00:00:00`).toLocaleDateString("es-CL") + (l.hora_visita ? ` · ${l.hora_visita}` : "")
                    : "—",
              },
              { encabezado: "Cliente", celda: (l) => l.cliente?.nombre ?? "—" },
              { encabezado: "Técnico", celda: (l) => l.tecnico?.nombre ?? "Sin asignar" },
              {
                encabezado: "Estado",
                celda: (l) => <StatusBadge estado={l.estado} etiqueta={ETIQUETA_ESTADO[l.estado]} tonoForzado={TONO_ESTADO[l.estado]} />,
              },
            ]}
            filas={levantamientos}
            claveFila={(l) => l.id}
            onFilaClick={(l) => abrirDetalle(l.id)}
            vacio={{ titulo: "Sin levantamientos todavía", mensaje: "Creá el primero para empezar.", icono: <Search size={32} /> }}
          />
        ) : null}
      </div>

      <Modal open={formAbierto} onClose={() => setFormAbierto(false)} title="Nuevo levantamiento">
        <div className="flex flex-col gap-ds-3">
          <ComboboxCliente value={clienteId} onChange={setClienteId} clientes={clientes} onClienteCreado={(c) => setClientes((prev) => [...prev, c])} />
          <ComboboxResponsable
            value={tecnicoId}
            onChange={setTecnicoId}
            equipo={tecnicos}
            opcionVacia="Asignar después"
            placeholder="Técnico o chofer asignado"
          />
          <div className="grid grid-cols-2 gap-ds-3">
            <DatePicker
              etiqueta="Fecha de visita (opcional)"
              ayuda="Cuándo debe ir el técnico a evaluar en terreno. Sin fecha, aparece como pendiente sin día fijo."
              valor={fechaVisita ? fechaDesdeString(fechaVisita) : null}
              onCambio={(f) => setFechaVisita(f ? fmtLocal(f) : "")}
            />
            <Input etiqueta="Hora (opcional)" tipo="hora" valor={horaVisita} onCambio={setHoraVisita} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="levantamiento-descripcion" className="text-ds-small font-medium text-ds-text/80">Qué necesita evaluar el técnico</label>
            <textarea
              id="levantamiento-descripcion"
              className="min-h-24 rounded-ds-md border border-ds-divider bg-ds-surface p-ds-3 text-ds-body text-ds-text outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej.: revisar instalación eléctrica del local, cotizar cableado nuevo…"
            />
          </div>
          {formError ? <p className="text-ds-small text-red-600">{formError}</p> : null}
          <Button variante="primario" cargando={guardando} onPress={crear}>
            Crear levantamiento
          </Button>
        </div>
      </Modal>

      <Modal open={detalleId != null} onClose={() => setDetalleId(null)} title={formatearFolio("LEV", detalle?.folio ?? null) ?? "Detalle del levantamiento"} wide>
        {!detalle ? (
          detalleError ? <ErrorState mensaje={detalleError} /> : <LoadingState />
        ) : (
          <div className="flex flex-col gap-ds-4">
            <div className="flex items-center justify-between">
              <StatusBadge estado={detalle.estado} etiqueta={ETIQUETA_ESTADO[detalle.estado]} tonoForzado={TONO_ESTADO[detalle.estado]} />
              <div className="flex items-center gap-ds-3">
                {detalle.trabajo_id ? (
                  <a href={`/dashboard/ordenes/${detalle.trabajo_id}`} className="text-ds-small font-medium text-ds-accent underline">
                    Ver {formatearFolio("OS", detalle.folio_os) ?? "OS"}
                  </a>
                ) : null}
                {puedeEditar && !editando ? (
                  <Button variante="secundario" tamano="sm" iconoIzq={<Pencil size={14} />} onPress={iniciarEdicion}>
                    Editar
                  </Button>
                ) : null}
              </div>
            </div>

            {editando ? (
              <div className="flex flex-col gap-ds-3 rounded-ds-md border border-ds-divider p-ds-3">
                <ComboboxCliente value={editClienteId} onChange={setEditClienteId} clientes={clientes} onClienteCreado={(c) => setClientes((prev) => [...prev, c])} />
                <ComboboxResponsable value={editTecnicoId} onChange={setEditTecnicoId} equipo={tecnicos} opcionVacia="Sin asignar" placeholder="Técnico o chofer asignado" />
                <div className="grid grid-cols-2 gap-ds-3">
                  <DatePicker
                    etiqueta="Fecha de visita (opcional)"
                    valor={editFechaVisita ? fechaDesdeString(editFechaVisita) : null}
                    onCambio={(f) => setEditFechaVisita(f ? fmtLocal(f) : "")}
                  />
                  <Input etiqueta="Hora (opcional)" tipo="hora" valor={editHoraVisita} onCambio={setEditHoraVisita} />
                </div>
                <textarea
                  className="min-h-24 rounded-ds-md border border-ds-divider bg-ds-surface p-ds-3 text-ds-body text-ds-text outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
                  value={editDescripcion}
                  onChange={(e) => setEditDescripcion(e.target.value)}
                  placeholder="Qué necesita evaluar el técnico"
                />
                <div className="flex gap-ds-2">
                  <Button variante="primario" tamano="sm" cargando={guardandoEdicion} onPress={guardarEdicion}>
                    Guardar cambios
                  </Button>
                  <Button variante="secundario" tamano="sm" onPress={() => setEditando(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-ds-3 text-ds-small sm:grid-cols-4">
                  <div>
                    <span className="text-ds-text-secondary">Cliente</span>
                    <p className="text-ds-text">{detalle.cliente?.nombre ?? "—"}</p>
                  </div>
                  <div>
                    <span className="text-ds-text-secondary">Técnico asignado</span>
                    <p className="text-ds-text">{detalle.tecnico?.nombre ?? "Sin asignar"}</p>
                  </div>
                  <div>
                    <span className="text-ds-text-secondary">Fecha de visita</span>
                    <p className="text-ds-text">
                      {detalle.fecha_visita
                        ? fechaDesdeString(detalle.fecha_visita).toLocaleDateString("es-CL") + (detalle.hora_visita ? ` · ${detalle.hora_visita}` : "")
                        : "Sin fecha"}
                    </p>
                  </div>
                  <div>
                    <span className="text-ds-text-secondary">Dirección</span>
                    {detalle.cliente?.direccion ? (
                      <p className="text-ds-text">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(detalle.cliente.direccion)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:text-ds-brand"
                        >
                          {detalle.cliente.direccion}
                        </a>
                      </p>
                    ) : puedeEditar ? (
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          value={direccionNueva}
                          onChange={(e) => setDireccionNueva(e.target.value)}
                          placeholder="Agregar dirección…"
                          className="h-8 min-w-0 flex-1 rounded-ds-sm border border-ds-divider bg-ds-surface px-ds-2 text-ds-small text-ds-text outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
                        />
                        <Button variante="secundario" tamano="sm" cargando={guardandoDireccion} deshabilitado={!direccionNueva.trim()} onPress={guardarDireccion}>
                          Guardar
                        </Button>
                      </div>
                    ) : (
                      <p className="text-ds-text-secondary">Sin dirección</p>
                    )}
                  </div>
                </div>

                {detalle.descripcion_requerimiento ? (
                  <div>
                    <span className="text-ds-small text-ds-text-secondary">Qué se pidió evaluar</span>
                    <p className="text-ds-body text-ds-text">{detalle.descripcion_requerimiento}</p>
                  </div>
                ) : null}
              </>
            )}

            {detalle.descripcion_tecnico ? (
              <div>
                <span className="text-ds-small text-ds-text-secondary">Lo que observó el técnico</span>
                <p className="text-ds-body text-ds-text">{detalle.descripcion_tecnico}</p>
              </div>
            ) : null}

            <div>
              <div className="flex items-center justify-between">
                <span className="text-ds-small font-medium text-ds-text/80">Materiales indicados</span>
                {puedeAgregarMaterial ? (
                  <Button variante="ghost" tamano="sm" iconoIzq={<Plus size={14} strokeWidth={2.75} />} onPress={() => setCatalogoAbierto(true)} deshabilitado={agregandoMaterial}>
                    Agregar
                  </Button>
                ) : null}
              </div>
              {detalle.materiales.length === 0 ? (
                <p className="text-ds-small text-ds-text-secondary">Todavía no hay materiales cargados.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {detalle.materiales.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 text-ds-small text-ds-text">
                      <span className="flex items-center gap-2">
                        {m.catalogo_item?.nombre ?? "Ítem eliminado"}
                        {m.agregado_por_admin ? <StatusBadge estado="agregado_admin" etiqueta="Agregado por Admin" tonoForzado="en_progreso" /> : null}
                      </span>
                      <span className="tabular-nums">
                        {m.cantidad} {m.catalogo_item?.unidad ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <span className="text-ds-small font-medium text-ds-text/80">Fotos</span>
                {puedeEditar ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const archivo = e.target.files?.[0];
                        if (archivo) void subirFoto(archivo);
                        e.target.value = "";
                      }}
                    />
                    <Button variante="secundario" tamano="sm" iconoIzq={<Camera size={14} />} cargando={subiendoFoto} onPress={() => fileRef.current?.click()}>
                      Agregar foto
                    </Button>
                  </>
                ) : null}
              </div>
              {detalle.fotos.length === 0 ? (
                <p className="mt-1 text-ds-small text-ds-text-secondary">Sin fotos todavía.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-ds-2">
                  {detalle.fotos.map((f) => (
                    <div key={f.id} className="flex w-24 flex-col gap-1">
                      <div className="group relative">
                        <a href={f.url} target="_blank" rel="noopener noreferrer">
                          {/* URL firmada (vence) — sin optimizer, con lazy-load igual. */}
                          <Image src={f.url} alt="" width={96} height={96} unoptimized className="h-24 w-24 rounded-ds-md border border-ds-divider object-cover" />
                        </a>
                        {puedeEditar ? (
                          <button
                            type="button"
                            onClick={() => eliminarFoto(f.id)}
                            disabled={eliminandoFotoId === f.id}
                            className="absolute right-1 top-1 rounded-ds-pill bg-ds-accent-700 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-50"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                      {puedeEditar ? (
                        <input
                          value={descripcionesFotos[f.id] ?? ""}
                          onChange={(e) => setDescripcionesFotos((prev) => ({ ...prev, [f.id]: e.target.value }))}
                          onBlur={() => guardarDescripcionFoto(f.id, f.descripcion)}
                          disabled={guardandoDescripcionFotoId === f.id}
                          placeholder="Descripción…"
                          className="h-7 w-full rounded-ds-sm border border-ds-divider bg-ds-surface px-1 text-[11px] text-ds-text outline-none focus-visible:ring-2 focus-visible:ring-ds-accent"
                        />
                      ) : f.descripcion ? (
                        <p className="text-[11px] leading-tight text-ds-text/70">{f.descripcion}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {detalleError ? <p className="text-ds-small text-red-600">{detalleError}</p> : null}

            {detalle.estado === "completado_tecnico" ? (
              <div className="flex flex-col gap-ds-2 border-t border-ds-divider pt-ds-3">
                <label htmlFor="levantamiento-referencia" className="text-ds-small font-medium text-ds-text/80">Referencia de la cotización externa (opcional)</label>
                <Input id="levantamiento-referencia" valor={referenciaExterna} onCambio={setReferenciaExterna} placeholder="Ej.: Defontana folio 4821" />
                <Button variante="primario" cargando={accionando} onPress={marcarCotizado}>
                  Marcar cotizado externamente
                </Button>
              </div>
            ) : null}

            {detalle.estado === "cotizado_externo" ? (
              <div className="flex gap-ds-2 border-t border-ds-divider pt-ds-3">
                <Button variante="primario" cargando={accionando} onPress={aprobar}>
                  Aprobar — crear OS
                </Button>
                <Button variante="peligro" cargando={accionando} onPress={rechazar}>
                  Rechazar
                </Button>
              </div>
            ) : null}

            {puedeEliminar ? (
              <div className="border-t border-ds-divider pt-ds-3">
                <Button variante="peligro" tamano="sm" iconoIzq={<Trash2 size={14} />} cargando={eliminando} onPress={eliminarLevantamiento}>
                  Eliminar levantamiento
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      <CatalogoSelectorModal
        open={catalogoAbierto}
        onClose={() => setCatalogoAbierto(false)}
        onAgregar={onAgregarMateriales}
        moneda={usuario.moneda ?? "CLP"}
        avisaDescuentoStock={false}
      />
    </DashboardShell>
  );
}

// useSearchParams() necesita un boundary de Suspense para el build de
// producción (si no, Next aborta con "missing-suspense-with-csr-bailout").
export default function LevantamientosPage() {
  return (
    <Suspense fallback={null}>
      <LevantamientosContenido />
    </Suspense>
  );
}
