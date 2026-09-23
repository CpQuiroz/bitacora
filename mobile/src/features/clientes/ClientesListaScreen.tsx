import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { Users } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import {
  AsistenteButton,
  Button,
  EmptyState,
  ErrorState,
  ESPACIO_ASISTENTE_FLOTANTE,
  Input,
  ListRow,
  ListRowGrupo,
  LoadingState,
  ScreenHeader,
  Tag,
  Texto,
} from "@bitacora/ui/native";
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

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader + ListRow, mismo
// patrón que Hoy/Más/ficha de cliente. Antes de esto era el único de
// los 4 tabs (Hoy/Agenda/Clientes/Más) que seguía con el header nativo
// y filas sueltas del sistema viejo (Faena).
export function ClientesListaScreen({ navigation }: NativeStackScreenProps<ClientesStackParamList, "ClientesLista">) {
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  // Asistente IA: exclusivo de Admin (Fase 2.2, 23-sep-2026) — mismo
  // criterio que MasScreen/HoyScreen/AgendaScreen; el backend
  // (requiereRol("admin")) es la protección real.
  const veAsistente = auth.fase === "listo" && auth.usuario.rol === "admin" && auth.modulosVisibles.includes("asistente");
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

  const filtros = {
    opciones: [
      { valor: "todos", etiqueta: "Todos" },
      { valor: "saldo", etiqueta: "Con saldo" },
      { valor: "pack", etiqueta: "Con pack" },
    ],
    valor: filtro,
    onCambio: (v: string) => setFiltro(v as Filtro),
  };

  if (clientes === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo=" " titulo="Clientes" filtros={filtros} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !clientes) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo=" " titulo="Clientes" filtros={filtros} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={`${visibles.length} ${visibles.length === 1 ? "cliente" : "clientes"}`} titulo="Clientes" filtros={filtros} />
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ paddingHorizontal: tokens.space["4"], paddingTop: tokens.space["3"], gap: tokens.space["3"] }}>
        <Input valor={busqueda} onCambio={setBusqueda} placeholder="Buscar por nombre, RUT o comuna" />
        {esGestion ? <Button onPress={() => setCreando(true)}>+ Cliente</Button> : null}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], paddingBottom: ESPACIO_ASISTENTE_FLOTANTE, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} />}
      >
        {visibles.length === 0 ? (
          <EmptyState
            icono={<Users size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo={busqueda || filtro !== "todos" ? "Sin resultados" : "Sin clientes"}
            mensaje={busqueda || filtro !== "todos" ? "Prueba con otro término o filtro." : "Crea el primero con el botón + Cliente."}
          />
        ) : (
          <ListRowGrupo>
            {visibles.map((item) => {
              const saldo = item.total_por_cobrar ?? 0;
              const vencido = (item.total_vencido ?? 0) > 0;
              return (
                <ListRow
                  key={item.id}
                  icono={
                    <Texto tamano={13} peso="semibold" color={tokens.color.accentRamp["800"]}>
                      {iniciales(item.nombre)}
                    </Texto>
                  }
                  titulo={item.nombre}
                  subtitulo={[formatearFolio("CLI", item.folio), item.rut].filter(Boolean).join(" · ") || undefined}
                  trailing={
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      {item.tiene_pack ? <Tag tono="accent2">Con pack</Tag> : null}
                      <Texto
                        peso="semibold"
                        tamano={tokens.size.small}
                        color={saldo === 0 ? `${tokens.color.text}99` : vencido ? tokens.color.accentRamp["700"] : tokens.color.text}
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {pesos(saldo)}
                      </Texto>
                    </View>
                  }
                  onPress={() => navigation.navigate("ClienteDetalle", { clienteId: item.id })}
                />
              );
            })}
          </ListRowGrupo>
        )}
      </ScrollView>

      <AsistenteButton visible={veAsistente} onPress={() => navigation.navigate("Asistente")} />

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
