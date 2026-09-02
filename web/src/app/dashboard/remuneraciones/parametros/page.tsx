"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/DashboardShell";
import { Button, Card, ErrorText, Input, Label, PageHeader, Select, SuccessText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { nombrePeriodo, periodoRelativo, remuneraciones, type AfpParametro } from "@/lib/remuneracionesApi";
import type { ParametroPrevisional } from "@bitacora/shared";

const PERIODOS = Array.from({ length: 12 }, (_, i) => periodoRelativo(-i));

const CAMPOS: { clave: keyof ParametroPrevisional; label: string; step?: string }[] = [
  { clave: "uf", label: "UF" },
  { clave: "utm", label: "UTM" },
  { clave: "ingreso_minimo", label: "Ingreso mínimo mensual" },
  { clave: "tope_imponible_uf", label: "Tope imponible (UF)", step: "0.01" },
  { clave: "tope_afc_uf", label: "Tope AFC (UF)", step: "0.01" },
  { clave: "tope_gratificacion_mensual", label: "Tope gratificación mensual" },
];

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
      const body: Record<string, unknown> = Object.fromEntries(CAMPOS.map((c) => [c.clave, Number(form[c.clave]) || 0]));
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
      <Link href="/dashboard/remuneraciones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Liquidaciones
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <PageHeader title="Parámetros previsionales" subtitle={nombrePeriodo(periodo)} />
        <Select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-44">
          {PERIODOS.map((p) => (
            <option key={p} value={p}>
              {nombrePeriodo(p)}
            </option>
          ))}
        </Select>
      </div>

      {error && <ErrorText>{error}</ErrorText>}
      {!params && !error && <p className="text-sm text-muted">Cargando…</p>}

      {params && (
        <>
          <p className="mb-4 text-sm text-muted">
            UF y UTM se traen automáticamente de mindicador.cl ({params.fuente === "mindicador" ? "auto" : "editado a mano"}). El ingreso
            mínimo, los topes y las comisiones AFP se revisan cuando la ley cambia.
          </p>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Indicadores</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {CAMPOS.map((c) => (
                  <div key={c.clave}>
                    <Label>{c.label}</Label>
                    <Input
                      type="number"
                      step={c.step}
                      value={form[c.clave] ?? ""}
                      onChange={(e) => setForm((f) => ({ ...f, [c.clave]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Comisión por AFP</h2>
              <div className="flex flex-col gap-3">
                {afp.map((a) => (
                  <div key={a.afp} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">{a.nombre}</span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        step="0.0001"
                        className="w-28"
                        value={afpForm[a.afp] ?? ""}
                        onChange={(e) => setAfpForm((f) => ({ ...f, [a.afp]: e.target.value }))}
                      />
                      <span className="text-xs text-muted">= {((Number(afpForm[a.afp]) || 0) * 100).toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {aviso && (
            <div className="mt-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}
          <Button type="button" onClick={guardar} disabled={guardando} className="mt-4">
            {guardando ? "Guardando…" : "Guardar parámetros"}
          </Button>
        </>
      )}
    </DashboardShell>
  );
}
