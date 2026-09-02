import { useRef, useState } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { useTema } from "../theme";
import { Button, Text } from "./ui";

type Punto = { x: number; y: number };

function trazoAPath(trazo: Punto[]): string {
  if (trazo.length === 0) return "";
  const [inicio, ...resto] = trazo;
  return `M ${inicio.x},${inicio.y} ` + resto.map((p) => `L ${p.x},${p.y}`).join(" ");
}

export function SignaturePad({ onGuardar }: { onGuardar: (base64Png: string) => Promise<void> | void }) {
  const t = useTema();
  const lienzoRef = useRef<View>(null);
  const [trazos, setTrazos] = useState<Punto[][]>([]);
  const [trazoActual, setTrazoActual] = useState<Punto[]>([]);
  const [guardando, setGuardando] = useState(false);

  const vacio = trazos.length === 0 && trazoActual.length === 0;

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
  function limpiar() {
    setTrazos([]);
    setTrazoActual([]);
  }
  async function guardar() {
    if (trazos.length === 0) return;
    setGuardando(true);
    try {
      const base64 = await captureRef(lienzoRef, { format: "png", result: "base64" });
      await onGuardar(base64);
      limpiar();
    } finally {
      setGuardando(false);
    }
  }

  const linea = (d: string, key?: number) => (
    <Path key={key} d={d} stroke={t.colores.foreground} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  );

  return (
    <View style={{ gap: t.espacio(2.5) }}>
      <View
        ref={lienzoRef}
        collapsable={false}
        style={{
          height: 180,
          borderWidth: 1,
          borderColor: t.colores.border,
          borderRadius: t.radio.md,
          backgroundColor: t.colores.bg,
          alignItems: "center",
          justifyContent: "center",
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onInicio}
        onResponderMove={onMover}
        onResponderRelease={onFin}
      >
        <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          {trazos.map((tr, i) => linea(trazoAPath(tr), i))}
          {trazoActual.length > 0 && linea(trazoAPath(trazoActual))}
        </Svg>
        {vacio && (
          <Text variante="etiqueta" tono="faint">
            Firma aquí
          </Text>
        )}
      </View>
      <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
        <Button titulo="Limpiar" variante="secundario" onPress={limpiar} />
        <Button titulo="Guardar firma" onPress={guardar} cargando={guardando} disabled={vacio} />
      </View>
    </View>
  );
}
