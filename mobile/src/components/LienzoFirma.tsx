import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { useTema } from "../theme";
import { Text } from "./ui";

type Punto = { x: number; y: number };

function trazoAPath(trazo: Punto[]): string {
  if (trazo.length === 0) return "";
  const [inicio, ...resto] = trazo;
  return `M ${inicio.x},${inicio.y} ` + resto.map((p) => `L ${p.x},${p.y}`).join(" ");
}

export type LienzoFirmaHandle = {
  vacio: () => boolean;
  capturar: () => Promise<string | null>;
  limpiar: () => void;
};

// Lienzo de firma inline (170px) con línea de apoyo y "Limpiar" arriba a
// la derecha. El padre captura el PNG en base64 vía ref al confirmar.
export const LienzoFirma = forwardRef<LienzoFirmaHandle, { alto?: number }>(function LienzoFirma({ alto = 170 }, ref) {
  const t = useTema();
  const lienzoRef = useRef<View>(null);
  const [trazos, setTrazos] = useState<Punto[][]>([]);
  const [trazoActual, setTrazoActual] = useState<Punto[]>([]);

  const vacio = trazos.length === 0 && trazoActual.length === 0;

  useImperativeHandle(ref, () => ({
    vacio: () => vacio,
    limpiar: () => {
      setTrazos([]);
      setTrazoActual([]);
    },
    capturar: async () => {
      if (vacio) return null;
      try {
        const base64 = await captureRef(lienzoRef, { format: "png", result: "base64", quality: 1 });
        return base64 && base64.length > 100 ? base64 : null;
      } catch {
        return null;
      }
    },
  }));

  function onInicio(e: GestureResponderEvent) {
    const { locationX, locationY } = e.nativeEvent;
    setTrazoActual([{ x: locationX, y: locationY }]);
  }
  function onMover(e: GestureResponderEvent) {
    const { locationX, locationY } = e.nativeEvent;
    setTrazoActual((prev) => [...prev, { x: locationX, y: locationY }]);
  }
  function onFin() {
    if (trazoActual.length > 0) {
      setTrazos((prev) => [...prev, trazoActual]);
      setTrazoActual([]);
    }
  }

  const linea = (d: string, key?: number) => (
    <Path key={key} d={d} stroke="#111111" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  );

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Text
          onPress={() => {
            setTrazos([]);
            setTrazoActual([]);
          }}
          variante="etiqueta"
          tono="brand"
          weight="semibold"
        >
          Limpiar
        </Text>
      </View>
      <View
        ref={lienzoRef}
        collapsable={false}
        style={{
          height: alto,
          borderWidth: 1,
          borderColor: t.colores.borderStrong,
          borderRadius: t.radio.md,
          backgroundColor: "#ffffff",
          overflow: "hidden",
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onInicio}
        onResponderMove={onMover}
        onResponderRelease={onFin}
      >
        <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* línea de apoyo */}
          <Line x1={16} y1={alto - 34} x2="92%" y2={alto - 34} stroke="#D3D8DD" strokeWidth={1} />
          {trazos.map((tr, i) => linea(trazoAPath(tr), i))}
          {trazoActual.length > 0 && linea(trazoAPath(trazoActual))}
        </Svg>
        {vacio ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text variante="cuerpo" tono="faint">
              Firma aquí
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});
