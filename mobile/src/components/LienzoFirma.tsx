import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Alert, Image, Modal, View } from "react-native";
import SignatureView, { type SignatureViewRef } from "react-native-signature-canvas";
import { useTema } from "../theme";
import { Button, Text } from "./ui";

// Oculta la barra propia de la librería (limpiar/descripción/confirmar) —
// el lienzo se controla desde afuera (ver LienzoFirmaHandle), igual que
// antes. Nombres de clase confirmados contra el HTML que empaqueta
// react-native-signature-canvas (h5/html.js).
const ESTILO_WEB = `
  .m-signature-pad--footer { display: none; }
  .m-signature-pad--body { border: none; }
  body, html { background-color: transparent; }
`;

export type LienzoFirmaHandle = {
  vacio: () => boolean;
  capturar: () => Promise<string | null>;
  limpiar: () => void;
};

// Historia de este componente (para no repetir el mismo error dos veces):
// 1) Versión original (hasta el refresco visual, commit 1acf839): botón
//    "Firmar aquí" que abría un modal a pantalla completa — el trazo no
//    competía con el scroll de la ficha y el área era grande.
// 2) El refresco visual (f17af18) lo cambió a un lienzo chico siempre
//    visible, inline en el ScrollView — SVG + Responder System a mano.
//    Bug real: dentro del ScrollView, el scroll le ganaba el gesto al
//    trazo casi siempre ("no deja firmar").
// 3) Primer intento de arreglo (14-sep-2026): se mantuvo el lienzo chico
//    inline pero se cambió el dibujo a react-native-signature-canvas
//    (WebView + signature_pad.js sobre un <canvas> real), que aísla el
//    touch del sistema de gestos de RN. Reportado por la usuaria: seguía
//    sin firmar bien con el dedo — el área chica dentro del scroll seguía
//    siendo un mal lugar para firmar aunque el gesto ya no compitiera.
// 4) Este archivo (14-sep-2026, 2º intento): se vuelve al patrón (1) —
//    botón "Firmar aquí" que abre un modal a pantalla completa, sin
//    scroll alrededor y con área grande — pero dibujando con
//    react-native-signature-canvas (no con el SVG a mano de la versión
//    original), para sumar ambos arreglos.
//
// Interfaz externa sin cambios (vacio/capturar/limpiar) — CierreFirma.tsx
// y ChecklistMantencionScreen.tsx no se tocaron. `capturar()` ahora
// devuelve la firma que ya quedó guardada al cerrar el modal, no dispara
// una captura nueva.
export const LienzoFirma = forwardRef<LienzoFirmaHandle, { alto?: number }>(function LienzoFirma({ alto = 110 }, ref) {
  const t = useTema();
  const sigRef = useRef<SignatureViewRef>(null);
  const [abierto, setAbierto] = useState(false);
  const [firma, setFirma] = useState<string | null>(null); // base64 puro, ya guardado
  const [vacioEnCurso, setVacioEnCurso] = useState(true); // trazo dentro del modal, antes de "Guardar firma"

  useImperativeHandle(ref, () => ({
    vacio: () => firma === null,
    limpiar: () => setFirma(null),
    capturar: () => Promise.resolve(firma),
  }));

  function abrir() {
    setVacioEnCurso(true);
    setAbierto(true);
  }

  function onOK(dataUrl: string) {
    // "data:image/png;base64,AAAA..." -> "AAAA..." — el backend espera
    // el base64 puro (Buffer.from(firma_base64, "base64")).
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    if (!base64) {
      // alerta-nativa: dentro de un Modal (el toast quedaría tapado)
      Alert.alert("No se pudo guardar la firma", "Intenta de nuevo.");
      return;
    }
    setFirma(base64);
    setAbierto(false);
  }

  function onEmpty() {
    // alerta-nativa: dentro de un Modal (el toast quedaría tapado)
    Alert.alert("Falta la firma", "Dibuja en el recuadro antes de guardar.");
  }

  return (
    <View style={{ gap: t.espacio(2) }}>
      {firma ? (
        <View
          style={{
            height: alto,
            borderWidth: 1,
            borderColor: t.colores.borderStrong,
            borderRadius: t.radio.md,
            overflow: "hidden",
            backgroundColor: "#ffffff",
          }}
        >
          <Image source={{ uri: `data:image/png;base64,${firma}` }} resizeMode="contain" style={{ width: "100%", height: "100%" }} />
        </View>
      ) : null}

      <Button titulo={firma ? "Cambiar firma" : "Firmar aquí"} variante="secundario" onPress={abrir} />

      <Modal visible={abierto} animationType="slide" onRequestClose={() => setAbierto(false)}>
        <View style={{ flex: 1, backgroundColor: t.colores.bg, padding: t.espacio(5), paddingTop: t.espacio(12), gap: t.espacio(3) }}>
          <Text variante="subtitulo">Firma</Text>
          <Text variante="etiqueta" tono="muted">
            Firma con el dedo en el recuadro.
          </Text>
          <View
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: t.colores.borderStrong,
              borderRadius: t.radio.md,
              overflow: "hidden",
              backgroundColor: "#ffffff",
            }}
          >
            <SignatureView
              ref={sigRef}
              onOK={onOK}
              onEmpty={onEmpty}
              onBegin={() => setVacioEnCurso(false)}
              onClear={() => setVacioEnCurso(true)}
              webStyle={ESTILO_WEB}
              descriptionText=""
              penColor="#111111"
              backgroundColor="#ffffff"
              autoClear={false}
              webviewContainerStyle={{ backgroundColor: "transparent" }}
            />
            {vacioEnCurso ? (
              <View
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}
              >
                <Text variante="cuerpo" tono="faint">
                  Firma aquí
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: t.espacio(2.5) }}>
            <Button titulo="Borrar" variante="ghost" fullWidth={false} onPress={() => sigRef.current?.clearSignature()} />
            <View style={{ flex: 1 }}>
              <Button titulo="Guardar firma" tamano="lg" onPress={() => sigRef.current?.readSignature()} />
            </View>
          </View>
          <Button titulo="Cancelar" variante="ghost" onPress={() => setAbierto(false)} />
        </View>
      </Modal>
    </View>
  );
});
