import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import {
  activas,
  descartar,
  descartarTodo,
  fallidas,
  pendientes,
  procesar,
  reintentar,
  suscribir,
  type AccionPendiente,
} from "./queue";

type RedContexto = {
  enLinea: boolean;
  cola: AccionPendiente[]; // todo
  pendientes: AccionPendiente[]; // activas (no fallidas)
  fallidas: AccionPendiente[];
  sincronizarAhora: () => void;
  reintentar: (id: string) => void;
  descartar: (id: string) => void;
  descartarTodo: () => void;
};

const Ctx = createContext<RedContexto>({
  enLinea: true,
  cola: [],
  pendientes: [],
  fallidas: [],
  sincronizarAhora: () => {},
  reintentar: () => {},
  descartar: () => {},
  descartarTodo: () => {},
});

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

  const valor = useMemo<RedContexto>(
    () => ({
      enLinea,
      cola,
      pendientes: activas(cola),
      fallidas: fallidas(cola),
      sincronizarAhora: () => void procesar(),
      reintentar: (id) => void reintentar(id),
      descartar: (id) => void descartar(id),
      descartarTodo: () => void descartarTodo(),
    }),
    [enLinea, cola]
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useRed(): RedContexto {
  return useContext(Ctx);
}
