import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Pressable, ScrollView, View } from "react-native";
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
  type LucideIcon,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { FUNCIONES_LEVANTAMIENTOS } from "@bitacora/shared";
import { ScreenHeader, ListRow, ListRowGrupo, AsistenteButton, ESPACIO_ASISTENTE_FLOTANTE, Texto, Tag } from "@bitacora/ui/native";
import { useAuth } from "../auth/AuthContext";
import { useRed } from "../../services/sync/NetworkProvider";
import { estaVencido, listarCobros } from "../../services/cobros";
import type { MasStackParamList } from "../../shell/navigation/types";

// "Más" — piloto del sistema visual móvil v2 (13-sep-2026, tarea #21):
// deja de ser una lista plana con iconos Ionicons en cuadrados de
// tinte-marca y pasa a grupos de ListRow sobre ScreenHeader, con el
// Asistente movido de la lista al botón flotante persistente. Toda la
// lógica de gating por rol/módulo/plan es la MISMA que antes — solo
// cambió cómo se pinta.
//
// "Accesos rápidos" (18-sep-2026): OS/Viajes/Mantención/Cobros/Gastos/
// Levantamientos —las tareas de terreno de uso diario— pasan de estar
// mezcladas en la lista "Operación"/"Administración" a una grilla de
// tarjetas con ícono grande arriba de todo. Partirlas en 5-6 secciones
// de una fila cada una (alternativa que se descartó) era más ruido de
// encabezados que contenido en una pantalla angosta; la grilla les da
// el mismo protagonismo visual sin ese costo. Lo que queda en
// "Administración" (Servicios y packs, Informes) es uso ocasional —
// se queda como lista, sin necesitar el mismo peso.

type Item = {
  titulo: string;
  contexto: string;
  icono: ReactNode;
  badge?: number;
  ir: () => void;
};

// Entrada de la grilla — a diferencia de Item, guarda el componente de
// ícono (no un ReactNode ya pintado) para poder alternar el color de
// tarjeta en tarjeta (ver `tinte` en AccesoRapido).
type AccesoItem = { titulo: string; Icono: LucideIcon; badge?: number; ir: () => void };

// Tarjeta de la grilla de accesos rápidos. Dos tintes alternados
// (marca / marca secundaria) para que la grilla no se vea como un solo
// bloque monocromo — mismo criterio visual que ya usa StatusBadge con
// sus tonos, adaptado a esta pantalla.
function AccesoRapido({ item, tinte }: { item: AccesoItem; tinte: 0 | 1 }) {
  const fondoIcono = tinte === 0 ? `${tokens.color.accent}22` : `${tokens.color.accent2}22`;
  const colorIcono = tinte === 0 ? tokens.color.accentRamp["700"] : tokens.color.accent2Ramp["700"];
  return (
    <Pressable onPress={item.ir} style={{ flex: 1 }}>
      <View
        style={{
          position: "relative",
          alignItems: "center",
          gap: tokens.space["1"],
          borderRadius: tokens.radius.md,
          backgroundColor: tokens.color.surface,
          borderWidth: 1,
          borderColor: tokens.color.divider,
          paddingVertical: tokens.space["3"],
          paddingHorizontal: tokens.space["1"],
        }}
      >
        {item.badge ? (
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 8,
              minWidth: 17,
              height: 17,
              borderRadius: 9,
              paddingHorizontal: 3,
              backgroundColor: tokens.color.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Texto tamano={tokens.size.micro} color={tokens.color.surface} peso="semibold">
              {item.badge}
            </Texto>
          </View>
        ) : null}
        <View style={{ width: 40, height: 40, borderRadius: tokens.radius.sm, backgroundColor: fondoIcono, alignItems: "center", justifyContent: "center" }}>
          <item.Icono size={20} strokeWidth={2.25} color={colorIcono} />
        </View>
        <Texto tamano={tokens.size.caption} color={tokens.color.text} peso="semibold" style={{ textAlign: "center" }} numberOfLines={2}>
          {item.titulo}
        </Texto>
      </View>
    </Pressable>
  );
}

// Agrupa de a 3 para la grilla, rellenando la última fila con espacios
// vacíos (en vez de dejar que 1-2 tarjetas sueltas se estiren al ancho
// completo).
function filasDeTres(items: AccesoItem[]): (AccesoItem | null)[][] {
  const filas: (AccesoItem | null)[][] = [];
  for (let i = 0; i < items.length; i += 3) {
    const fila: (AccesoItem | null)[] = items.slice(i, i + 3);
    while (fila.length < 3) fila.push(null);
    filas.push(fila);
  }
  return filas;
}

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
      // sin conexión — la tarjeta queda sin badge
    }
  }, [visibles]);

  useEffect(() => {
    void cargarCobros();
  }, [cargarCobros]);
  useFocusEffect(useCallback(() => void cargarCobros(), [cargarCobros]));

  const iconoTint = { color: tokens.color.accentRamp["700"] };

  // --- Accesos rápidos (grilla) ---
  const accesos: AccesoItem[] = [{ titulo: "Órdenes de servicio", Icono: HardHat, ir: () => navigation.navigate("Trabajos") }];
  if (!deshabilitados.includes("viajes")) {
    accesos.push({ titulo: "Viajes", Icono: Route, ir: () => navigation.navigate("Viajes") });
  }
  accesos.push({ titulo: "Mantención", Icono: Wrench, ir: () => navigation.navigate("MantencionVehiculo") });
  if (visibles.includes("financiero")) {
    accesos.push({ titulo: "Cobros", Icono: Banknote, badge: cobros?.vencidos || undefined, ir: () => navigation.navigate("CobrosLista") });
    // Sigue siendo el formulario de alta rápida (no hay lista de
    // gastos en el móvil) — se deja "Nuevo gasto", no "Gastos", para no
    // prometer una vista que no existe.
    accesos.push({ titulo: "Nuevo gasto", Icono: Receipt, ir: () => navigation.navigate("GastoForm") });
  }
  if (veLevantamientos) {
    accesos.push({ titulo: "Levantamientos", Icono: Search, ir: () => navigation.navigate("Levantamientos") });
  }

  // --- Administración (uso ocasional — se queda como lista) ---
  const administracion: Item[] = [];
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
    { titulo: "Administración", items: administracion },
    { titulo: "Cuenta", items: cuenta },
  ].filter((g) => g.items.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScrollView contentContainerStyle={{ gap: tokens.space["6"], paddingTop: tokens.space["3"], paddingBottom: ESPACIO_ASISTENTE_FLOTANTE }}>
        <ScreenHeader titulo="Más" />

        {accesos.length > 0 ? (
          <View style={{ paddingHorizontal: tokens.space["4"], gap: tokens.space["2"] }}>
            <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
              Accesos rápidos
            </Texto>
            <View style={{ gap: tokens.space["2"] }}>
              {filasDeTres(accesos).map((fila, i) => (
                <View key={i} style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                  {fila.map((item, j) => (item ? <AccesoRapido key={item.titulo} item={item} tinte={((i * 3 + j) % 2) as 0 | 1} /> : <View key={j} style={{ flex: 1 }} />))}
                </View>
              ))}
            </View>
          </View>
        ) : null}

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
