import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { EmptyState, ErrorState, Input, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { HojaCrearCliente } from "../../components/HojaCrearCliente";
import { pesos } from "../../lib/plata";
import { useAuth } from "../auth/AuthContext";
import { listarClientes, type ClienteConActividad } from "../../services/clientes";
import type { ClientesStackParamList } from "../../shell/navigation/types";

type Filtro = "todos" | "saldo" | "pack";

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

export function ClientesListaScreen({ navigation }: NativeStackScreenProps<ClientesStackParamList, "ClientesLista">) {
  const t = useTema();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const [clientes, setClientes] = useState<ClienteConActividad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [creando, setCreando] = useState(false);

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
    let base = (clientes ?? []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre));
    if (filtro === "saldo") base = base.filter((c) => (c.total_por_cobrar ?? 0) > 0);
    if (filtro === "pack") base = base.filter((c) => c.tiene_pack);
    if (!q) return base;
    return base.filter(
      (c) => c.nombre.toLowerCase().includes(q) || (c.rut ?? "").toLowerCase().includes(q) || (c.comuna ?? "").toLowerCase().includes(q)
    );
  }, [clientes, busqueda, filtro]);

  if (clientes === null && !error) return <LoadingScreen />;
  if (error && !clientes) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(4), gap: t.espacio(3) }}>
        <Input placeholder="Buscar por nombre, RUT o comuna" value={busqueda} onChangeText={setBusqueda} />
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {(
            [
              { k: "todos", t: "Todos" },
              { k: "saldo", t: "Con saldo" },
              { k: "pack", t: "Con pack" },
            ] as { k: Filtro; t: string }[]
          ).map((f) => {
            const activo = filtro === f.k;
            return (
              <Pressable
                key={f.k}
                onPress={() => setFiltro(f.k)}
                style={{
                  paddingHorizontal: t.espacio(3),
                  paddingVertical: t.espacio(1.5),
                  borderRadius: t.radio.full,
                  borderWidth: 1,
                  borderColor: activo ? t.colores.brand : t.colores.border,
                  backgroundColor: activo ? t.colores.brand : t.colores.surface,
                }}
              >
                <Text variante="caption" weight="semibold" tono={activo ? "inverso" : "muted"}>
                  {f.t}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingBottom: t.espacio(16), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <View style={{ padding: t.espacio(4) }}>
            <EmptyState
              icono={<Ionicons name="people-outline" size={40} color={t.colores.faint} />}
              titulo={busqueda || filtro !== "todos" ? "Sin resultados" : "Sin clientes"}
              mensaje={busqueda || filtro !== "todos" ? "Prueba con otro término o filtro." : "Crea el primero con el botón +."}
            />
          </View>
        }
        renderItem={({ item }) => {
          const saldo = item.total_por_cobrar ?? 0;
          const vencido = (item.total_vencido ?? 0) > 0;
          const tono = saldo === 0 ? t.colores.faint : vencido ? t.colores.danger : t.colores.accent;
          return (
            <Pressable
              onPress={() => navigation.navigate("ClienteDetalle", { clienteId: item.id })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: t.espacio(3),
                paddingHorizontal: t.espacio(4),
                paddingVertical: t.espacio(3),
                borderBottomWidth: 1,
                borderBottomColor: t.colores.border,
                opacity: item.activo ? 1 : 0.5,
              }}
            >
              <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.colores.brandSoft, alignItems: "center", justifyContent: "center" }}>
                <Text weight="bold" tono="brand" style={{ fontSize: 13 }}>
                  {iniciales(item.nombre)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text weight="semibold" numberOfLines={1}>
                  {item.nombre}
                </Text>
                {item.rut ? (
                  <Text mono variante="caption" tono="muted">
                    {item.rut}
                  </Text>
                ) : null}
              </View>
              <Text mono weight="semibold" style={{ color: tono }}>
                {pesos(saldo)}
              </Text>
            </Pressable>
          );
        }}
      />

      {esGestion ? (
        <Pressable
          onPress={() => setCreando(true)}
          style={{
            position: "absolute",
            right: t.espacio(5),
            bottom: t.espacio(6),
            height: 50,
            paddingHorizontal: t.espacio(4),
            borderRadius: 25,
            backgroundColor: t.colores.brand,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            ...t.sombra.flotante,
          }}
        >
          <Ionicons name="add" size={22} color={t.colores.brandForeground} />
          <Text weight="bold" tono="inverso">
            Cliente
          </Text>
        </Pressable>
      ) : null}

      <HojaCrearCliente
        visible={creando}
        onCerrar={() => setCreando(false)}
        onCreado={(c) => {
          setCreando(false);
          navigation.navigate("ClienteDetalle", { clienteId: c.id });
        }}
      />
    </View>
  );
}
