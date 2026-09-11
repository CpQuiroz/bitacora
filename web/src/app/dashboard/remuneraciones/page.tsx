"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, Cifra, LoadingState, Select, StatusBadge, type TonoEstado } from "@bitacora/ui/web";
import { Stat } from "@/components/Stat";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { nombrePeriodo, periodoRelativo, remuneraciones, type FormatoExport, type LiquidacionConNombre } from "@/lib/remuneracionesApi";

const PERIODOS = Array.from({ length: 12 }, (_, i) => periodoRelativo(-i));

// "borrador"/"emitida" no están en MAPA_ESTADO_TONO (ambiguos a propósito).
const TONO_FORZADO: Record<string, TonoEstado> = { borrador: "en_progreso", emitida: "completado" };

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function RemuneracionesPage() {
  const { usuario } = useUsuarioShell();
  const [periodo, setPeriodo] = useState(periodoRelativo(0));
  const [filas, setFilas] = useState<LiquidacionConNombre[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const [emitiendo, setEmitiendo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setFilas(await remuneraciones.liquidaciones(periodo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las liquidaciones");
    }
  }, [periodo]);

  useEffect(() => {
    setFilas(null);
    cargar();
  }, [cargar]);

  const totales = useMemo(() => {
    const l = filas ?? [];
    return {
      liquido: l.reduce((s, x) => s + x.liquido_pagar, 0),
      costoEmpresa: l.reduce((s, x) => s + x.total_haberes + x.aporte_afc_empleador + x.aporte_sis + x.aporte_mutual, 0),
      emitidas: l.filter((x) => x.estado === "emitida").length,
    };
  }, [filas]);

  async function generar() {
    setGenerando(true);
    setAviso(null);
    setError(null);
    try {
      const r = await remuneraciones.generar(periodo);
      const partes = [`${r.generadas} liquidación(es) generada(s)`];
      if (r.omitidas_emitidas) partes.push(`${r.omitidas_emitidas} ya emitidas, sin cambios`);
      if (r.prorrateadas) partes.push(`${r.prorrateadas} prorrateada(s) por fecha de ingreso`);
      setAviso(partes.join(" · ") + ".");
      if (r.incompletas.length > 0) {
        setError(
          `${r.incompletas.length} colaborador(es) sin liquidación por datos incompletos: ` +
            r.incompletas.map((i) => i.faltan.join("/")).join("; ") +
            ". Complétalos en Datos del equipo y volvé a generar."
        );
      }
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron generar");
    } finally {
      setGenerando(false);
    }
  }

  async function emitir(id: string) {
    setEmitiendo(id);
    try {
      await remuneraciones.emitir(id);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo emitir");
    } finally {
      setEmitiendo(null);
    }
  }

  async function exportar(formato: FormatoExport) {
    setError(null);
    try {
      await remuneraciones.exportar(formato, periodo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el archivo");
    }
  }

  if (!usuario) return null;
  const moneda = usuario.moneda ?? "CLP";

  return (
    <DashboardShell usuario={usuario}>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Liquidaciones de sueldo</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{nombrePeriodo(periodo)}</p>
        </div>
        <div className="flex items-end gap-ds-2">
          <Select valor={periodo} onCambio={setPeriodo} opciones={PERIODOS.map((p) => ({ valor: p, etiqueta: nombrePeriodo(p) }))} />
          <Button onPress={generar} cargando={generando}>
            Generar mes
          </Button>
        </div>
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {aviso ? <p className="mb-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}

      {filas && filas.length > 0 && (
        <div className="mb-ds-4 grid gap-ds-3 sm:grid-cols-3">
          <Stat etiqueta="Total líquido" valor={formatMoneda(totales.liquido, moneda)} />
          <Stat etiqueta="Costo empresa (aprox.)" valor={formatMoneda(totales.costoEmpresa, moneda)} />
          <Stat etiqueta="Emitidas" valor={`${totales.emitidas} / ${filas.length}`} />
        </div>
      )}

      {filas && totales.emitidas > 0 && (
        <div className="mb-ds-4">
          <Card>
            <div className="flex flex-wrap items-center gap-ds-3">
              <span className="font-ds-body text-ds-small font-medium text-ds-text">Exportar {nombrePeriodo(periodo)}:</span>
              <Button variante="secundario" onPress={() => exportar("resumen")}>
                Resumen previsional (CSV)
              </Button>
              <Button variante="secundario" onPress={() => exportar("previred")}>
                Archivo Previred
              </Button>
              <Button variante="secundario" onPress={() => exportar("lre")}>
                Libro de Remuneraciones (DT)
              </Button>
            </div>
            <p className="mt-ds-2 font-ds-body text-ds-caption text-ds-text/60">
              Solo las liquidaciones <strong>emitidas</strong>. Descargá → subí a previred.cl / la DT → revisá el total → pagá ahí. Los
              archivos Previred y DT son un <strong>borrador</strong>: validalos con tu contador contra el validador oficial antes del primer
              envío real.
            </p>
          </Card>
        </div>
      )}

      {filas === null && !error ? <LoadingState /> : null}

      {filas && filas.length === 0 && (
        <Card>
          <div className="py-ds-8 text-center">
            <p className="font-ds-body text-ds-small font-medium text-ds-text">Sin liquidaciones para {nombrePeriodo(periodo)}</p>
            <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">
              Cargá los datos del equipo en{" "}
              <Link href="/dashboard/personas" className="font-medium text-ds-brand hover:underline">
                Personas
              </Link>{" "}
              (pestaña «Datos laborales» de cada persona) y usá “Generar mes”.
            </p>
          </div>
        </Card>
      )}

      {filas && filas.length > 0 && (
        <Card sinRelleno elevacion="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-ds-body">
              <thead>
                <tr className="border-b border-ds-divider text-[11px] font-medium uppercase tracking-[0.08em] text-ds-text/60">
                  <th className="px-ds-4 py-ds-3">Colaborador</th>
                  <th className="px-ds-4 py-ds-3 text-right">Días</th>
                  <th className="px-ds-4 py-ds-3 text-right">Imponible</th>
                  <th className="px-ds-4 py-ds-3 text-right">Descuentos</th>
                  <th className="px-ds-4 py-ds-3 text-right">Líquido</th>
                  <th className="px-ds-4 py-ds-3">Estado</th>
                  <th className="px-ds-4 py-ds-3"></th>
                </tr>
              </thead>
              <tbody>
                {filas.map((l) => (
                  <tr key={l.id} className="border-b border-ds-text/[0.08] last:border-0 even:bg-ds-text/[0.02]">
                    <td className="px-ds-4 py-ds-3 font-medium text-ds-text">{l.colaborador?.nombre ?? "—"}</td>
                    <td className="px-ds-4 py-ds-3 text-right text-ds-text/70"><Cifra>{l.dias_trabajados}</Cifra></td>
                    <td className="px-ds-4 py-ds-3 text-right text-ds-text/70"><Cifra>{formatMoneda(l.base_imponible, moneda)}</Cifra></td>
                    <td className="px-ds-4 py-ds-3 text-right text-ds-text/70"><Cifra>{formatMoneda(l.total_descuentos, moneda)}</Cifra></td>
                    <td className="px-ds-4 py-ds-3 text-right font-medium text-ds-text"><Cifra>{formatMoneda(l.liquido_pagar, moneda)}</Cifra></td>
                    <td className="px-ds-4 py-ds-3">
                      <StatusBadge estado={l.estado} tonoForzado={TONO_FORZADO[l.estado]} />
                    </td>
                    <td className="px-ds-4 py-ds-3">
                      <div className="flex items-center gap-ds-3">
                        <Link href={`/dashboard/remuneraciones/${l.id}`} className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline">
                          {l.estado === "borrador" ? "Revisar" : "Ver"}
                        </Link>
                        {l.estado === "borrador" ? (
                          <button
                            type="button"
                            onClick={() => emitir(l.id)}
                            disabled={emitiendo === l.id}
                            className="font-ds-body text-ds-caption font-medium text-ds-brand hover:underline disabled:opacity-50"
                          >
                            {emitiendo === l.id ? "Emitiendo…" : "Emitir"}
                          </button>
                        ) : (
                          <button type="button" onClick={() => remuneraciones.abrirPdf(l.id)} className="font-ds-body text-ds-caption font-medium text-ds-text/60 hover:text-ds-brand">
                            PDF
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardShell>
  );
}
