import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Text } from "../../components/ui";
import { pesos } from "../../lib/plata";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { estaVencido, listarCobros } from "../../services/cobros";
import type { MasStackParamList } from "../../shell/navigation/types";

// "Más" = la vieja pantalla de Gestión. Menú agrupado en Dinero /
// Análisis / Dispositivo (+ Terreno para el histórico). Cada ítem lleva
// un icono en cuadrado de 34px y una línea de contexto real.

type Item = {
  titulo: string;
  contexto: string;
  icono: keyof typeof Ionicons.glyphMap;
  badge?: number;
  ir: () => void;
};

export function MasScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MasInicio">) {
  const t = useTema();
  const auth = useAuth();
  const { pendientes } = useRed();
  const listo = auth.fase === "listo";
  const visibles = listo ? auth.modulosVisibles : [];
  const acciones = listo ? auth.acciones : [];
  const deshabilitados = listo ? auth.modulosDeshabilitados : [];

  const [cobros, setCobros] = useState<{ vencidos: number; monto: number } | null>(null);

  const cargarCobros = useCallback(async () => {
    if (!visibles.includes("financiero")) return;
    try {
      const r = await listarCobros();
      const venc = r.cobros.filter((c) => estaVencido(c));
      setCobros({ vencidos: venc.length, monto: venc.reduce((s, c) => s + (Number(c.monto) || 0), 0) });
    } catch {
      // sin conexión — la línea de contexto queda genérica
    }
  }, [visibles]);

  useEffect(() => {
    void cargarCobros();
  }, [cargarCobros]);
  useFocusEffect(useCallback(() => void cargarCobros(), [cargarCobros]));

  const grupos: { titulo: string; items: Item[] }[] = [];

  // --- Terreno (histórico) ---
  const terreno: Item[] = [
    { titulo: "Todos los trabajos", contexto: "El historial completo, no solo lo de hoy", icono: "clipboard-outline", ir: () => navigation.navigate("Trabajos") },
  ];
  if (!deshabilitados.includes("viajes")) {
    terreno.push({ titulo: "Todos los viajes", contexto: "El historial completo de viajes", icono: "car-outline", ir: () => navigation.navigate("Viajes") });
  }
  terreno.push({
    titulo: "Mantención de vehículo",
    contexto: "Chequeo diario y programa de mantención de tu camión",
    icono: "construct-outline",
    ir: () => navigation.navigate("MantencionVehiculo"),
  });
  grupos.push({ titulo: "Terreno", items: terreno });

  // --- Dinero ---
  const dinero: Item[] = [];
  if (visibles.includes("financiero")) {
    dinero.push({
      titulo: "Cobros",
      contexto: cobros ? `${cobros.vencidos} vencido${cobros.vencidos === 1 ? "" : "s"} · ${pesos(cobros.monto)}` : "Facturas y pagos de los clientes",
      icono: "cash-outline",
      ir: () => navigation.navigate("CobrosLista"),
    });
    dinero.push({ titulo: "Nuevo gasto", contexto: "Monto, categoría, proveedor y comprobante", icono: "wallet-outline", ir: () => navigation.navigate("GastoForm") });
  }
  if (visibles.includes("agenda_pro")) {
    dinero.push({ titulo: "Servicios y packs", contexto: "Precios, duraciones y packs de sesiones", icono: "pricetags-outline", ir: () => navigation.navigate("Catalogo") });
  }
  if (dinero.length) grupos.push({ titulo: "Dinero", items: dinero });

  // --- Análisis ---
  const analisis: Item[] = [];
  if (acciones.includes("ver_dashboard") && visibles.includes("informes")) {
    analisis.push({ titulo: "Informes", contexto: "Visión general, financiero, ventas, operaciones", icono: "bar-chart-outline", ir: () => navigation.navigate("Informes") });
  }
  if (visibles.includes("asistente")) {
    analisis.push({ titulo: "Asistente IA", contexto: "Pregunta sobre trabajos, viajes, clientes y cobros", icono: "sparkles-outline", ir: () => navigation.navigate("Asistente") });
  }
  if (analisis.length) grupos.push({ titulo: "Análisis", items: analisis });

  // --- Dispositivo ---
  grupos.push({
    titulo: "Dispositivo",
    items: [
      {
        titulo: "Cola de sincronización",
        contexto: pendientes.length ? `${pendientes.length} acción${pendientes.length === 1 ? "" : "es"} sin enviar` : "Todo sincronizado",
        icono: "sync-outline",
        badge: pendientes.length || undefined,
        ir: () => navigation.navigate("Perfil"),
      },
      { titulo: "Perfil y sesión", contexto: "Tus datos, el bloqueo con huella y la versión", icono: "person-circle-outline", ir: () => navigation.navigate("Perfil") },
    ],
  });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.colores.bg }} contentContainerStyle={{ padding: t.espacio(4), gap: t.espacio(5) }}>
      {grupos.map((g) => (
        <View key={g.titulo} style={{ gap: t.espacio(2) }}>
          <Text mono variante="caption" tono="faint" weight="semibold" style={{ letterSpacing: 1.5, textTransform: "uppercase" }}>
            {g.titulo}
          </Text>
          <View style={{ borderTopWidth: 1, borderTopColor: t.colores.border }}>
            {g.items.map((it) => (
              <Pressable
                key={it.titulo}
                onPress={it.ir}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: t.espacio(3),
                  paddingVertical: t.espacio(3),
                  borderBottomWidth: 1,
                  borderBottomColor: t.colores.border,
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: t.radio.sm, backgroundColor: t.colores.brandSoft, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={it.icono} size={18} color={t.colores.brand} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight="semibold">{it.titulo}</Text>
                  <Text variante="caption" tono="muted" numberOfLines={1}>
                    {it.contexto}
                  </Text>
                </View>
                {it.badge ? (
                  <View style={{ minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, backgroundColor: t.colores.accent, alignItems: "center", justifyContent: "center" }}>
                    <Text mono variante="caption" weight="bold" tono="inverso">
                      {it.badge}
                    </Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={t.colores.faint} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
