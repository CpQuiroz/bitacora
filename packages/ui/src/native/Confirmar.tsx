import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import type { Confirmar, OpcionesConfirmar } from "../tipos";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { Texto } from "./Texto";

// Reemplaza Alert.alert con botones (tarea 156):
//   if (!(await confirmar({ titulo: "¿Eliminar esta foto?", accion: "Eliminar", destructivo: true }))) return;
// Hoja inferior del sistema de diseño; "atrás" de Android y tocar afuera cancelan.
const ConfirmarContext = createContext<Confirmar>(async () => false);

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [pedido, setPedido] = useState<OpcionesConfirmar | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirmar = useCallback<Confirmar>((opciones) => {
    resolverRef.current?.(false);
    setPedido(opciones);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const responder = useCallback((ok: boolean) => {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setPedido(null);
  }, []);

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      <Dialog abierto={pedido != null} onCerrar={() => responder(false)} titulo={pedido?.titulo ?? ""}>
        <View style={{ gap: tokens.space["4"] }}>
          {pedido?.mensaje ? (
            <Texto tamano={tokens.size.body} color={tokens.color.text}>
              {pedido.mensaje}
            </Texto>
          ) : null}
          <View style={{ gap: tokens.space["2"] }}>
            <Button bloque variante={pedido?.destructivo ? "peligro" : "primario"} onPress={() => responder(true)}>
              {pedido?.accion ?? "Confirmar"}
            </Button>
            <Button bloque variante="secundario" onPress={() => responder(false)}>
              {pedido?.cancelar ?? "Cancelar"}
            </Button>
          </View>
        </View>
      </Dialog>
    </ConfirmarContext.Provider>
  );
}

export function useConfirmar(): Confirmar {
  return useContext(ConfirmarContext);
}
