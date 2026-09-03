import { View } from "react-native";
import { useTema, type Tema } from "../../theme";
import { Text } from "./Text";

type ParClave = "neutro" | "exito" | "aviso" | "peligro" | "info" | "marca";

// Estado de un trabajo/OS o de un viaje → color. Prioridad y sync tienen
// sus propios helpers (no se mezclan acá para que "alta" no se vea igual
// que "cancelado").
const POR_ESTADO: Record<string, ParClave> = {
  // Trabajo
  en_curso: "info",
  completado: "exito",
  cancelado: "peligro",
  // OS (estado_os)
  pendiente: "neutro",
  enviada: "neutro",
  en_proceso: "info",
  completada: "exito",
  firmada: "exito",
  // Viaje
  borrador: "aviso",
  confirmado: "exito",
  facturado: "info",
};

function colores(clave: ParClave, t: Tema): { bg: string; fg: string } {
  switch (clave) {
    case "exito":
      return { bg: t.colores.successSoft, fg: t.colores.success };
    case "aviso":
      return { bg: t.colores.warningSoft, fg: t.colores.warning };
    case "peligro":
      return { bg: t.colores.dangerSoft, fg: t.colores.danger };
    case "info":
      return { bg: t.colores.infoSoft, fg: t.colores.info };
    case "marca":
      return { bg: t.colores.brandSoft, fg: t.colores.brand };
    default:
      return { bg: t.colores.surfaceAlt, fg: t.colores.muted };
  }
}

export function Badge({ estado, texto }: { estado?: string; texto?: string }) {
  const t = useTema();
  const clave = estado ? POR_ESTADO[estado] ?? "neutro" : "neutro";
  const c = colores(clave, t);
  const label = (texto ?? estado ?? "").replace(/_/g, " ");

  return (
    <View
      style={{
        backgroundColor: c.bg,
        borderRadius: t.radio.full,
        paddingHorizontal: t.espacio(2.5),
        paddingVertical: t.espacio(1),
      }}
    >
      <Text variante="caption" weight="semibold" style={{ color: c.fg, textTransform: "capitalize" }}>
        {label}
      </Text>
    </View>
  );
}
