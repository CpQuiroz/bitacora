import { View } from "react-native";
import { Check } from "lucide-react-native";
import { tokens } from "@bitacora/design-tokens";
import { Texto, useMarca } from "@bitacora/ui/native";

const ETIQUETAS = ["Iniciar", "Ejecutar", "Cerrar"] as const;

// Fase 3.4 (23-sep-2026, pedido explícito) — indicador 1-2-3 del
// flujo simplificado de la OS. Un paso queda "hecho" (✓, tono marca)
// si ya se pasó de él; el actual se resalta; los que faltan quedan
// apagados. Puramente visual — quién puede volver a un paso anterior
// lo decide la pantalla que lo usa (TrabajoDetalleScreen), no esto.
export function IndicadorPasos({ pasoActual }: { pasoActual: 1 | 2 | 3 }) {
  const marca = useMarca();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: tokens.space["4"] }}>
      {ETIQUETAS.map((etiqueta, i) => {
        const numero = i + 1;
        const hecho = numero < pasoActual;
        const activo = numero === pasoActual;
        return (
          <View key={etiqueta} style={{ flex: etiqueta === "Ejecutar" ? 1 : 0, flexDirection: "row", alignItems: "center" }}>
            {i > 0 ? (
              <View
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: hecho || activo ? marca.base : tokens.color.divider,
                  marginHorizontal: 4,
                }}
              />
            ) : null}
            <View style={{ alignItems: "center", gap: 3 }}>
              <View
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: hecho ? marca.base : activo ? marca.suave : tokens.color.surface,
                  borderWidth: activo ? 2 : 1,
                  borderColor: activo ? marca.base : tokens.color.divider,
                }}
              >
                {hecho ? (
                  <Check size={14} strokeWidth={3} color={marca.foreground} />
                ) : (
                  <Texto tamano={tokens.size.caption} peso="semibold" color={activo ? marca.fuerte : tokens.color.textSecondary}>
                    {numero}
                  </Texto>
                )}
              </View>
              <Texto tamano={9} peso={activo ? "semibold" : "regular"} color={activo ? marca.fuerte : tokens.color.textSecondary}>
                {etiqueta}
              </Texto>
            </View>
          </View>
        );
      })}
    </View>
  );
}
