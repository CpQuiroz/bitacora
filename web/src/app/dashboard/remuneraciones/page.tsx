"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, PageHeader, Select, SuccessText } from "@/components/ui";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { nombrePeriodo, periodoRelativo, remuneraciones, type FormatoExport, type LiquidacionConNombre } from "@/lib/remuneracionesApi";

const PERIODOS = Array.from({ length: 12 }, (_, i) => periodoRelativo(-i));

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
      setAviso(`${r.generadas} liquidación(es) generada(s)${r.omitidas_emitidas ? ` · ${r.omitidas_emitidas} ya emitidas, sin cambios` : ""}.`);
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Liquidaciones de sueldo" subtitle={nombrePeriodo(periodo)} />
        <div className="flex items-end gap-2">
          <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-44">
            {PERIODOS.map((p) => (
              <option key={p} value={p}>
                {nombrePeriodo(p)}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={generar} disabled={generando}>
            {generando ? "Generando…" : "Generar mes"}
          </Button>
        </div>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {aviso && (
        <div className="mb-4">
          <SuccessText>{aviso}</SuccessText>
        </div>
      )}

      {filas && filas.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <p className="text-xs text-muted">Total líquido</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatMoneda(totales.liquido, moneda)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted">Costo empresa (aprox.)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{formatMoneda(totales.costoEmpresa, moneda)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted">Emitidas</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {totales.emitidas} / {filas.length}
            </p>
          </Card>
        </div>
      )}

      {filas && totales.emitidas > 0 && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-foreground">Exportar {nombrePeriodo(periodo)}:</span>
            <Button type="button" variant="outline" onClick={() => exportar("resumen")}>
              Resumen previsional (CSV)
            </Button>
            <Button type="button" variant="outline" onClick={() => exportar("previred")}>
              Archivo Previred
            </Button>
            <Button type="button" variant="outline" onClick={() => exportar("lre")}>
              Libro de Remuneraciones (DT)
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Solo las liquidaciones <strong>emitidas</strong>. Descargá → subí a previred.cl / la DT → revisá el total → pagá ahí. Los
            archivos Previred y DT son un <strong>borrador</strong>: validalos con tu contador contra el validador oficial antes del primer
            envío real.
          </p>
        </Card>
      )}

      {filas === null && !error && <p className="text-sm text-muted">Cargando…</p>}

      {filas && filas.length === 0 && (
        <Card>
          <div className="py-12 text-center">
            <p className="font-medium text-foreground">Sin liquidaciones para {nombrePeriodo(periodo)}</p>
            <p className="mt-1 text-sm text-muted">
              Cargá los datos del equipo en{" "}
              <Link href="/dashboard/remuneraciones/datos-laborales" className="font-medium text-brand hover:underline">
                Datos del equipo
              </Link>{" "}
              y usá “Generar mes”.
            </p>
          </div>
        </Card>
      )}

      {filas && filas.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted">
                <th className="px-5 py-3 font-medium">Colaborador</th>
                <th className="px-5 py-3 font-medium">Días</th>
                <th className="px-5 py-3 font-medium">Imponible</th>
                <th className="px-5 py-3 font-medium">Descuentos</th>
                <th className="px-5 py-3 font-medium">Líquido</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {filas.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 font-medium text-foreground">{l.colaborador?.nombre ?? "—"}</td>
                  <td className="px-5 py-3 text-muted">{l.dias_trabajados}</td>
                  <td className="px-5 py-3 tabular-nums text-muted">{formatMoneda(l.base_imponible, moneda)}</td>
                  <td className="px-5 py-3 tabular-nums text-muted">{formatMoneda(l.total_descuentos, moneda)}</td>
                  <td className="px-5 py-3 tabular-nums font-medium text-foreground">{formatMoneda(l.liquido_pagar, moneda)}</td>
                  <td className="px-5 py-3">
                    <Badge value={l.estado} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/dashboard/remuneraciones/${l.id}`} className="text-xs font-medium text-brand hover:underline">
                        {l.estado === "borrador" ? "Revisar" : "Ver"}
                      </Link>
                      {l.estado === "borrador" ? (
                        <button
                          type="button"
                          onClick={() => emitir(l.id)}
                          disabled={emitiendo === l.id}
                          className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
                        >
                          {emitiendo === l.id ? "Emitiendo…" : "Emitir"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => remuneraciones.abrirPdf(l.id)}
                          className="text-xs font-medium text-muted hover:text-brand"
                        >
                          PDF
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
