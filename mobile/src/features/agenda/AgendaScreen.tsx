import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, SectionList, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Badge, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { listarMisTareas, type TareaConDatos } from "../../services/agenda";
import type { AgendaStackParamList } from "../../shell/navigation/types";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function claveHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function etiquetaFecha(fecha: string): string {
  const hoy = claveHoy();
  const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (fecha === hoy) return "Hoy";
  if (fecha === manana) return "Mañana";
  const [a, m, d] = fecha.split("-").map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]} ${d} ${MESES[m - 1]}`;
}

const PENDIENTES = new Set(["pendiente", "confirmada"]);

export function AgendaScreen({ navigation }: NativeStackScreenProps<AgendaStackParamList, "AgendaLista">) {
  const t = useTema();
  const [tareas, setTareas] = useState<TareaConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarMisTareas();
      setTareas(r.tareas);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu agenda");
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const secciones = useMemo(() => {
    const hoy = claveHoy();
    // Solo desde hoy en adelante, citas aún activas primero.
    const relevantes = (tareas ?? [])
      .filter((x) => x.fecha >= hoy)
      .sort((a, b) => (a.fecha === b.fecha ? (a.hora ?? "").localeCompare(b.hora ?? "") : a.fecha.localeCompare(b.fecha)));
    const porFecha = new Map<string, TareaConDatos[]>();
    for (const x of relevantes) {
      if (!porFecha.has(x.fecha)) porFecha.set(x.fecha, []);
      porFecha.get(x.fecha)!.push(x);
    }
    return [...porFecha.entries()].map(([fecha, data]) => ({ titulo: etiquetaFecha(fecha), data }));
  }, [tareas]);

  if (tareas === null && !error) return <LoadingScreen />;
  if (error && !tareas) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: t.espacio(4), paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        renderSectionHeader={({ section }) => (
          <Text variante="etiqueta" weight="semibold" tono="muted" style={{ marginTop: t.espacio(2), marginBottom: t.espacio(1) }}>
            {section.titulo}
          </Text>
        )}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="calendar-outline" size={40} color={t.colores.faint} />}
            titulo="Sin citas próximas"
            mensaje="Cuando te asignen una tarea o cita, aparecerá acá."
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate("TareaDetalle", { tareaId: item.id, titulo: item.titulo })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
              <View style={{ flex: 1, gap: t.espacio(1) }}>
                <Text variante="subtitulo">{item.titulo}</Text>
                <Text variante="etiqueta" tono="muted">
                  {item.hora ? item.hora.slice(0, 5) : "Sin hora"}
                  {item.cliente?.nombre ? ` · ${item.cliente.nombre}` : ""}
                </Text>
                {item.paquete_id ? (
                  <Text variante="caption" tono="muted">
                    Sesión de paquete
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Badge estado={item.estado} />
                {item.prioridad === "alta" && PENDIENTES.has(item.estado) ? (
                  <Text variante="caption" weight="semibold" tono="danger">
                    Prioridad alta
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
