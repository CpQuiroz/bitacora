import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { Badge, Button, Card, EmptyState, ErrorState, Input, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { listarClientes, type ClienteConActividad } from "../../services/clientes";
import type { GestionStackParamList } from "../../shell/navigation/types";

export function ClientesListaScreen({ navigation }: NativeStackScreenProps<GestionStackParamList, "ClientesLista">) {
  const t = useTema();
  const [clientes, setClientes] = useState<ClienteConActividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarClientes();
      setClientes(r.clientes);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los clientes");
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
    const q = busqueda.trim().toLowerCase();
    const base = (clientes ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (!q) return base;
    return base.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.rut ?? "").toLowerCase().includes(q) ||
        (c.comuna ?? "").toLowerCase().includes(q)
    );
  }, [clientes, busqueda]);

  if (clientes === null && !error) return <LoadingScreen />;
  if (error && !clientes) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(4), gap: t.espacio(3) }}>
        <Button titulo="Nuevo cliente" onPress={() => navigation.navigate("ClienteForm")} />
        <Input placeholder="Buscar por nombre, RUT o comuna" value={busqueda} onChangeText={setBusqueda} />
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: t.espacio(4), paddingTop: 0, paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="people-outline" size={40} color={t.colores.faint} />}
            titulo={busqueda ? "Sin resultados" : "Sin clientes"}
            mensaje={busqueda ? "Prueba con otro término." : "Crea el primero con el botón de arriba."}
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate("ClienteDetalle", { clienteId: item.id })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variante="subtitulo">{item.nombre}</Text>
                <Text variante="caption" tono="muted">
                  {[item.comuna, item.telefono].filter(Boolean).join(" · ") || item.direccion}
                </Text>
                {(item.cantidad_os ?? 0) > 0 || (item.cantidad_cotizaciones ?? 0) > 0 ? (
                  <Text variante="caption" tono="muted">
                    {item.cantidad_os ?? 0} OS · {item.cantidad_cotizaciones ?? 0} cotizaciones
                  </Text>
                ) : null}
              </View>
              {!item.activo ? <Badge texto="inactivo" estado="cancelado" /> : null}
            </View>
          </Card>
        )}
      />
    </View>
  );
}
