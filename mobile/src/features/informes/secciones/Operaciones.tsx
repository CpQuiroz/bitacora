import { View } from "react-native";
import { useTema } from "../../../theme";
import { obtenerOperaciones } from "../../../services/informes";
import { Bloque, CargandoSeccion, ErrorSeccion, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

const ETIQUETA_ESTADO: Record<string, string> = {
  agendado: "Agendado",
  en_progreso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export function Operaciones({ desde, hasta }: { desde: string; hasta: string }) {
  const t = useTema();
  const { datos, error, reintentar } = useInformeFetch(() => obtenerOperaciones(desde, hasta), [desde, hasta]);

  if (error) return <ErrorSeccion mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <CargandoSeccion />;

  const { kpis, distribucion_estado: distribucion, os_por_mes: porMes, tiempo_promedio_conclusion: tiempos } = datos;

  return (
    <View style={{ gap: t.espacio(4) }}>
      <GrillaMetricas>
        <Metrica etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <Metrica etiqueta="Completadas" valor={String(kpis.completadas)} nota={`${kpis.pct_conclusion.toFixed(0)}% de conclusión`} />
        <Metrica etiqueta="En curso" valor={String(kpis.en_curso)} />
        <Metrica etiqueta="Agendadas" valor={String(kpis.agendadas)} />
      </GrillaMetricas>

      <Bloque titulo="OS por período (últimos 12 meses)">
        {porMes.length === 0 ? (
          <SinDatos mensaje="Sin órdenes de servicio registradas en los últimos 12 meses." />
        ) : (
          porMes.map((m) => <FilaTabla key={m.mes} label={m.mes} valor={`${m.completadas} completadas`} valorSecundario={`de ${m.total} total`} />)
        )}
      </Bloque>

      <Bloque titulo="Distribución por estado">
        {distribucion.length === 0 ? (
          <SinDatos mensaje="Ninguna OS registrada en el período." />
        ) : (
          distribucion.map((d) => <FilaTabla key={d.estado} label={ETIQUETA_ESTADO[d.estado] ?? d.estado} valor={String(d.cantidad)} />)
        )}
      </Bloque>

      <Bloque titulo="Tiempo promedio de conclusión">
        {tiempos.filter((m) => m.dias_promedio != null).length === 0 ? (
          <SinDatos mensaje="Ninguna OS cerrada en los últimos 12 meses." />
        ) : (
          tiempos
            .filter((m) => m.dias_promedio != null)
            .map((m) => <FilaTabla key={m.mes} label={m.mes} valor={`${m.dias_promedio!.toFixed(1)} días`} />)
        )}
      </Bloque>
    </View>
  );
}
