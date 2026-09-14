import type { ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto } from "./Texto";
import { useMarca } from "./marca";
import { FUENTE_NATIVE } from "./fuentes";

// Sistema visual móvil v2 (13-sep-2026) — cabecera única para las 4
// pantallas del piloto en adelante (ninguna pantalla define su propio
// estilo de cabecera después de este cambio).
//
// Tamaños del título (30) y del antetítulo (11, coincide con
// tokens.size.micro) vienen del mockup de referencia de la usuaria, no
// de la escala h1-h5/small/caption existente (30 no es ninguno de los
// pasos de esa escala) — mismo criterio que `RADIO_CARD` en
// packages/ui/src/web/Card.tsx: un valor específico de este componente,
// no un token nuevo de tokens.json.
const TAMANO_TITULO = 30;
const TAMANO_ANTETITULO = tokens.size.micro; // 11 — sí coincide con la escala.
const ALTO_ACCION = 48; // coincide con ALTURA_NATIVE.md de Button.

export type OpcionFiltroHeader = { valor: string; etiqueta: string };

export type PropsScreenHeader = {
  antetitulo?: string;
  titulo: string;
  /** Acción circular a la derecha del título (en una pantalla de detalle: "volver"). */
  accion?: { icono: ReactNode; onPress: () => void; etiquetaAccesible?: string };
  /** Fila de chips pill debajo del título — selección simple (radio), no multi-selección. */
  filtros?: { opciones: OpcionFiltroHeader[]; valor: string; onCambio: (valor: string) => void };
};

export function ScreenHeader({ antetitulo, titulo, accion, filtros }: PropsScreenHeader) {
  const marca = useMarca();
  return (
    <View style={{ paddingHorizontal: tokens.space["4"], gap: tokens.space["1"] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: tokens.space["2"] }}>
        <View style={{ flex: 1 }}>
          {antetitulo ? (
            <Texto
              tamano={TAMANO_ANTETITULO}
              color={tokens.color.accent2Ramp["800"]}
              peso="semibold"
              style={{ textTransform: "uppercase", letterSpacing: 1.3 }}
            >
              {antetitulo}
            </Texto>
          ) : null}
          <Texto
            tamano={TAMANO_TITULO}
            color={tokens.color.text}
            style={{ fontFamily: FUENTE_NATIVE.heading, lineHeight: TAMANO_TITULO * 1.08 }}
          >
            {titulo}
          </Texto>
        </View>
        {accion ? (
          <Pressable
            onPress={accion.onPress}
            accessibilityRole="button"
            accessibilityLabel={accion.etiquetaAccesible}
            hitSlop={4}
            style={({ pressed }) => ({
              width: ALTO_ACCION,
              height: ALTO_ACCION,
              borderRadius: tokens.radius.pill,
              backgroundColor: tokens.color.surface,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            {accion.icono}
          </Pressable>
        ) : null}
      </View>

      {filtros ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: tokens.space["1"], paddingTop: tokens.space["1"], paddingBottom: 2 }}
        >
          {filtros.opciones.map((o) => {
            const activo = o.valor === filtros.valor;
            return (
              <Pressable
                key={o.valor}
                onPress={() => filtros.onCambio(o.valor)}
                style={{
                  paddingHorizontal: tokens.space["2"],
                  paddingVertical: 6,
                  borderRadius: tokens.radius.pill,
                  backgroundColor: activo ? marca.base : "transparent",
                  borderWidth: activo ? 0 : 1,
                  borderColor: tokens.color.divider,
                }}
              >
                <Texto tamano={tokens.size.small} color={activo ? marca.foreground : tokens.color.text} peso={activo ? "semibold" : "medium"}>
                  {o.etiqueta}
                </Texto>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
