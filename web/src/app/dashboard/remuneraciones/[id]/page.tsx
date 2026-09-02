"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatMoneda } from "@/lib/formatMoneda";
import { DashboardShell } from "@/components/DashboardShell";
import { Badge, Button, Card, ErrorText, Input, Label, PageHeader, SuccessText } from "@/components/ui";
import { IconChevronLeft } from "@/components/icons";
import { useUsuarioShell } from "@/lib/useUsuarioShell";
import { nombrePeriodo, remuneraciones, type LiquidacionConNombre } from "@/lib/remuneracionesApi";

const VARIABLES = [
  { clave: "dias_trabajados", label: "Días trabajados" },
  { clave: "horas_extra", label: "Horas extra ($)" },
  { clave: "otros_imponibles", label: "Bonos / comisiones ($)" },
  { clave: "otros_no_imponibles", label: "Otros no imponibles ($)" },
  { clave: "asignacion_familiar", label: "Asignación familiar ($)" },
  { clave: "otros_descuentos", label: "Otros descuentos ($)" },
] as const;

export default function LiquidacionDetallePage() {
  const params = useParams<{ id: string }>();
  const { usuario } = useUsuarioShell();
  const [liq, setLiq] = useState<LiquidacionConNombre | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [emitiendo, setEmitiendo] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const l = await remuneraciones.liquidacion(params.id);
      setLiq(l);
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
      const body = Object.fromEntries(VARIABLES.map((v) => [v.clave, Number(form[v.clave]) || 0]));
      setLiq(await remuneraciones.editar(params.id, body));
      setAviso("Recalculado.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  async function emitir() {
    setEmitiendo(true);
    try {
      setLiq(await remuneraciones.emitir(params.id));
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
      <Link href="/dashboard/remuneraciones" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <IconChevronLeft className="h-4 w-4" />
        Liquidaciones
      </Link>

      {error && <ErrorText>{error}</ErrorText>}
      {!liq && !error && <p className="text-sm text-muted">Cargando…</p>}

      {liq && (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <PageHeader title={liq.colaborador?.nombre ?? "Liquidación"} subtitle={nombrePeriodo(liq.periodo)} action={<Badge value={liq.estado} />} />
            <div className="flex gap-2">
              {liq.estado === "emitida" && (
                <Button type="button" variant="outline" onClick={() => remuneraciones.abrirPdf(liq.id)}>
                  Descargar PDF
                </Button>
              )}
              {liq.estado === "borrador" && (
                <Button type="button" onClick={emitir} disabled={emitiendo}>
                  {emitiendo ? "Emitiendo…" : "Emitir"}
                </Button>
              )}
            </div>
          </div>

          {aviso && (
            <div className="mb-4">
              <SuccessText>{aviso}</SuccessText>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
            <Card>
              <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="mt-5 flex items-center justify-between rounded-lg bg-brand-soft px-4 py-3">
                <span className="text-sm font-semibold text-brand">Líquido a pagar</span>
                <span className="text-lg font-bold tabular-nums text-brand">{formatMoneda(liq.liquido_pagar, m)}</span>
              </div>
              <p className="mt-3 text-xs text-muted">
                Base imponible {formatMoneda(liq.base_imponible, m)} · Base tributable {formatMoneda(liq.base_tributable, m)} · Costo empresa
                (AFC {formatMoneda(liq.aporte_afc_empleador, m)} + SIS {formatMoneda(liq.aporte_sis, m)} + Mutual{" "}
                {formatMoneda(liq.aporte_mutual, m)})
              </p>
            </Card>

            <Card>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Ajustes del mes</h2>
              {liq.estado === "emitida" ? (
                <p className="text-sm text-muted">La liquidación ya fue emitida. Para corregirla, generá de nuevo el mes (se crea un borrador nuevo).</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {VARIABLES.map((v) => (
                    <div key={v.clave}>
                      <Label>{v.label}</Label>
                      <Input
                        type="number"
                        value={form[v.clave] ?? ""}
                        onChange={(e) => setForm((f) => ({ ...f, [v.clave]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <Button type="button" onClick={guardar} disabled={guardando} className="mt-1">
                    {guardando ? "Recalculando…" : "Recalcular"}
                  </Button>
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
      <h3 className="mb-2 text-xs font-semibold uppercase text-muted">{titulo}</h3>
      <div className="flex flex-col gap-1.5 text-sm">{children}</div>
    </div>
  );
}

function Fila({ et, v, m, fuerte }: { et: string; v: number; m: string; fuerte?: boolean }) {
  if (!v && !fuerte) return null;
  return (
    <div className={`flex items-center justify-between ${fuerte ? "mt-1 border-t border-border pt-2 font-semibold text-foreground" : "text-muted"}`}>
      <span>{et}</span>
      <span className="tabular-nums">{formatMoneda(v, m)}</span>
    </div>
  );
}
