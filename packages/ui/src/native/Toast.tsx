import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Keyboard, Platform, Pressable, View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import type { ConDeshacer, MostrarToast, OpcionesToast, TonoToast } from "../tipos";
import { crearConDeshacer } from "../compartido/deshacer";
import { HIT_SLOP_TEXTO } from "./accesibilidad";
import { Texto } from "./Texto";

const DURACION_MS = 3000;
const DURACION_CON_ACCION_MS = 5000;

type Item = { id: number; mensaje: string } & OpcionesToast;

const ICONO: Record<TonoToast, typeof Info> = { exito: CheckCircle2, error: AlertTriangle, info: Info };

const ToastContext = createContext<MostrarToast>(() => {});

// iOS presenta las pantallas "modal" de native-stack y los <Modal> en un
// controlador propio, encima de la raíz: sin esta capa el toast quedaría
// tapado. En Android todo vive en la misma jerarquía.
const Capa = Platform.OS === "ios" ? FullWindowOverlay : Fragment;

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);
  const teclado = useAltoTecladoIos();

  const quitar = useCallback((id: number) => setItems((actuales) => actuales.filter((i) => i.id !== id)), []);

  const mostrar = useCallback<MostrarToast>(
    (mensaje, opciones = {}) => {
      const id = ++idRef.current;
      setItems((actuales) => [...actuales, { id, mensaje, ...opciones }]);
      // TalkBack/VoiceOver no leen solos una vista nueva que no tiene foco.
      AccessibilityInfo.announceForAccessibility(mensaje);
      setTimeout(() => quitar(id), opciones.duracionMs ?? (opciones.accion ? DURACION_CON_ACCION_MS : DURACION_MS));
    },
    [quitar]
  );

  return (
    <ToastContext.Provider value={mostrar}>
      <View style={{ flex: 1 }}>
        {children}
        <Capa>
          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: tokens.space["4"],
              right: tokens.space["4"],
              // Sobre la barra de pestañas (~64) y el inset inferior del
              // teléfono; con el teclado abierto (iOS), sobre el teclado.
              bottom: teclado > 0 ? teclado + tokens.space["4"] : tokens.space["8"] + 64 + insets.bottom,
              alignItems: "center",
              gap: tokens.space["2"],
            }}
          >
            {items.map((item) => {
              const tono = item.tono ?? "info";
              const Icono = ICONO[tono];
              const fondo = tono === "error" ? tokens.semantic.danger : tokens.color.neutral["900"];
              const texto = tono === "error" ? tokens.color.surface : tokens.color.neutral["100"];
              return (
                <View
                  key={item.id}
                  accessibilityLiveRegion={tono === "error" ? "assertive" : "polite"}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: tokens.space["2"],
                    maxWidth: 480,
                    backgroundColor: fondo,
                    borderRadius: tokens.radius.pill,
                    paddingHorizontal: tokens.space["4"],
                    paddingVertical: tokens.space["2"],
                    shadowColor: tokens.color.neutral["900"],
                    shadowOpacity: 0.16,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 4,
                  }}
                >
                  <Icono size={16} strokeWidth={2.5} color={texto} />
                  <Texto tamano={tokens.size.small} color={texto} style={{ flexShrink: 1 }}>
                    {item.mensaje}
                  </Texto>
                  {item.accion ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={HIT_SLOP_TEXTO}
                      onPress={() => {
                        item.accion!.onPress();
                        quitar(item.id);
                      }}
                    >
                      <Texto tamano={tokens.size.small} color={texto} peso="semibold" style={{ textDecorationLine: "underline" }}>
                        {item.accion.etiqueta}
                      </Texto>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        </Capa>
      </View>
    </ToastContext.Provider>
  );
}

// En Android adjustResize ya achica la ventana con el teclado abierto.
function useAltoTecladoIos(): number {
  const [alto, setAlto] = useState(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const mostrar = Keyboard.addListener("keyboardWillShow", (e) => setAlto(e.endCoordinates.height));
    const ocultar = Keyboard.addListener("keyboardWillHide", () => setAlto(0));
    return () => {
      mostrar.remove();
      ocultar.remove();
    };
  }, []);
  return alto;
}

export function useToast(): MostrarToast {
  return useContext(ToastContext);
}

/** Acción con "Deshacer" (5 s) — ver compartido/deshacer.ts. */
export function useDeshacer(): ConDeshacer {
  const toast = useToast();
  return useMemo(() => crearConDeshacer(toast), [toast]);
}
