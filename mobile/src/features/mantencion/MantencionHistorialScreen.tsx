import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import type { MasStackParamList } from "../../shell/navigation/types";
import { obtenerHistorialEquipo, type MantencionResumen } from "../../services/mantencion";

const fechaCorta = (iso: string) => {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d && m ? `${d} ${meses[m - 1]} ${y}` : iso;
};

export function MantencionHistorialScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "MantencionHistorial">) {
  const t = useTema();
  const { equipoId, patente } = route.params;
  const [registros, setRegistros] = useState<MantencionResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: patente ? `Mantención · ${patente}` : "Historial" });
  }, [navigation, patente]);

  const cargar = useCallback(async () => {
    setError(null);
    const r = await obtenerHistorialEquipo(equipoId);
    if (r.error) {
      setError(r.error);
      setRegistros([]);
      return;
    }
    setRegistros(r.registros);
  }, [equipoId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (registros === null && !error) return <LoadingScreen />;
  if (error) return <ErrorState mensaje={error} onReintentar={() => void cargar()} />;
  if (registros && registros.length === 0) {
    return (
      <EmptyState
        icono={<Ionicons name="construct-outline" size={40} color={t.colores.faint} />}
        titulo="Sin registros de mantención"
        mensaje="Este camión todavía no tiene mantenciones registradas."
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(4) }}>
      <View style={{ borderTopWidth: 1, borderTopColor: t.colores.border }}>
        {(registros ?? []).map((r) => (
          <Pressable
            key={r.id}
            onPress={() => navigation.navigate("MantencionDetalle", { equipoId, registroId: r.id })}
            style={{
              paddingVertical: t.espacio(3),
              borderBottomWidth: 1,
              borderBottomColor: t.colores.border,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
              <Text mono variante="caption" tono="muted" style={{ flex: 1 }}>
                {fechaCorta(r.fecha)}
                {r.folio != null ? ` · N° ${String(r.folio).padStart(4, "0")}` : ""}
              </Text>
              <View
                style={{
                  paddingHorizontal: t.espacio(2),
                  paddingVertical: 2,
                  borderRadius: 999,
                  backgroundColor: r.con_novedades ? t.colores.dangerSoft : t.colores.successSoft,
                }}
              >
                <Text variante="caption" weight="bold" style={{ color: r.con_novedades ? t.colores.danger : t.colores.success }}>
                  {r.con_novedades ? "Con novedades" : "Sin novedades"}
                </Text>
              </View>
            </View>
            <Text weight="semibold">{r.tipo === "programa" ? "Programa de mantención" : "Chequeo diario"}</Text>
            <Text variante="caption" tono="muted">
              {r.origen === "externo" ? "Taller externo" : "Interno"}
              {r.realizado_por_nombre ? ` · ${r.realizado_por_nombre}` : ""}
              {r.kilometraje != null ? ` · ${r.kilometraje.toLocaleString("es-CL")} km` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
