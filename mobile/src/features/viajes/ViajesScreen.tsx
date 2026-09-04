import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useTema } from "../../theme";
import { pesos } from "../../lib/plata";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { listarViajesEquipo, listarViajesPropios, type ViajeConDatos } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

type Periodo = "semana" | "mes" | "todos";
const PERIODOS: { clave: Periodo; label: string }[] = [
  { clave: "semana", label: "Esta semana" },
  { clave: "mes", label: "Este mes" },
  { clave: "todos", label: "Todos" },
];

function desdeDe(periodo: Periodo): string {
  if (periodo === "todos") return "";
  const hoy = new Date();
  if (periodo === "mes") {
    return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
  }
  // Semana: desde el lunes.
  const dia = hoy.getDay(); // 0 = domingo
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() - ((dia + 6) % 7));
  return lunes.toISOString().slice(0, 10);
}

export function ViajesScreen({ navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajesLista">) {
  const t = useTema();
  const red = useRed();
  const auth = useAuth();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  // "Registrar viaje" = la creación completa; "Foto de la guía" = solo la
  // imagen de un viaje que ya se guardó (no bloquea nada).
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

  if (viajes === null && !error) return <LoadingScreen />;
  if (error && !viajes) return <ErrorState mensaje={error} onReintentar={cargar} />;

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      <View style={{ padding: t.espacio(4), gap: t.espacio(3) }}>
        <Button titulo="Nuevo viaje" onPress={() => navigation.navigate("ViajeForm")} />
        {esGestion ? (
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
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
                    paddingVertical: t.espacio(2),
                    borderRadius: t.radio.md,
                    backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
                  }}
                >
                  <Text variante="etiqueta" weight="semibold" style={{ color: activo ? t.colores.brandForeground : t.colores.muted }}>
                    {o.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {creacionesPendientes.map((a) => {
          const { guia, ruta } = guiaDe(a);
          return (
            <Card key={a.id} plano style={{ backgroundColor: t.colores.surfaceAlt, borderColor: "transparent", gap: t.espacio(1) }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: t.espacio(2) }}>
                <Ionicons name="cloud-upload-outline" size={16} color={t.colores.muted} />
                <Text variante="etiqueta" weight="semibold" style={{ flex: 1 }}>
                  Guía {guia}
                </Text>
                <Text variante="caption" tono="muted">
                  Enviando…
                </Text>
              </View>
              {ruta ? (
                <Text variante="caption" tono="muted">
                  {ruta}
                </Text>
              ) : null}
              <Text variante="caption" tono="muted">
                Sin enviar todavía — se reintenta solo. No lo registres de nuevo.
              </Text>
            </Card>
          );
        })}
        {creacionesFallidas.map((a) => {
          const { guia, ruta } = guiaDe(a);
          return (
            <Card key={a.id} plano style={{ backgroundColor: t.colores.dangerSoft, borderColor: "transparent", gap: t.espacio(1.5) }}>
              <Text variante="etiqueta" weight="semibold" style={{ color: t.colores.danger }}>
                Guía {guia} — no se pudo enviar
              </Text>
              {ruta ? (
                <Text variante="caption" tono="muted">
                  {ruta}
                </Text>
              ) : null}
              {a.ultimoError ? (
                <Text variante="caption" tono="danger">
                  {a.ultimoError}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
                <Button titulo="Reintentar" variante="secundario" onPress={() => red.reintentar(a.id)} />
                <Button titulo="Descartar" variante="ghost" onPress={() => red.descartar(a.id)} />
              </View>
            </Card>
          );
        })}
        {fotosPendientes > 0 ? (
          <Text variante="caption" tono="muted">
            {fotosPendientes} foto{fotosPendientes === 1 ? "" : "s"} de guía subiéndose — el viaje ya quedó guardado
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
          {PERIODOS.map((p) => {
            const activo = p.clave === periodo;
            return (
              <Pressable
                key={p.clave}
                onPress={() => setPeriodo(p.clave)}
                hitSlop={6}
                style={{
                  paddingHorizontal: t.espacio(3),
                  paddingVertical: t.espacio(1.5),
                  borderRadius: t.radio.md,
                  backgroundColor: activo ? t.colores.brand : t.colores.surfaceAlt,
                }}
              >
                <Text variante="caption" weight="semibold" style={{ color: activo ? t.colores.brandForeground : t.colores.muted }}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {viajes && viajes.length > 0 ? (
          <Text variante="caption" tono="muted">
            {visibles.length} viaje{visibles.length === 1 ? "" : "s"} · {pesos(totalPeriodo)}
          </Text>
        ) : null}
      </View>
      <FlatList
        data={visibles}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ padding: t.espacio(4), paddingTop: 0, paddingBottom: t.espacio(10), gap: t.espacio(3), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListEmptyComponent={
          <EmptyState
            icono={<Ionicons name="car-outline" size={40} color={t.colores.faint} />}
            titulo={viajes && viajes.length > 0 ? "Sin viajes en este período" : "Sin viajes"}
            mensaje={
              viajes && viajes.length > 0
                ? "Prueba con otro período o registra uno nuevo."
                : "Registra tu primer viaje con el botón de arriba."
            }
          />
        }
        renderItem={({ item }) => (
          <Card onPress={() => navigation.navigate("ViajeDetalle", { viajeId: item.id })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: t.espacio(3) }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variante="subtitulo">{item.cliente_info?.nombre ?? item.cliente}</Text>
                <Text variante="etiqueta" tono="muted">
                  {item.fecha} · Guía {item.numero_guia}
                </Text>
                <Text variante="caption" tono="muted">
                  {item.origen} → {item.destino}
                </Text>
                {equipo && item.chofer?.nombre ? (
                  <Text variante="caption" tono="muted">
                    {item.chofer.nombre}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Badge estado={item.estado} />
                <Text variante="etiqueta" weight="semibold">
                  {pesos(item.total)}
                </Text>
              </View>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
