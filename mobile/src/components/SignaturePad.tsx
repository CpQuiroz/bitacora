import { useRef, useState } from "react";
import { Alert, Modal, View, type GestureResponderEvent } from "react-native";
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

/**
 * Firma del cliente. Abre un modal a pantalla completa para firmar —
 * así el gesto no compite con el scroll de la pantalla de detalle y el
 * área de firma es grande.
 */
export function SignaturePad({ onGuardar }: { onGuardar: (base64Png: string) => Promise<void> | void }) {
  const t = useTema();
  const [abierto, setAbierto] = useState(false);
  const lienzoRef = useRef<View>(null);
  const [trazos, setTrazos] = useState<Punto[][]>([]);
  const [trazoActual, setTrazoActual] = useState<Punto[]>([]);
  const [guardando, setGuardando] = useState(false);

  const vacio = trazos.length === 0 && trazoActual.length === 0;

  function reset() {
    setTrazos([]);
    setTrazoActual([]);
  }
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
  async function guardar() {
    if (vacio) return;
    setGuardando(true);
    try {
      const base64 = await captureRef(lienzoRef, { format: "png", result: "base64", quality: 1 });
      if (!base64 || base64.length < 100) {
        Alert.alert("No se pudo guardar la firma", "Intenta de nuevo. Si sigue fallando, avisa a la oficina.");
        return;
      }
      await onGuardar(base64);
      setAbierto(false);
      reset();
    } catch {
      Alert.alert("No se pudo guardar la firma", "Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  const linea = (d: string, key?: number) => (
    <Path key={key} d={d} stroke="#111111" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  );

  return (
    <>
      <Button
        titulo="Firmar aquí"
        variante="secundario"
        onPress={() => {
          reset();
          setAbierto(true);
        }}
      />

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: t.colores.bg, padding: t.espacio(5), paddingTop: t.espacio(12), gap: t.espacio(3) }}>
          <Text variante="subtitulo">Firma del cliente</Text>
          <Text variante="etiqueta" tono="muted">
            Pide al cliente que firme en el recuadro.
          </Text>
          <View
            ref={lienzoRef}
            collapsable={false}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: t.colores.border,
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
          <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
            <Button titulo="Borrar" variante="ghost" onPress={reset} disabled={vacio} />
            <View style={{ flex: 1 }}>
              <Button titulo="Guardar firma" tamano="lg" onPress={guardar} cargando={guardando} disabled={vacio} />
            </View>
          </View>
          <Button titulo="Cancelar" variante="ghost" onPress={() => setAbierto(false)} />        </View>
      </Modal>
    </>
  );
}
