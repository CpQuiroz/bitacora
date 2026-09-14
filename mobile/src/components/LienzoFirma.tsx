import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View } from "react-native";
import SignatureView, { type SignatureViewRef } from "react-native-signature-canvas";
import { useTema } from "../theme";
import { Text } from "./ui";

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

// Bug real (14-sep-2026): el lienzo anterior usaba el Responder System
// de RN a mano (onStartShouldSetResponder/onResponderMove + SVG) —
// dentro del ScrollView de la pantalla, el scroll le ganaba el gesto al
// trazo la mayoría de las veces ("no deja firmar"), un conflicto
// conocido de esa API con contenedores scrolleables. react-native-
// signature-canvas resuelve esto de raíz: el dibujo ocurre DENTRO de un
// WebView (signature_pad.js sobre un <canvas> HTML real), completamente
// aislado del sistema de gestos de RN — el touch nunca compite con el
// ScrollView padre.
//
// Interfaz externa sin cambios (vacio/capturar/limpiar) — CierreFirma.tsx
// y ChecklistMantencionScreen.tsx no se tocaron.
export const LienzoFirma = forwardRef<LienzoFirmaHandle, { alto?: number }>(function LienzoFirma({ alto = 170 }, ref) {
  const t = useTema();
  const sigRef = useRef<SignatureViewRef>(null);
  const [vacio, setVacio] = useState(true);
  // readSignature() es async vía callback (onOK/onEmpty) — se envuelve
  // en una promesa para que capturar() siga devolviendo Promise<string|null>,
  // igual que antes.
  const resolverPendiente = useRef<((v: string | null) => void) | null>(null);

  useImperativeHandle(ref, () => ({
    vacio: () => vacio,
    limpiar: () => {
      sigRef.current?.clearSignature();
      setVacio(true);
    },
    capturar: () =>
      new Promise<string | null>((resolve) => {
        resolverPendiente.current = resolve;
        sigRef.current?.readSignature();
      }),
  }));

  function onOK(dataUrl: string) {
    // "data:image/png;base64,AAAA..." -> "AAAA..." — el backend espera
    // el base64 puro (Buffer.from(firma_base64, "base64")), mismo
    // contrato que ya usaba captureRef() antes.
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    resolverPendiente.current?.(base64 || null);
    resolverPendiente.current = null;
  }

  function onEmpty() {
    resolverPendiente.current?.(null);
    resolverPendiente.current = null;
  }

  return (
    <View style={{ gap: t.espacio(1.5) }}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Text
          onPress={() => {
            sigRef.current?.clearSignature();
            setVacio(true);
          }}
          variante="etiqueta"
          tono="brand"
          weight="semibold"
        >
          Limpiar
        </Text>
      </View>
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
        <SignatureView
          ref={sigRef}
          onOK={onOK}
          onEmpty={onEmpty}
          onBegin={() => setVacio(false)}
          onClear={() => setVacio(true)}
          webStyle={ESTILO_WEB}
          descriptionText=""
          penColor="#111111"
          backgroundColor="#ffffff"
          autoClear={false}
          webviewContainerStyle={{ backgroundColor: "transparent" }}
        />
        {vacio ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
            <Text variante="cuerpo" tono="faint">
              Firma aquí
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
});
