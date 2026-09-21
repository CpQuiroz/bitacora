"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Paperclip, Sliders } from "lucide-react";
import type { EstadoRendicion, Gasto, Rendicion } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell, type UsuarioShell } from "@/components/DashboardShell";
import { Button, Card, StatusBadge, Table, Textarea, type TonoEstado } from "@bitacora/ui/web";
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

// PASO 6 (sistema de diseño). Aprobar/Rechazar reusa PanelAcciones
// (mismo drawer que Cotizaciones/Cobros) — aprobar no dispara nada
// automático, ninguna pasarela real detrás (mismo criterio que
// Cobros); "saldo liquidado" es un checkbox informativo.
export default function DetalleRendicionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [usuario, setUsuario] = useState<UsuarioShell | null>(null);
  const [detalle, setDetalle] = useState<DetalleRendicion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [panelAbierto, setPanelAbierto] = useState(false);
  const [rechazando, setRechazando] = useState(false);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  async function cargar() {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.replace("/login");
      return;
    }
    const [resMe, resDetalle] = await Promise.all([apiFetch("/api/me"), apiFetch(`/api/rendiciones/${params.id}`)]);
    if (resMe.ok) {
      const { usuario: u } = await resMe.json();
      if (u)
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

  if (!usuario) return null;

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
                {detalle.fecha_termino}
              </p>
            </div>
            <div className="flex items-center gap-ds-2">
              <StatusBadge estado={detalle.estado} etiqueta={ETIQUETA_ESTADO[detalle.estado]} tonoForzado={TONO_ESTADO[detalle.estado]} />
              {detalle.estado === "enviada" && (
                <Button variante="secundario" iconoIzq={<Sliders size={16} strokeWidth={2.75} />} onPress={() => setPanelAbierto(true)}>
                  Revisar
                </Button>
              )}
            </div>
          </div>

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
              {detalle.saldo !== 0 && (detalle.estado === "aprobada" || detalle.estado === "enviada") && (
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
            <p className="mb-ds-3 font-ds-body text-ds-small font-semibold text-ds-text">Gastos incluidos</p>
            {detalle.gastos.length === 0 ? (
              <Card>
                <p className="font-ds-body text-ds-small text-ds-text/60">Todavía no se agregó ningún gasto (se hace desde el celular).</p>
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
