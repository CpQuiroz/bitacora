import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { pendientes, procesar, suscribir, type AccionPendiente } from "./queue";

type RedContexto = {
  enLinea: boolean;
  cola: AccionPendiente[];
  sincronizarAhora: () => void;
};

const Ctx = createContext<RedContexto>({ enLinea: true, cola: [], sincronizarAhora: () => {} });

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [enLinea, setEnLinea] = useState(true);
  const [cola, setCola] = useState<AccionPendiente[]>([]);

  useEffect(() => {
    pendientes().then(setCola);
    const desuscribir = suscribir(setCola);

    const offNet = NetInfo.addEventListener((estado) => {
      const conectado = Boolean(estado.isConnected) && estado.isInternetReachable !== false;
      setEnLinea(conectado);
      if (conectado) void procesar();
    });

    const subApp = AppState.addEventListener("change", (s) => {
      if (s === "active") void procesar();
    });

    return () => {
      desuscribir();
      offNet();
      subApp.remove();
    };
  }, []);

  return <Ctx.Provider value={{ enLinea, cola, sincronizarAhora: () => void procesar() }}>{children}</Ctx.Provider>;
}

export function useRed(): RedContexto {
  return useContext(Ctx);
}
