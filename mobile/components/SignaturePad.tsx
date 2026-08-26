import { useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { captureRef } from "react-native-view-shot";

type Punto = { x: number; y: number };

function trazoAPath(trazo: Punto[]): string {
  if (trazo.length === 0) return "";
  const [inicio, ...resto] = trazo;
  return `M ${inicio.x},${inicio.y} ` + resto.map((p) => `L ${p.x},${p.y}`).join(" ");
}

export function SignaturePad({
  onGuardar,
}: {
  onGuardar: (base64Png: string) => Promise<void> | void;
}) {
  const lienzoRef = useRef<View>(null);
  const [trazos, setTrazos] = useState<Punto[][]>([]);
  const [trazoActual, setTrazoActual] = useState<Punto[]>([]);
  const [guardando, setGuardando] = useState(false);

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

  return (
    <View>
      <View
        ref={lienzoRef}
        collapsable={false}
        style={styles.lienzo}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onInicio}
        onResponderMove={onMover}
        onResponderRelease={onFin}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {trazos.map((trazo, i) => (
            <Path
              key={i}
              d={trazoAPath(trazo)}
              stroke="#000"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {trazoActual.length > 0 && (
            <Path
              d={trazoAPath(trazoActual)}
              stroke="#000"
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </Svg>
        {trazos.length === 0 && trazoActual.length === 0 && (
          <Text style={styles.placeholder}>Firma aquí</Text>
        )}
      </View>
      <View style={styles.botones}>
        <TouchableOpacity onPress={limpiar} style={styles.botonSecundario}>
          <Text style={styles.textoSecundario}>Limpiar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={guardar}
          disabled={trazos.length === 0 || guardando}
          style={[styles.botonPrimario, (trazos.length === 0 || guardando) && styles.deshabilitado]}
        >
          {guardando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.textoPrimario}>Guardar firma</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lienzo: {
    height: 180,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: { color: "#bbb", fontSize: 14 },
  botones: { flexDirection: "row", gap: 10, marginTop: 10 },
  botonSecundario: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  textoSecundario: { color: "#333", fontWeight: "600" },
  botonPrimario: { flex: 1, backgroundColor: "#000", borderRadius: 8, padding: 12, alignItems: "center" },
  textoPrimario: { color: "#fff", fontWeight: "600" },
  deshabilitado: { opacity: 0.4 },
});
