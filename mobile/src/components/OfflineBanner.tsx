import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../theme";
import { useRed } from "../services/sync/NetworkProvider";
import { Text } from "./ui";

function haceCuanto(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  return ` · datos de las ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

/** Barra fina arriba de una pantalla cuando no hay señal o hay acciones sin sincronizar. */
export function OfflineBanner({ guardadoEn }: { guardadoEn?: number }) {
  const t = useTema();
  const { enLinea, cola } = useRed();
  const pendientes = cola.length;

  if (enLinea && pendientes === 0) return null;

  const fondo = enLinea ? t.colores.infoSoft : t.colores.warningSoft;
  const color = enLinea ? t.colores.info : t.colores.warning;
  const texto = !enLinea
    ? `Sin conexión${haceCuanto(guardadoEn)}`
    : `${pendientes} acción${pendientes === 1 ? "" : "es"} sin sincronizar`;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: fondo, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Ionicons name={enLinea ? "sync-outline" : "cloud-offline-outline"} size={13} color={color} />
      <Text variante="caption" weight="medium" style={{ color }}>
        {texto}
      </Text>
    </View>
  );
}
