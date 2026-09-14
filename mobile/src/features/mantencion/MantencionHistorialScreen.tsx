import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { ArrowLeft, CheckCheck, Wrench } from "lucide-react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import { EmptyState, ErrorState, ListRow, ListRowGrupo, LoadingState, ScreenHeader, StatusBadge } from "@bitacora/ui/native";
import type { MasStackParamList } from "../../shell/navigation/types";
import { obtenerHistorialEquipo, type MantencionResumen } from "../../services/mantencion";

const fechaCorta = (iso: string) => {
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return d && m ? `${d} ${meses[m - 1]} ${y}` : iso;
};

// Sistema visual móvil v2 (14-sep-2026) — migración del sistema viejo
// (useTema/Ionicons/filas de Pressable a mano) al nuevo: ScreenHeader
// propio con volver, ListRow/ListRowGrupo para el historial (antes filas
// sueltas), StatusBadge para "Con novedades"/"Sin novedades" (mismo
// mapa en_progreso/completado que ya usa el resto del sistema — nunca
// rojo/verde literal). El título ya no lo pone el header nativo
// (navigation.setOptions): ahora lo dibuja el propio ScreenHeader.
export function MantencionHistorialScreen({ route, navigation }: NativeStackScreenProps<MasStackParamList, "MantencionHistorial">) {
  const { equipoId, patente } = route.params;
  const [registros, setRegistros] = useState<MantencionResumen[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };
  const titulo = patente ? `Mantención · ${patente}` : "Historial";

  if (registros === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={volver} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={volver} />
        <ErrorState mensaje={error} onReintentar={() => void cargar()} />
      </View>
    );
  }
  if (registros && registros.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo={titulo} accion={volver} />
        <EmptyState
          icono={<Wrench size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
          titulo="Sin registros de mantención"
          mensaje="Este camión todavía no tiene mantenciones registradas."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo={titulo} accion={volver} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"] }}>
        <ListRowGrupo>
          {(registros ?? []).map((r) => (
            <ListRow
              key={r.id}
              icono={
                r.tipo === "programa" ? (
                  <Wrench size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />
                ) : (
                  <CheckCheck size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />
                )
              }
              titulo={r.tipo === "programa" ? "Mantención Flota" : "Checklist diario"}
              subtitulo={`${fechaCorta(r.fecha)}${r.folio != null ? ` · N° ${String(r.folio).padStart(4, "0")}` : ""} · ${r.origen === "externo" ? "Taller externo" : "Interno"}${r.realizado_por_nombre ? ` · ${r.realizado_por_nombre}` : ""}${r.kilometraje != null ? ` · ${r.kilometraje.toLocaleString("es-CL")} km` : ""}`}
              trailing={
                r.con_novedades ? (
                  <StatusBadge estado="con_novedades" etiqueta="Con novedades" tonoForzado="en_progreso" />
                ) : (
                  <StatusBadge estado="ok" etiqueta="Sin novedades" tonoForzado="completado" />
                )
              }
              onPress={() => navigation.navigate("MantencionDetalle", { equipoId, registroId: r.id })}
            />
          ))}
        </ListRowGrupo>
      </ScrollView>
    </View>
  );
}
