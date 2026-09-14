import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Car, CloudUpload } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { tokens } from "@bitacora/design-tokens";
import {
  Button,
  EmptyState,
  ErrorState,
  ListRow,
  ListRowGrupo,
  LoadingState,
  ScreenHeader,
  StatusBadge,
  Texto,
  useMarca,
} from "@bitacora/ui/native";
import { pesos } from "../../lib/plata";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { listarViajesEquipo, listarViajesPropios, type ViajeConDatos } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

type Periodo = "semana" | "mes" | "todos";
const PERIODOS: { clave: Periodo; label: string }[] = [
  { clave: "semana", label: "Semana" },
  { clave: "mes", label: "Mes" },
  { clave: "todos", label: "Todos" },
];

// Mismo mapeo que usaba <Badge> (components/ui) — "borrador"/"confirmado"/
// "facturado" no son ninguno de los 4 estados de MAPA_ESTADO_TONO (esos
// son de OS), así que se fuerza el tono a mano.
const TONO_VIAJE: Record<string, "en_progreso" | "completado" | "cerrado"> = {
  borrador: "en_progreso",
  confirmado: "completado",
  facturado: "cerrado",
};

function desdeDe(periodo: Periodo): string {
  if (periodo === "todos") return "";
  const hoy = new Date();
  if (periodo === "mes") {
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  }
  const dia = hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((dia + 6) % 7));
  return lunes.toISOString().slice(0, 10);
}

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader (chips de período,
// mismo patrón que Mes/Sem/Día en Agenda) + ListRow/ListRowGrupo. Antes
// era el único stack de los 4 tabs sin ninguna pantalla migrada.
export function ViajesScreen({ navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajesLista">) {
  const marca = useMarca();
  const red = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const esCreacion = (a: (typeof red.pendientes)[number]) => a.recurso === "viajes" && a.etiqueta === "Registrar viaje";
  const creacionesPendientes = red.pendientes.filter(esCreacion);
  const creacionesFallidas = red.fallidas.filter(esCreacion);
  const fotosPendientes = red.pendientes.filter((a) => a.recurso === "viajes" && a.etiqueta === "Foto de la guía").length;
  const guiaDe = (a: (typeof red.pendientes)[number]) => {
    const b = (a.body ?? {}) as { numero_guia?: string; origen?: string; destino?: string };
    return { guia: b.numero_guia ?? "sin número", ruta: b.origen && b.destino ? `${b.origen} → ${b.destino}` : "" };
  };

  const [viajes, setViajes] = useState<ViajeConDatos[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [equipo, setEquipo] = useState(false);

  const visibles = useMemo(() => {
    const desde = desdeDe(periodo);
    const lista = desde ? (viajes ?? []).filter((v) => v.fecha >= desde) : viajes ?? [];
    return lista;
  }, [viajes, periodo]);
  const totalPeriodo = useMemo(() => visibles.reduce((s, v) => s + (v.total ?? 0), 0), [visibles]);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = equipo ? await listarViajesEquipo() : await listarViajesPropios();
      setViajes(r.viajes);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los viajes");
    }
  }, [equipo]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const filtros = {
    opciones: PERIODOS.map((p) => ({ valor: p.clave, etiqueta: p.label })),
    valor: periodo,
    onCambio: (v: string) => setPeriodo(v as Periodo),
  };

  if (viajes === null && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo=" " titulo="Viajes" filtros={filtros} />
        <View style={{ padding: tokens.space["4"] }}>
          <LoadingState />
        </View>
      </View>
    );
  }
  if (error && !viajes) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader antetitulo=" " titulo="Viajes" filtros={filtros} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader antetitulo={`${visibles.length} ${visibles.length === 1 ? "viaje" : "viajes"} · ${pesos(totalPeriodo)}`} titulo="Viajes" filtros={filtros} />
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ paddingHorizontal: tokens.space["4"], paddingTop: tokens.space["3"], gap: tokens.space["3"] }}>
        <Button onPress={() => navigation.navigate("ViajeForm")}>+ Nuevo viaje</Button>
        {esGestion ? (
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            {[
              { v: false, label: "Míos" },
              { v: true, label: "Del equipo" },
            ].map((o) => {
              const activo = o.v === equipo;
              return (
                <Pressable
                  key={o.label}
                  onPress={() => setEquipo(o.v)}
                  hitSlop={6}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: tokens.space["2"],
                    borderRadius: tokens.radius.md,
                    backgroundColor: activo ? marca.base : tokens.color.surface,
                  }}
                >
                  <Texto tamano={tokens.size.small} peso="semibold" color={activo ? marca.foreground : tokens.color.text + "99"}>
                    {o.label}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {creacionesPendientes.map((a) => {
          const { guia, ruta } = guiaDe(a);
          return (
            <View key={a.id} style={{ backgroundColor: tokens.color.surface, borderRadius: tokens.radius.md, padding: tokens.space["3"], gap: tokens.space["1"] }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space["2"] }}>
                <CloudUpload size={16} color={tokens.color.text + "99"} />
                <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text} style={{ flex: 1 }}>
                  Guía {guia}
                </Texto>
                <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"}>
                  Enviando…
                </Texto>
              </View>
              {ruta ? (
                <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"}>
                  {ruta}
                </Texto>
              ) : null}
              <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"}>
                Sin enviar todavía — se reintenta solo. No lo registres de nuevo.
              </Texto>
            </View>
          );
        })}
        {creacionesFallidas.map((a) => {
          const { guia, ruta } = guiaDe(a);
          return (
            <View key={a.id} style={{ backgroundColor: tokens.color.accentRamp["200"], borderRadius: tokens.radius.md, padding: tokens.space["3"], gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.accentRamp["800"]}>
                Guía {guia} — no se pudo enviar
              </Texto>
              {ruta ? (
                <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"}>
                  {ruta}
                </Texto>
              ) : null}
              {a.ultimoError ? (
                <Texto tamano={tokens.size.caption} color={tokens.color.accentRamp["800"]}>
                  {a.ultimoError}
                </Texto>
              ) : null}
              <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
                <Button variante="secundario" onPress={() => red.reintentar(a.id)}>
                  Reintentar
                </Button>
                <Button variante="ghost" onPress={() => red.descartar(a.id)}>
                  Descartar
                </Button>
              </View>
            </View>
          );
        })}
        {fotosPendientes > 0 ? (
          <Texto tamano={tokens.size.caption} color={tokens.color.text + "99"}>
            {fotosPendientes} foto{fotosPendientes === 1 ? "" : "s"} de guía subiéndose — el viaje ya quedó guardado
          </Texto>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={{ padding: tokens.space["4"], flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} />}
      >
        {visibles.length === 0 ? (
          <EmptyState
            icono={<Car size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
            titulo={viajes && viajes.length > 0 ? "Sin viajes en este período" : "Sin viajes"}
            mensaje={viajes && viajes.length > 0 ? "Prueba con otro período o registra uno nuevo." : "Registra tu primer viaje con el botón de arriba."}
          />
        ) : (
          <ListRowGrupo>
            {visibles.map((item) => (
              <ListRow
                key={item.id}
                icono={<Car size={20} strokeWidth={2.25} color={tokens.color.accentRamp["700"]} />}
                titulo={item.cliente_info?.nombre ?? item.cliente}
                subtitulo={`${item.fecha} · Guía ${item.numero_guia} · ${item.origen} → ${item.destino}${equipo && item.chofer?.nombre ? ` · ${item.chofer.nombre}` : ""}`}
                trailing={
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <StatusBadge estado={item.estado} etiqueta={item.estado} tonoForzado={TONO_VIAJE[item.estado]} />
                    <Texto tamano={tokens.size.small} peso="semibold" color={tokens.color.text} style={{ fontVariant: ["tabular-nums"] }}>
                      {pesos(item.total)}
                    </Texto>
                  </View>
                }
                onPress={() => navigation.navigate("ViajeDetalle", { viajeId: item.id })}
              />
            ))}
          </ListRowGrupo>
        )}
      </ScrollView>
    </View>
  );
}
