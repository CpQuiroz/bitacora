import { View } from "react-native";
import { useTema, type Tema } from "../../theme";
import { Text } from "./Text";

// Estado → (fondo, texto) — alineado con el Badge del web (ui.tsx).
type ParClave = "neutro" | "exito" | "aviso" | "peligro" | "info" | "marca";

const POR_ESTADO: Record<string, ParClave> = {
  // Trabajo / OS
  en_curso: "info",
  en_proceso: "info",
  pendiente: "neutro",
  enviada: "info",
  completado: "exito",
  completada: "exito",
  firmada: "exito",
  cancelado: "peligro",
  // Viaje
  borrador: "aviso",
  confirmado: "exito",
  facturado: "info",
  // Prioridad
  alta: "peligro",
  media: "aviso",
  baja: "neutro",
  // Sync
  sincronizado: "exito",
  sincronizando: "info",
  error: "peligro",
  offline: "aviso",
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
    <View style={{ backgroundColor: c.bg, borderRadius: t.radio.full, paddingHorizontal: t.espacio(2.5), paddingVertical: t.espacio(1) }}>
      <Text variante="caption" weight="semibold" style={{ color: c.fg, textTransform: "capitalize" }}>
        {label}
      </Text>
    </View>
  );
}
