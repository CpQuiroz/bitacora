import { useState } from "react";
import { Pressable, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { ErrorState, LoadingState, Texto, useMarca } from "@bitacora/ui/native";
import { formatearMoneda } from "../../../lib/plata";
import { obtenerGastosInforme, type AgrupacionGastos } from "../../../services/informes";
import { Bloque, FilaTabla, GrillaMetricas, Metrica, SinDatos, useInformeFetch } from "../componentes";

const AGRUPACIONES: { valor: AgrupacionGastos; etiqueta: string; dimension: string; dimensionPlural: string }[] = [
  { valor: "categoria", etiqueta: "Por categoría", dimension: "Categoría", dimensionPlural: "Categorías" },
  { valor: "centro_costo", etiqueta: "Por centro de costo", dimension: "Centro de costo", dimensionPlural: "Centros de costo" },
  { valor: "os", etiqueta: "Por Orden de Servicio", dimension: "Orden de Servicio", dimensionPlural: "Órdenes de Servicio" },
];

export function GastosInformeSeccion({ desde, hasta, moneda }: { desde: string; hasta: string; moneda: string }) {
  const marca = useMarca();
  const [agrupacion, setAgrupacion] = useState<AgrupacionGastos>("categoria");
  const config = AGRUPACIONES.find((a) => a.valor === agrupacion)!;
  const { datos, error, reintentar } = useInformeFetch(() => obtenerGastosInforme(desde, hasta, agrupacion), [desde, hasta, agrupacion]);

  return (
    <View style={{ gap: tokens.space["4"] }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: tokens.space["2"] }}>
        {AGRUPACIONES.map((a) => {
          const activo = a.valor === agrupacion;
          return (
            <Pressable
              key={a.valor}
              onPress={() => setAgrupacion(a.valor)}
              style={{
                minHeight: 36,
                justifyContent: "center",
                paddingHorizontal: tokens.space["3"],
                borderRadius: tokens.radius.md,
                backgroundColor: activo ? marca.suave : tokens.color.surface,
              }}
            >
              <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
                {a.etiqueta}
              </Texto>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <ErrorState mensaje={error} onReintentar={reintentar} />
      ) : !datos ? (
        <LoadingState />
      ) : (
        <>
          <GrillaMetricas>
            <Metrica etiqueta="Total de gastos" valor={formatearMoneda(datos.kpis.total_gastos, moneda)} />
            <Metrica etiqueta={`${config.dimensionPlural} con gastos`} valor={String(datos.kpis.grupos_con_gastos)} />
            <Metrica etiqueta={`Promedio por ${config.dimension.toLowerCase()}`} valor={formatearMoneda(datos.kpis.promedio_por_grupo, moneda)} />
            <Metrica etiqueta={`Mayor ${config.dimension.toLowerCase()}`} valor={datos.kpis.mayor_grupo ?? "—"} />
          </GrillaMetricas>

          <Bloque titulo="Distribución de gastos">
            {datos.distribucion.length === 0 ? (
              <SinDatos mensaje={`Ningún gasto con ${config.dimension.toLowerCase()} asignada en el período.`} />
            ) : (
              datos.distribucion.map((d) => <FilaTabla key={d.estado} label={d.estado} valor={formatearMoneda(d.cantidad, moneda)} />)
            )}
          </Bloque>

          <Bloque titulo={`Ranking de ${config.dimensionPlural.toLowerCase()}`}>
            {datos.ranking.length === 0 ? (
              <SinDatos mensaje={`Ningún gasto con ${config.dimension.toLowerCase()} asignada en el período.`} />
            ) : (
              datos.ranking.map((r) => <FilaTabla key={r.nombre} label={r.nombre} valor={formatearMoneda(r.valor, moneda)} />)
            )}
          </Bloque>

          <Bloque titulo={`Evolución por ${config.dimension.toLowerCase()} (últimos 12 meses)`}>
            {datos.evolucion.length === 0 ? (
              <SinDatos mensaje="Ningún gasto en el período seleccionado." />
            ) : (
              datos.evolucion.map((m) => <FilaTabla key={m.mes} label={m.mes} valor={formatearMoneda(m.monto, moneda)} />)
            )}
          </Bloque>
        </>
      )}
    </View>
  );
}
