import { useMemo } from "react";
import { View } from "react-native";
import { useTema } from "../../../theme";
import { Text } from "../../../components/ui";
import { obtenerServicios } from "../../../services/informes";
import { Bloque, CargandoSeccion, ErrorSeccion, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

export function Servicios({ desde, hasta }: { desde: string; hasta: string }) {
  const t = useTema();
  const { datos, error, reintentar } = useInformeFetch(() => obtenerServicios(desde, hasta), [desde, hasta]);

  // Mismos 3 insights que ya arma la web a partir de los mismos datos —
  // texto generado en el cliente, no una agregación nueva.
  const insights = useMemo(() => {
    if (!datos || datos.ranking_tipos.length === 0) return [];
    const total = datos.ranking_tipos.reduce((acc, r) => acc + r.valor, 0);
    const lista: string[] = [];
    const top = datos.ranking_tipos[0];
    if (top && total > 0) {
      lista.push(`El tipo "${top.nombre}" representa el ${((top.valor / total) * 100).toFixed(0)}% de tus OS clasificadas en el período.`);
    }
    if (datos.kpis.total_os > 0 && datos.kpis.tipos_utilizados === 0) {
      lista.push("Ninguna OS de este período tiene un Tipo de OS asignado.");
    }
    if (datos.kpis.tasa_promedio >= 80) {
      lista.push(`Tasa de conclusión alta (${datos.kpis.tasa_promedio.toFixed(0)}%) — la mayoría de tus OS llegan a buen puerto.`);
    }
    return lista;
  }, [datos]);

  if (error) return <ErrorSeccion mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <CargandoSeccion />;

  const { kpis, distribucion_tipo: distribucion, ranking_tipos: ranking, top_clientes_por_tipo: topClientes } = datos;

  return (
    <View style={{ gap: t.espacio(4) }}>
      <GrillaMetricas>
        <Metrica etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <Metrica etiqueta="Completadas" valor={String(kpis.completadas)} />
        <Metrica etiqueta="Tipos utilizados" valor={String(kpis.tipos_utilizados)} />
        <Metrica etiqueta="Tasa promedio" valor={`${kpis.tasa_promedio.toFixed(0)}%`} />
      </GrillaMetricas>

      <Bloque titulo="Distribución por tipo">
        {distribucion.length === 0 ? (
          <SinDatos mensaje="Ninguna OS clasificada por Tipo de OS en el período." />
        ) : (
          distribucion.map((d) => <FilaTabla key={d.estado} label={d.estado} valor={String(d.cantidad)} />)
        )}
      </Bloque>

      <Bloque titulo="Ranking de tipos">
        {ranking.length === 0 ? (
          <SinDatos mensaje="Ninguna OS clasificada por Tipo de OS en el período." />
        ) : (
          ranking.map((r) => <FilaTabla key={r.nombre} label={r.nombre} valor={String(r.valor)} />)
        )}
      </Bloque>

      <Bloque titulo="Top clientes por tipo">
        {topClientes.length === 0 ? (
          <SinDatos mensaje="Ningún dato de clientes por tipo disponible." />
        ) : (
          topClientes.map((c) => <FilaTabla key={`${c.cliente}-${c.tipo}`} label={c.cliente} sub={c.tipo} valor={String(c.cantidad)} />)
        )}
      </Bloque>

      <Bloque titulo="Insights de servicios">
        {insights.length === 0 ? (
          <SinDatos mensaje="Sin observaciones todavía — clasifica tus OS por Tipo de OS para verlas acá." />
        ) : (
          <View style={{ gap: t.espacio(1.5) }}>
            {insights.map((texto, i) => (
              <Text key={i} variante="cuerpo">
                • {texto}
              </Text>
            ))}
          </View>
        )}
      </Bloque>
    </View>
  );
}
