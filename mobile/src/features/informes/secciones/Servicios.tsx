import { useMemo } from "react";
import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { ErrorState, LoadingState, Texto } from "@bitacora/ui/native";
import { obtenerServicios } from "../../../services/informes";
import { Bloque, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

// Tarea 145 (opción B, 26-sep-2026): sin "Tipo de OS" — volumen de OS, tasa
// de conclusión y clientes con más OS, igual que la web.
export function Servicios({ desde, hasta }: { desde: string; hasta: string }) {
  const { datos, error, reintentar } = useInformeFetch(() => obtenerServicios(desde, hasta), [desde, hasta]);
  const topClientes = useMemo(() => datos?.top_clientes ?? [], [datos]);

  const insights = useMemo(() => {
    if (!datos || datos.kpis.total_os === 0) return [];
    const lista: string[] = [];
    const top = topClientes[0];
    if (top) lista.push(`${top.cliente} concentra el ${((top.cantidad / datos.kpis.total_os) * 100).toFixed(0)}% de tus OS del período (${top.cantidad}).`);
    if (datos.kpis.tasa_promedio >= 80) {
      lista.push(`Tasa de conclusión alta (${datos.kpis.tasa_promedio.toFixed(0)}%) — la mayoría de tus OS llegan a buen puerto.`);
    } else if (datos.kpis.tasa_promedio < 50) {
      lista.push(`Menos de la mitad de tus OS del período están terminadas (${datos.kpis.tasa_promedio.toFixed(0)}%).`);
    }
    return lista;
  }, [datos, topClientes]);

  if (error) return <ErrorState mensaje={error} onReintentar={reintentar} />;
  if (!datos) return <LoadingState />;

  const { kpis } = datos;

  return (
    <View style={{ gap: tokens.space["4"] }}>
      <GrillaMetricas>
        <Metrica etiqueta="Total de OS" valor={String(kpis.total_os)} />
        <Metrica etiqueta="Completadas" valor={String(kpis.completadas)} />
        <Metrica etiqueta="Tasa de conclusión" valor={`${kpis.tasa_promedio.toFixed(0)}%`} />
      </GrillaMetricas>

      <Bloque titulo="Clientes con más OS">
        {topClientes.length === 0 ? (
          <SinDatos mensaje="Sin OS en el período." />
        ) : (
          topClientes.map((c) => <FilaTabla key={c.cliente} label={c.cliente} valor={String(c.cantidad)} />)
        )}
      </Bloque>

      <Bloque titulo="Insights de servicios">
        {insights.length === 0 ? (
          <SinDatos mensaje="Sin observaciones todavía para este período." />
        ) : (
          <View style={{ gap: tokens.space["1"] }}>
            {insights.map((texto, i) => (
              <Texto key={i} tamano={tokens.size.small} color={tokens.color.text}>
                • {texto}
              </Texto>
            ))}
          </View>
        )}
      </Bloque>
    </View>
  );
}
