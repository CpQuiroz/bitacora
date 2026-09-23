import { Pressable, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";
import { FUENTE_NATIVE } from "./fuentes";
import { Button } from "./Button";
import { resolverMarca } from "./marca";

// Sistema visual móvil v2 (13-sep-2026). Terracota fija (tokens.color.accent),
// NO el color de marca del tenant (useMarca().base) — a diferencia del botón
// primario, el Asistente es una identidad de PLATAFORMA (la IA de Bitácora),
// no algo que deba variar por empresa. Si esto no es lo que se quería,
// avisar y se cambia a marca.base en una línea.
const TERRACOTA = tokens.color.accent;
// Mismo cálculo de contraste que usa resolverMarca() para el acento por
// defecto — no un "#ffffff" a mano: si el terracota base cambia de tono
// en tokens.json, esto sigue eligiendo bien.
const FOREGROUND = resolverMarca(TERRACOTA).foreground;

// Huella real del botón en la variante "flotante" — distancia desde el
// borde inferior de la pantalla (96) + su propio alto (48). Bug real
// (14-sep-2026): Hoy y Más adivinaban un paddingBottom para su lista sin
// este número (35 y 140 respectivamente, los dos insuficientes) y el
// botón tapaba la última fila. Toda pantalla que use la variante
// "flotante" debe sumar ESPACIO_ASISTENTE_FLOTANTE al padding inferior
// de su contenido scrolleable — nunca adivinar un valor a mano.
// Bajado de 110 a 96 (23-sep-2026, pedido explícito: quedaba muy
// arriba, molestaba la visual) — exportado (antes solo el derivado
// ESPACIO_ASISTENTE_FLOTANTE) para que el FAB de Agenda, que se
// alinea a propósito con este botón, lo use en vez de repetir el
// número a mano.
export const OFFSET_ASISTENTE_FLOTANTE = 96;
const ALTO_ASISTENTE_FLOTANTE = 48;
export const ESPACIO_ASISTENTE_FLOTANTE = OFFSET_ASISTENTE_FLOTANTE + ALTO_ASISTENTE_FLOTANTE + tokens.space["4"]; // 110 + 48 + ~18 de aire

export type PropsAsistenteButton = {
  /** El gating por rol lo resuelve quien consume el componente — este solo pinta o no pinta nada. */
  visible?: boolean;
  /**
   * "flotante" (default): pill abajo a la derecha, sobre la tab bar,
   * visible en las 4 pestañas. "en_barra": circular 52px, para vivir
   * junto al botón primario de una barra de acción fija — no flota.
   */
  variante?: "flotante" | "en_barra";
  onPress: () => void;
};

export function AsistenteButton({ visible = true, variante = "flotante", onPress }: PropsAsistenteButton) {
  if (!visible) return null;

  if (variante === "en_barra") {
    return <Button forma="circular" variante="primario" onPress={onPress} etiquetaAccesible="Asistente" iconoIzq={<Sparkles size={22} strokeWidth={2.75} color={FOREGROUND} />}>{null}</Button>;
  }

  return (
    <View style={{ position: "absolute", right: 18, bottom: OFFSET_ASISTENTE_FLOTANTE }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Asistente"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: tokens.space["1"],
          height: 48,
          paddingHorizontal: tokens.space["3"],
          borderRadius: tokens.radius.pill,
          backgroundColor: TERRACOTA,
          opacity: pressed ? 0.9 : 1,
          shadowColor: TERRACOTA,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        })}
      >
        <Sparkles size={26} strokeWidth={2.75} color={FOREGROUND} />
        <Texto tamano={tokens.size.small} color={FOREGROUND} style={{ fontFamily: FUENTE_NATIVE.bodySemiBold }}>
          Asistente
        </Texto>
      </Pressable>
    </View>
  );
}
