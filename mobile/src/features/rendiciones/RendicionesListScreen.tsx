import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { ArrowLeft, HandCoins, Plus } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoRendicion } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge, Texto, useMarca, type TonoEstado } from "@bitacora/ui/native";
import { listarMisRendiciones, type RendicionConDatos } from "../../services/rendiciones";
import { useAuth } from "../auth/AuthContext";
import type { MasStackParamList } from "../../shell/navigation/types";

const ETIQUETA_ESTADO: Record<EstadoRendicion, string> = {
  borrador: "Borrador",
  enviada: "Enviada — esperando revisión",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

const TONO_ESTADO: Record<EstadoRendicion, TonoEstado> = {
  borrador: "cerrado",
  enviada: "en_progreso",
  aprobada: "completado",
  rechazada: "cancelado",
};

const ETIQUETA_PERIODO: Record<string, string> = { diario: "Diario", semanal: "Semanal" };

function FabNuevaRendicion({ onPress }: { onPress: () => void }) {
  const marca = useMarca();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Nueva rendición"
      onPress={onPress}
      style={{
        position: "absolute",
        right: 18,
        bottom: 24,
        width: 56,
        height: 56,
        borderRadius: tokens.radius.pill,
        backgroundColor: marca.base,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: marca.base,
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 6,
      }}
    >
      <Plus size={26} color={marca.foreground} />
    </Pressable>
  );
}

// "Mis rendiciones" (Más → Rendiciones, 21-sep-2026) — mismo patrón
// visual que Levantamientos: ScreenHeader propio + ListRow/ListRowGrupo.
// El Admin también ve las de todo el equipo (backend ya no filtra por
// colaborador para roles de gestión) — se muestra el nombre de quién
// es cada una, igual que Levantamientos.
export function RendicionesListScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "RendicionesLista">) {
  const auth = useAuth();
  const esAdmin = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const [lista, setLista] = useState<RendicionConDatos[] | null>(null);

  const cargar = useCallback(async () => {
    setLista(await listarMisRendiciones());
  }, []);

  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (lista === null) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Rendiciones" accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Rendiciones" accion={volver} />
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={cargar} />}
        contentContainerStyle={{ padding: tokens.space["4"], flexGrow: 1, gap: tokens.space["2"] }}
        ListEmptyComponent={
          <EmptyState
            icono={<HandCoins size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo="Sin rendiciones"
            mensaje="Tocá el botón + para registrar el fondo por rendir de este período."
          />
        }
        renderItem={({ item }) => (
          <ListRowGrupo>
            <ListRow
              icono={<HandCoins size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
              titulo={formatearFolio("REND", item.folio) ?? "Rendición"}
              subtitulo={[
                ETIQUETA_PERIODO[item.periodo] ?? item.periodo,
                esAdmin ? item.colaborador?.nombre ?? null : null,
                `${item.fecha_inicio} a ${item.fecha_termino}`,
              ]
                .filter(Boolean)
                .join(" · ")}
              onPress={() => navigation.navigate("RendicionDetalle", { id: item.id })}
              trailing={
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <StatusBadge estado={item.estado} etiqueta={ETIQUETA_ESTADO[item.estado]} tonoForzado={TONO_ESTADO[item.estado]} />
                  <Texto tamano={tokens.size.caption} color={tokens.color.textSecondary} style={{ fontVariant: ["tabular-nums"] }}>
                    Saldo: ${item.saldo.toLocaleString("es-CL")}
                  </Texto>
                </View>
              }
            />
          </ListRowGrupo>
        )}
      />
      <FabNuevaRendicion onPress={() => navigation.navigate("RendicionForm")} />
    </View>
  );
}
