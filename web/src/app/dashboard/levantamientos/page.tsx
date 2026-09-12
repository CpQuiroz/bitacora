"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import type { Cliente, EstadoLevantamiento, Usuario } from "@bitacora/shared";
import { FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, ErrorState, Input, LoadingState, StatusBadge, Table } from "@bitacora/ui/web";
import { Modal } from "@/components/Modal";
import { ComboboxCliente } from "@/components/ComboboxCliente";
import { ComboboxResponsable } from "@/components/ComboboxResponsable";

type LevantamientoResumen = {
  id: string;
  estado: EstadoLevantamiento;
  descripcion_requerimiento: string | null;
  creado_en: string;
  cliente: { id: string; nombre: string } | null;
  tecnico: { id: string; nombre: string } | null;
};

type Material = { id: string; catalogo_item_id: string; cantidad: number; catalogo_item: { id: string; nombre: string; precio_base: number; unidad: string } | null };
type Foto = { id: string; url: string; creado_en: string };

type Detalle = LevantamientoResumen & {
  descripcion_tecnico: string | null;
  referencia_externa: string | null;
  trabajo_id: string | null;
  folio_os: number | null;
  materiales: Material[];
  fotos: Foto[];
};

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
export default function LevantamientosPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [levantamientos, setLevantamientos] = useState<LevantamientoResumen[] | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [formAbierto, setFormAbierto] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [tecnicoId, setTecnicoId] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [referenciaExterna, setReferenciaExterna] = useState("");
  const [accionando, setAccionando] = useState(false);
  const [detalleError, setDetalleError] = useState<string | null>(null);

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

  async function crear() {
    if (!clienteId) return setFormError("Elige un cliente");
    setGuardando(true);
    setFormError(null);
    const res = await apiFetch("/api/levantamientos", {
      method: "POST",
      body: JSON.stringify({ cliente_id: clienteId, tecnico_id: tecnicoId || undefined, descripcion_requerimiento: descripcion }),
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

  if (!usuario || levantamientos === null) {
    return error ? <ErrorState mensaje={error} /> : <LoadingState />;
  }

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

        <Table
          columnas={[
            { encabezado: "Fecha", celda: (l) => new Date(l.creado_en).toLocaleDateString("es-CL") },
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
          <div className="flex flex-col gap-1">
            <label className="text-ds-small font-medium text-ds-text/80">Qué necesita evaluar el técnico</label>
            <textarea
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

      <Modal open={detalleId != null} onClose={() => setDetalleId(null)} title="Detalle del levantamiento" wide>
        {!detalle ? (
          detalleError ? <ErrorState mensaje={detalleError} /> : <LoadingState />
        ) : (
          <div className="flex flex-col gap-ds-4">
            <div className="flex items-center justify-between">
              <StatusBadge estado={detalle.estado} etiqueta={ETIQUETA_ESTADO[detalle.estado]} tonoForzado={TONO_ESTADO[detalle.estado]} />
              {detalle.trabajo_id ? (
                <a href={`/dashboard/ordenes/${detalle.trabajo_id}`} className="text-ds-small font-medium text-ds-accent underline">
                  Ver OS N° {detalle.folio_os ?? "—"}
                </a>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-ds-3 text-ds-small">
              <div>
                <span className="text-ds-text/60">Cliente</span>
                <p className="text-ds-text">{detalle.cliente?.nombre ?? "—"}</p>
              </div>
              <div>
                <span className="text-ds-text/60">Técnico asignado</span>
                <p className="text-ds-text">{detalle.tecnico?.nombre ?? "Sin asignar"}</p>
              </div>
            </div>

            {detalle.descripcion_requerimiento ? (
              <div>
                <span className="text-ds-small text-ds-text/60">Qué se pidió evaluar</span>
                <p className="text-ds-body text-ds-text">{detalle.descripcion_requerimiento}</p>
              </div>
            ) : null}

            {detalle.descripcion_tecnico ? (
              <div>
                <span className="text-ds-small text-ds-text/60">Lo que observó el técnico</span>
                <p className="text-ds-body text-ds-text">{detalle.descripcion_tecnico}</p>
              </div>
            ) : null}

            <div>
              <span className="text-ds-small font-medium text-ds-text/80">Materiales indicados</span>
              {detalle.materiales.length === 0 ? (
                <p className="text-ds-small text-ds-text/60">Todavía no hay materiales cargados.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {detalle.materiales.map((m) => (
                    <li key={m.id} className="flex justify-between text-ds-small text-ds-text">
                      <span>{m.catalogo_item?.nombre ?? "Ítem eliminado"}</span>
                      <span className="tabular-nums">
                        {m.cantidad} {m.catalogo_item?.unidad ?? ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {detalle.fotos.length > 0 ? (
              <div>
                <span className="text-ds-small font-medium text-ds-text/80">Fotos</span>
                <div className="mt-1 flex flex-wrap gap-ds-2">
                  {detalle.fotos.map((f) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={f.id} src={f.url} alt="" className="h-24 w-24 rounded-ds-md border border-ds-divider object-cover" />
                  ))}
                </div>
              </div>
            ) : null}

            {detalleError ? <p className="text-ds-small text-red-600">{detalleError}</p> : null}

            {detalle.estado === "completado_tecnico" ? (
              <div className="flex flex-col gap-ds-2 border-t border-ds-divider pt-ds-3">
                <label className="text-ds-small font-medium text-ds-text/80">Referencia de la cotización externa (opcional)</label>
                <Input valor={referenciaExterna} onCambio={setReferenciaExterna} placeholder="Ej.: Defontana folio 4821" />
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
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
