import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, RefreshControl, SectionList, View } from "react-native";
import { List, Map as MapIcon, Navigation, ClipboardList } from "lucide-react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoOS, EstadoTrabajo } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, EmptyState, ErrorState, LoadingState, Skeleton, StatusBadge, Texto, useMarca } from "@bitacora/ui/native";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useAuth } from "../auth/AuthContext";
import { listarTrabajos, type TrabajoLista } from "../../services/trabajos";
import { obtenerRutaDelDia } from "../../services/ruta";
import { distanciaMetros } from "../../lib/geo";
import { formatearFechaLarga } from "../../lib/horario";
import type { TrabajosStackParamList } from "../../shell/navigation/types";
import { TrabajosMapa } from "./TrabajosMapa";

const ETIQUETA_OS: Record<string, string> = {
  pendiente: "Pendiente",
  enviada: "Enviada",
  en_proceso: "En proceso",
  completada: "Completada",
  firmada: "Firmada",
  cancelada: "Cancelado",
};

const HOY = () => new Date().toISOString().slice(0, 10);

function abrirNavegacion(direccion: string | null) {
  if (!direccion) return;
  const d = encodeURIComponent(direccion);
  const url = Platform.select({ ios: `http://maps.apple.com/?daddr=${d}`, default: `https://www.google.com/maps/dir/?api=1&destination=${d}` });
  Linking.openURL(url!);
}

type Seccion = { titulo: string; orden: number; data: TrabajoLista[] };

function agrupar(trabajos: TrabajoLista[]): Seccion[] {
  const hoy = HOY();
  const map = new Map<string, Seccion>();
  const ordenados = [...trabajos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return (a.hora_programada ?? "99:99").localeCompare(b.hora_programada ?? "99:99");
  });
  for (const tr of ordenados) {
    let clave: string;
    let titulo: string;
    let orden: number;
    if (tr.fecha === hoy) {
      const manana = tr.hora_programada != null && tr.hora_programada.slice(0, 5) < "13:00";
      clave = manana ? "hoy-manana" : "hoy-tarde";
      titulo = manana ? "MAÑANA" : "TARDE";
      orden = manana ? 0 : 1;
    } else {
      clave = tr.fecha;
      titulo = formatearFechaLarga(tr.fecha).toUpperCase();
      // Próximos antes que pasados; próximos ascendente, pasados descendente.
      orden = tr.fecha > hoy ? 100 + Number(tr.fecha.replace(/-/g, "")) / 1e8 : 1_000_000 - Number(tr.fecha.replace(/-/g, "")) / 1e8;
    }
    if (!map.has(clave)) map.set(clave, { titulo, orden, data: [] });
    map.get(clave)!.data.push(tr);
  }
  return [...map.values()].sort((a, b) => a.orden - b.orden);
}

// PASO 6 (sistema de diseño) — migrado. Ver docs/design-system.md.
// Seam conocido: TrabajosMapa.tsx (vista de mapa) sigue Faena — no
// forma parte del bucket "listado + ficha".
export function TrabajosScreen({ navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajosLista">) {
  const auth = useAuth();
  const marca = useMarca();
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";
  const empresaNombre = auth.fase === "listo" ? auth.usuario.empresa.nombre : "";
  const usuarioNombre = auth.fase === "listo" ? auth.usuario.nombre : "";

  const [vista, setVista] = useState<"lista" | "mapa">("lista");
  const [equipo, setEquipo] = useState(false);
  const [trabajos, setTrabajos] = useState<TrabajoLista[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [kmRuta, setKmRuta] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await listarTrabajos(esGestion && equipo);
      setTrabajos(r.trabajos);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar tus trabajos");
    }
  }, [esGestion, equipo]);

  useEffect(() => {
    setTrabajos(null);
    cargar();
  }, [cargar]);

  useEffect(() => {
    void obtenerRutaDelDia()
      .then((r) => {
        const con = r.paradas.filter((p) => p.lat != null && p.lng != null) as { lat: number; lng: number }[];
        if (con.length < 2) return setKmRuta(con.length ? 0 : null);
        let m = 0;
        for (let i = 1; i < con.length; i++) m += distanciaMetros(con[i - 1], con[i]);
        setKmRuta(Math.round(m / 100) / 10);
      })
      .catch(() => setKmRuta(null));
  }, []);

  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  async function onRefresh() {
    setRefrescando(true);
    await cargar();
    setRefrescando(false);
  }

  const secciones = useMemo(() => agrupar(trabajos ?? []), [trabajos]);
  const contadores = useMemo(() => {
    const list = trabajos ?? [];
    const est = (tr: TrabajoLista): EstadoOS => tr.orden?.estado_os ?? estadoOsDeTrabajo(tr.estado as EstadoTrabajo);
    const pendientes = list.filter((tr) => ["pendiente", "enviada", "en_proceso"].includes(est(tr))).length;
    const listas = list.filter((tr) => ["completada", "firmada"].includes(est(tr))).length;
    return { pendientes, listas };
  }, [trabajos]);

  const toggleVista = (
    <View style={{ flexDirection: "row", gap: tokens.space["2"], padding: tokens.space["4"], paddingBottom: tokens.space["2"] }}>
      {(["lista", "mapa"] as const).map((v) => {
        const activo = vista === v;
        const Icono = v === "lista" ? List : MapIcon;
        return (
          <Pressable
            key={v}
            onPress={() => setVista(v)}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: tokens.space["2"],
              borderRadius: tokens.radius.pill,
              backgroundColor: activo ? marca.base : tokens.color.surface,
              borderWidth: 1,
              borderColor: activo ? marca.base : tokens.color.divider,
            }}
          >
            <Icono size={16} strokeWidth={2.75} color={activo ? marca.foreground : `${tokens.color.text}99`} />
            <Texto tamano={tokens.size.caption} color={activo ? marca.foreground : `${tokens.color.text}99`} peso="semibold">
              {v === "lista" ? "Lista" : "Mapa"}
            </Texto>
          </Pressable>
        );
      })}
    </View>
  );

  if (vista === "mapa") {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        {toggleVista}
        <TrabajosMapa onVerOS={(trabajoId) => navigation.navigate("TrabajoDetalle", { trabajoId })} />
      </View>
    );
  }

  const encabezado = (
    <View style={{ backgroundColor: marca.base, padding: tokens.space["6"], gap: tokens.space["3"] }}>
      <View>
        <Texto tamano={tokens.size.h4} color={marca.foreground}>
          {formatearFechaLarga(HOY())}
        </Texto>
        <Texto tamano={tokens.size.caption} color={`${marca.foreground}b3`}>
          {[empresaNombre, usuarioNombre].filter(Boolean).join(" · ")}
        </Texto>
      </View>
      <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
        {[
          { k: "Pendientes", v: String(contadores.pendientes) },
          { k: "Listas", v: String(contadores.listas) },
          { k: "Km por recorrer", v: kmRuta == null ? "—" : String(kmRuta) },
        ].map((c) => (
          <View
            key={c.k}
            style={{ flex: 1, backgroundColor: `${marca.foreground}1f`, borderRadius: tokens.radius.md, padding: tokens.space["3"], gap: 2 }}
          >
            <Texto tamano={22} color={marca.foreground} style={{ fontVariant: ["tabular-nums"] }}>
              {c.v}
            </Texto>
            <Texto tamano={11} color={`${marca.foreground}b3`}>
              {c.k}
            </Texto>
          </View>
        ))}
      </View>
    </View>
  );

  if (trabajos === null && !error)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        {toggleVista}
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={72} radio={32} />
            <Skeleton alto={72} radio={32} />
          </LoadingState>
        </View>
      </View>
    );
  if (error && !trabajos)
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        {toggleVista}
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      {toggleVista}
      {esGestion ? (
        <View style={{ paddingHorizontal: tokens.space["4"], paddingBottom: tokens.space["2"], gap: tokens.space["2"] }}>
          <Button bloque onPress={() => navigation.navigate("TrabajoForm")}>
            Nuevo trabajo
          </Button>
          <View style={{ flexDirection: "row", gap: tokens.space["2"] }}>
            {(["Míos", "Equipo"] as const).map((op, i) => {
              const activo = (i === 1) === equipo;
              return (
                <Pressable
                  key={op}
                  onPress={() => setEquipo(i === 1)}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: tokens.radius.pill,
                    backgroundColor: activo ? marca.base : tokens.color.surface,
                    borderWidth: 1,
                    borderColor: activo ? marca.base : tokens.color.divider,
                  }}
                >
                  <Texto tamano={tokens.size.caption} color={activo ? marca.foreground : `${tokens.color.text}99`} peso="semibold">
                    {op}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: tokens.space["8"], flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={marca.base} />}
        ListHeaderComponent={encabezado}
        ListEmptyComponent={
          <View style={{ padding: tokens.space["4"] }}>
            <EmptyState
              icono={<ClipboardList size={32} strokeWidth={2.75} color={tokens.color.accent2Ramp["800"]} />}
              titulo="Sin trabajos"
              mensaje={equipo ? "El equipo no tiene trabajos asignados." : "No tienes trabajos asignados."}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Texto
            tamano={10}
            color={`${tokens.color.text}66`}
            peso="semibold"
            style={{
              letterSpacing: 1.5,
              paddingHorizontal: tokens.space["4"],
              paddingTop: tokens.space["4"],
              paddingBottom: tokens.space["2"],
            }}
          >
            {section.titulo}
          </Texto>
        )}
        renderItem={({ item }) => {
          const estadoOs = item.orden?.estado_os ?? estadoOsDeTrabajo(item.estado as EstadoTrabajo);
          const enCurso = estadoOs === "en_proceso";
          const firmada = estadoOs === "firmada";
          return (
            <View style={{ paddingHorizontal: tokens.space["4"], paddingBottom: tokens.space["3"], opacity: firmada ? 0.68 : 1 }}>
              <Card onPress={() => navigation.navigate("TrabajoDetalle", { trabajoId: item.id, titulo: item.cliente })}>
                <View style={{ flexDirection: "row", gap: tokens.space["3"] }}>
                  <Texto tamano={15} color={tokens.color.text} peso="semibold" style={{ width: 46, fontVariant: ["tabular-nums"] }}>
                    {item.hora_programada ? item.hora_programada.slice(0, 5) : "--:--"}
                  </Texto>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto tamano={16.5} color={tokens.color.text} peso="semibold" numberOfLines={1}>
                      {item.cliente}
                    </Texto>
                    {item.ubicacion ? (
                      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} numberOfLines={1}>
                        {item.ubicacion}
                      </Texto>
                    ) : null}
                    {item.orden?.folio != null ? (
                      <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} style={{ fontVariant: ["tabular-nums"] }}>
                        OS N° {item.orden.folio}
                      </Texto>
                    ) : null}
                  </View>
                  <StatusBadge estado={estadoOs} etiqueta={ETIQUETA_OS[estadoOs] ?? estadoOs} />
                </View>

                {enCurso ? (
                  <View style={{ flexDirection: "row", gap: tokens.space["2"], marginTop: tokens.space["3"] }}>
                    <View style={{ flex: 1 }}>
                      <Button onPress={() => navigation.navigate("TrabajoDetalle", { trabajoId: item.id, titulo: item.cliente })}>
                        Continuar
                      </Button>
                    </View>
                    <Pressable
                      onPress={() => abrirNavegacion(item.ubicacion)}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: tokens.radius.pill,
                        borderWidth: 1,
                        borderColor: tokens.color.divider,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Navigation size={20} strokeWidth={2.75} color={marca.base} />
                    </Pressable>
                  </View>
                ) : null}
              </Card>
            </View>
          );
        }}
      />
    </View>
  );
}
