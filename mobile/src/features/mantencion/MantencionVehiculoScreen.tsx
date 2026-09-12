import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Equipo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Card, EmptyState, ErrorState, LoadingScreen, PickerBuscable, Text } from "../../components/ui";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";
import {
  listarVehiculos,
  obtenerHistorialEquipo,
  obtenerMantencionInicio,
  type MantencionInicio,
  type MantencionResumen,
} from "../../services/mantencion";

const fechaCorta = (iso: string) => {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d && m ? `${d} ${meses[m - 1]}` : iso;
};

export function MantencionVehiculoScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MantencionVehiculo">) {
  const t = useTema();
  const auth = useAuth();
  const puedeCambiar = auth.fase === "listo" && auth.modulosVisibles.includes("flota");

  const [inicio, setInicio] = useState<MantencionInicio | null>(null);
  const [error, setError] = useState(false);
  const [desdeCache, setDesdeCache] = useState(false);

  // Cuando un admin/supervisor cambia de camión, este override manda.
  const [override, setOverride] = useState<Equipo | null>(null);
  const [registrosOverride, setRegistrosOverride] = useState<MantencionResumen[]>([]);
  const [vehiculos, setVehiculos] = useState<Equipo[]>([]);

  useEffect(() => {
    if (puedeCambiar) void listarVehiculos().then(setVehiculos);
  }, [puedeCambiar]);

  const cargar = useCallback(async () => {
    try {
      const r = await obtenerMantencionInicio(4);
      setInicio(r.datos);
      setDesdeCache(r.desdeCache);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      if (override) void obtenerHistorialEquipo(override.id).then((h) => setRegistrosOverride(h.registros.slice(0, 4)));
    }, [cargar, override])
  );

  const vehiculo = override ?? inicio?.vehiculo ?? null;
  const registros = override ? registrosOverride : (inicio?.registros ?? []);

  if (!inicio && error) {
    return <ErrorState mensaje="No se pudo cargar la información del vehículo." onReintentar={() => void cargar()} />;
  }
  if (!inicio) return <LoadingScreen />;

  if (!vehiculo && !puedeCambiar) {
    return (
      <EmptyState
        icono={<Ionicons name="car-outline" size={40} color={t.colores.faint} />}
        titulo="No tienes un vehículo asignado"
        mensaje="Pídele a la oficina que te asigne el camión para registrar su mantención."
      />
    );
  }

  const irAChecklist = (tipo: "diario" | "programa") => {
    if (!vehiculo) return;
    navigation.navigate("ChecklistMantencion", { equipoId: vehiculo.id, tipo, patente: vehiculo.patente ?? null });
  };

  const hoyISO = new Date().toISOString().slice(0, 10);
  const hizoDiarioHoy = registros.some((r) => r.tipo === "diario" && r.fecha === hoyISO);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(3) }}>
      {/* Header de foco navy */}
      <View style={{ borderRadius: t.radio.contenedor, backgroundColor: t.colores.brand, padding: t.espacio(4), gap: t.espacio(2) }}>
        <Text mono variante="caption" style={{ color: t.colores.onDark, letterSpacing: 1.2, textTransform: "uppercase" }}>
          {override ? "Camión seleccionado" : "Camión asignado"}
        </Text>
        {vehiculo ? (
          <>
            <Text mono weight="bold" style={{ color: "#fff", fontSize: 24 }}>
              {vehiculo.patente ?? "—"}
            </Text>
            <Text variante="caption" style={{ color: t.colores.onDark }}>
              {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || vehiculo.nombre}
              {vehiculo.tipo_vehiculo ? ` · ${vehiculo.tipo_vehiculo}` : ""}
            </Text>
          </>
        ) : (
          <Text style={{ color: "#fff" }}>Elige un camión para registrar su mantención.</Text>
        )}
      </View>

      {vehiculo && (
        <View style={{ flexDirection: "row", gap: t.espacio(3) }}>
          <BotonGrande
            titulo="Checklist diario"
            sub={hizoDiarioHoy ? "35 ítems · ya lo hiciste hoy" : "35 ítems · aún no lo haces hoy"}
            icono="checkmark-done-outline"
            tono="brand"
            onPress={() => irAChecklist("diario")}
          />
          <BotonGrande
            titulo="Mantención Flota"
            sub="Cada 250 h o 6 meses"
            icono="construct-outline"
            tono="accent"
            onPress={() => irAChecklist("programa")}
          />
        </View>
      )}

      {vehiculo && (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: t.espacio(1) }}>
            <Text weight="semibold">Últimas mantenciones</Text>
            {registros.length > 0 && (
              <Pressable
                hitSlop={8}
                onPress={() => navigation.navigate("MantencionHistorial", { equipoId: vehiculo.id, patente: vehiculo.patente ?? null })}
              >
                <Text variante="caption" weight="bold" tono="brand">
                  Ver todas
                </Text>
              </Pressable>
            )}
          </View>
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
                <FilaRegistro key={r.id} r={r} />
              ))}
            </View>
          )}
        </Card>
      )}

      {puedeCambiar && (
        <PickerBuscable
          etiqueta="Cambiar de camión"
          placeholder="Elegir otro camión de la flota"
          valor={override?.id ?? ""}
          opcionVacia="Volver a mi camión asignado"
          opciones={vehiculos.map((v) => ({ id: v.id, label: v.patente ?? v.nombre, sublabel: [v.marca, v.modelo].filter(Boolean).join(" ") }))}
          onElegir={(id) => {
            const v = id ? (vehiculos.find((x) => x.id === id) ?? null) : null;
            setOverride(v);
            setRegistrosOverride([]);
            if (v) void obtenerHistorialEquipo(v.id).then((h) => setRegistrosOverride(h.registros.slice(0, 4)));
          }}
        />
      )}
    </ScrollView>
  );
}

function FilaRegistro({ r }: { r: MantencionResumen }) {
  const t = useTema();
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2.5), paddingVertical: t.espacio(2.5), borderBottomWidth: 1, borderBottomColor: t.colores.border }}
    >
      <Text mono variante="caption" tono="muted" style={{ width: 58 }}>
        {fechaCorta(r.fecha)}
      </Text>
      <Text variante="caption" style={{ flex: 1 }} numberOfLines={1}>
        {r.tipo === "programa" ? "Programa" : "Diario"}
        {r.realizado_por_nombre ? ` · ${r.realizado_por_nombre}` : ""}
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
      <Text variante="caption" tono="muted">
        {sub}
      </Text>
    </Pressable>
  );
}
