import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ScrollView, View } from "react-native";
import {
  Banknote,
  ChevronRight,
  CircleUser,
  FileChartColumn,
  HardHat,
  Receipt,
  RefreshCw,
  Route,
  Search,
  Tags,
  Wrench,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { ScreenHeader, ListRow, ListRowGrupo, AsistenteButton, Texto, Tag } from "@bitacora/ui/native";
import { pesos } from "../../lib/plata";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { estaVencido, listarCobros } from "../../services/cobros";
import type { MasStackParamList } from "../../shell/navigation/types";

// "Más" — piloto del sistema visual móvil v2 (13-sep-2026, tarea #21):
// deja de ser una lista plana con iconos Ionicons en cuadrados de
// tinte-marca y pasa a 3 grupos de ListRow (Operación / Administración
// / Cuenta) sobre ScreenHeader, con el Asistente movido de la lista al
// botón flotante persistente. Toda la lógica de gating por rol/módulo/
// plan es la MISMA que antes — solo cambió cómo se pinta.
//
// El prompt de referencia da un ejemplo de 3 grupos con solo 6 ítems
// (Trabajos/Viajes, Cobros/Gastos/Informes, Perfil); la pantalla real
// tiene más funciones que ese ejemplo no nombra. Se ubicaron por
// afinidad: Mantención de vehículo y Levantamientos son trabajo de
// terreno → Operación; Servicios y packs es configuración de negocio →
// Administración; Cola de sincronización es estado del dispositivo,
// igual que Perfil → Cuenta.

type Item = {
  titulo: string;
  contexto: string;
  icono: ReactNode;
  badge?: number;
  ir: () => void;
};

export function MasScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "MasInicio">) {
  const auth = useAuth();
  const { pendientes } = useRed();
  const listo = auth.fase === "listo";
  const visibles = listo ? auth.modulosVisibles : [];
  const acciones = listo ? auth.acciones : [];
  const deshabilitados = listo ? auth.modulosDeshabilitados : [];
  // Levantamientos no se gatea por rol/módulo (el técnico es
  // rol=colaborador, igual que cualquier otro terreno) — el eje real es
  // usuarios.funcion. Sumar un perfil nuevo a futuro (ej. "asistente")
  // es un cambio acá, en FUNCIONES_LEVANTAMIENTOS (shared), no de lógica
  // dispersa por pantallas.
  const funcion = listo ? auth.usuario.funcion : null;
  const veLevantamientos = funcion != null && FUNCIONES_LEVANTAMIENTOS.includes(funcion);
  const veAsistente = visibles.includes("asistente");

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

  const iconoTint = { color: tokens.color.accentRamp["700"] };

  // --- Operación ---
  const operacion: Item[] = [
    { titulo: "Todas las órdenes de servicio", contexto: "El historial completo, no solo lo de hoy", icono: <HardHat size={22} strokeWidth={2.25} {...iconoTint} />, ir: () => navigation.navigate("Trabajos") },
  ];
  if (!deshabilitados.includes("viajes")) {
    operacion.push({ titulo: "Todos los viajes", contexto: "El historial completo de viajes", icono: <Route size={22} strokeWidth={2.25} {...iconoTint} />, ir: () => navigation.navigate("Viajes") });
  }
  operacion.push({
    titulo: "Mantención de vehículo",
    contexto: "Chequeo diario y programa de mantención de tu camión",
    icono: <Wrench size={22} strokeWidth={2.25} {...iconoTint} />,
    ir: () => navigation.navigate("MantencionVehiculo"),
  });
  if (veLevantamientos) {
    operacion.push({
      titulo: "Levantamientos",
      contexto: "Evaluaciones en terreno asignadas a vos",
      icono: <Search size={22} strokeWidth={2.25} {...iconoTint} />,
      ir: () => navigation.navigate("Levantamientos"),
    });
  }

  // --- Administración ---
  const administracion: Item[] = [];
  if (visibles.includes("financiero")) {
    administracion.push({
      titulo: "Cobros",
      contexto: cobros ? `${cobros.vencidos} vencido${cobros.vencidos === 1 ? "" : "s"} · ${pesos(cobros.monto)}` : "Facturas y pagos de los clientes",
      icono: <Banknote size={22} strokeWidth={2.25} {...iconoTint} />,
      ir: () => navigation.navigate("CobrosLista"),
    });
    administracion.push({ titulo: "Nuevo gasto", contexto: "Monto, categoría, proveedor y comprobante", icono: <Receipt size={22} strokeWidth={2.25} {...iconoTint} />, ir: () => navigation.navigate("GastoForm") });
  }
  if (visibles.includes("agenda_pro")) {
    administracion.push({ titulo: "Servicios y packs", contexto: "Precios, duraciones y packs de sesiones", icono: <Tags size={22} strokeWidth={2.25} {...iconoTint} />, ir: () => navigation.navigate("Catalogo") });
  }
  if (acciones.includes("ver_dashboard") && visibles.includes("informes")) {
    administracion.push({ titulo: "Informes", contexto: "Visión general, financiero, ventas, operaciones", icono: <FileChartColumn size={22} strokeWidth={2.25} {...iconoTint} />, ir: () => navigation.navigate("Informes") });
  }

  // --- Cuenta ---
  const cuenta: Item[] = [
    {
      titulo: "Cola de sincronización",
      contexto: pendientes.length ? `${pendientes.length} acción${pendientes.length === 1 ? "" : "es"} sin enviar` : "Todo sincronizado",
      icono: <RefreshCw size={22} strokeWidth={2.25} {...iconoTint} />,
      badge: pendientes.length || undefined,
      ir: () => navigation.navigate("Perfil"),
    },
    { titulo: "Perfil y sesión", contexto: "Tus datos, el bloqueo con huella y la versión", icono: <CircleUser size={22} strokeWidth={2.25} {...iconoTint} />, ir: () => navigation.navigate("Perfil") },
  ];

  const grupos: { titulo: string; items: Item[] }[] = [
    { titulo: "Operación", items: operacion },
    { titulo: "Administración", items: administracion },
    { titulo: "Cuenta", items: cuenta },
  ].filter((g) => g.items.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScrollView contentContainerStyle={{ gap: tokens.space["6"], paddingTop: tokens.space["3"], paddingBottom: 140 }}>
        <ScreenHeader titulo="Más" />
        {grupos.map((g) => (
          <View key={g.titulo} style={{ paddingHorizontal: tokens.space["4"], gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              {g.titulo}
            </Texto>
            <ListRowGrupo>
              {g.items.map((it) => (
                <ListRow
                  key={it.titulo}
                  icono={it.icono}
                  titulo={it.titulo}
                  subtitulo={it.contexto}
                  onPress={it.ir}
                  trailing={
                    it.badge ? (
                      <Tag tono="accent">{it.badge}</Tag>
                    ) : (
                      <ChevronRight size={18} strokeWidth={2.25} color={`${tokens.color.text}66`} />
                    )
                  }
                />
              ))}
            </ListRowGrupo>
          </View>
        ))}
      </ScrollView>
      <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />
    </View>
  );
}
