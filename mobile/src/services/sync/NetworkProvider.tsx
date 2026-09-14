import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Alert, AppState } from "react-native";
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

    // Solo `isConnected` (el radio WiFi/datos está prendido) — NO
    // `isInternetReachable`. Bug real reportado 13-sep: con 4 barras de
    // 5G reales, la app mostraba "Sin conexión" y encolaba fotos que en
    // realidad SÍ subían solas al toque (confirmado: la foto terminaba
    // subida, solo que el aviso decía lo contrario todo el tiempo que
    // duró el chequeo). `isInternetReachable` es un probe de mejor
    // esfuerzo (ping/DNS) documentado como propenso a falsos negativos
    // en Android — que WiFi/datos esté prendido ya es la señal
    // confiable; si igual no hay internet de verdad, el intento real
    // de `procesar()` va a fallar y ESO sí queda reflejado (la acción
    // pasa a "fallida", visible en el banner y en Perfil) sin necesitar
    // adivinar de antemano con un probe que no es confiable.
    const offNet = NetInfo.addEventListener((estado) => {
      const conectado = Boolean(estado.isConnected);
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
      // A diferencia de los triggers automáticos (encolar, reconectar,
      // foreground — esos siguen en "void", silenciosos a propósito), el
      // botón manual SÍ muestra el error si procesar() rechaza — ver el
      // comentario sobre ultimoErrorProcesar en queue.ts. Diagnóstico
      // 14-sep-2026: sin esto, un error real quedaba invisible para
      // siempre, indistinguible de "no hay nada para enviar".
      sincronizarAhora: () => {
        procesar().catch((e) => {
          Alert.alert(
            "No se pudo sincronizar",
            `Hubo un error inesperado al reintentar:\n\n${e instanceof Error ? e.message : String(e)}`
          );
        });
      },
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
