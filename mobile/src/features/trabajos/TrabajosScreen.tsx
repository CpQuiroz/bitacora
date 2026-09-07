import { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Platform, Pressable, RefreshControl, SectionList, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { EstadoOS, EstadoTrabajo } from "@bitacora/shared";
import { estadoOsDeTrabajo } from "@bitacora/shared";
import { useTema } from "../../theme";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingScreen, Text } from "../../components/ui";
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

export function TrabajosScreen({ navigation }: NativeStackScreenProps<TrabajosStackParamList, "TrabajosLista">) {
  const t = useTema();
  const auth = useAuth();
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
    <View style={{ flexDirection: "row", gap: t.espacio(2), padding: t.espacio(4), paddingBottom: t.espacio(2) }}>
      {(["lista", "mapa"] as const).map((v) => {
        const activo = vista === v;
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
              gap: t.espacio(2),
              borderRadius: t.radio.md,
              backgroundColor: activo ? t.colores.brand : t.colores.surface,
              borderWidth: 1,
              borderColor: activo ? t.colores.brand : t.colores.border,
            }}
          >
            <Ionicons name={v === "lista" ? "list-outline" : "map-outline"} size={16} color={activo ? t.colores.brandForeground : t.colores.muted} />
            <Text variante="etiqueta" weight="semibold" tono={activo ? "inverso" : "muted"}>
              {v === "lista" ? "Lista" : "Mapa"}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (vista === "mapa") {
    return (
      <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
        {toggleVista}
        <TrabajosMapa onVerOS={(trabajoId) => navigation.navigate("TrabajoDetalle", { trabajoId })} />
      </View>
    );
  }

  const encabezado = (
    <View style={{ backgroundColor: t.colores.brand, padding: t.espacio(5), gap: t.espacio(3) }}>
      <View>
        <Text variante="titulo" tono="inverso">
          {formatearFechaLarga(HOY())}
        </Text>
        <Text variante="caption" style={{ color: t.colores.brandSoft }}>
          {[empresaNombre, usuarioNombre].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
        {[
          { k: "Pendientes", v: String(contadores.pendientes) },
          { k: "Listas", v: String(contadores.listas) },
          { k: "Km por recorrer", v: kmRuta == null ? "—" : String(kmRuta) },
        ].map((c) => (
          <View
            key={c.k}
            style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: t.radio.md, padding: t.espacio(3), gap: 2 }}
          >
            <Text variante="cifra" tono="inverso" style={{ fontSize: 22 }}>
              {c.v}
            </Text>
            <Text style={{ color: t.colores.brandSoft, fontSize: 11 }}>{c.k}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  if (trabajos === null && !error)
    return (
      <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
        {toggleVista}
        <LoadingScreen />
      </View>
    );
  if (error && !trabajos)
    return (
      <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
        {toggleVista}
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: t.colores.bg }}>
      <OfflineBanner guardadoEn={guardadoEn} />
      {toggleVista}
      {esGestion && (
        <View style={{ paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(2), gap: t.espacio(2) }}>
          <Button titulo="Nuevo trabajo" onPress={() => navigation.navigate("TrabajoForm")} />
          <View style={{ flexDirection: "row", gap: t.espacio(2) }}>
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
                    borderRadius: t.radio.md,
                    backgroundColor: activo ? t.colores.brand : t.colores.surface,
                    borderWidth: 1,
                    borderColor: activo ? t.colores.brand : t.colores.border,
                  }}
                >
                  <Text variante="etiqueta" weight="semibold" tono={activo ? "inverso" : "muted"}>
                    {op}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
      <SectionList
        sections={secciones}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: t.espacio(10), flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={t.colores.brand} />}
        ListHeaderComponent={encabezado}
        ListEmptyComponent={
          <View style={{ padding: t.espacio(4) }}>
            <EmptyState
              icono={<Ionicons name="clipboard-outline" size={40} color={t.colores.faint} />}
              titulo="Sin trabajos"
              mensaje={equipo ? "El equipo no tiene trabajos asignados." : "No tienes trabajos asignados."}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text
            mono
            weight="semibold"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              color: t.colores.faint,
              paddingHorizontal: t.espacio(4),
              paddingTop: t.espacio(4),
              paddingBottom: t.espacio(2),
            }}
          >
            {section.titulo}
          </Text>
        )}
        renderItem={({ item }) => {
          const estadoOs = item.orden?.estado_os ?? estadoOsDeTrabajo(item.estado as EstadoTrabajo);
          const enCurso = estadoOs === "en_proceso";
          const firmada = estadoOs === "firmada";
          return (
            <View style={{ paddingHorizontal: t.espacio(4), paddingBottom: t.espacio(3), opacity: firmada ? 0.68 : 1 }}>
              <Card
                onPress={() => navigation.navigate("TrabajoDetalle", { trabajoId: item.id, titulo: item.cliente })}
                style={enCurso ? { borderLeftWidth: 4, borderLeftColor: t.colores.accent } : undefined}
              >
                <View style={{ flexDirection: "row", gap: t.espacio(3) }}>
                  <Text mono weight="semibold" style={{ width: 46, fontSize: 15 }}>
                    {item.hora_programada ? item.hora_programada.slice(0, 5) : "--:--"}
                  </Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight="semibold" style={{ fontSize: 16.5 }} numberOfLines={1}>
                      {item.cliente}
                    </Text>
                    {item.ubicacion ? (
                      <Text variante="caption" tono="muted" numberOfLines={1}>
                        {item.ubicacion}
                      </Text>
                    ) : null}
                    {item.orden?.folio != null ? (
                      <Text mono variante="caption" tono="muted">
                        OS N° {item.orden.folio}
                      </Text>
                    ) : null}
                  </View>
                  <Badge estado={estadoOs} texto={ETIQUETA_OS[estadoOs] ?? estadoOs} />
                </View>

                {enCurso ? (
                  <View style={{ flexDirection: "row", gap: t.espacio(2), marginTop: t.espacio(3) }}>
                    <Button
                      titulo="Continuar"
                      variante="acento"
                      onPress={() => navigation.navigate("TrabajoDetalle", { trabajoId: item.id, titulo: item.cliente })}
                      style={{ flex: 1 }}
                    />
                    <Pressable
                      onPress={() => abrirNavegacion(item.ubicacion)}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: t.radio.md,
                        borderWidth: 1,
                        borderColor: t.colores.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="navigate" size={20} color={t.colores.brand} />
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
