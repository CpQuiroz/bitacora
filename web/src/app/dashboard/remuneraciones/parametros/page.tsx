"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, Input, LoadingState, Select } from "@bitacora/ui/web";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { nombrePeriodo, periodoRelativo, remuneraciones, type AfpParametro } from "@/lib/remuneracionesApi";
import type { ParametroPrevisional } from "@bitacora/shared";

const PERIODOS = Array.from({ length: 12 }, (_, i) => periodoRelativo(-i));

// `editable: false` = parámetro legal nacional, solo lectura desde acá
// (lo mantiene el equipo de Bitácora). Ver AUDITORIA_REMUNERACIONES.md #2.
const CAMPOS: { clave: keyof ParametroPrevisional; label: string; editable: boolean }[] = [
  { clave: "uf", label: "UF", editable: true },
  { clave: "utm", label: "UTM", editable: true },
  { clave: "tope_gratificacion_mensual", label: "Tope gratificación mensual", editable: true },
  { clave: "ingreso_minimo", label: "Ingreso mínimo mensual", editable: false },
  { clave: "tope_imponible_uf", label: "Tope imponible (UF)", editable: false },
  { clave: "tope_afc_uf", label: "Tope AFC (UF)", editable: false },
];

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
export default function ParametrosPage() {
  const { usuario } = useUsuarioShell();
  const [periodo, setPeriodo] = useState(periodoRelativo(0));
  const [params, setParams] = useState<ParametroPrevisional | null>(null);
  const [afp, setAfp] = useState<AfpParametro[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [afpForm, setAfpForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    setParams(null);
    try {
      const { parametros, afp } = await remuneraciones.parametros(periodo);
      setParams(parametros);
      setAfp(afp);
      setForm(Object.fromEntries(CAMPOS.map((c) => [c.clave, String(parametros[c.clave] ?? "")])));
      setAfpForm(Object.fromEntries(afp.map((a) => [a.afp, String(a.tasa_comision)])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los parámetros");
    }
  }, [periodo]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar() {
    setGuardando(true);
    setAviso(null);
    setError(null);
    try {
      const body: Record<string, unknown> = Object.fromEntries(
        CAMPOS.filter((c) => c.editable).map((c) => [c.clave, Number(form[c.clave]) || 0])
      );
      body.afp = afp.map((a) => ({ afp: a.afp, tasa_comision: Number(afpForm[a.afp]) || 0 }));
      const r = await remuneraciones.guardarParametros(periodo, body);
      setParams(r.parametros);
      setAfp(r.afp);
      setAviso("Parámetros guardados.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!usuario) return null;

  return (
    <DashboardShell usuario={usuario}>
      <Link href="/dashboard/remuneraciones" className="mb-ds-4 inline-flex items-center gap-ds-1 font-ds-body text-ds-small font-medium text-ds-brand hover:underline">
        <ChevronLeft size={16} strokeWidth={2.75} />
        Liquidaciones
      </Link>
      <div className="mb-ds-6 flex flex-wrap items-center justify-between gap-ds-3">
        <div>
          <p className="ds-heading text-ds-h2 text-ds-text">Parámetros previsionales</p>
          <p className="mt-ds-1 font-ds-body text-ds-small text-ds-text/70">{nombrePeriodo(periodo)}</p>
        </div>
        <Select valor={periodo} onCambio={setPeriodo} opciones={PERIODOS.map((p) => ({ valor: p, etiqueta: nombrePeriodo(p) }))} />
      </div>

      {error ? <p className="font-ds-body text-ds-small text-ds-accent-700">{error}</p> : null}
      {!params && !error ? <LoadingState /> : null}

      {params && (
        <>
          <p className="mb-ds-4 font-ds-body text-ds-small text-ds-text/70">
            UF y UTM se traen automáticamente de mindicador.cl para el mes del período (
            {params.fuente === "mindicador" ? "auto" : "editado a mano"}). Podés corregir UF, UTM, el tope de
            gratificación y las comisiones AFP si hiciera falta. El ingreso mínimo y los topes imponibles son ley
            nacional — los mantiene el equipo de Bitácora y acá se muestran de solo lectura.
          </p>

          <div className="grid gap-ds-6 lg:grid-cols-2">
            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Indicadores</p>
              <div className="grid gap-ds-3 sm:grid-cols-2">
                {CAMPOS.map((c) => (
                  <Input
                    key={c.clave}
                    etiqueta={c.editable ? c.label : `${c.label} (solo lectura)`}
                    tipo="numero"
                    deshabilitado={!c.editable}
                    valor={form[c.clave] ?? ""}
                    onCambio={(v) => setForm((f) => ({ ...f, [c.clave]: v }))}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <p className="mb-ds-4 font-ds-body text-ds-small font-semibold text-ds-text">Comisión por AFP</p>
              <div className="flex flex-col gap-ds-3">
                {afp.map((a) => (
                  <div key={a.afp} className="flex items-center justify-between gap-ds-3">
                    <span className="font-ds-body text-ds-small text-ds-text">{a.nombre}</span>
                    <div className="flex items-center gap-1">
                      <div className="w-28">
                        <Input tipo="numero" valor={afpForm[a.afp] ?? ""} onCambio={(v) => setAfpForm((f) => ({ ...f, [a.afp]: v }))} />
                      </div>
                      <span className="font-ds-body text-ds-caption text-ds-text/60">= {((Number(afpForm[a.afp]) || 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {aviso ? <p className="mt-ds-4 font-ds-body text-ds-small font-medium text-ds-accent2-800">{aviso}</p> : null}
          <div className="mt-ds-4">
            <Button onPress={guardar} cargando={guardando}>
              Guardar parámetros
            </Button>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
