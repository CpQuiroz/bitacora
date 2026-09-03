import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { estaVencido, listarCobros, type CobroConCliente } from "../../services/cobros";
import type { GestionStackParamList } from "../../shell/navigation/types";

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;

type Filtro = "pendientes" | "vencidas" | "pagadas" | "todas";
const FILTROS: { clave: Filtro; label: string }[] = [
  { clave: "pendientes", label: "Pendientes" },
  { clave: "vencidas", label: "Vencidas" },
  { clave: "pagadas", label: "Pagadas" },
  { clave: "todas", label: "Todas" },
];

export function CobrosListaScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "CobrosLista">) {
  const t = useTema();
  const [cobros, setCobros] = useState<CobroConCliente[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [filtro, setFiltro] = useState<Filtro>("pendientes");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarCobros();
      setCobros(r.cobros);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los cobros");
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

  const visibles = useMemo(() => {
    const base = cobros ?? [];
    if (filtro === "todas") return base;
    if (filtro === "pagadas") return base.filter((c) => c.estado === "pagada");
    if (filtro === "vencidas") return base.filter((c) => estaVencido(c));
    return base.filter((c) => c.estado === "pendiente" && !estaVencido(c));
  }, [cobros, filtro]);

  const totalVisible = useMemo(() => visibles.reduce((s, c) => s + (c.monto ?? 0), 0), [visibles]);

  if (cobros === null && !error) return <LoadingScreen />;
  if (error && !cobros) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(4), gap: t.espacio(3) }}>
        <Button titulo="Nuevo cobro" onPress={() => navigation.navigate("CobroForm")} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: t.espacio(2) }}>
          {FILTROS.map((f) => {
            const activo = f.clave === filtro;
            return (
              <Pressable
                key={f.clave}
                onPress={() => setFiltro(f.clave)}
                hitSlop={6}
                style={{
                  paddingHorizontal: t.espacio(3),
                  paddingVertical: t.espacio(1.5),
                  borderRadius: t.radio.full,
                  backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
                }}
              >
                <Text variante="caption" weight="semibold" style={{ color: activo ? t.colores.brandForeground : t.colores.muted }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {visibles.length > 0 ? (
          <Text variante="caption" tono="muted">
            {visibles.length} {visibles.length === 1 ? "cobro" : "cobros"} · {pesos(totalVisible)}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: t.espacio(4), paddingTop: 0, paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="cash-outline" size={40} color={t.colores.faint} />}
            titulo="Sin cobros"
            mensaje="No hay cobros en este filtro."
          />
        }
        renderItem={({ item }) => {
          const vencido = estaVencido(item);
          return (
            <Card onPress={() => navigation.navigate("CobroDetalle", { cobroId: item.id })}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variante="subtitulo">{item.cliente_info?.nombre ?? item.cliente}</Text>
                  <Text variante="caption" tono="muted">
                    Vence {item.fecha_vencimiento}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text variante="etiqueta" weight="semibold">
                    {pesos(item.monto)}
                  </Text>
                  <Badge texto={vencido ? "vencida" : item.estado} estado={vencido ? "vencida" : item.estado} />
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
