import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoLevantamiento } from "@bitacora/shared";
import { useTema } from "../../theme";
import { LoadingScreen, Text } from "../../components/ui";
import { listarMisLevantamientos, type LevantamientoResumen } from "../../services/levantamientos";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoLevantamiento, string> = {
  creado: "Creado",
  asignado: "Por completar",
  en_terreno: "En terreno",
  completado_tecnico: "Completado — esperando cotización",
  cotizado_externo: "Cotizado — esperando aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

// El técnico solo ve los suyos (el backend ya los filtra) — nada que
// completar además de descripción + materiales + fotos. Cotizar y
// aprobar/rechazar es exclusivo de la web (Admin).
export function LevantamientosListScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "Levantamientos">) {
  const t = useTema();
  const [lista, setLista] = useState<LevantamientoResumen[] | null>(null);

  const cargar = useCallback(async () => {
    setLista(await listarMisLevantamientos());
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  if (lista === null) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <FlatList
        data={lista}
        keyExtractor={(l) => l.id}
        contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(2.5) }}
        ListEmptyComponent={
          <View style={{ paddingTop: t.espacio(10), alignItems: "center", gap: t.espacio(2) }}>
            <Ionicons name="search-outline" size={32} color={t.colores.faint} />
            <Text tono="muted">Sin levantamientos asignados.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const pendiente = item.estado === "asignado" || item.estado === "en_terreno" || item.estado === "creado";
          return (
            <Pressable
              onPress={() => navigation.navigate("LevantamientoDetalle", { id: item.id })}
              style={{
                borderWidth: 1,
                borderColor: t.colores.border,
                borderRadius: t.radio.md,
                padding: t.espacio(3.5),
                gap: t.espacio(1),
                backgroundColor: t.colores.surface,
              }}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text weight="semibold" style={{ flex: 1 }} numberOfLines={1}>
                  {item.cliente?.nombre ?? "Cliente"}
                </Text>
                <View
                  style={{
                    paddingHorizontal: t.espacio(2),
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: pendiente ? t.colores.accentSoft : t.colores.surfaceAlt,
                  }}
                >
                  <Text variante="caption" weight="bold" style={{ color: pendiente ? t.colores.accent : t.colores.muted }}>
                    {ETIQUETA_ESTADO[item.estado]}
                  </Text>
                </View>
              </View>
              {item.descripcion_requerimiento ? (
                <Text variante="caption" tono="muted" numberOfLines={2}>
                  {item.descripcion_requerimiento}
                </Text>
              ) : null}
              <Text mono variante="caption" tono="faint">
                {new Date(item.creado_en).toLocaleDateString("es-CL")}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
