import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { ErrorState, LoadingState, Texto } from "@bitacora/ui/native";
import { formatearMoneda } from "../../../lib/plata";
import { obtenerVisionGeneral } from "../../../services/informes";
import { Bloque, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

const pct = (n: number) => `${n.toFixed(0)}%`;

export function VisionGeneral({ desde, hasta, moneda }: { desde: string; hasta: string; moneda: string }) {
  const { datos, error, reintentar } = useInformeFetch(() => obtenerVisionGeneral(desde, hasta), [desde, hasta]);

  if (error) return <ErrorState mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <LoadingState />;

  const { kpis, resumen_gastos: g, ingresos_vs_gastos: ig, ingresos_por_mes: porMes } = datos;

  return (
    <View style={{ gap: tokens.space["4"] }}>
      <GrillaMetricas>
        <Metrica etiqueta="Ingreso total" valor={formatearMoneda(kpis.ingresos_totales, moneda)} />
        <Metrica etiqueta="Total de gastos" valor={formatearMoneda(g.total, moneda)} />
        <Metrica etiqueta="Cotizaciones" valor={String(kpis.cant_presupuestos)} nota={`${pct(kpis.pct_conversion)} de conversión`} />
        <Metrica etiqueta="OS completadas" valor={String(kpis.ot_completadas)} nota={`${pct(kpis.pct_conclusion_ot)} de conclusión`} />
        <Metrica etiqueta="Clientes activos" valor={String(kpis.clientes_activos)} />
      </GrillaMetricas>

      <Bloque titulo="Ingresos vs gastos">
        <FilaTabla label="Ingreso recibido" valor={formatearMoneda(ig.ingresos_recibidos, moneda)} />
        <FilaTabla label="Gastos pagados" valor={formatearMoneda(ig.gastos_pagados, moneda)} />
        <FilaTabla label="Resultado neto" valor={formatearMoneda(ig.resultado_neto, moneda)} />
      </Bloque>

      <Bloque titulo="Resumen de gastos">
        <GrillaMetricas>
          <Metrica etiqueta="Pagado" valor={formatearMoneda(g.pagado, moneda)} nota={`${g.cantidad_pagado} ítem(s)`} />
          <Metrica etiqueta="Pendiente" valor={formatearMoneda(g.pendiente, moneda)} nota={`${g.cantidad_pendiente} ítem(s)`} />
          <Metrica etiqueta="Vencido" valor={formatearMoneda(g.vencido, moneda)} nota={`${g.cantidad_vencido} ítem(s)`} />
          <Metrica etiqueta="Total" valor={formatearMoneda(g.total, moneda)} nota={`${g.cantidad_total} ítem(s)`} />
        </GrillaMetricas>
      </Bloque>

      <Bloque titulo="Ingreso por período (últimos 12 meses)">
        {porMes.length === 0 ? (
          <SinDatos mensaje="Sin datos de ingresos todavía." />
        ) : (
          porMes.map((m) => (
            <FilaTabla
              key={m.mes}
              label={m.mes}
              valor={formatearMoneda(m.recibido, moneda)}
              sub="Recibido"
              valorSecundario={m.pendiente || m.vencido ? `+ ${formatearMoneda(m.pendiente + m.vencido, moneda)} sin cobrar` : undefined}
            />
          ))
        )}
      </Bloque>

      <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary}>
        Para el detalle por área, entrá a Financiero, Ventas, Operaciones, Servicios, Clientes o Gastos arriba.
      </Texto>
    </View>
  );
}
