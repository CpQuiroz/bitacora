"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Plus } from "lucide-react";
import type { EstadoRendicion, MetodoEntregaRendicion, PeriodoRendicion, Rendicion, Usuario } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { GastosSubnav } from "@/components/GastosSubnav";
import { InputMonto } from "@/components/InputMonto";
import { Button, Card, DatePicker, EmptyState, ErrorState, LoadingState, Select, StatusBadge, Table, type TonoEstado } from "@bitacora/ui/web";

type RendicionConDatos = Rendicion & {
  colaborador: { id: string; nombre: string } | null;
  total_gastado: number;
  saldo: number;
};

const ETIQUETA_ESTADO: Record<EstadoRendicion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

// borrador/enviada/rechazada no están en MAPA_ESTADO_TONO (ambiguos a
// propósito, ver packages/ui/src/tipos.ts) — se fuerzan acá.
const TONO_ESTADO: Record<EstadoRendicion, TonoEstado> = {
  borrador: "cerrado",
  enviada: "en_progreso",
  aprobada: "completado",
  rechazada: "cancelado",
};

const ETIQUETA_PERIODO: Record<string, string> = { diario: "Diario", semanal: "Semanal" };
const ETIQUETA_METODO_ENTREGA: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia" };

const HOY = () => new Date().toISOString().slice(0, 10);

// PASO 6 (sistema de diseño). Fondo por rendir / caja chica.
// Pedido 22-sep-2026: se agrega creación desde la web (antes solo
// nacía en el celular) — gestión puede crearla a nombre de cualquier
// colaborador, un colaborador solo a nombre propio (lo valida el
// backend igual). El detalle ([id]/page.tsx) es donde se cargan los
// gastos con foto, se edita y se elimina mientras sigue en borrador.
export default function RendicionesPage() {
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [rol, setRol] = useState<string | null>(null);
  const [rendiciones, setRendiciones] = useState<RendicionConDatos[] | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<"todos" | EstadoRendicion>("todos");

  const [formAbierto, setFormAbierto] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [colaboradorId, setColaboradorId] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoRendicion>("semanal");
  const [fechaInicio, setFechaInicio] = useState(() => HOY());
  const [fechaTermino, setFechaTermino] = useState(() => HOY());
  const [montoEntregado, setMontoEntregado] = useState("");
  const [metodoEntrega, setMetodoEntrega] = useState<MetodoEntregaRendicion>("efectivo");

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resRendiciones] = await Promise.all([apiFetch("/api/me"), apiFetch("/api/rendiciones")]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u) {
        setRol(u.rol);
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
    if (!resRendiciones.ok) {
      setError("No se pudieron cargar las rendiciones");
      return;
    }
    setRendiciones(await resRendiciones.json());
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNueva() {
    setColaboradorId("");
    setPeriodo("semanal");
    setFechaInicio(HOY());
    setFechaTermino(HOY());
    setMontoEntregado("");
    setMetodoEntrega("efectivo");
    setFormError(null);
    setFormAbierto(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setGuardando(true);
    const res = await apiFetch("/api/rendiciones", {
      method: "POST",
      body: JSON.stringify({
        colaborador_id: colaboradorId || undefined,
        periodo,
        fecha_inicio: fechaInicio,
        fecha_termino: fechaTermino,
        monto_entregado: montoEntregado,
        metodo_entrega: metodoEntrega,
      }),
    });
    setGuardando(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setFormError(body.error ?? "No se pudo crear la rendición");
      return;
    }
    const nueva = await res.json();
    // Directo al detalle: ahí se cargan los gastos con foto (mismo
    // formulario que un colaborador vería en el celular).
    router.push(`/dashboard/rendiciones/${nueva.id}`);
  }

  if (!usuario) return null;

  const filtradas = (rendiciones ?? []).filter((r) => filtroEstado === "todos" || r.estado === filtroEstado);
  const totales = (rendiciones ?? []).reduce(
    (acc, r) => ({
      entregado: acc.entregado + Number(r.monto_entregado),
      gastado: acc.gastado + r.total_gastado,
      saldo: acc.saldo + r.saldo,
    }),
    { entregado: 0, gastado: 0, saldo: 0 }
  );

  return (
    <DashboardShell usuario={usuario}>
      <GastosSubnav activo="rendiciones" rol={usuario.rol} />
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Rendiciones</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
            Fondo por rendir entregado a colaboradores, reconciliado contra sus gastos de terreno
          </p>
        </div>
        <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={() => (formAbierto ? setFormAbierto(false) : abrirNueva())}>
          Nueva rendición
        </Button>
      </div>

      <div className="mb-ds-6 grid gap-ds-4 sm:grid-cols-3">
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text-secondary">Total entregado</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.entregado, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text-secondary">Total gastado</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.gastado, usuario.moneda)}</p>
        </Card>
        <Card>
          <p className="font-ds-body text-ds-caption text-ds-text-secondary">Saldo pendiente</p>
          <p className="mt-ds-1 font-ds-body text-ds-h5 font-semibold text-ds-text">{formatMoneda(totales.saldo, usuario.moneda)}</p>
        </Card>
      </div>

      {formAbierto && (
        <div className="mb-ds-6">
          <Card>
            <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Nueva rendición</p>
            <form onSubmit={onSubmit} className="flex flex-col gap-ds-4">
              <div className="grid gap-ds-4 sm:grid-cols-2">
                {rol !== "colaborador" && (
                  <div className="sm:col-span-2">
                    <Select
                      etiqueta="Colaborador"
                      valor={colaboradorId}
                      onCambio={setColaboradorId}
                      opciones={[{ valor: "", etiqueta: "A mi nombre" }, ...usuarios.map((u) => ({ valor: u.id, etiqueta: u.nombre }))]}
                    />
                  </div>
                )}
                <Select
                  etiqueta="Período"
                  valor={periodo}
                  onCambio={(v) => setPeriodo(v as PeriodoRendicion)}
                  opciones={[
                    { valor: "diario", etiqueta: "Diario" },
                    { valor: "semanal", etiqueta: "Semanal" },
                  ]}
                />
                <Select
                  etiqueta="Método de entrega"
                  valor={metodoEntrega}
                  onCambio={(v) => setMetodoEntrega(v as MetodoEntregaRendicion)}
                  opciones={[
                    { valor: "efectivo", etiqueta: "Efectivo" },
                    { valor: "transferencia", etiqueta: "Transferencia" },
                  ]}
                />
                <div className="flex flex-col gap-ds-1">
                  <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">Monto entregado</label>
                  <InputMonto required value={montoEntregado} onChange={setMontoEntregado} moneda={usuario.moneda} />
                </div>
                <DatePicker etiqueta="Fecha de inicio" valor={aFecha(fechaInicio)} onCambio={(f) => setFechaInicio(aTexto(f))} />
                <DatePicker etiqueta="Fecha de término" valor={aFecha(fechaTermino)} onCambio={(f) => setFechaTermino(aTexto(f))} />
              </div>
              {formError ? <p className="font-ds-body text-ds-small text-ds-accent-700">{formError}</p> : null}
              <div className="flex gap-ds-2">
                <Button tipo="submit" cargando={guardando}>
                  Crear y agregar gastos
                </Button>
                <Button variante="ghost" onPress={() => setFormAbierto(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      <div className="mb-ds-4 max-w-xs">
        <Select
          etiqueta="Filtrar por estado"
          valor={filtroEstado}
          onCambio={(v) => setFiltroEstado(v as typeof filtroEstado)}
          opciones={[
            { valor: "todos", etiqueta: "Todos" },
            { valor: "borrador", etiqueta: "Borrador" },
            { valor: "enviada", etiqueta: "Enviada" },
            { valor: "aprobada", etiqueta: "Aprobada" },
            { valor: "rechazada", etiqueta: "Rechazada" },
          ]}
        />
      </div>

      {error ? <ErrorState mensaje={error} /> : null}
      {rendiciones === null && !error ? <LoadingState /> : null}
      {rendiciones && rendiciones.length === 0 ? (
        <EmptyState
          icono={<HandCoins size={28} strokeWidth={2.75} />}
          titulo="Todavía no hay rendiciones"
          mensaje="Creá la primera con el botón de arriba, o se cargan desde el celular (Más → Rendiciones)."
          accion={
            <Button iconoIzq={<Plus size={16} strokeWidth={2.75} />} onPress={abrirNueva}>
              Nueva rendición
            </Button>
          }
        />
      ) : null}
      {rendiciones && rendiciones.length > 0 && filtradas.length === 0 ? (
        <EmptyState icono={<HandCoins size={28} strokeWidth={2.75} />} titulo="Ninguna rendición coincide con el filtro" />
      ) : null}

      {filtradas.length > 0 && (
        <Table<RendicionConDatos>
          filas={filtradas}
          claveFila={(r) => r.id}
          vacio={{ titulo: "Ninguna rendición coincide con el filtro" }}
          // Convención (tarea 149): la fila abre la rendición.
          onFilaClick={(r) => router.push(`/dashboard/rendiciones/${r.id}`)}
          columnas={[
            { encabezado: "Folio", celda: (r) => <span className="font-medium text-ds-text">{formatearFolio("REND", r.folio) ?? "—"}</span> },
            { encabezado: "Colaborador", celda: (r) => r.colaborador?.nombre ?? "—" },
            { encabezado: "Período", celda: (r) => `${ETIQUETA_PERIODO[r.periodo] ?? r.periodo} · ${r.fecha_inicio} a ${r.fecha_termino}` },
            { encabezado: "Entrega", celda: (r) => ETIQUETA_METODO_ENTREGA[r.metodo_entrega] ?? r.metodo_entrega },
            { encabezado: "Entregado", clase: "text-right", celda: (r) => formatMoneda(r.monto_entregado, usuario.moneda) },
            { encabezado: "Saldo", clase: "text-right", celda: (r) => formatMoneda(r.saldo, usuario.moneda) },
            {
              encabezado: "Estado",
              celda: (r) => <StatusBadge estado={r.estado} etiqueta={ETIQUETA_ESTADO[r.estado]} tonoForzado={TONO_ESTADO[r.estado]} />,
            },
          ]}
        />
      )}
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
