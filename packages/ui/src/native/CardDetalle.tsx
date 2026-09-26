import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";
import { useMarca } from "./marca";

// Sistema visual móvil v2 (13-sep-2026) — variante NUEVA y distinta del
// `Card` genérico de packages/ui (children/onPress/elevacion/sinRelleno,
// sin composición semántica). Se llama distinto a propósito (no un
// "Card" #2) para no generar dos cosas con el mismo nombre en el repo —
// ver informe del Paso 0.
//
// Tamaños (17/14/18) del mockup de referencia, no de la escala h1-h5/
// small/caption existente — mismo criterio que RADIO_CARD del Card web.
const TAMANO_TITULO = 17;
const TAMANO_SUBTITULO = 14;
const RADIO = 22; // ídem ListRowGrupo — ver comentario ahí.

// Sombra "sm" — mismos valores que Card.tsx (native), no exportados
// desde ahí; se duplica el objeto (5 líneas) en vez de tocar el
// contrato de Card por esto.
const SOMBRA_SM = {
  shadowColor: tokens.color.neutral["900"],
  shadowOpacity: 0.14,
  shadowRadius: 2,
  shadowOffset: { width: 0, height: 1 },
  elevation: 1,
} as const;

export type MetadatoCardDetalle = { icono: ReactNode; texto: string };
export type AccionCardDetalle = { etiqueta: string; onPress: () => void; tono?: "brand" | "muted" | "peligro" };

export type PropsCardDetalle = {
  /** Ej. "Folio N° 0142". */
  folio?: string;
  /** Ej. <StatusBadge estado={...} /> — CardDetalle no decide el tono, solo el layout. */
  badge?: ReactNode;
  titulo: string;
  subtitulo?: string;
  /** Cada ícono debe venir en tamaño 18, ya coloreado por quien llama. */
  metadatos?: MetadatoCardDetalle[];
  acciones?: AccionCardDetalle[];
  onPress?: () => void;
  /** Contenido libre extra (ej. una grilla propia de la pantalla) antes del divisor de acciones. */
  children?: ReactNode;
};

export function CardDetalle({ folio, badge, titulo, subtitulo, metadatos, acciones, onPress, children }: PropsCardDetalle) {
  const marca = useMarca();
  const colorAccion: Record<NonNullable<AccionCardDetalle["tono"]>, string> = {
    brand: marca.base,
    muted: tokens.color.textSecondary,
    peligro: tokens.color.accentRamp["700"],
  };

  const contenido = (
    <View style={{ backgroundColor: tokens.color.neutral["100"], borderRadius: RADIO, padding: tokens.space["4"], gap: tokens.space["2"], ...SOMBRA_SM }}>
      {folio || badge ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {folio ? (
            <Texto tamano={tokens.size.small} color={tokens.color.textSecondary} peso="medium">
              {folio}
            </Texto>
          ) : (
            <View />
          )}
          {badge}
        </View>
      ) : null}

      <View style={{ gap: 2 }}>
        <Texto tamano={TAMANO_TITULO} color={tokens.color.text} peso="semibold">
          {titulo}
        </Texto>
        {subtitulo ? (
          <Texto tamano={TAMANO_SUBTITULO} color={tokens.color.textSecondary}>
            {subtitulo}
          </Texto>
        ) : null}
      </View>

      {metadatos && metadatos.length > 0 ? (
        <View style={{ gap: tokens.space["1"] }}>
          {metadatos.map((m, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["1"] }}>
              {m.icono}
              <Texto tamano={tokens.size.small} color={tokens.color.textSecondary}>
                {m.texto}
              </Texto>
            </View>
          ))}
        </View>
      ) : null}

      {children}

      {acciones && acciones.length > 0 ? (
        <>
          <View style={{ height: 1, backgroundColor: tokens.color.divider, marginHorizontal: -tokens.space["4"] }} />
          <View style={{ flexDirection: "row", gap: tokens.space["4"] }}>
            {acciones.map((a, i) => (
              <Pressable key={i} onPress={a.onPress} hitSlop={4}>
                <Texto tamano={tokens.size.small} color={colorAccion[a.tono ?? "muted"]} peso="semibold">
                  {a.etiqueta}
                </Texto>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );

  if (!onPress) return contenido;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {contenido}
    </Pressable>
  );
}
