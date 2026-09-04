import { View } from "react-native";
import { useTema } from "../../../theme";
import { formatearMoneda } from "../../../lib/plata";
import { obtenerVentas } from "../../../services/informes";
import { Bloque, CargandoSeccion, ErrorSeccion, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  enviado: "Enviado",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  vencida: "Vencida",
  expirado: "Expirado",
};

export function Ventas({ desde, hasta, moneda }: { desde: string; hasta: string; moneda: string }) {
  const t = useTema();
  const { datos, error, reintentar } = useInformeFetch(() => obtenerVentas(desde, hasta), [desde, hasta]);

  if (error) return <ErrorSeccion mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <CargandoSeccion />;

  const { kpis, cotizaciones_por_mes: porMes, distribucion_estado: distribucion, top_servicios: servicios } = datos;

  return (
    <View style={{ gap: t.espacio(4) }}>
      <GrillaMetricas>
        <Metrica etiqueta="Total de cotizaciones" valor={String(kpis.total_cotizaciones)} />
        <Metrica etiqueta="Valor total" valor={formatearMoneda(kpis.valor_total, moneda)} />
        <Metrica etiqueta="Tasa de conversión" valor={`${kpis.tasa_conversion.toFixed(0)}%`} />
        <Metrica etiqueta="Ticket promedio" valor={formatearMoneda(kpis.ticket_promedio, moneda)} />
      </GrillaMetricas>

      <Bloque titulo="Cotizaciones por período (últimos 12 meses)">
        {porMes.length === 0 ? (
          <SinDatos mensaje="Sin cotizaciones registradas en los últimos 12 meses." />
        ) : (
          porMes.map((m) => (
            <FilaTabla key={m.mes} label={m.mes} valor={`${m.aprobadas} aprobadas`} valorSecundario={`de ${m.total} total`} />
          ))
        )}
      </Bloque>

      <Bloque titulo="Distribución por estado">
        {distribucion.length === 0 ? (
          <SinDatos mensaje="Ninguna cotización registrada en el período." />
        ) : (
          distribucion.map((d) => <FilaTabla key={d.estado} label={ETIQUETA_ESTADO[d.estado] ?? d.estado} valor={String(d.cantidad)} />)
        )}
      </Bloque>

      <Bloque titulo="Top servicios vendidos">
        {servicios.length === 0 ? (
          <SinDatos mensaje="Ningún servicio vendido en el período." />
        ) : (
          servicios.map((s) => (
            <FilaTabla key={s.servicio} label={s.servicio} sub={`${s.cantidad} unidad(es)`} valor={formatearMoneda(s.valor, moneda)} />
          ))
        )}
      </Bloque>
    </View>
  );
}
