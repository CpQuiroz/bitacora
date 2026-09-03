import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "../theme";
import { useRed } from "../services/sync/NetworkProvider";
import { Text } from "./ui";

function haceCuanto(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const hhmm = `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const ayer = new Date(hoy.getTime() - 86400000).toDateString() === d.toDateString();
  return ` · datos ${mismoDia ? "de las" : ayer ? "de ayer" : "del"} ${mismoDia || ayer ? hhmm : d.toLocaleDateString("es-CL")}`;
}

/** Barra fina arriba de una pantalla cuando no hay señal, hay acciones sin sincronizar, o alguna falló. */
export function OfflineBanner({ guardadoEn }: { guardadoEn?: number }) {
  const t = useTema();
  const { enLinea, pendientes, fallidas } = useRed();

  if (fallidas.length > 0) {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          backgroundColor: t.colores.dangerSoft,
          paddingHorizontal: 12,
          paddingVertical: 7,
        }}
      >
        <Ionicons name="alert-circle-outline" size={14} color={t.colores.danger} />
        <Text variante="caption" weight="semibold" style={{ color: t.colores.danger }}>
          {fallidas.length} {fallidas.length === 1 ? "acción no se pudo enviar" : "acciones no se pudieron enviar"} — revísalas en Perfil
        </Text>
      </View>
    );
  }

  if (enLinea && pendientes.length === 0) return null;

  const fondo = enLinea ? t.colores.infoSoft : t.colores.warningSoft;
  const color = enLinea ? t.colores.info : t.colores.warning;
  const texto = !enLinea
    ? `Sin conexión${haceCuanto(guardadoEn)}`
    : `${pendientes.length} ${pendientes.length === 1 ? "acción" : "acciones"} sin sincronizar`;

  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: fondo, paddingHorizontal: 12, paddingVertical: 7 }}
    >
      <Ionicons name={enLinea ? "sync-outline" : "cloud-offline-outline"} size={14} color={color} />
      <Text variante="caption" weight="medium" style={{ color }}>
        {texto}
      </Text>
    </View>
  );
}
