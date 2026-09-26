import { Children, type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";

// Sistema visual móvil v2 (13-sep-2026).
const ALTO_MIN = 64;
const MOSAICO = 46; // radio.md (16) sí coincide con la escala — el tamaño del mosaico no.
const GAP_ICONO_TEXTO = tokens.space["3"]; // 13 — hace que el divisor de ListRowGrupo caiga en 77 (padding 18 + mosaico 46 + este gap).
// Radio del contenedor agrupador — valor del mockup de referencia, no
// coincide con sm/md/lg/pill de tokens.radius (28 es el más cercano,
// visiblemente distinto). Mismo criterio que RADIO_CARD en
// packages/ui/src/web/Card.tsx: constante local, no un token nuevo.
const RADIO_GRUPO = 22;
const INSET_DIVISOR = tokens.space["4"] + MOSAICO + GAP_ICONO_TEXTO; // 18 + 46 + 13 = 77.

export type PropsListRow = {
  /** Ya renderizado y coloreado por quien llama (ej. <Truck color={tokens.color.accentRamp["700"]} />) — ListRow solo da el mosaico de fondo. */
  icono: ReactNode;
  titulo: string;
  /** Estado real de la fila (ej. "3 pendientes", "Vence hoy") — nunca texto decorativo. */
  subtitulo?: string;
  /** Chevron, badge numérico, o cualquier otro indicador al final de la fila. */
  trailing?: ReactNode;
  onPress?: () => void;
};

export function ListRow({ icono, titulo, subtitulo, trailing, onPress }: PropsListRow) {
  const contenido = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: GAP_ICONO_TEXTO, minHeight: ALTO_MIN, paddingVertical: tokens.space["1"] }}>
      <View
        style={{
          width: MOSAICO,
          height: MOSAICO,
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.accentRamp["200"],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icono}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Texto tamano={tokens.size.h5} color={tokens.color.text} peso="semibold">
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return <View style={{ paddingHorizontal: tokens.space["4"] }}>{contenido}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: tokens.space["4"],
        backgroundColor: pressed ? tokens.color.neutral["200"] : "transparent",
      })}
    >
      {contenido}
    </Pressable>
  );
}

/**
 * Agrupa varias `ListRow` en un contenedor con el radio del sistema
 * visual v2 (22, ver `RADIO_GRUPO`) y les inserta el separador de 1px
 * entre filas, empezando donde termina el mosaico de ícono (77px desde
 * el borde) — nunca de lado a lado. Ninguna pantalla debería armar este
 * contenedor a mano.
 */
export function ListRowGrupo({ children }: { children: ReactNode }) {
  const filas = Children.toArray(children);
  return (
    <View style={{ borderRadius: RADIO_GRUPO, overflow: "hidden", backgroundColor: tokens.color.neutral["100"] }}>
      {filas.map((fila, i) => (
        <View key={i}>
          {fila}
          {i < filas.length - 1 ? <View style={{ height: 1, backgroundColor: tokens.color.divider, marginLeft: INSET_DIVISOR }} /> : null}
        </View>
      ))}
    </View>
  );
}
