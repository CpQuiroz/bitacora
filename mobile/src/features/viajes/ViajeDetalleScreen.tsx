import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Linking, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowLeft, Camera, Map, Navigation, Pencil, RefreshCw, X } from "lucide-react-native";
import type { EstadoViaje } from "@bitacora/shared";
import { formatearFolio } from "@bitacora/shared";
import { tokens } from "@bitacora/design-tokens";
import { Button, Card, ErrorState, LoadingState, ScreenHeader, Skeleton, StatusBadge, Texto } from "@bitacora/ui/native";
import { pesos } from "../../lib/plata";
import { OfflineBanner } from "../../components/OfflineBanner";
import { useRed } from "../../services/sync/NetworkProvider";
import { useAuth } from "../auth/AuthContext";
import { elegirFotos } from "../../lib/imagen";
import { aprobarViaje, eliminarFotoViaje, encolarFotoViaje, obtenerViaje, rechazarViaje, type ViajeDetalle } from "../../services/viajes";
import type { ViajesStackParamList } from "../../shell/navigation/types";

const NOTA_ESTADO: Record<EstadoViaje, string> = {
  borrador: "La oficina todavía no lo revisa.",
  confirmado: "Revisado y confirmado por la oficina.",
  facturado: "Facturado al cliente.",
};

// Mismo mapeo que ViajesScreen.tsx — "borrador"/"confirmado"/"facturado"
// no son de los 4 tonos default de StatusBadge, se fuerza a mano.
const TONO_VIAJE: Record<string, "en_progreso" | "completado" | "cerrado"> = {
  borrador: "en_progreso",
  confirmado: "completado",
  facturado: "cerrado",
};

function abrirEnMapa(app: "google" | "waze", origen: string, destino: string) {
  const o = encodeURIComponent(origen);
  const d = encodeURIComponent(destino);
  const url =
    app === "waze"
      ? `https://waze.com/ul?q=${d}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=driving`;
  Linking.openURL(url).catch(() => Alert.alert("No se pudo abrir", "Revisa que tengas la app instalada."));
}

// Sistema visual móvil v2 (14-sep-2026) — ScreenHeader propio (volver) +
// tokens/Texto/Card/StatusBadge en vez de useTema()/components-ui viejo.
export function ViajeDetalleScreen({ route, navigation }: NativeStackScreenProps<ViajesStackParamList, "ViajeDetalle">) {
  const { viajeId } = route.params;
  const { enLinea, pendientes } = useRed();
  const auth = useAuth();

  const fotosEnCola = pendientes.filter((a) => a.recurso === `viaje:${viajeId}` && a.etiqueta === "Foto de viaje");
  const esGestion = auth.fase === "listo" && auth.usuario.rol !== "colaborador";

  const [viaje, setViaje] = useState<ViajeDetalle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardadoEn, setGuardadoEn] = useState<number | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [eliminandoFotoId, setEliminandoFotoId] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const r = await obtenerViaje(viajeId);
      setViaje(r.viaje);
      setGuardadoEn(r.desdeCache ? r.guardadoEn : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el viaje");
    }
  }, [viajeId]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useFocusEffect(useCallback(() => void cargar(), [cargar]));

  // Cuando una foto sale de la cola, refrescamos para traer la del servidor.
  useEffect(() => {
    void cargar();
  }, [fotosEnCola.length, cargar]);

  async function agregarFoto() {
    const [elegida] = await elegirFotos({ titulo: "Foto del viaje" });
    if (!elegida) return;
    await encolarFotoViaje(viajeId, elegida);
  }

  function confirmarEliminarFoto(fotoId: string) {
    Alert.alert("Eliminar foto", "¿Eliminar esta foto del viaje?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para eliminar una foto.");
          setEliminandoFotoId(fotoId);
          const res = await eliminarFotoViaje(viajeId, fotoId);
          setEliminandoFotoId(null);
          if (!res.ok) return Alert.alert("No se pudo eliminar", res.error);
          void cargar();
        },
      },
    ]);
  }

  async function aprobar() {
    if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para aprobar un viaje.");
    setOcupado(true);
    const r = await aprobarViaje(viajeId);
    setOcupado(false);
    if (!r.ok) return Alert.alert("No se pudo aprobar", r.error ?? "Intenta de nuevo.");
    cargar();
  }

  function rechazar() {
    Alert.alert("Rechazar el viaje", "Se elimina de la lista. El chofer tendrá que registrarlo de nuevo si corresponde.", [
      { text: "No", style: "cancel" },
      {
        text: "Sí, rechazar",
        style: "destructive",
        onPress: async () => {
          if (!enLinea) return Alert.alert("Sin conexión", "Necesitas conexión para rechazar un viaje.");
          setOcupado(true);
          const r = await rechazarViaje(viajeId);
          setOcupado(false);
          if (!r.ok) return Alert.alert("No se pudo rechazar", r.error ?? "Intenta de nuevo.");
          navigation.goBack();
        },
      },
    ]);
  }

  const volver = { icono: <ArrowLeft size={20} strokeWidth={2.5} color={tokens.color.text} />, onPress: () => navigation.goBack(), etiquetaAccesible: "Volver" };

  if (!viaje && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Viaje" accion={volver} />
        <View style={{ padding: tokens.space["4"], gap: tokens.space["3"] }}>
          <LoadingState>
            <Skeleton alto={80} radio={16} />
            <Skeleton alto={140} radio={16} />
          </LoadingState>
        </View>
      </View>
    );
  }
  if (error && !viaje) {
    return (
      <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
        <ScreenHeader titulo="Viaje" accion={volver} />
        <ErrorState mensaje={error} onReintentar={cargar} />
      </View>
    );
  }
  if (!viaje) return null;

  const kmRecorridos =
    viaje.km_inicial != null && viaje.km_final != null ? viaje.km_final - viaje.km_inicial : null;

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.bg }}>
      <ScreenHeader
        antetitulo={`${formatearFolio("VIA", viaje.folio) ? `${formatearFolio("VIA", viaje.folio)} · ` : ""}${viaje.fecha} · Guía ${viaje.numero_guia}`}
        titulo={viaje.cliente_info?.nombre ?? viaje.cliente}
        accion={volver}
      />
      <OfflineBanner guardadoEn={guardadoEn} />
      <ScrollView contentContainerStyle={{ padding: tokens.space["4"], gap: tokens.space["4"], paddingBottom: tokens.space["8"] * 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space["3"] }}>
          <StatusBadge estado={viaje.estado} etiqueta={viaje.estado} tonoForzado={TONO_VIAJE[viaje.estado]} />
        </View>
        <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
          {esGestion && viaje.chofer?.nombre ? `Chofer: ${viaje.chofer.nombre} · ` : ""}
          {NOTA_ESTADO[viaje.estado]}
        </Texto>

        <Card>
          <View style={{ gap: tokens.space["2"] }}>
            <Fila etiqueta="Origen" valor={viaje.origen} />
            <Fila etiqueta="Destino" valor={viaje.destino} />
            {viaje.equipo_info ? (
              <Fila
                etiqueta="Vehículo"
                valor={`${viaje.equipo_info.nombre}${viaje.equipo_info.patente ? ` · ${viaje.equipo_info.patente}` : ""}`}
              />
            ) : null}
            {viaje.km_inicial != null ? <Fila etiqueta="Km inicial" valor={String(viaje.km_inicial)} /> : null}
            {viaje.km_final != null ? <Fila etiqueta="Km final" valor={String(viaje.km_final)} /> : null}
            {kmRecorridos != null ? <Fila etiqueta="Km recorridos" valor={String(kmRecorridos)} /> : null}
            <View style={{ flexDirection: "row", gap: tokens.space["2"], marginTop: tokens.space["1"] }}>
              <Button
                variante="secundario"
                iconoIzq={<Map size={16} strokeWidth={2.25} color={tokens.color.text} />}
                onPress={() => abrirEnMapa("google", viaje.origen, viaje.destino)}
              >
                Google Maps
              </Button>
              <Button
                variante="secundario"
                iconoIzq={<Navigation size={16} strokeWidth={2.25} color={tokens.color.text} />}
                onPress={() => abrirEnMapa("waze", viaje.origen, viaje.destino)}
              >
                Waze
              </Button>
            </View>
          </View>
        </Card>

        <Card>
          <View style={{ gap: tokens.space["2"] }}>
            <Fila etiqueta="Monto (sin IVA)" valor={pesos(viaje.subtotal)} />
            {viaje.aplica_iva ? <Fila etiqueta="IVA (19%)" valor={pesos(viaje.iva)} /> : null}
            <Fila etiqueta="Total" valor={pesos(viaje.total)} destacado />
          </View>
        </Card>

        {viaje.comentarios ? (
          <Card>
            <View style={{ gap: tokens.space["2"] }}>
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
                Comentarios de la oficina
              </Texto>
              <Texto tamano={tokens.size.body} color={tokens.color.text}>
                {viaje.comentarios}
              </Texto>
            </View>
          </Card>
        ) : null}

        {/* Fotos del viaje (guía + adicionales del chofer) */}
        {(() => {
          const subidas = [
            ...(viaje.foto_guia_url_firmada ? [{ id: "guia", url: viaje.foto_guia_url_firmada }] : []),
            ...(viaje.fotos ?? []),
          ];
          const total = subidas.length + fotosEnCola.length;
          return (
            <Card>
              <View style={{ gap: tokens.space["3"] }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
                    Fotos del viaje
                  </Texto>
                  {total > 0 ? (
                    <Texto tamano={tokens.size.caption} color={`${tokens.color.text}66`} style={{ fontVariant: ["tabular-nums"] }}>
                      {subidas.length} subida{subidas.length === 1 ? "" : "s"}
                      {fotosEnCola.length ? ` · ${fotosEnCola.length} en cola` : ""}
                    </Texto>
                  ) : null}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: tokens.space["2"] }}>
                  {subidas.map((f) => (
                    <View key={f.id} style={{ width: 78, height: 78 }}>
                      <Image source={{ uri: f.url }} style={{ width: 78, height: 78, borderRadius: tokens.radius.sm, borderWidth: 1, borderColor: tokens.color.divider }} />
                      {f.id !== "guia" && viaje.estado !== "facturado" ? (
                        <Pressable
                          onPress={() => confirmarEliminarFoto(f.id)}
                          disabled={eliminandoFotoId === f.id}
                          hitSlop={8}
                          style={{
                            position: "absolute",
                            right: -6,
                            top: -6,
                            width: 22,
                            height: 22,
                            borderRadius: 11,
                            backgroundColor: tokens.color.accentRamp["700"],
                            alignItems: "center",
                            justifyContent: "center",
                            opacity: eliminandoFotoId === f.id ? 0.6 : 1,
                          }}
                        >
                          <X size={13} strokeWidth={2.5} color="#ffffff" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                  {fotosEnCola.map((a) => (
                    <View key={a.id} style={{ width: 78, height: 78, borderRadius: tokens.radius.sm, backgroundColor: tokens.color.neutral["200"], borderWidth: 1, borderColor: tokens.color.divider, alignItems: "center", justifyContent: "center" }}>
                      <RefreshCw size={16} strokeWidth={2.25} color={tokens.color.accent} />
                    </View>
                  ))}
                  {viaje.estado !== "facturado" ? (
                    <Pressable
                      onPress={agregarFoto}
                      style={{ width: 78, height: 78, borderRadius: tokens.radius.sm, borderWidth: 1.5, borderStyle: "dashed", borderColor: `${tokens.color.text}33`, alignItems: "center", justifyContent: "center" }}
                    >
                      <Camera size={22} strokeWidth={2} color={`${tokens.color.text}66`} />
                    </Pressable>
                  ) : null}
                </ScrollView>
                {total === 0 ? (
                  <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`}>
                    Sin fotos todavía.
                  </Texto>
                ) : null}
              </View>
            </Card>
          );
        })()}

        {viaje.estado !== "facturado" ? (
          <View style={{ gap: tokens.space["3"], marginTop: tokens.space["1"], borderTopWidth: 1, borderTopColor: tokens.color.divider, paddingTop: tokens.space["4"] }}>
            {esGestion ? (
              <Texto tamano={tokens.size.caption} color={`${tokens.color.text}99`} peso="semibold" style={{ textTransform: "uppercase", letterSpacing: 1 }}>
                Gestión
              </Texto>
            ) : null}
            {esGestion && viaje.estado === "borrador" ? (
              <Button tamano="lg" bloque onPress={aprobar} cargando={ocupado}>
                Aprobar viaje
              </Button>
            ) : null}
            <Button
              variante="secundario"
              bloque
              iconoIzq={<Pencil size={16} strokeWidth={2.25} color={tokens.color.text} />}
              onPress={() => navigation.navigate("ViajeForm", { viajeId })}
            >
              Editar
            </Button>
            {esGestion && viaje.estado === "borrador" ? (
              <Button variante="peligro" bloque onPress={rechazar} cargando={ocupado}>
                Rechazar viaje
              </Button>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Fila({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: tokens.space["3"] }}>
      <Texto tamano={tokens.size.small} color={`${tokens.color.text}99`}>
        {etiqueta}
      </Texto>
      <Texto
        tamano={destacado ? tokens.size.h5 : tokens.size.small}
        peso={destacado ? "semibold" : "medium"}
        color={tokens.color.text}
        style={{ flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] }}
      >
        {valor}
      </Texto>
    </View>
  );
}
