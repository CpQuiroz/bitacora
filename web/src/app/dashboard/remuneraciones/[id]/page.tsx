"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, Input, LoadingState, StatusBadge, type TonoEstado } from "@bitacora/ui/web";
import { InputMonto } from "@/components/InputMonto";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { nombrePeriodo, remuneraciones, type LiquidacionConNombre } from "@/lib/remuneracionesApi";

const VARIABLES = [
  { clave: "dias_trabajados", label: "Días trabajados", dinero: false },
  { clave: "horas_extra", label: "Horas extra", dinero: true },
  { clave: "otros_imponibles", label: "Bonos / comisiones", dinero: true },
  { clave: "otros_no_imponibles", label: "Otros no imponibles", dinero: true },
  { clave: "asignacion_familiar", label: "Asignación familiar", dinero: true },
  { clave: "otros_descuentos", label: "Otros descuentos", dinero: true },
] as const;

// "borrador"/"emitida" no están en MAPA_ESTADO_TONO (ambiguos a propósito).
const TONO_FORZADO: Record<string, TonoEstado> = { borrador: "en_progreso", emitida: "completado" };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function LiquidacionDetallePage() {
  const params = useParams<{ id: string }>();
  const { usuario } = useUsuarioShell();
  const [liq, setLiq] = useState<LiquidacionConNombre | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);
  const [tuvoLicencia, setTuvoLicencia] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const l = await remuneraciones.liquidacion(params.id);
      setLiq(l);
      setTuvoLicencia(l.tuvo_licencia);
      setForm({
        dias_trabajados: String(l.dias_trabajados),
        horas_extra: String(l.horas_extra),
        otros_imponibles: String(l.otros_imponibles),
        otros_no_imponibles: String(l.otros_no_imponibles),
        asignacion_familiar: String(l.asignacion_familiar),
        otros_descuentos: String(l.otros_descuentos),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar");
    }
  }, [params.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    setError(null);
    try {
      const body: Record<string, unknown> = Object.fromEntries(VARIABLES.map((v) => [v.clave, Number(form[v.clave]) || 0]));
      body.tuvo_licencia = tuvoLicencia;
      setLiq(await remuneraciones.editar(params.id, body));
      setAviso("Recalculado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function emitir() {
    setError(null);
    if (liq?.tuvo_licencia && !window.confirm("Esta liquidación tiene licencia médica marcada. ¿Confirmás que ajustaste los valores a mano y querés emitirla?")) {
      return;
    }
    setEmitiendo(true);
    try {
      setLiq(await remuneraciones.emitir(params.id, Boolean(liq?.tuvo_licencia)));
      setAviso("Liquidación emitida.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo emitir");
    } finally {
      setEmitiendo(false);
    }
  }

  if (!usuario) return null;
  const m = usuario.moneda ?? "CLP";

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/remuneraciones" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Liquidaciones
      </Link>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {!liq && !error ? <LoadingState /> : null}

      {liq && (
        <>
          <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
            <div>
              <div className="flex items-center gap-ds-2">
                <p className="ds-heading text-ds-h2 text-ds-text">{liq.colaborador?.nombre ?? "Liquidación"}</p>
                <StatusBadge estado={liq.estado} tonoForzado={TONO_FORZADO[liq.estado]} />
              </div>
              <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{nombrePeriodo(liq.periodo)}</p>
            </div>
            <div className="flex gap-ds-2">
              {liq.estado === "emitida" && (
                <Button variante="secundario" onPress={() => remuneraciones.abrirPdf(liq.id)}>
                  Descargar PDF
                </Button>
              )}
              {liq.estado === "borrador" && (
                <Button onPress={emitir} cargando={emitiendo}>
                  Emitir
                </Button>
              )}
            </div>
          </div>

          {aviso ? <p className="mb-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

          {liq.tuvo_licencia && (
            <p className="mb-ds-4 rounded-ds-md bg-ds-accent-100 px-ds-4 py-ds-3 font-ds-body text-ds-small text-ds-accent-800">
              <strong>Licencia médica en el período.</strong> El cálculo automático no descuenta días de licencia ni
              trata el subsidio — ajustá los días trabajados y los haberes a mano antes de emitir.
            </p>
          )}

          <div className="grid gap-ds-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <div className="grid gap-ds-4 sm:grid-cols-2">
                <Seccion titulo="Haberes">
                  <Fila et="Sueldo base" v={liq.sueldo_base} m={m} />
                  <Fila et="Gratificación (Art. 50)" v={liq.gratificacion} m={m} />
                  <Fila et="Horas extra" v={liq.horas_extra} m={m} />
                  <Fila et="Bonos / comisiones" v={liq.otros_imponibles} m={m} />
                  <Fila et="Colación" v={liq.colacion} m={m} />
                  <Fila et="Movilización" v={liq.movilizacion} m={m} />
                  <Fila et="Asignación familiar" v={liq.asignacion_familiar} m={m} />
                  <Fila et="Otros no imponibles" v={liq.otros_no_imponibles} m={m} />
                  <Fila et="Total haberes" v={liq.total_haberes} m={m} fuerte />
                </Seccion>
                <Seccion titulo="Descuentos">
                  <Fila et="AFP (10%)" v={liq.cotizacion_afp} m={m} />
                  <Fila et="Comisión AFP" v={liq.comision_afp} m={m} />
                  <Fila et="Salud (7%)" v={liq.cotizacion_salud} m={m} />
                  <Fila et="Adicional Isapre" v={liq.salud_adicional} m={m} />
                  <Fila et="Seguro cesantía (0,6%)" v={liq.cotizacion_afc} m={m} />
                  <Fila et="Impuesto único" v={liq.impuesto_unico} m={m} />
                  <Fila et="Otros descuentos" v={liq.otros_descuentos} m={m} />
                  <Fila et="Total descuentos" v={liq.total_descuentos} m={m} fuerte />
                </Seccion>
              </div>
              <div className="mt-ds-5 flex items-center justify-between rounded-ds-md bg-ds-brand/[0.08] px-ds-4 py-ds-3">
                <span className="font-ds-body text-ds-small font-semibold text-ds-brand">Líquido a pagar</span>
                <span className="font-ds-body text-ds-h5 font-bold tabular-nums text-ds-brand">{formatMoneda(liq.liquido_pagar, m)}</span>
              </div>
              <p className="mt-ds-3 font-ds-body text-ds-caption text-ds-text/60">
                Base imponible {formatMoneda(liq.base_imponible, m)} · Base tributable {formatMoneda(liq.base_tributable, m)} · Costo empresa
                (AFC {formatMoneda(liq.aporte_afc_empleador, m)} + SIS {formatMoneda(liq.aporte_sis, m)} + Mutual{" "}
                {formatMoneda(liq.aporte_mutual, m)})
              </p>
            </Card>

            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Ajustes del mes</p>
              {liq.estado === "emitida" ? (
                <p className="font-ds-body text-ds-small text-ds-text/70">La liquidación ya fue emitida. Para corregirla, generá de nuevo el mes (se crea un borrador nuevo).</p>
              ) : (
                <div className="flex flex-col gap-ds-3">
                  {VARIABLES.map((v) =>
                    v.dinero ? (
                      <div key={v.clave} className="flex flex-col gap-ds-1">
                        <label className="font-ds-body text-ds-caption font-medium text-ds-text/70">{v.label}</label>
                        <InputMonto value={form[v.clave] ?? ""} onChange={(val) => setForm((f) => ({ ...f, [v.clave]: val }))} moneda={m} />
                      </div>
                    ) : (
                      <Input key={v.clave} etiqueta={v.label} tipo="numero" valor={form[v.clave] ?? ""} onCambio={(val) => setForm((f) => ({ ...f, [v.clave]: val }))} />
                    )
                  )}
                  <label className="flex items-center gap-ds-2 font-ds-body text-ds-small text-ds-text">
                    <input type="checkbox" className="accent-[var(--ds-brand)]" checked={tuvoLicencia} onChange={(e) => setTuvoLicencia(e.target.checked)} />
                    Tuvo licencia médica este mes
                  </label>
                  <div className="mt-ds-1">
                    <Button onPress={guardar} cargando={guardando}>
                      Recalcular
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </DashboardShell>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-ds-2 font-ds-body text-ds-caption font-semibold uppercase text-ds-text/60">{titulo}</p>
      <div className="flex flex-col gap-1.5 font-ds-body text-ds-small">{children}</div>
    </div>
  );
}

function Fila({ et, v, m, fuerte }: { et: string; v: number; m: string; fuerte?: boolean }) {
  if (!v && !fuerte) return null;
  return (
    <div className={`flex items-center justify-between ${fuerte ? "mt-ds-1 border-t border-ds-divider pt-ds-2 font-semibold text-ds-text" : "text-ds-text/70"}`}>
      <span>{et}</span>
      <span className="tabular-nums">{formatMoneda(v, m)}</span>
    </div>
  );
}
