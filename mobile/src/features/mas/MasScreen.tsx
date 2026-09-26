import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Alert, ScrollView, View } from "react-native";
import {
  Banknote,
  ChevronRight,
  CircleUser,
  ClipboardList,
  CreditCard,
  FileChartColumn,
  HardHat,
  Receipt,
  RefreshCw,
  Route,
  Search,
  Tags,
  Truck,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { ScreenHeader, ListRow, ListRowGrupo, AsistenteButton, ESPACIO_ASISTENTE_FLOTANTE, QuickAccessCard, Texto, Tag } from "@bitacora/ui/native";
import { useAuth } from "../auth/AuthContext";
import { accesoDesdeAuth } from "../../lib/modulos";
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

// Tarjeta de la grilla de accesos rápidos — componente compartido
// (packages/ui/src/native/QuickAccessCard.tsx, 20-sep-2026) para poder
// reusarla en cualquier otra pantalla con este mismo patrón. Se audita
// el resto de la app en esa fecha: el único parecido real es
// BotonGrande (MantencionVehiculoScreen.tsx) — pero ese es un patrón
// DISTINTO (2 por fila, con subtítulo), no se fuerza a compartir este
// componente para no perder esa información.

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
  // Levantamientos: para el TÉCNICO no se mira el módulo del rol (el
  // técnico es rol=colaborador) sino usuarios.funcion (FUNCIONES_
  // LEVANTAMIENTOS, shared) — más el módulo activo en la empresa (tarea
  // 152). El Admin lo ve sin función técnica (pedido 21-sep-2026).
  // Tarea 152: qué entradas se ven según módulos de la empresa y del rol
  // (misma fuente que el backend) — ver lib/modulos.ts.
  const acceso = accesoDesdeAuth(auth);
  const veLevantamientos = acceso.levantamientos;
  // Asistente IA: exclusivo de Admin (Fase 2.2, 23-sep-2026) — el rol
  // se chequea ADEMÁS del módulo, mismo criterio y mismo motivo que
  // DashboardShell.tsx (web): el backend (requiereRol("admin")) es la
  // protección real, esto evita ofrecer un botón que igual daría 403.
  const veAsistente = listo && auth.usuario.rol === "admin" && visibles.includes("asistente");

  const [cobros, setCobros] = useState<{ vencidos: number; monto: number } | null>(null);

  const cargarCobros = useCallback(async () => {
    if (!visibles.includes("cobros")) return;
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
  const accesos: AccesoItem[] = [];
  if (acceso.ordenesServicio) {
    accesos.push({ titulo: "Órdenes de servicio", Icono: HardHat, ir: () => navigation.navigate("Trabajos") });
  }
  if (acceso.viajes) {
    accesos.push({ titulo: "Viajes", Icono: Route, ir: () => navigation.navigate("Viajes") });
  }
  if (acceso.mantencion) {
    accesos.push({ titulo: "Mantención", Icono: Wrench, ir: () => navigation.navigate("MantencionVehiculo") });
  }
  // Tarea 146: Equipos (con Flota/Equipos, la lista; el chofer, su vehículo).
  if (visibles.includes("flota") || visibles.includes("equipos")) {
    accesos.push({ titulo: "Equipos", Icono: Truck, ir: () => navigation.navigate("Equipos") });
  } else if (acceso.miVehiculo) {
    accesos.push({ titulo: "Mi vehículo", Icono: Truck, ir: () => navigation.navigate("Equipos") });
  }
  // Dinero, separado en 3 módulos activables independientemente desde
  // el 23-sep-2026 (antes "financiero" bundleaba los 3 — pedido
  // explícito: una empresa puede necesitar solo Gastos, sin Cobros ni
  // Cotización). Ver packages/shared/src/permisos.ts.
  if (visibles.includes("cobros")) {
    accesos.push({ titulo: "Cobros", Icono: Banknote, badge: cobros?.vencidos || undefined, ir: () => navigation.navigate("CobrosLista") });
  }
  if (visibles.includes("financiero")) {
    // Gasto suelto (alta rápida — sigue sin existir una lista de gastos
    // en el móvil, a propósito) y Rendiciones (fondo por rendir/caja
    // chica, 21-sep-2026) son la misma familia que en web (GastosSubnav:
    // Rendiciones es subsección de Gastos) — antes eran 2 tarjetas
    // sueltas sin relación visible entre sí (pedido explícito 22-sep-2026
    // tras confundirse por la separación). Se unen en una sola tarjeta
    // "Gastos" que ofrece las 2 acciones, en vez de construir la lista
    // de gastos que se decidió no tener.
    accesos.push({
      titulo: "Gastos",
      Icono: Receipt,
      ir: () =>
        Alert.alert("Gastos", "¿Qué querés hacer?", [
          { text: "Nuevo gasto", onPress: () => navigation.navigate("GastoForm") },
          { text: "Rendiciones", onPress: () => navigation.navigate("RendicionesLista") },
          { text: "Cancelar", style: "cancel" },
        ]),
    });
  }
  if (veLevantamientos) {
    accesos.push({ titulo: "Levantamientos", Icono: Search, ir: () => navigation.navigate("Levantamientos") });
  }

  // --- Administración (uso ocasional) — misma tarjeta grande con
  // ícono que "Accesos rápidos" (pedido explícito 23-sep-2026: "hazlo
  // iconos igual"), en su propia grilla con rótulo propio — sigue
  // siendo uso ocasional, no se mezcla con la grilla de tareas
  // diarias de arriba.
  const administracion: AccesoItem[] = [];
  if (visibles.includes("agenda_pro")) {
    administracion.push({ titulo: "Servicios y packs", Icono: Tags, ir: () => navigation.navigate("Catalogo") });
  }
  if (acciones.includes("ver_dashboard") && visibles.includes("informes")) {
    administracion.push({ titulo: "Informes", Icono: FileChartColumn, ir: () => navigation.navigate("Informes") });
  }
  // Fase 5.3 (23-sep-2026) — historial propio, self-service, sin gate
  // de módulo (mismo criterio que /api/mis-trabajos).
  administracion.push({ titulo: "Mis trabajos", Icono: ClipboardList, ir: () => navigation.navigate("MisTrabajos") });
  // "Mi plan" (23-sep-2026) — solo lectura, solo quien gestiona el plan
  // (hoy Admin). El pago/cambio de plan sigue en la web (Google Play).
  if (acciones.includes("gestionar_plan")) {
    administracion.push({ titulo: "Mi plan", Icono: CreditCard, ir: () => navigation.navigate("MiPlan") });
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

  const grupos: { titulo: string; items: Item[] }[] = [{ titulo: "Cuenta", items: cuenta }].filter((g) => g.items.length > 0);

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScrollView contentContainerStyle={{ gap: tokens.space["6"], paddingTop: tokens.space["3"], paddingBottom: ESPACIO_ASISTENTE_FLOTANTE }}>
        <ScreenHeader titulo="Más" />

        <GrillaAccesos titulo="Accesos rápidos" items={accesos} />
        <GrillaAccesos titulo="Administración" items={administracion} />

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
                      <ChevronRight size={18} strokeWidth={2.25} color={tokens.color.textSecondary} />
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

// Grilla de tarjetas con ícono grande (misma que "Accesos rápidos",
// 18-sep-2026) — reusada también para "Administración" (23-sep-2026,
// "hazlo iconos igual": antes era una lista de texto, ahora mismo
// tratamiento visual, en su propia grilla con rótulo propio).
function GrillaAccesos({ titulo, items }: { titulo: string; items: AccesoItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: tokens.space["4"], gap: tokens.space["2"] }}>
      <Texto tamano={tokens.size.micro} color={tokens.color.accent2Ramp["800"]} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1.3 }}>
        {titulo}
      </Texto>
      <View style={{ gap: tokens.space["2"] }}>
        {filasDeTres(items).map((fila, i) => (
          <View key={i} style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            {fila.map((item, j) =>
              item ? (
                <QuickAccessCard key={item.titulo} titulo={item.titulo} Icono={item.Icono} badge={item.badge} tinte={((i * 3 + j) % 2) as 0 | 1} onPress={item.ir} />
              ) : (
                <View key={j} style={{ flex: 1 }} />
              )
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
