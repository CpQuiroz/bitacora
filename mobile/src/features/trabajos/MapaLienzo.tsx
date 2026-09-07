import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";
import { useTema } from "../../theme";
import { Text } from "../../components/ui";

// No hay mapa nativo (expo-maps se quitó: en Android necesita una API
// key de Google y sin ella tumbaba la app). Este lienzo dibuja las
// paradas en su posición relativa real dentro del recuadro de
// coordenadas — pines numerados por orden de visita, unidos por la línea
// de recorrido, con la posición propia como punto verde. Sin calles
// debajo, pero la geometría es fiel.

export type PuntoMapa = {
  id: string;
  lat: number;
  lng: number;
  numero: number;
  activo: boolean;
};

const PAD = 34;

export function MapaLienzo({
  puntos,
  posicionPropia,
  seleccionId,
  onSeleccionar,
}: {
  puntos: PuntoMapa[];
  posicionPropia: { lat: number; lng: number } | null;
  seleccionId?: string;
  onSeleccionar?: (id: string) => void;
}) {
  const t = useTema();
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);

  const caja = useMemo(() => {
    const coords = [...puntos.map((p) => ({ lat: p.lat, lng: p.lng })), ...(posicionPropia ? [posicionPropia] : [])];
    if (coords.length === 0) return null;
    let minLat = Math.min(...coords.map((c) => c.lat));
    let maxLat = Math.max(...coords.map((c) => c.lat));
    let minLng = Math.min(...coords.map((c) => c.lng));
    let maxLng = Math.max(...coords.map((c) => c.lng));
    if (maxLat - minLat < 1e-4) {
      minLat -= 5e-4;
      maxLat += 5e-4;
    }
    if (maxLng - minLng < 1e-4) {
      minLng -= 5e-4;
      maxLng += 5e-4;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [puntos, posicionPropia]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setTam({ w: width, h: height });
  }

  const ordenados = useMemo(() => [...puntos].sort((a, b) => a.numero - b.numero), [puntos]);

  return (
    <View onLayout={onLayout} style={{ flex: 1, backgroundColor: "#E8ECEF", overflow: "hidden" }}>
      {caja && tam && tam.w > 0 && tam.h > 0 ? (
        (() => {
          const x = (lng: number) => PAD + ((lng - caja.minLng) / (caja.maxLng - caja.minLng)) * (tam.w - PAD * 2);
          const y = (lat: number) => PAD + ((caja.maxLat - lat) / (caja.maxLat - caja.minLat)) * (tam.h - PAD * 2);
          return (
            <Svg width={tam.w} height={tam.h}>
              {ordenados.slice(1).map((p, i) => {
                const prev = ordenados[i];
                return (
                  <Line
                    key={`l${p.id}`}
                    x1={x(prev.lng)}
                    y1={y(prev.lat)}
                    x2={x(p.lng)}
                    y2={y(p.lat)}
                    stroke={t.colores.brand}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    opacity={0.4}
                  />
                );
              })}
              {posicionPropia ? (
                <Circle cx={x(posicionPropia.lng)} cy={y(posicionPropia.lat)} r={7} fill="#15803d" stroke="#ffffff" strokeWidth={2} />
              ) : null}
              {ordenados.map((p) => {
                const sel = p.id === seleccionId;
                return (
                  <Circle
                    key={p.id}
                    cx={x(p.lng)}
                    cy={y(p.lat)}
                    r={sel ? 15 : 13}
                    fill={p.activo ? t.colores.accent : t.colores.brand}
                    stroke="#ffffff"
                    strokeWidth={sel ? 3 : 2}
                    onPress={onSeleccionar ? () => onSeleccionar(p.id) : undefined}
                  />
                );
              })}
              {ordenados.map((p) => (
                <SvgText
                  key={`n${p.id}`}
                  x={x(p.lng)}
                  y={y(p.lat) + 4}
                  fill="#ffffff"
                  fontSize={12}
                  fontWeight="700"
                  textAnchor="middle"
                >
                  {p.numero}
                </SvgText>
              ))}
            </Svg>
          );
        })()
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: t.espacio(5) }}>
          <Text variante="etiqueta" tono="muted" style={{ textAlign: "center" }}>
            {caja ? "" : "Ninguna parada de hoy tiene ubicación en el mapa."}
          </Text>
        </View>
      )}
    </View>
  );
}
