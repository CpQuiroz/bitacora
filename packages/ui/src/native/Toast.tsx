import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { MostrarToast } from "../tipos";
import { Texto } from "./Texto";

const DURACION_MS = 2600;

type Item = { id: number; mensaje: string };

const ToastContext = createContext<MostrarToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const idRef = useRef(0);

  const mostrar = useCallback<MostrarToast>((mensaje) => {
    const id = ++idRef.current;
    setItems((actuales) => [...actuales, { id, mensaje }]);
    setTimeout(() => setItems((actuales) => actuales.filter((i) => i.id !== id)), DURACION_MS);
  }, []);

  return (
    <ToastContext.Provider value={mostrar}>
      <View style={{ flex: 1 }}>
        {children}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: tokens.space["8"], alignItems: "center", gap: tokens.space["2"] }}
        >
          {items.map((item) => (
            <View
              key={item.id}
              style={{
                backgroundColor: tokens.color.neutral["900"],
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
              <Texto tamano={tokens.size.small} color={tokens.color.neutral["100"]}>
                {item.mensaje}
              </Texto>
            </View>
          ))}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): MostrarToast {
  return useContext(ToastContext);
}
