import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Button, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import type { MasStackParamList } from "../../shell/navigation/types";
import { obtenerMantencionInicio, type MantencionInicio } from "../../services/mantencion";

export function MantencionVehiculoScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MantencionVehiculo">) {
  const t = useTema();
  const [datos, setDatos] = useState<MantencionInicio | null>(null);
  const [error, setError] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await obtenerMantencionInicio();
      setDatos(r.datos);
      setDesdeCache(r.desdeCache);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
    }, [cargar])
  );

  if (!datos && error) return <ErrorState mensaje="No se pudo cargar la información del vehículo." onReintentar={() => void cargar()} />;
  if (!datos) return <LoadingScreen />;

  const { vehiculo, registros } = datos;

  if (!vehiculo) {
    return (
      <EmptyState
        icono={<Ionicons name="car-outline" size={40} color={t.colores.faint} />}
        titulo="No tienes un vehículo asignado"
        mensaje="Pídele a la oficina que te asigne el camión para registrar su mantención."
      />
    );
  }

  const irAChecklist = (tipo: "diario" | "programa") =>
    navigation.navigate("ChecklistMantencion", { equipoId: vehiculo.id, tipo, patente: vehiculo.patente ?? null });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(3) }}>
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(3), marginBottom: t.espacio(3) }}>
          <View style={{ paddingHorizontal: t.espacio(2.5), paddingVertical: t.espacio(1), borderRadius: t.radio.sm, backgroundColor: t.colores.surfaceAlt, borderWidth: 1, borderColor: t.colores.border }}>
            <Text mono weight="semibold">{vehiculo.patente ?? "—"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text weight="semibold">{[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || vehiculo.nombre}</Text>
            <Text variante="caption" tono="muted">{vehiculo.tipo_vehiculo ?? "Vehículo asignado"}</Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: t.espacio(3) }}>
          <BotonGrande
            titulo="Chequeo diario"
            sub="Antes de salir a ruta"
            icono="checkmark-done-outline"
            tono="brand"
            onPress={() => irAChecklist("diario")}
          />
          <BotonGrande
            titulo="Programa de mantención"
            sub="Cada 250 h o 6 meses"
            icono="construct-outline"
            tono="accent"
            onPress={() => irAChecklist("programa")}
          />
        </View>
      </Card>

      <Card>
        <Text weight="semibold" style={{ marginBottom: t.espacio(1) }}>Últimas mantenciones</Text>
        {desdeCache && (
          <Text variante="caption" tono="faint" style={{ marginBottom: t.espacio(2) }}>
            Sin conexión — mostrando lo último guardado.
          </Text>
        )}
        {registros.length === 0 ? (
          <Text variante="caption" tono="muted" style={{ paddingVertical: t.espacio(2) }}>
            Este camión todavía no tiene mantenciones registradas.
          </Text>
        ) : (
          <View style={{ borderTopWidth: 1, borderTopColor: t.colores.border }}>
            {registros.map((r) => (
              <View
                key={r.id}
                style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2.5), paddingVertical: t.espacio(2.5), borderBottomWidth: 1, borderBottomColor: t.colores.border }}
              >
                <Text mono variante="caption" tono="muted" style={{ width: 74 }}>
                  {r.creado_en.slice(0, 10)}
                </Text>
                <Text variante="caption" style={{ flex: 1 }} numberOfLines={1}>
                  {r.tipo === "programa" ? "Programa" : "Diario"}
                  {r.origen === "externo" ? " · taller" : ""}
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
                    {r.con_novedades ? "Novedades" : "OK"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

function BotonGrande({
  titulo,
  sub,
  icono,
  tono,
  onPress,
}: {
  titulo: string;
  sub: string;
  icono: keyof typeof Ionicons.glyphMap;
  tono: "brand" | "accent";
  onPress: () => void;
}) {
  const t = useTema();
  const color = tono === "brand" ? t.colores.brand : t.colores.accent;
  const fondo = tono === "brand" ? t.colores.brandSoft : t.colores.accentSoft;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 118,
        borderRadius: t.radio.md,
        borderWidth: 1,
        borderColor: tono === "accent" ? t.colores.accent : t.colores.border,
        backgroundColor: t.colores.surface,
        padding: t.espacio(3),
        gap: t.espacio(2),
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View style={{ width: 30, height: 30, borderRadius: t.radio.sm, backgroundColor: fondo, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icono} size={17} color={color} />
      </View>
      <Text weight="semibold">{titulo}</Text>
      <Text variante="caption" tono="muted">{sub}</Text>
    </Pressable>
  );
}
