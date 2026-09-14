import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { ArrowLeft, Banknote } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import {
  Button,
  EmptyState,
  ErrorState,
  ESPACIO_ASISTENTE_FLOTANTE,
  ListRow,
  ListRowGrupo,
  LoadingState,
  ScreenHeader,
  StatusBadge,
  Texto,
} from "@bitacora/ui/native";
import { pesos } from "../../lib/plata";
import { OfflineBanner } from "../../components/OfflineBanner";
import { estaVencido, listarCobros, type CobroConCliente } from "../../services/cobros";
import type { MasStackParamList } from "../../shell/navigation/types";

type Filtro = "pendientes" | "vencidas" | "pagadas" | "todas";
const FILTROS: { clave: Filtro; label: string }[] = [
  { clave: "pendientes", label: "Pendientes" },
  { clave: "vencidas", label: "Vencidas" },
  { clave: "pagadas", label: "Pagadas" },
  { clave: "todas", label: "Todas" },
];

// Sistema visual móvil v2 — pantalla push (no es raíz de tab, por eso
// ScreenHeader lleva `accion` de volver, mismo patrón que
// ClienteDetalleScreen). Filtros de estado como chips del propio
// ScreenHeader (mismo mecanismo que Mes/Sem/Día en Agenda), lista con
// ListRow/ListRowGrupo en vez de Card+FlatList (mismo criterio que
// ClientesListaScreen: nada virtualizado, listas cortas).
export function CobrosListaScreen({ navigation }: NativeStackScreenProps<MasStackParamList, "CobrosLista">) {
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

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  const filtros = {
    opciones: FILTROS.map((f) => ({ valor: f.clave, etiqueta: f.label })),
    valor: filtro,
    onCambio: (v: string) => setFiltro(v as Filtro),
  };

  if (cobros === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cobros" accion={volver} filtros={filtros} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !cobros) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Cobros" accion={volver} filtros={filtros} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader titulo="Cobros" accion={volver} filtros={filtros} />
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ paddingHorizontal: tokens.space["4"], paddingTop: tokens.space["3"], gap: tokens.space["2"] }}>
        <Button bloque onPress={() => navigation.navigate("CobroForm")}>
          Nuevo cobro
        </Button>
        {visibles.length > 0 ? (
          <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
            {visibles.length} {visibles.length === 1 ? "cobro" : "cobros"} · {pesos(totalVisible)}
          </Texto>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], paddingBottom: ESPACIO_ASISTENTE_FLOTANTE, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} />}
      >
        {visibles.length === 0 ? (
          <EmptyState
            icono={<Banknote size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo="Sin cobros"
            mensaje="No hay cobros en este filtro."
          />
        ) : (
          <ListRowGrupo>
            {visibles.map((item) => {
              const vencido = estaVencido(item);
              const estadoMostrado = vencido ? "vencida" : item.estado;
              return (
                <ListRow
                  key={item.id}
                  icono={<Banknote size={22} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                  titulo={item.cliente_info?.nombre ?? item.cliente}
                  subtitulo={`Vence ${item.fecha_vencimiento}`}
                  trailing={
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                        {pesos(item.monto)}
                      </Texto>
                      <StatusBadge estado={estadoMostrado} tonoForzado={estadoMostrado === "pendiente" ? "en_progreso" : undefined} />
                    </View>
                  }
                  onPress={() => navigation.navigate("CobroDetalle", { cobroId: item.id })}
                />
              );
            })}
          </ListRowGrupo>
        )}
      </ScrollView>
    </View>
  );
}
