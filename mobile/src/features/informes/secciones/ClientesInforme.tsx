import { View } from "react-native";
import { useTema } from "../../../theme";
import { formatearMoneda } from "../../../lib/plata";
import { obtenerClientesInforme } from "../../../services/informes";
import { Bloque, CargandoSeccion, ErrorSeccion, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

export function ClientesInforme({ desde, hasta, moneda }: { desde: string; hasta: string; moneda: string }) {
  const t = useTema();
  const { datos, error, reintentar } = useInformeFetch(() => obtenerClientesInforme(desde, hasta), [desde, hasta]);

  if (error) return <ErrorSeccion mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <CargandoSeccion />;

  const { kpis, distribucion_estado: distribucion, clientes_por_mes: porMes, tasa_retencion: retencion, por_comuna: comunas } = datos;

  return (
    <View style={{ gap: t.espacio(4) }}>
      <GrillaMetricas>
        <Metrica etiqueta="Total de clientes" valor={String(kpis.total_clientes)} />
        <Metrica etiqueta="Clientes activos" valor={String(kpis.clientes_activos)} />
        <Metrica etiqueta="Nuevos clientes" valor={String(kpis.nuevos_clientes)} />
        <Metrica etiqueta="Ingreso promedio" valor={formatearMoneda(kpis.ingreso_promedio, moneda)} />
      </GrillaMetricas>

      <Bloque titulo="Evolución de la base de clientes (últimos 12 meses)">
        {porMes.length === 0 ? (
          <SinDatos mensaje="Sin clientes registrados en los últimos 12 meses." />
        ) : (
          porMes.map((m) => <FilaTabla key={m.mes} label={m.mes} valor={`${m.nuevos} nuevos`} valorSecundario={`${m.total} total`} />)
        )}
      </Bloque>

      <Bloque titulo="Distribución por estado">
        {distribucion.length === 0 ? (
          <SinDatos mensaje="Ningún cliente registrado." />
        ) : (
          distribucion.map((d) => <FilaTabla key={d.estado} label={d.estado} valor={String(d.cantidad)} />)
        )}
      </Bloque>

      <Bloque titulo="Tasa de retención">
        {retencion.filter((m) => m.valor != null).length === 0 ? (
          <SinDatos mensaje="Sin actividad suficiente para calcular retención mes a mes." />
        ) : (
          retencion.filter((m) => m.valor != null).map((m) => <FilaTabla key={m.mes} label={m.mes} valor={`${m.valor!.toFixed(0)}%`} />)
        )}
      </Bloque>

      <Bloque titulo="Clientes por comuna">
        {comunas.length === 0 ? (
          <SinDatos mensaje="Ningún cliente tiene comuna registrada todavía." />
        ) : (
          comunas.map((c) => <FilaTabla key={c.nombre} label={c.nombre} valor={String(c.valor)} />)
        )}
      </Bloque>
    </View>
  );
}
